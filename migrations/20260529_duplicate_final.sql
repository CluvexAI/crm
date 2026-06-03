-- ============================================================
-- DUPLICATE LEAD PREVENTION — COMPLETE FINAL SQL
-- Run this ONCE in InsForge SQL Editor
-- ============================================================

-- STEP 1: Create audit log table for duplicate blocks
-- (includes all required fields per business requirements)
CREATE TABLE IF NOT EXISTS lead_duplicate_blocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_by      TEXT,
  attempted_data    JSONB,
  matched_lead_id   UUID,
  matched_on        TEXT,
  matched_value     TEXT,
  days_remaining    INTEGER,
  blocked_at        TIMESTAMP DEFAULT NOW()
);

-- STEP 2: Create performance indexes on leads table
-- Index on normalized phone (digit-only, leading-zero-stripped)
CREATE INDEX IF NOT EXISTS idx_leads_phone_norm
  ON leads (LTRIM(REGEXP_REPLACE(owner_phone, '\D', '', 'g'), '0'));

-- Index on normalized email
CREATE INDEX IF NOT EXISTS idx_leads_email_norm
  ON leads (LOWER(TRIM(email)));

-- Index on last_follow_up date
CREATE INDEX IF NOT EXISTS idx_leads_last_follow_up
  ON leads (last_follow_up);

-- STEP 3: Create the check_duplicate_lead RPC function
-- (used by the frontend to check before showing the form)
CREATE OR REPLACE FUNCTION check_duplicate_lead(
  p_phone     TEXT,
  p_email     TEXT,
  p_website   TEXT,
  p_agent_id  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match RECORD;
  v_days_since    INTEGER;
  v_days_remaining INTEGER;
  v_matched_on    TEXT;
  v_matched_value TEXT;
BEGIN
  SELECT
    l.id,
    l.contact_name,
    l.business_name,
    l.owner_phone,
    l.email,
    l.website,
    l.status,
    l.created_by,
    l.last_follow_up,
    l.created_at,
    u.name AS owner_name,
    EXTRACT(DAY FROM (NOW() - GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at))))::INTEGER AS days_since
  INTO v_match
  FROM leads l
  LEFT JOIN users u ON u.id::TEXT = l.created_by::TEXT
  WHERE
    l.created_by::TEXT != p_agent_id
    AND l.status NOT IN ('Closed (Lost)', 'closed_lost', 'rejected')
    AND GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at)) >= NOW() - INTERVAL '30 days'
    AND (
      -- Phone match: strip all non-digits, strip leading zeros, check suffix
      (
        p_phone IS NOT NULL AND p_phone != '' AND
        l.owner_phone IS NOT NULL AND l.owner_phone != '' AND
        (
          LTRIM(REGEXP_REPLACE(l.owner_phone, '\D', '', 'g'), '0') =
          LTRIM(REGEXP_REPLACE(p_phone, '\D', '', 'g'), '0')
          OR
          LTRIM(REGEXP_REPLACE(l.owner_phone, '\D', '', 'g'), '0') LIKE
            '%' || LTRIM(REGEXP_REPLACE(p_phone, '\D', '', 'g'), '0')
          OR
          LTRIM(REGEXP_REPLACE(p_phone, '\D', '', 'g'), '0') LIKE
            '%' || LTRIM(REGEXP_REPLACE(l.owner_phone, '\D', '', 'g'), '0')
        )
      )
      OR
      -- Email match: case-insensitive, trimmed
      (
        p_email IS NOT NULL AND p_email != '' AND
        l.email IS NOT NULL AND l.email != '' AND
        LOWER(TRIM(l.email)) = LOWER(TRIM(p_email))
      )
      OR
      -- Website match: strip protocol, www, trailing slash
      (
        p_website IS NOT NULL AND p_website != '' AND
        l.website IS NOT NULL AND l.website != '' AND
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(l.website), '^https?://(www\.)?', ''), '/.*$', '')) =
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(p_website), '^https?://(www\.)?', ''), '/.*$', ''))
      )
    )
  ORDER BY GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at)) DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('isDuplicate', false);
  END IF;

  v_days_since    := v_match.days_since;
  v_days_remaining := GREATEST(0, 30 - v_days_since);

  -- Determine what field matched
  IF p_phone IS NOT NULL AND p_phone != '' AND
     LTRIM(REGEXP_REPLACE(v_match.owner_phone, '\D', '', 'g'), '0') =
     LTRIM(REGEXP_REPLACE(p_phone, '\D', '', 'g'), '0')
  THEN
    v_matched_on    := 'phone';
    v_matched_value := v_match.owner_phone;
  ELSIF p_email IS NOT NULL AND p_email != '' AND LOWER(TRIM(v_match.email)) = LOWER(TRIM(p_email)) THEN
    v_matched_on    := 'email';
    v_matched_value := v_match.email;
  ELSE
    v_matched_on    := 'website';
    v_matched_value := v_match.website;
  END IF;

  RETURN jsonb_build_object(
    'isDuplicate',         true,
    'lead_id',             v_match.id,
    'lead_name',           COALESCE(v_match.business_name, v_match.contact_name, 'Unknown'),
    'matched_on',          v_matched_on,
    'matched_value',       v_matched_value,
    'owner_agent_name',    COALESCE(v_match.owner_name, 'Unknown Agent'),
    'days_since_activity', v_days_since,
    'days_remaining',      v_days_remaining,
    'message',             'Lead already exists and is under active follow-up by another Sales Agent User within the last 30 days.'
  );
END;
$$;

-- STEP 4: Hard block trigger (NO admin bypass — applies to ALL users)
CREATE OR REPLACE FUNCTION enforce_duplicate_lead_block()
RETURNS TRIGGER AS $$
DECLARE
  v_match RECORD;
  v_days_remaining INTEGER;
BEGIN
  -- On UPDATE: only check if contact fields changed
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_phone IS NOT DISTINCT FROM OLD.owner_phone
       AND NEW.email IS NOT DISTINCT FROM OLD.email
       AND NEW.website IS NOT DISTINCT FROM OLD.website THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Skip closed leads
  IF NEW.status IN ('Closed (Lost)', 'closed_lost', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Find a duplicate from ANOTHER agent within 30 days
  SELECT
    l.id,
    GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at)) AS last_activity
  INTO v_match
  FROM leads l
  WHERE
    l.id IS DISTINCT FROM NEW.id
    AND l.created_by::TEXT != NEW.created_by::TEXT
    AND l.status NOT IN ('Closed (Lost)', 'closed_lost', 'rejected')
    AND GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at)) >= NOW() - INTERVAL '30 days'
    AND (
      (
        NEW.owner_phone IS NOT NULL AND NEW.owner_phone != '' AND
        l.owner_phone IS NOT NULL AND l.owner_phone != '' AND
        LTRIM(REGEXP_REPLACE(l.owner_phone, '\D', '', 'g'), '0') =
        LTRIM(REGEXP_REPLACE(NEW.owner_phone, '\D', '', 'g'), '0')
      )
      OR
      (
        NEW.email IS NOT NULL AND NEW.email != '' AND
        l.email IS NOT NULL AND l.email != '' AND
        LOWER(TRIM(l.email)) = LOWER(TRIM(NEW.email))
      )
      OR
      (
        NEW.website IS NOT NULL AND NEW.website != '' AND
        l.website IS NOT NULL AND l.website != '' AND
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(l.website), '^https?://(www\.)?', ''), '/.*$', '')) =
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(NEW.website), '^https?://(www\.)?', ''), '/.*$', ''))
      )
    )
  ORDER BY last_activity DESC
  LIMIT 1;

  IF FOUND THEN
    v_days_remaining := GREATEST(0, 30 - EXTRACT(DAY FROM (NOW() - v_match.last_activity))::INTEGER);

    -- Log the blocked attempt
    INSERT INTO lead_duplicate_blocks (
      attempted_by, matched_lead_id, matched_on, matched_value, days_remaining, blocked_at, attempted_data
    ) VALUES (
      NEW.created_by::TEXT,
      v_match.id,
      'trigger_block',
      COALESCE(NEW.owner_phone, NEW.email, NEW.website, ''),
      v_days_remaining,
      NOW(),
      jsonb_build_object(
        'owner_phone', NEW.owner_phone,
        'email', NEW.email,
        'website', NEW.website,
        'contact_name', NEW.contact_name,
        'business_name', NEW.business_name
      )
    );

    RAISE EXCEPTION 'DUPLICATE_LEAD: Lead already exists and is under active follow-up by another Sales Agent User within the last 30 days. Available in % day(s).', v_days_remaining;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger (DROP first in case it exists from old version)
DROP TRIGGER IF EXISTS trg_enforce_duplicate_lead_block ON leads;
CREATE TRIGGER trg_enforce_duplicate_lead_block
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION enforce_duplicate_lead_block();

-- STEP 5: Verify setup
SELECT 'check_duplicate_lead function' AS item, COUNT(*)::TEXT AS status
  FROM pg_proc WHERE proname = 'check_duplicate_lead'
UNION ALL
SELECT 'trg_enforce_duplicate_lead_block trigger', COUNT(*)::TEXT
  FROM pg_trigger WHERE tgname = 'trg_enforce_duplicate_lead_block'
UNION ALL
SELECT 'lead_duplicate_blocks table', COUNT(*)::TEXT
  FROM information_schema.tables WHERE table_name = 'lead_duplicate_blocks';
-- All 3 rows must show status = 1
