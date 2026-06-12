-- ============================================================
-- CRITICAL FIX: Attendance Table Schema Repair
-- Run this ENTIRE script in InsForge SQL Editor
-- This fixes 4 column type mismatches preventing all inserts
-- ============================================================

-- STEP 1: Drop the foreign key constraint on user_id
-- (CRM users are not stored in the Insforge users table)
ALTER TABLE attendance
  DROP CONSTRAINT IF EXISTS attendance_user_id_fkey;

-- STEP 2: Change user_id from INTEGER to TEXT
-- (CRM stores userId as Date.now() which exceeds INTEGER max)
ALTER TABLE attendance
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- STEP 3: Change login_time from TIME to TIMESTAMPTZ
-- (CRM sends full ISO timestamps like "2026-06-12T07:30:00.000Z", not just "HH:MM:SS")
ALTER TABLE attendance
  ALTER COLUMN login_time TYPE TIMESTAMPTZ USING NULL;

-- STEP 4: Change logout_time from TIME to TIMESTAMPTZ
ALTER TABLE attendance
  ALTER COLUMN logout_time TYPE TIMESTAMPTZ USING NULL;

-- STEP 5: Add work_summary column (used by submitDailyReport)
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS work_summary TEXT;

-- STEP 6: Drop old unique constraint if it exists, recreate correctly
ALTER TABLE attendance
  DROP CONSTRAINT IF EXISTS attendance_user_date_unique;

ALTER TABLE attendance
  ADD CONSTRAINT attendance_user_date_unique UNIQUE (user_id, date);

-- STEP 7: Ensure RLS is enabled with open policy (anon key must be able to insert)
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendance can do all" ON attendance;
CREATE POLICY "Attendance can do all" ON attendance FOR ALL USING (true) WITH CHECK (true);

-- STEP 8: Verify final schema (you should see these columns and types)
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'attendance'
ORDER BY ordinal_position;

-- STEP 9: Verify no blocking constraints remain
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'attendance'::regclass;
