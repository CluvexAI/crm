/**
 * userDeletionService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central service for ALL user deletions in the ZSM CRM.
 * Every delete must go through hardDeleteUser() — never call deleteUserRecord()
 * or any storage layer directly from UI components.
 *
 * Architecture translation (PostgreSQL → this system's data layer):
 *
 *  SQL table                  │  This system's equivalent
 * ────────────────────────────┼──────────────────────────────────────────────
 *  users                      │  localStorage: zsm_crm_users
 *                             │  + backend:    server/data/users.json
 *  deleted_user_tombstones    │  localStorage: zsm_crm_deleted_uuids
 *                             │  + backend:    server/data/deleted_uuids.json
 *  deletion_audit_log         │  localStorage: zsm_deletion_audit_log  (new)
 *                             │  + backend:    POST /api/users/deletion-log (new)
 *  audit_logs                 │  React state:  allAuditLogs (AppContext)
 *  login_sessions             │  React state:  currentUser (in-memory only)
 *  password_reset_tokens      │  backend file: server/data/otp_store.json
 *  email_accounts             │  localStorage: zsm_user_emails
 *  synced_emails              │  localStorage: zsm_synced_emails
 *  email_store (IMAP inbox)   │  backend API:  DELETE /api/mail/user/:uuid
 *  daily_reports              │  backend file: server/data/daily_reports.json
 *  chat_registrations         │  localStorage: zsm_crm_chat_db
 *  notifications              │  React state:  allNotifications (in-memory)
 *  project_assignments        │  localStorage: zsm_crm_projects (assignedTo field)
 */

import {
  deleteUserRecord,
  getDatabaseInfo,
} from './userDatabase';

import {
  getUserEmails,
  saveUserEmails,
} from './emailService';

// ─── Constants ────────────────────────────────────────────────────────────────

const DELETION_AUDIT_LOG_KEY = 'zsm_deletion_audit_log';
const CHAT_DB_KEY            = 'zsm_crm_chat_db';
const SYNCED_EMAILS_KEY      = 'zsm_synced_emails';
const PROJECTS_KEY           = 'zsm_crm_projects';
const ATTENDANCE_KEY         = 'zsm_crm_attendance';
const LEAVES_KEY             = 'zsm_crm_leaves';
const BACKEND_BASE           = process.env.REACT_APP_API_URL || '';

// ─── Deletion Audit Log ───────────────────────────────────────────────────────

const readDeletionAuditLog = () => {
  try {
    return JSON.parse(localStorage.getItem(DELETION_AUDIT_LOG_KEY)) || [];
  } catch {
    return [];
  }
};

const writeDeletionAuditEntry = (entry) => {
  try {
    const logs = readDeletionAuditLog();
    logs.unshift(entry);
    // Keep last 1000 deletion records
    if (logs.length > 1000) logs.length = 1000;
    localStorage.setItem(DELETION_AUDIT_LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('[DeletionAudit] Failed to write audit entry:', e.message);
  }
};

// Also persist audit entry to backend log file (non-blocking)
const syncAuditToBackend = (entry) => {
  fetch(`${BACKEND_BASE}/api/users/deletion-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(err =>
    console.warn('[DeletionAudit] Backend sync failed (non-critical):', err.message)
  );
};

// ─── Related Data Cleanup Functions ──────────────────────────────────────────

/**
 * Cleans up all localStorage stores that reference this user's UUID.
 * Returns a summary of what was cleaned.
 */
const cleanLocalStorageArtifacts = (uuid, email) => {
  const cleaned = [];

  // 1. Email accounts (zsm_user_emails)
  try {
    const userEmails = getUserEmails();
    const before = userEmails.length;
    const filtered = userEmails.filter(
      e => e.userId !== uuid && e.email?.toLowerCase() !== email?.toLowerCase()
    );
    if (filtered.length < before) {
      saveUserEmails(filtered);
      cleaned.push(`email_accounts (removed ${before - filtered.length})`);
    }
  } catch (e) {
    console.warn('[HardDelete] email_accounts cleanup failed:', e.message);
  }

  // 2. Synced IMAP emails (zsm_synced_emails)
  try {
    const syncedRaw = localStorage.getItem(SYNCED_EMAILS_KEY);
    if (syncedRaw) {
      const synced = JSON.parse(syncedRaw) || [];
      const before = synced.length;
      const filtered = synced.filter(e => e.userId !== uuid);
      if (filtered.length < before) {
        localStorage.setItem(SYNCED_EMAILS_KEY, JSON.stringify(filtered));
        cleaned.push(`synced_emails (removed ${before - filtered.length})`);
      }
    }
  } catch (e) {
    console.warn('[HardDelete] synced_emails cleanup failed:', e.message);
  }

  // 3. Chat registrations (zsm_crm_chat_db)
  try {
    const chatRaw = localStorage.getItem(CHAT_DB_KEY);
    if (chatRaw) {
      const chatDb = JSON.parse(chatRaw);
      if (chatDb && chatDb.users) {
        const before = chatDb.users.length;
        chatDb.users = chatDb.users.filter(u => u.uuid !== uuid && u.id !== uuid);
        if (chatDb.users.length < before) {
          localStorage.setItem(CHAT_DB_KEY, JSON.stringify(chatDb));
          cleaned.push(`chat_registrations (removed ${before - chatDb.users.length})`);
        }
      }
    }
  } catch (e) {
    console.warn('[HardDelete] chat_db cleanup failed:', e.message);
  }

  // 4. Project assignments — set assignedTo to null for this user's projects
  try {
    const projectsRaw = localStorage.getItem(PROJECTS_KEY);
    if (projectsRaw) {
      const projects = JSON.parse(projectsRaw) || [];
      let modified = 0;
      const updated = projects.map(p => {
        if (p.assignedTo === uuid || String(p.assignedTo) === uuid) {
          modified++;
          return { ...p, assignedTo: null, assignedToName: '[Deleted User]', _unassignedAt: new Date().toISOString() };
        }
        return p;
      });
      if (modified > 0) {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        cleaned.push(`project_assignments (unassigned ${modified})`);
      }
    }
  } catch (e) {
    console.warn('[HardDelete] project_assignments cleanup failed:', e.message);
  }

  // 5. Attendance records — anonymise (keep records, remove identity)
  try {
    const attendanceRaw = localStorage.getItem(ATTENDANCE_KEY);
    if (attendanceRaw) {
      const attendance = JSON.parse(attendanceRaw) || [];
      let modified = 0;
      const updated = attendance.map(a => {
        if (a.userId === uuid || String(a.userId) === uuid) {
          modified++;
          return { ...a, userName: '[Deleted User]', _anonymisedAt: new Date().toISOString() };
        }
        return a;
      });
      if (modified > 0) {
        localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(updated));
        cleaned.push(`attendance_records (anonymised ${modified})`);
      }
    }
  } catch (e) {
    console.warn('[HardDelete] attendance cleanup failed:', e.message);
  }

  // 6. Leave requests — anonymise
  try {
    const leavesRaw = localStorage.getItem(LEAVES_KEY);
    if (leavesRaw) {
      const leaves = JSON.parse(leavesRaw) || [];
      let modified = 0;
      const updated = leaves.map(l => {
        if (l.userId === uuid || String(l.userId) === uuid) {
          modified++;
          return { ...l, userName: '[Deleted User]', _anonymisedAt: new Date().toISOString() };
        }
        return l;
      });
      if (modified > 0) {
        localStorage.setItem(LEAVES_KEY, JSON.stringify(updated));
        cleaned.push(`leave_requests (anonymised ${modified})`);
      }
    }
  } catch (e) {
    console.warn('[HardDelete] leave_requests cleanup failed:', e.message);
  }

  return cleaned;
};

/**
 * Cleans up backend-side data stores for the deleted user.
 * All fire-and-forget — deletion is already committed before these run.
 */
const cleanBackendArtifacts = (uuid, email) => {
  const tasks = [];

  // Clear OTP/password reset tokens for this email (server/data/otp_store.json)
  tasks.push(
    fetch(`${BACKEND_BASE}/api/auth/revoke-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(e => console.warn('[HardDelete] OTP token revocation failed (non-critical):', e.message))
  );

  // Clear IMAP email store for this user (server/data/emails.json)
  tasks.push(
    fetch(`${BACKEND_BASE}/api/mail/user/${uuid}`, {
      method: 'DELETE',
    }).catch(e => console.warn('[HardDelete] Email store cleanup failed (non-critical):', e.message))
  );

  return tasks; // caller can await if needed, but we don't block on these
};

// ─── Main Export: hardDeleteUser ──────────────────────────────────────────────

/**
 * Permanently deletes a user with full audit trail.
 *
 * Equivalent to the PostgreSQL hardDeleteUser() service:
 *  1. Verify user exists
 *  2. Check tombstone (idempotent — safe to call twice)
 *  3. Write tombstone FIRST (prevents any resurrection window)
 *  4. Clean all related data stores (equivalent to foreign-key cascade)
 *  5. Hard-delete from users store
 *  6. Write comprehensive deletion audit log entry
 *
 * @param {object} targetUser   - Full user object to delete (must have uuid + email)
 * @param {object} deletedBy    - Current user performing the delete (must have uuid + name)
 * @param {string} reason       - Reason for deletion (optional, recorded in audit)
 * @param {string} source       - Source system ('manual_admin' | 'api' | 'bulk_import')
 * @returns {Promise<{success, deletedUser, tombstoneCreated, deletedAt, auditId, tablesClean}>}
 */
export const hardDeleteUser = async (
  targetUser,
  deletedBy,
  reason = '',
  source = 'manual_admin'
) => {
  const startedAt = new Date().toISOString();

  // ── Step 1: Verify user exists ─────────────────────────────────────────────
  if (!targetUser || !targetUser.uuid) {
    throw new Error('hardDeleteUser: targetUser must have a uuid field');
  }
  if (!deletedBy || !deletedBy.uuid) {
    throw new Error('hardDeleteUser: deletedBy must have a uuid field');
  }

  const { uuid, email, name, role, department, employeeId } = targetUser;

  // Guard: cannot delete primary admin
  if (email === 'admin@zsmeservices.com') {
    throw new Error('The primary admin user cannot be deleted.');
  }

  // ── Step 2: Check if already tombstoned (idempotency) ─────────────────────
  const dbInfo = getDatabaseInfo();
  const alreadyTombstoned = dbInfo.tombstones?.includes(String(uuid));

  if (alreadyTombstoned) {
    console.warn(`[HardDelete] UUID already tombstoned: ${uuid} — idempotent no-op`);
    return {
      success: true,
      alreadyDeleted: true,
      deletedUser: email,
      tombstoneCreated: false,
      deletedAt: startedAt,
    };
  }

  const cleanedStores   = [];
  let   tombstoneCreated = false;

  try {
    // ── Step 3: Write tombstone FIRST ────────────────────────────────────────
    // deleteUserRecord() writes the tombstone atomically before removing
    // from the localStorage/backend arrays — this is the critical ordering.
    deleteUserRecord(uuid);
    tombstoneCreated = true;

    // ── Step 4: Clean all related data stores ─────────────────────────────
    const localStoresCleaned = cleanLocalStorageArtifacts(uuid, email);
    cleanedStores.push(...localStoresCleaned);

    // Backend artifact cleanup (non-blocking — deletion already committed)
    cleanBackendArtifacts(uuid, email);
    cleanedStores.push('backend:otp_tokens (async)', 'backend:email_store (async)');

    // ── Step 5: Write comprehensive deletion audit log ─────────────────────
    const auditEntry = {
      id:                   `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      // Deleted user snapshot
      deletedUserUuid:      uuid,
      deletedUserEmail:     email,
      deletedUserName:      name,
      deletedUserRole:      role,
      deletedUserDept:      department,
      deletedUserEmployeeId: employeeId,
      deletedUserSnapshot:  { ...targetUser, password: '[REDACTED]' },
      // Who did it
      deletedByUuid:        deletedBy.uuid,
      deletedByName:        deletedBy.name,
      deletedByRole:        deletedBy.role,
      // What happened
      deletionType:         'hard_delete',
      deletionSource:       source,
      deletionReason:       reason || 'No reason provided',
      tombstoneCreated:     true,
      blockResync:          true,
      blockRestore:         true,
      // What was cleaned
      tablesClean:          cleanedStores,
      // Timing
      startedAt,
      completedAt:          new Date().toISOString(),
    };

    writeDeletionAuditEntry(auditEntry);
    syncAuditToBackend(auditEntry);

    console.log(
      `[DELETE SUCCESS] User permanently deleted:`,
      `${email} (${uuid}) | By: ${deletedBy.name} | Cleaned: ${cleanedStores.join(', ')}`
    );

    return {
      success:          true,
      deletedUser:      email,
      deletedUserName:  name,
      tombstoneCreated: true,
      deletedAt:        auditEntry.completedAt,
      auditId:          auditEntry.id,
      tablesClean:      cleanedStores,
    };

  } catch (err) {
    // If tombstone was written but subsequent steps failed,
    // the user is still safely deleted (tombstone is the source of truth).
    // Log the partial failure but do not re-throw as a full rollback.
    console.error(`[DELETE PARTIAL] UUID ${uuid} — tombstone: ${tombstoneCreated}, error:`, err.message);

    const errorAudit = {
      id:               `del_err_${Date.now()}`,
      deletedUserUuid:  uuid,
      deletedUserEmail: email,
      deletedByUuid:    deletedBy.uuid,
      deletedByName:    deletedBy.name,
      deletionType:     'hard_delete',
      deletionSource:   source,
      tombstoneCreated,
      status:           'PARTIAL_FAILURE',
      error:            err.message,
      tablesClean:      cleanedStores,
      startedAt,
      completedAt:      new Date().toISOString(),
    };

    writeDeletionAuditEntry(errorAudit);
    syncAuditToBackend(errorAudit);

    if (tombstoneCreated) {
      // User IS deleted (tombstone written) — return success with warning
      console.warn('[HardDelete] User deleted but cleanup incomplete. Tombstone is authoritative.');
      return {
        success:          true,
        deletedUser:      email,
        tombstoneCreated: true,
        cleanupWarning:   err.message,
        auditId:          errorAudit.id,
        tablesClean:      cleanedStores,
      };
    }

    // Tombstone was NOT written — this is a real failure
    throw new Error(`Hard delete failed for ${email}: ${err.message}`);
  }
};

// ─── Audit Log Exports ────────────────────────────────────────────────────────

/** Returns the full deletion audit log (newest first) */
export const getDeletionAuditLog = () => readDeletionAuditLog();

/** Returns deletion records for a specific user (by UUID or email) */
export const getDeletionRecord = (uuidOrEmail) => {
  return readDeletionAuditLog().find(
    e => e.deletedUserUuid === uuidOrEmail ||
         e.deletedUserEmail?.toLowerCase() === uuidOrEmail?.toLowerCase()
  ) || null;
};
