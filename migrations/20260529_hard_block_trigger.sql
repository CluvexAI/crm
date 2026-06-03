-- Hard Block Trigger to prevent duplicates at the database layer

-- Create a function that will run BEFORE INSERT or UPDATE on leads
CREATE OR REPLACE FUNCTION enforce_duplicate_lead_block()
RETURNS TRIGGER AS $$
DECLARE
  v_match RECORD;
  v_last_activity TIMESTAMP;
  v_days_remaining INTEGER;
  v_user_role TEXT;
BEGIN
  -- We only enforce this for new leads or if phone/email/website changes
  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_phone = OLD.owner_phone AND NEW.email = OLD.email AND NEW.website = OLD.website THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Admin users bypass duplicate restrictions
  SELECT role INTO v_user_role FROM users WHERE id = NEW.created_by;
  IF v_user_role IN ('admin', 'superadmin', 'administrator', 'manager') THEN
    RETURN NEW;
  END IF;

  -- Skip if the lead is marked as Closed/Lost (they don't block new leads)
  IF NEW.status = 'Closed (Lost)' THEN
    RETURN NEW;
  END IF;

  -- Check for duplicates within the last 30 days
  SELECT 
    l.id,
    l.created_by,
    l.assigned_to,
    GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at)) as last_activity
  INTO v_match
  FROM leads l
  WHERE 
    l.id != NEW.id
    AND l.status NOT IN ('Closed (Lost)')
    AND l.created_by::TEXT != NEW.created_by::TEXT
    AND (l.assigned_to IS NULL OR l.assigned_to::TEXT != NEW.created_by::TEXT)
    AND GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at)) >= NOW() - INTERVAL '30 days'
    AND (
      (
        NEW.owner_phone IS NOT NULL AND NEW.owner_phone != '' AND
        (
          REGEXP_REPLACE(l.owner_phone, '\D', '', 'g') = REGEXP_REPLACE(NEW.owner_phone, '\D', '', 'g')
          OR
          (
            LENGTH(REGEXP_REPLACE(NEW.owner_phone, '\D', '', 'g')) >= 7 AND
            LENGTH(REGEXP_REPLACE(l.owner_phone, '\D', '', 'g')) >= 7 AND
            (
              REGEXP_REPLACE(l.owner_phone, '\D', '', 'g') LIKE '%' || LTRIM(REGEXP_REPLACE(NEW.owner_phone, '\D', '', 'g'), '0')
              OR
              REGEXP_REPLACE(NEW.owner_phone, '\D', '', 'g') LIKE '%' || LTRIM(REGEXP_REPLACE(l.owner_phone, '\D', '', 'g'), '0')
            )
          )
        )
      )
      OR (NEW.email IS NOT NULL AND NEW.email != '' AND LOWER(TRIM(l.email)) = LOWER(TRIM(NEW.email)))
      OR (NEW.website IS NOT NULL AND NEW.website != '' AND LOWER(REGEXP_REPLACE(REGEXP_REPLACE(l.website, '^https?://(www\.)?', ''), '/$', '')) = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(NEW.website, '^https?://(www\.)?', ''), '/$', '')))
    )
  ORDER BY GREATEST(l.created_at, COALESCE(l.last_follow_up, l.created_at)) DESC
  LIMIT 1;

  -- If a match is found, RAISE EXCEPTION to hard-block the insert/update
  IF FOUND THEN
    v_days_remaining := 30 - EXTRACT(DAY FROM (NOW() - v_match.last_activity))::INTEGER;
    RAISE EXCEPTION 'DUPLICATE_LEAD: This lead is already registered by another agent. Available in % days.', v_days_remaining;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the leads table
DROP TRIGGER IF EXISTS trg_enforce_duplicate_lead_block ON leads;
CREATE TRIGGER trg_enforce_duplicate_lead_block
BEFORE INSERT OR UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION enforce_duplicate_lead_block();

-- ==========================================
-- Add Indexes for Performance Optimization
-- ==========================================
-- Index on owner_phone for fast duplicate checking
CREATE INDEX IF NOT EXISTS idx_leads_owner_phone ON leads (REGEXP_REPLACE(owner_phone, '\D', '', 'g'));
-- Index on email
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (LOWER(TRIM(email)));
-- Index on website
CREATE INDEX IF NOT EXISTS idx_leads_website ON leads (LOWER(REGEXP_REPLACE(REGEXP_REPLACE(website, '^https?://(www\.)?', ''), '/$', '')));
-- Index on last_follow_up
CREATE INDEX IF NOT EXISTS idx_leads_last_follow_up ON leads (last_follow_up);

