/**
 * syncService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Directory Sync service with Tombstone Enforcement.
 * Prevents resurrection of permanently deleted users during external directory syncs.
 */

import {
  getTombstones,
  getAllUsers,
  createUserRecord,
  updateUserRecord,
} from './userDatabase';

const SYNC_BLOCKED_LOG_KEY = 'zsm_crm_sync_blocked_log';
const BACKEND_BASE = process.env.REACT_APP_API_URL || '';

/**
 * Log a blocked sync attempt to localStorage and sync it to the backend log file
 */
const logBlockedAttempt = async (incomingUser, reason) => {
  const logEntry = {
    id: `sync_block_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    email: incomingUser.email,
    insforge_user_id: incomingUser.insforge_user_id || incomingUser.insforgeUserId || '',
    blocked_at: new Date().toISOString(),
    sync_source: incomingUser.source || 'directory_sync',
    reason
  };

  try {
    const localLogs = JSON.parse(localStorage.getItem(SYNC_BLOCKED_LOG_KEY)) || [];
    localLogs.unshift(logEntry);
    if (localLogs.length > 500) localLogs.length = 500;
    localStorage.setItem(SYNC_BLOCKED_LOG_KEY, JSON.stringify(localLogs));

    // Send to backend for centralized admin audit visibility
    await fetch(`${BACKEND_BASE}/api/users/sync-blocked-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry),
    }).catch(err => console.warn('[SyncService] Backend log failed:', err.message));
  } catch (e) {
    console.error('[SyncService] Failed to write sync blocked log:', e.message);
  }
};

/**
 * Sync job with directory sync rules & tombstone checking
 * 
 * @param {Array<object>} incomingUsers - Array of user objects from the external directory
 * @returns {Promise<object>} Results summary of created, updated, blocked, and failed users
 */
export const runDirectorySync = async (incomingUsers) => {
  console.log(`[SYNC] Starting directory sync for ${incomingUsers.length} users`);

  const results = {
    created: [],
    updated: [],
    blocked: [],
    errors: []
  };

  // Load all local tombstones
  const tombstoneList = getTombstones(); // Returns array of UUID strings
  
  // Since we also block based on email and Insforge ID, load the user database info
  // and deletion audit records to resolve historical attributes if needed,
  // or build lookup sets directly from our backend tombstones.
  const tombstoneEmails = new Set();
  const tombstoneInsforgeIds = new Set();

  try {
    const res = await fetch(`${BACKEND_BASE}/api/users/deletion-log`);
    if (res.ok) {
      const { data } = await res.json();
      if (Array.isArray(data)) {
        data.forEach(entry => {
          if (entry.deletedUserEmail) {
            tombstoneEmails.add(entry.deletedUserEmail.toLowerCase().trim());
          }
          if (entry.deletedUserUuid) {
            tombstoneInsforgeIds.add(entry.deletedUserUuid);
          }
          if (entry.deletedUserSnapshot?.insforge_user_id) {
            tombstoneInsforgeIds.add(entry.deletedUserSnapshot.insforge_user_id);
          }
          if (entry.deletedUserSnapshot?.insforgeUserId) {
            tombstoneInsforgeIds.add(entry.deletedUserSnapshot.insforgeUserId);
          }
        });
      }
    }
  } catch (err) {
    console.warn('[SyncService] Could not pre-fetch deletion log lookup sets (using local safety layer):', err.message);
  }

  // Fallback / merge with local storage UUIDs
  tombstoneList.forEach(uuid => {
    tombstoneInsforgeIds.add(uuid);
  });

  const existingUsers = getAllUsers() || [];

  for (const incomingUser of incomingUsers) {
    const userEmail = incomingUser.email?.toLowerCase().trim();
    const insforgeId = incomingUser.insforge_user_id || incomingUser.insforgeUserId || '';
    const incomingUuid = incomingUser.uuid || incomingUser.id || '';

    // ─── TOMBSTONE CHECK — block re-sync of deleted users ────────────────────
    const isBlockedByTombstone =
      (userEmail && tombstoneEmails.has(userEmail)) ||
      (insforgeId && tombstoneInsforgeIds.has(insforgeId)) ||
      (incomingUuid && tombstoneInsforgeIds.has(incomingUuid));

    if (isBlockedByTombstone) {
      console.warn(`[SYNC BLOCKED] Tombstone match — skipping: ${incomingUser.email}`);
      results.blocked.push(incomingUser.email);
      await logBlockedAttempt(incomingUser, 'Tombstone match — permanently deleted user');
      continue;
    }

    // ─── MOCK UUID CHECK — never provision mock users ────────────────────────
    if (incomingUuid && incomingUuid.startsWith('a1b2c3d4-')) {
      console.warn(`[SYNC BLOCKED] Mock UUID detected: ${incomingUuid}`);
      results.blocked.push(incomingUuid);
      continue;
    }

    // ─── Proceed with normal sync ───────────────────────────────────────────
    try {
      const exists = existingUsers.find(
        u => (userEmail && u.email?.toLowerCase() === userEmail) ||
             (incomingUuid && u.uuid === incomingUuid)
      );

      if (!exists) {
        // Create user
        const newRecord = {
          ...incomingUser,
          uuid: incomingUuid || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        createUserRecord(newRecord);
        results.created.push(incomingUser.email);
      } else {
        // Update user
        const updated = updateUserRecord(exists.uuid, {
          ...incomingUser,
          updatedAt: new Date().toISOString()
        });
        if (updated) {
          results.updated.push(incomingUser.email);
        } else {
          // Blocked by local userDatabase checks (e.g. tombstoned dynamically)
          results.blocked.push(incomingUser.email);
        }
      }
    } catch (err) {
      console.error(`[SYNC ERROR] Failed to sync user ${incomingUser.email}:`, err.message);
      results.errors.push({
        email: incomingUser.email,
        error: err.message
      });
    }
  }

  console.log(`[SYNC COMPLETE]`, results);
  return results;
};

export default runDirectorySync;
