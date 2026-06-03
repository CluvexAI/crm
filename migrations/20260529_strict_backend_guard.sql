-- 20260529_strict_backend_guard.sql
-- ZERO-BYPASS BACKEND GUARD FOR DUPLICATE LEADS

-- 1. Ensure deleted_at column exists
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 2. Create the exact last-10-digit normalizer
CREATE OR REPLACE FUNCTION normalize_phone_last10(p_phone TEXT) RETURNS TEXT AS $$
DECLARE
  v_digits TEXT;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN RETURN NULL; END IF;
  
  -- Strip all non-numeric characters
  v_digits := REGEXP_REPLACE(p_phone, '\D', '', 'g');
  
  -- Handle common international dialing mistakes (Country Code + Trunk Prefix 0)
  IF v_digits LIKE '3530%' THEN
    v_digits := '353' || SUBSTRING(v_digits FROM 5);
  ELSIF v_digits LIKE '440%' THEN
    v_digits := '44' || SUBSTRING(v_digits FROM 4);
  ELSIF v_digits LIKE '610%' THEN
    v_digits := '61' || SUBSTRING(v_digits FROM 4);
  END IF;

  -- Strip all leading zeros
  v_digits := LTRIM(v_digits, '0');
  
  -- Return up to the last 10 digits
  IF LENGTH(v_digits) > 10 THEN
    RETURN RIGHT(v_digits, 10);
  END IF;
  
  RETURN v_digits;
END;
$$ LANGUAGE plpgsql;

-- 3. Create the ironclad trigger function
CREATE OR REPLACE FUNCTION guard_duplicate_crm_leads()
RETURNS TRIGGER AS $$
DECLARE
  v_match RECORD;
  v_days_since INTEGER;
  v_norm_phone TEXT;
  v_norm_email TEXT;
  v_norm_website TEXT;
BEGIN
  -- Normalize incoming data
  v_norm_phone := normalize_phone_last10(NEW.owner_phone);
  v_norm_email := LOWER(TRIM(NEW.email));
  v_norm_website := LOWER(REGEXP_REPLACE(REGEXP_REPLACE(NEW.website, '^https?://(www\.)?', ''), '/$', ''));

  -- Skip check if all fields are empty
  IF (v_norm_phone IS NULL OR v_norm_phone = '') AND 
     (v_norm_email IS NULL OR v_norm_email = '') AND 
     (v_norm_website IS NULL OR v_norm_website = '') THEN
    RETURN NEW;
  END IF;

  -- Search for active duplicate within last 30 days
  SELECT 
    id,
    created_by,
    created_by_name,
    EXTRACT(DAY FROM (NOW() - GREATEST(created_at, COALESCE(last_follow_up, created_at))))::INTEGER AS days_since_activity
  INTO v_match
  FROM crm_leads
  WHERE 
    id != NEW.id -- In case of UPDATE
    AND deleted_at IS NULL
    AND status NOT IN ('Closed (Lost)', 'closed_lost', 'rejected')
    AND GREATEST(created_at, COALESCE(last_follow_up, created_at)) >= NOW() - INTERVAL '30 days'
    AND (
      (v_norm_phone IS NOT NULL AND normalize_phone_last10(owner_phone) = v_norm_phone)
      OR
      (v_norm_email IS NOT NULL AND v_norm_email != '' AND LOWER(TRIM(email)) = v_norm_email)
      OR
      (v_norm_website IS NOT NULL AND v_norm_website != '' AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(website, '^https?://(www\.)?', ''), '/$', '')) = v_norm_website)
    )
  ORDER BY GREATEST(created_at, COALESCE(last_follow_up, created_at)) DESC
  LIMIT 1;

  -- If a match is found, BLOCK the insert/update by raising an exception
  IF FOUND THEN
    -- The frontend specifically catches 'DUPLICATE_LEAD'
    RAISE EXCEPTION 'DUPLICATE_LEAD_DETECTED: Lead already owned by % (Last activity % days ago)', 
      COALESCE(v_match.created_by_name, 'another agent'), v_match.days_since_activity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Apply the trigger (Runs BEFORE every INSERT or UPDATE)
DROP TRIGGER IF EXISTS trigger_guard_duplicate_crm_leads ON crm_leads;
CREATE TRIGGER trigger_guard_duplicate_crm_leads
BEFORE INSERT OR UPDATE ON crm_leads
FOR EACH ROW
EXECUTE FUNCTION guard_duplicate_crm_leads();
