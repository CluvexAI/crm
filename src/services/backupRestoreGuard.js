/**
 * backupRestoreGuard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Intercepts user backup restore operations and filters out permanently deleted
 * or mock users before they can write back to the CRM database.
 */

import { getTombstones } from './userDatabase';

const BACKEND_BASE = process.env.REACT_APP_API_URL || '';

/**
 * Validates and filters user backup data, removing tombstoned and mock users.
 * Logs the filtration result to the centralized deletion audit log on the server.
 * 
 * @param {object} backupData - Object containing a 'users' array to restore
 * @param {string} restoredBy - Username/ID of the administrator performing the restore
 * @returns {Promise<Array<object>>} Filtered list of safe users to restore
 */
export const safeRestoreFromBackup = async (backupData, restoredBy) => {
  console.log(`[RESTORE] Backup restore initiated by: ${restoredBy}`);

  if (!backupData || !Array.isArray(backupData.users)) {
    throw new Error('Invalid backup data: missing or malformed users array');
  }

  // Load tombstone UUIDs (Layer 2)
  const tombstoneList = getTombstones();
  const blockedIds = new Set(tombstoneList);
  
  // Also load tombstone emails and snapshot IDs from backend deletion logs
  const blockedEmails = new Set();
  try {
    const res = await fetch(`${BACKEND_BASE}/api/users/deletion-log`);
    if (res.ok) {
      const { data } = await res.json();
      if (Array.isArray(data)) {
        data.forEach(entry => {
          if (entry.deletedUserEmail) {
            blockedEmails.add(entry.deletedUserEmail.toLowerCase().trim());
          }
          if (entry.deletedUserUuid) {
            blockedIds.add(entry.deletedUserUuid);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[RestoreGuard] Could not query server deletion logs for lookup (using local tombstones only):', err.message);
  }

  // Perform filtration
  const filtered = backupData.users.filter(user => {
    const userEmail = user.email?.toLowerCase().trim();
    const userId = user.uuid || user.id;

    const isBlocked =
      (userEmail && blockedEmails.has(userEmail)) ||
      (userId && blockedIds.has(userId)) ||
      (userId && userId.startsWith('a1b2c3d4-')); // Mock UUID check

    if (isBlocked) {
      console.warn(`[RESTORE BLOCKED] Skipping tombstoned/mock user: ${user.email || userId}`);
    }

    return !isBlocked;
  });

  const totalBlocked = backupData.users.length - filtered.length;
  const blockedUserEmails = backupData.users
    .filter(user => {
      const userEmail = user.email?.toLowerCase().trim();
      const userId = user.uuid || user.id;
      return (userEmail && blockedEmails.has(userEmail)) || (userId && blockedIds.has(userId)) || (userId && userId.startsWith('a1b2c3d4-'));
    })
    .map(user => user.email || user.uuid || user.id);

  // Log the restore event to backend deletion audit log
  const auditLogPayload = {
    id: `restore_audit_${Date.now()}`,
    deletedUserUuid: 'backup_restore_op',
    deletedUserEmail: 'N/A',
    deletedUserName: 'Backup Restore Event',
    deletedByUuid: restoredBy,
    deletedByName: restoredBy,
    deletionType: 'backup_restore_filter',
    deletionSource: 'backup_restore_guard',
    deletionReason: `Filtered restore. Original count: ${backupData.users.length} | Restored: ${filtered.length} | Blocked: ${totalBlocked}`,
    tombstoneCreated: false,
    blockResync: true,
    blockRestore: true,
    // Keep custom restore stats
    action: 'backup_restore_filtered',
    performed_by: restoredBy,
    total_in_backup: backupData.users.length,
    total_blocked: totalBlocked,
    total_restored: filtered.length,
    blocked_users: JSON.stringify(blockedUserEmails),
    restored_at: new Date().toISOString(),
    source: 'backup_restore_guard'
  };

  try {
    await fetch(`${BACKEND_BASE}/api/users/deletion-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditLogPayload)
    });
  } catch (err) {
    console.warn('[RestoreGuard] Failed to sync restore log to server:', err.message);
  }

  console.log(`[RESTORE COMPLETE] Restored: ${filtered.length} | Blocked: ${totalBlocked}`);

  return filtered;
};

export default safeRestoreFromBackup;
