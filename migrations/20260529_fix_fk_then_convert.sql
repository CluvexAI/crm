-- ================================================================
-- COMPLETE FIX: Drop FK constraint, convert types, re-add constraint
-- Run this ENTIRE block in InsForge SQL Editor at once
-- ================================================================

-- STEP 1: Drop all foreign key constraints on leads that reference users
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_created_by_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey;

-- Also drop any other FK constraints that may exist on leads
-- (run this to find them all first if needed)
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_name = 'leads' AND constraint_type = 'FOREIGN KEY';

-- STEP 2: Convert users.id to TEXT first (leads.created_by references it)
ALTER TABLE users ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- STEP 3: Now convert leads columns
ALTER TABLE leads ALTER COLUMN created_by  TYPE TEXT USING created_by::TEXT;
ALTER TABLE leads ALTER COLUMN assigned_to TYPE TEXT USING assigned_to::TEXT;

-- STEP 4: Re-add the foreign key constraints (now TEXT → TEXT)
ALTER TABLE leads
  ADD CONSTRAINT leads_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE leads
  ADD CONSTRAINT leads_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- STEP 5: Verify — all 3 must show data_type = 'text'
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE (table_name = 'leads'  AND column_name IN ('created_by','assigned_to'))
   OR (table_name = 'users'  AND column_name = 'id')
ORDER BY table_name, column_name;
