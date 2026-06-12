-- ============================================================
-- FIX: permission denied for sequence attendance_id_seq
-- Error code: 42501
--
-- The anon role (used by Insforge SDK) cannot use the SERIAL
-- sequence to generate the `id` column.
--
-- SOLUTION: Replace INTEGER SERIAL with UUID primary key.
-- UUID uses gen_random_uuid() — no sequence, no permission issue.
--
-- Run this ENTIRE script in Insforge SQL Editor.
-- ============================================================

-- STEP 1: Drop the old attendance table and recreate with UUID id
-- (safe — table is empty, 0 records confirmed by audit)
DROP TABLE IF EXISTS attendance CASCADE;

-- STEP 2: Recreate with UUID primary key (no sequence dependency)
CREATE TABLE attendance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  user_name     TEXT,
  date          DATE NOT NULL,
  login_time    TIMESTAMPTZ,
  logout_time   TIMESTAMPTZ,
  breaks        JSONB DEFAULT '[]'::jsonb,
  meetings      JSONB DEFAULT '[]'::jsonb,
  work_summary  TEXT,
  status        TEXT DEFAULT 'Present',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT attendance_user_date_unique UNIQUE (user_id, date)
);

-- STEP 3: Enable Row Level Security
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create open RLS policy (anon role can read/write)
DROP POLICY IF EXISTS "Attendance can do all" ON attendance;
CREATE POLICY "Attendance can do all" ON attendance
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- STEP 5: Grant table permissions to anon role explicitly
GRANT ALL ON TABLE attendance TO anon;

-- STEP 6: Verify the table was created correctly
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'attendance'
ORDER BY ordinal_position;
