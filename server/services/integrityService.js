/**
 * integrityService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs automatically on every backend startup and every 30 minutes.
 * Scans backend database files for ghost users and mock users, auto-purges them,
 * and ensures required production accounts are active.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TOMBSTONES_FILE = path.join(DATA_DIR, 'deleted_uuids.json');
const INTEGRITY_LOG_FILE = path.join(DATA_DIR, 'integrity_check_logs.json');
const DELETION_AUDIT_FILE = path.join(DATA_DIR, 'deletion_audit_log.json');

// Helper to read JSON safely
const readJSON = (file, def = []) => {
  try {
    if (!fs.existsSync(file)) return def;
    return JSON.parse(fs.readFileSync(file, 'utf8')) || def;
  } catch {
    return def;
  }
};

// Helper to write JSON safely
const writeJSON = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`[Integrity] Write failed for ${file}:`, e.message);
  }
};

// Server-side hard delete helper
const serverHardDeleteUser = (userId, reason) => {
  const users = readJSON(USERS_FILE, []);
  const targetIdx = users.findIndex(u => u.uuid === userId || u.id === userId);
  if (targetIdx === -1) return;

  const targetUser = users[targetIdx];
  users.splice(targetIdx, 1);
  writeJSON(USERS_FILE, users);

  // Log to deletion audit log
  const auditEntry = {
    id: `del_integrity_${Date.now()}`,
    deletedUserUuid: targetUser.uuid || targetUser.id,
    deletedUserEmail: targetUser.email,
    deletedUserName: targetUser.name || targetUser.full_name || '',
    deletedByUuid: 'system_integrity_check',
    deletedByName: 'System Integrity Daemon',
    deletionType: 'hard_delete_auto',
    deletionSource: 'system_integrity_check',
    deletionReason: reason,
    tombstoneCreated: true,
    blockResync: true,
    blockRestore: true,
    tablesClean: ['backend_users_json'],
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString()
  };

  const auditLogs = readJSON(DELETION_AUDIT_FILE, []);
  auditLogs.unshift(auditEntry);
  if (auditLogs.length > 1000) auditLogs.length = 1000;
  writeJSON(DELETION_AUDIT_FILE, auditLogs);
};

/**
 * Runs integrity checks on CRM data files
 */
const runGhostUserIntegrityCheck = async () => {
  console.log('[INTEGRITY] Starting ghost user and database consistency check...');

  let ghostsFound = 0;
  let mockUsersFound = 0;

  // Load tombstones (Array of UUID strings)
  const tombstones = readJSON(TOMBSTONES_FILE, []);
  const users = readJSON(USERS_FILE, []);

  // Also query deletion log to find deleted emails/insforge_user_ids
  const auditLogs = readJSON(DELETION_AUDIT_FILE, []);
  const tombstoneEmails = new Set();
  const tombstoneInsforgeIds = new Set();

  auditLogs.forEach(entry => {
    if (entry.deletedUserEmail) {
      tombstoneEmails.add(entry.deletedUserEmail.toLowerCase().trim());
    }
    if (entry.deletedUserUuid) {
      tombstoneInsforgeIds.add(entry.deletedUserUuid);
    }
    if (entry.deletedUserSnapshot?.insforge_user_id) {
      tombstoneInsforgeIds.add(entry.deletedUserSnapshot.insforge_user_id);
    }
  });

  tombstones.forEach(uuid => {
    tombstoneInsforgeIds.add(uuid);
  });

  // ─── CHECK 1: Find ghost users matching tombstone ────────────────────────
  // We make a copy of the users array to safely iterate and delete
  const currentUsers = [...users];
  for (const user of currentUsers) {
    const userUuid = user.uuid || user.id;
    const userEmail = user.email?.toLowerCase().trim();
    const insforgeId = user.insforge_user_id || user.insforgeUserId;

    // Safeguard: Never classify the primary administrator as a ghost
    if (userEmail === 'admin@zsmeservices.com' || userUuid === 'a1b2c3d4-0001-4e5f-8a9b-000000000001') {
      continue;
    }

    const isGhost =
      (userUuid && tombstoneInsforgeIds.has(userUuid)) ||
      (userEmail && tombstoneEmails.has(userEmail)) ||
      (insforgeId && tombstoneInsforgeIds.has(insforgeId));

    if (isGhost) {
      ghostsFound++;
      console.warn(`[GHOST DETECTED] Auto-removing tombstoned user: ${user.email}`);
      serverHardDeleteUser(
        userUuid,
        `Ghost user auto-removed — tombstone match for email: ${user.email}`
      );
    }
  }

  // ─── CHECK 2: Find and remove mock UUID users ────────────────────────────
  // Re-read users to operate on fresh state
  const currentUsers2 = readJSON(USERS_FILE, []);
  for (const user of currentUsers2) {
    const userUuid = user.uuid || user.id;
    const userEmail = user.email?.toLowerCase().trim();

    // Safeguard: Never classify the primary administrator as a mock user
    if (userEmail === 'admin@zsmeservices.com' || userUuid === 'a1b2c3d4-0001-4e5f-8a9b-000000000001') {
      continue;
    }

    if (userUuid && userUuid.startsWith('a1b2c3d4-')) {
      mockUsersFound++;
      console.warn(`[MOCK UUID DETECTED] Auto-removing mock user: ${user.email}`);
      serverHardDeleteUser(
        userUuid,
        'Mock UUID auto-removed on integrity check'
      );
    }
  }

  // ─── CHECK 3: Verify real required production users exist ─────────────────
  const requiredUUIDs = [
    'a1b2c3d4-0001-4e5f-8a9b-000000000001',
    '53984c72-7fc6-47a5-be0a-94bb7382c067',
    '3fc54ade-f756-46ee-a571-43191703de19'
  ];

  const finalUsers = readJSON(USERS_FILE, []);
  for (const uuid of requiredUUIDs) {
    const exists = finalUsers.find(u => u.uuid === uuid || u.id === uuid || (uuid === 'a1b2c3d4-0001-4e5f-8a9b-000000000001' && u.email?.toLowerCase() === 'admin@zsmeservices.com'));

    if (!exists) {
      console.error(`[INTEGRITY FAIL] Required production user missing: ${uuid} — provisioning`);
      
      let newUser;
      if (uuid === 'a1b2c3d4-0001-4e5f-8a9b-000000000001') {
        newUser = {
          uuid: 'a1b2c3d4-0001-4e5f-8a9b-000000000001',
          id: 1779860000000,
          email: 'admin@zsmeservices.com',
          name: 'Admin User',
          password: '$2b$12$QOpWdtuG45euisE3IGB3..3pErrW9UCQpKny9w4zcBQu6OyMRxQA.', // bcrypt hash for 'admin123'
          role: 'Admin',
          department: 'Management',
          designation: 'Director',
          status: 'Active',
          employeeId: 'EMP-001',
          shift: '9:00 AM - 6:00 PM',
          dateOfJoining: '2020-01-01',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        const defaultEmail = uuid === '53984c72-7fc6-47a5-be0a-94bb7382c067'
          ? 'operations@zsmeservices.com'
          : 'billing@zsmeservices.com';
        
        const defaultName = uuid === '53984c72-7fc6-47a5-be0a-94bb7382c067'
          ? 'Operations Manager'
          : 'Billing Specialist';

        newUser = {
          uuid,
          id: uuid,
          email: defaultEmail,
          name: defaultName,
          role: uuid === '53984c72-7fc6-47a5-be0a-94bb7382c067' ? 'Manager' : 'Employee',
          department: uuid === '53984c72-7fc6-47a5-be0a-94bb7382c067' ? 'Operations' : 'Billing',
          status: 'active',
          employeeId: uuid === '53984c72-7fc6-47a5-be0a-94bb7382c067' ? 'EMP-OPS-001' : 'EMP-BIL-001',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      finalUsers.push(newUser);
      writeJSON(USERS_FILE, finalUsers);
    }
  }

  // ─── CHECK 4: Write integrity check results log ──────────────────────────
  const logEntry = {
    id: `integ_${Date.now()}`,
    check_type: 'ghost_user_check',
    ghosts_found: ghostsFound,
    ghosts_removed: ghostsFound,
    mock_users_found: mockUsersFound,
    mock_users_removed: mockUsersFound,
    checked_at: new Date().toISOString(),
    status: 'completed'
  };

  const integrityLogs = readJSON(INTEGRITY_LOG_FILE, []);
  integrityLogs.unshift(logEntry);
  if (integrityLogs.length > 500) integrityLogs.length = 500;
  writeJSON(INTEGRITY_LOG_FILE, integrityLogs);

  console.log(
    `[INTEGRITY DONE] Auto-Check Complete. Ghosts removed: ${ghostsFound} | ` +
    `Mock users removed: ${mockUsersFound}`
  );
};

// Start scheduled integrity runs (every 30 minutes)
setInterval(runGhostUserIntegrityCheck, 30 * 60 * 1000);

module.exports = {
  runGhostUserIntegrityCheck
};
