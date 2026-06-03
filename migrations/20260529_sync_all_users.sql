-- ================================================================
-- COMPLETE USER MIGRATION TO INSFORGE CLOUD DB
-- Run this entire block in InsForge SQL Editor
-- Migrates ALL users from mockData + real localStorage agents
-- ================================================================

-- ── Mock Data Users (EMP-007 to EMP-011 missing from cloud) ──────
INSERT INTO users (id, name, email, role, status)
VALUES
  (7, 'Neha Verma',  'neha@zsmeservices.com',      'Graphics Manager',         'Active'),
  (8, 'Rohan Desai', 'rohan.d@zsmeservices.com',   'Graphic Designer',         'Active'),
  (9, 'Kavya Sharma','kavya@zsmeservices.com',      'Junior Graphic Designer',  'Active'),
  (10,'Arun Mehta',  'arun.m@zsmeservices.com',     'Video Editor',             'Active'),
  (11,'Pooja Iyer',  'pooja@zsmeservices.com',      'Motion Graphic Designer',  'Active')
ON CONFLICT (id) DO NOTHING;

-- ── Verify mock users are now all present ─────────────────────────
SELECT id, name, email, role, status
FROM users
ORDER BY id;
-- Must return 11 rows (IDs 1-11)
