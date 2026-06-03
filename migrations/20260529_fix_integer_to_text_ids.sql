-- ================================================================
-- ROOT CAUSE FIX: Convert created_by / assigned_to from INTEGER to TEXT
-- so UUID strings from the React app can be stored correctly.
-- Run this entire script in InsForge SQL Editor.
-- ================================================================

-- STEP 1: Convert foreign key columns from INTEGER to TEXT
-- This is the root cause of ALL lead save failures

ALTER TABLE leads
  ALTER COLUMN created_by  TYPE TEXT USING created_by::TEXT,
  ALTER COLUMN assigned_to TYPE TEXT USING assigned_to::TEXT;

-- Verify conversion
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('created_by', 'assigned_to');
-- Must show: data_type = 'text' for both

-- STEP 2: Also convert users.id to TEXT so the duplicate check
-- JOIN between leads.created_by and users.id works correctly

ALTER TABLE users
  ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- STEP 3: Update the check_duplicate_lead function
-- to use TEXT comparison (no casting needed now)
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
  v_days_since     INTEGER;
  v_days_remaining INTEGER;
  v_matched_on     TEXT;
  v_matched_value  TEXT;
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
    EXTRACT(DAY FROM (NOW() - GREATEST(l.created_at::TIMESTAMP, COALESCE(l.last_follow_up::TIMESTAMP, l.created_at::TIMESTAMP))))::INTEGER AS days_since
  INTO v_match
  FROM leads l
  LEFT JOIN users u ON u.id = l.created_by
  WHERE
    l.created_by != p_agent_id
    AND l.status NOT IN ('Closed (Lost)', 'closed_lost', 'rejected')
    AND GREATEST(l.created_at::TIMESTAMP, COALESCE(l.last_follow_up::TIMESTAMP, l.created_at::TIMESTAMP))
        >= NOW() - INTERVAL '30 days'
    AND (
      -- Phone: strip non-digits, strip leading zeros, substring match
      (
        p_phone IS NOT NULL AND p_phone != '' AND
        l.owner_phone IS NOT NULL AND l.owner_phone != '' AND
        LTRIM(REGEXP_REPLACE(l.owner_phone, '[^0-9]', '', 'g'), '0') != '' AND
        LTRIM(REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g'), '0') != '' AND
        (
          LTRIM(REGEXP_REPLACE(l.owner_phone, '[^0-9]', '', 'g'), '0') =
          LTRIM(REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g'), '0')
          OR
          LTRIM(REGEXP_REPLACE(l.owner_phone, '[^0-9]', '', 'g'), '0') LIKE
            '%' || LTRIM(REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g'), '0')
          OR
          LTRIM(REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g'), '0') LIKE
            '%' || LTRIM(REGEXP_REPLACE(l.owner_phone, '[^0-9]', '', 'g'), '0')
        )
      )
      OR
      -- Email: case-insensitive exact match
      (
        p_email IS NOT NULL AND p_email != '' AND
        LOWER(TRIM(l.email)) = LOWER(TRIM(p_email))
      )
      OR
      -- Website: strip protocol/www/trailing slash, domain match
      (
        p_website IS NOT NULL AND p_website != '' AND
        l.website IS NOT NULL AND l.website != '' AND
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(l.website), '^https?://(www\.)?', ''), '/.*$', '')) =
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(p_website), '^https?://(www\.)?', ''), '/.*$', ''))
      )
    )
  ORDER BY GREATEST(l.created_at::TIMESTAMP, COALESCE(l.last_follow_up::TIMESTAMP, l.created_at::TIMESTAMP)) DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('isDuplicate', false);
  END IF;

  v_days_since     := v_match.days_since;
  v_days_remaining := GREATEST(0, 30 - v_days_since);

  IF p_phone IS NOT NULL AND p_phone != '' AND l.owner_phone IS NOT NULL THEN
    v_matched_on    := 'phone';
    v_matched_value := v_match.owner_phone;
  ELSIF p_email IS NOT NULL AND p_email != '' THEN
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

-- STEP 4: Rebuild the hard-block trigger with TEXT comparison
CREATE OR REPLACE FUNCTION enforce_duplicate_lead_block()
RETURNS TRIGGER AS $$
DECLARE
  v_match          RECORD;
  v_days_remaining INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_phone IS NOT DISTINCT FROM OLD.owner_phone
       AND NEW.email    IS NOT DISTINCT FROM OLD.email
       AND NEW.website  IS NOT DISTINCT FROM OLD.website THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.status IN ('Closed (Lost)', 'closed_lost', 'rejected') THEN
    RETURN NEW;
  END IF;

  SELECT
    l.id,
    GREATEST(l.created_at::TIMESTAMP, COALESCE(l.last_follow_up::TIMESTAMP, l.created_at::TIMESTAMP)) AS last_activity
  INTO v_match
  FROM leads l
  WHERE
    l.id     IS DISTINCT FROM NEW.id
    AND l.created_by != NEW.created_by
    AND l.status NOT IN ('Closed (Lost)', 'closed_lost', 'rejected')
    AND GREATEST(l.created_at::TIMESTAMP, COALESCE(l.last_follow_up::TIMESTAMP, l.created_at::TIMESTAMP))
        >= NOW() - INTERVAL '30 days'
    AND (
      (
        NEW.owner_phone IS NOT NULL AND NEW.owner_phone != '' AND
        l.owner_phone   IS NOT NULL AND l.owner_phone != '' AND
        LTRIM(REGEXP_REPLACE(l.owner_phone,   '[^0-9]', '', 'g'), '0') =
        LTRIM(REGEXP_REPLACE(NEW.owner_phone, '[^0-9]', '', 'g'), '0')
      )
      OR
      (
        NEW.email IS NOT NULL AND NEW.email != '' AND
        LOWER(TRIM(l.email)) = LOWER(TRIM(NEW.email))
      )
      OR
      (
        NEW.website IS NOT NULL AND NEW.website != '' AND
        l.website   IS NOT NULL AND l.website != '' AND
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(l.website),   '^https?://(www\.)?', ''), '/.*$', '')) =
        LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(NEW.website), '^https?://(www\.)?', ''), '/.*$', ''))
      )
    )
  ORDER BY last_activity DESC
  LIMIT 1;

  IF FOUND THEN
    v_days_remaining := GREATEST(0, 30 - EXTRACT(DAY FROM (NOW() - v_match.last_activity))::INTEGER);
    RAISE EXCEPTION 'DUPLICATE_LEAD: Lead already exists and is under active follow-up by another Sales Agent User within the last 30 days. Available in % day(s).', v_days_remaining;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_duplicate_lead_block ON leads;
CREATE TRIGGER trg_enforce_duplicate_lead_block
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION enforce_duplicate_lead_block();

-- STEP 5: Verify everything is correct
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('leads', 'users')
  AND column_name IN ('id', 'created_by', 'assigned_to')
ORDER BY table_name, column_name;
-- All must show data_type = 'text'

-- STEP 6: Test insert now works with a UUID created_by
INSERT INTO leads (
  contact_name, business_name, owner_phone, email,
  status, created_by, assigned_to
) VALUES (
  'UUID TEST LEAD', 'Test Co', '00000000001', 'uuid_test@test.com',
  'New Lead', '2eab48d9-b005-4a6b-b1bb-bfb481de316b', '2eab48d9-b005-4a6b-b1bb-bfb481de316b'
) RETURNING id, contact_name, created_by;
-- MUST succeed now

-- Clean up test
DELETE FROM leads WHERE contact_name = 'UUID TEST LEAD';
