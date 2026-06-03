-- Run ONE statement at a time in InsForge SQL Editor
-- Start with this one only:

CREATE TABLE IF NOT EXISTS crm_leads (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  contact_name    TEXT,
  business_name   TEXT,
  owner_phone     TEXT,
  alt_phone       TEXT,
  website         TEXT,
  country         TEXT,
  address         TEXT,
  county          TEXT,
  email           TEXT,
  business_category TEXT,
  proposal_type   TEXT,
  company_type    TEXT,
  city            TEXT,
  status          TEXT DEFAULT 'New Lead',
  follow_up_result TEXT,
  created_by      TEXT,
  created_by_name TEXT,
  assigned_to     TEXT,
  remarks         JSONB DEFAULT '[]',
  last_follow_up  TIMESTAMP,
  followup_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
