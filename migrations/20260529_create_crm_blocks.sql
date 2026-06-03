-- Run this SECOND (after crm_leads table is created)

CREATE TABLE IF NOT EXISTS crm_duplicate_blocks (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  attempted_by  TEXT,
  attempted_by_name TEXT,
  matched_lead_id TEXT,
  matched_on    TEXT,
  matched_value TEXT,
  days_remaining INTEGER,
  blocked_at    TIMESTAMP DEFAULT NOW(),
  attempted_data JSONB
);
