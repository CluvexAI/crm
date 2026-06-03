-- 20260529_duplicate_lead_prevention.sql

-- Add missing columns to leads if not exists
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS followup_count INTEGER DEFAULT 0;

-- (website and email are already in the table per schema)

-- Create duplicate check indexes
CREATE INDEX IF NOT EXISTS idx_leads_owner_phone ON leads(owner_phone) WHERE owner_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website) WHERE website IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_website_normalized ON leads(
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(website, '^https?://(www\.)?', ''), '/$', ''))
) WHERE website IS NOT NULL;

-- Create follow-up log table
CREATE TABLE IF NOT EXISTS lead_followup_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            TEXT NOT NULL,
  followed_up_by     TEXT NOT NULL,
  followup_type      VARCHAR(100),
  notes              TEXT,
  next_followup_date DATE,
  followed_up_at     TIMESTAMP DEFAULT NOW(),
  created_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_lead_id ON lead_followup_logs(lead_id);

-- Create duplicate block log table
CREATE TABLE IF NOT EXISTS lead_duplicate_blocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_by      TEXT NOT NULL,
  matched_lead_id   TEXT NOT NULL,
  matched_on        VARCHAR(50) NOT NULL,
  matched_value     VARCHAR(255) NOT NULL,
  owner_agent_id    TEXT NOT NULL,
  last_follow_up    TIMESTAMP,
  days_remaining    INTEGER,
  blocked_at        TIMESTAMP DEFAULT NOW(),
  attempted_data    JSONB
);

-- Trigger to auto-update last_follow_up
CREATE OR REPLACE FUNCTION update_lead_last_followup()
RETURNS TRIGGER AS $$
BEGIN
  -- We update the lead using CAST to avoid type mismatch
  UPDATE leads
  SET
    last_follow_up = NOW(),
    followup_count = COALESCE(followup_count, 0) + 1
  WHERE id::TEXT = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_last_followup ON lead_followup_logs;
CREATE TRIGGER trigger_update_last_followup
AFTER INSERT ON lead_followup_logs
FOR EACH ROW
EXECUTE FUNCTION update_lead_last_followup();

-- Core Duplicate Check RPC Function
CREATE OR REPLACE FUNCTION check_duplicate_lead(
  p_phone TEXT,
  p_email TEXT,
  p_website TEXT,
  p_agent_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_match RECORD;
  v_days_since INTEGER;
  v_days_rem INTEGER;
  v_matched_on TEXT;
  v_matched_val TEXT;
  v_agent_name TEXT;
BEGIN
  -- Search for matching lead within last 30 days
  SELECT 
    l.id,
    l.contact_name,
    l.business_name,
    l.owner_phone,
    l.email,
    l.website,
    l.created_by,
    l.last_follow_up,
    l.created_at,
    u.name AS owner_name,
    EXTRACT(DAY FROM (NOW() - GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at))))::INTEGER AS days_since_activity,
    CASE
      WHEN p_phone IS NOT NULL AND p_phone != '' AND
      (
        REGEXP_REPLACE(l.owner_phone, '\D', '', 'g') = REGEXP_REPLACE(p_phone, '\D', '', 'g')
        OR
        (
          LENGTH(REGEXP_REPLACE(p_phone, '\D', '', 'g')) >= 7 AND
          LENGTH(REGEXP_REPLACE(l.owner_phone, '\D', '', 'g')) >= 7 AND
          (
            REGEXP_REPLACE(l.owner_phone, '\D', '', 'g') LIKE '%' || LTRIM(REGEXP_REPLACE(p_phone, '\D', '', 'g'), '0')
            OR
            REGEXP_REPLACE(p_phone, '\D', '', 'g') LIKE '%' || LTRIM(REGEXP_REPLACE(l.owner_phone, '\D', '', 'g'), '0')
          )
        )
      ) THEN 'phone'
      WHEN p_email IS NOT NULL AND p_email != '' AND LOWER(TRIM(l.email)) = LOWER(TRIM(p_email)) THEN 'email'
      WHEN p_website IS NOT NULL AND p_website != '' AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(l.website, '^https?://(www\.)?', ''), '/$', '')) = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(p_website, '^https?://(www\.)?', ''), '/$', '')) THEN 'website'
    END AS matched_on
  INTO v_match
  FROM leads l
  LEFT JOIN users u ON u.id::TEXT = l.created_by::TEXT OR u.uuid::TEXT = l.created_by::TEXT
  WHERE 
    l.status NOT IN ('Closed (Lost)')
    AND l.created_by::TEXT != p_agent_id
    AND (l.assigned_to IS NULL OR l.assigned_to::TEXT != p_agent_id)
    AND GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at)) >= NOW() - INTERVAL '30 days'
    AND (
      (
        p_phone IS NOT NULL AND p_phone != '' AND
        (
          REGEXP_REPLACE(l.owner_phone, '\D', '', 'g') = REGEXP_REPLACE(p_phone, '\D', '', 'g')
          OR
          (
            LENGTH(REGEXP_REPLACE(p_phone, '\D', '', 'g')) >= 7 AND
            LENGTH(REGEXP_REPLACE(l.owner_phone, '\D', '', 'g')) >= 7 AND
            (
              REGEXP_REPLACE(l.owner_phone, '\D', '', 'g') LIKE '%' || LTRIM(REGEXP_REPLACE(p_phone, '\D', '', 'g'), '0')
              OR
              REGEXP_REPLACE(p_phone, '\D', '', 'g') LIKE '%' || LTRIM(REGEXP_REPLACE(l.owner_phone, '\D', '', 'g'), '0')
            )
          )
        )
      )
      OR (p_email IS NOT NULL AND p_email != '' AND LOWER(TRIM(l.email)) = LOWER(TRIM(p_email)))
      OR (p_website IS NOT NULL AND p_website != '' AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(l.website, '^https?://(www\.)?', ''), '/$', '')) = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(p_website, '^https?://(www\.)?', ''), '/$', '')))
    )
  ORDER BY GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at)) DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{"isDuplicate": false}'::JSONB;
  END IF;

  v_days_since := v_match.days_since_activity;
  v_days_rem := GREATEST(0, 30 - v_days_since);
  
  IF v_match.matched_on = 'phone' THEN
    v_matched_val := v_match.owner_phone;
  ELSIF v_match.matched_on = 'email' THEN
    v_matched_val := v_match.email;
  ELSE
    v_matched_val := v_match.website;
  END IF;

  RETURN jsonb_build_object(
    'isDuplicate', true,
    'lead_id', v_match.id,
    'lead_name', COALESCE(v_match.business_name, v_match.contact_name),
    'matched_on', v_match.matched_on,
    'matched_value', v_matched_val,
    'owner_agent_name', COALESCE(v_match.owner_name, 'Unknown Agent'),
    'last_activity_at', GREATEST(v_match.created_at, COALESCE(v_match.last_follow_up, v_match.created_at)),
    'days_since_activity', v_days_since,
    'days_remaining', v_days_rem,
    'message', 'This lead was registered by ' || COALESCE(v_match.owner_name, 'another agent') || '. Last activity ' || v_days_since || ' day(s) ago. Available in ' || v_days_rem || ' day(s).'
  );
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- ADMIN REPORT QUERY: BLOCKED ATTEMPTS
-- ==========================================
-- SELECT 
--   b.blocked_at,
--   u_attempt.name AS attempted_by_agent,
--   b.matched_on,
--   b.matched_value,
--   l.contact_name AS original_lead,
--   u_owner.name AS owner_agent,
--   b.days_remaining
-- FROM lead_duplicate_blocks b
-- LEFT JOIN users u_attempt ON b.attempted_by = u_attempt.id::TEXT OR b.attempted_by = u_attempt.uuid::TEXT
-- LEFT JOIN leads l ON b.matched_lead_id = l.id::TEXT
-- LEFT JOIN users u_owner ON l.created_by::TEXT = u_owner.id::TEXT OR l.created_by::TEXT = u_owner.uuid::TEXT
-- ORDER BY b.blocked_at DESC;
