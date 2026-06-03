-- ================================================================
-- DELETE ALL 6 MOCK USERS FROM INSFORGE CLOUD DB
-- Run each statement one at a time in InsForge SQL Editor
-- ================================================================

-- STEP 1: Delete mock leads that reference mock users (created_by 2 or 5)
-- (These are the 2 sample leads Rohan Mehta & Deepak Kumar)
DELETE FROM leads WHERE created_by IN (1,2,3,4,5,6);

-- STEP 2: Delete mock sales referencing mock users
DELETE FROM sales WHERE closed_by IN (1,2,3,4,5,6);

-- STEP 3: Delete mock invoices (no FK but clean up)
DELETE FROM invoices WHERE id IN ('INV-2026-001','INV-2026-002');

-- STEP 4: Delete the 6 mock users
DELETE FROM users WHERE id IN (1,2,3,4,5,6);

-- STEP 5: Verify — must return 0 rows
SELECT id, name, email FROM users WHERE id IN (1,2,3,4,5,6);
-- Must return: 0 rows

-- STEP 6: Confirm total remaining users
SELECT id, name, email, role, status FROM users ORDER BY name;
-- Must return only your real agents
