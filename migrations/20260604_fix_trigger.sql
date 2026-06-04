-- Fix for guard_duplicate_crm_leads to properly handle TG_OP
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
    (TG_OP = 'INSERT' OR id != NEW.id) -- Crucial fix: only exclude NEW.id on UPDATE
    AND deleted_at IS NULL
    AND status NOT IN ('Closed (Lost)', 'closed_lost', 'rejected')
    AND GREATEST(created_at, COALESCE(last_follow_up, created_at)) >= NOW() - INTERVAL '30 days'
    AND (
      (v_norm_phone IS NOT NULL AND v_norm_phone != '' AND normalize_phone_last10(owner_phone) = v_norm_phone)
      OR
      (v_norm_email IS NOT NULL AND v_norm_email != '' AND LOWER(TRIM(email)) = v_norm_email)
      OR
      (v_norm_website IS NOT NULL AND v_norm_website != '' AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(website, '^https?://(www\.)?', ''), '/$', '')) = v_norm_website)
    )
  ORDER BY GREATEST(created_at, COALESCE(last_follow_up, created_at)) DESC
  LIMIT 1;

  -- If a match is found, BLOCK the insert/update by raising an exception
  IF FOUND THEN
    RAISE EXCEPTION 'DUPLICATE_LEAD_DETECTED: Lead already owned by % (Last activity % days ago)', 
      COALESCE(v_match.created_by_name, 'another agent'), v_match.days_since_activity;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
