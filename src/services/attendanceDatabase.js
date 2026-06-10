/**
 * attendanceDatabase.js — 100% backend-driven attendance persistence.
 *
 * ALL reads and writes go directly to the backend REST API.
 * Zero localStorage usage — attendance survives browser history clears.
 */

const API_BASE = (process.env.REACT_APP_API_URL || '') + '/api/attendance';
const USERS_API = (process.env.REACT_APP_API_URL || '') + '/api/users';

/**
 * Fetch ALL attendance logs from the backend.
 * Primary source: dedicated /api/attendance endpoint.
 * Fallback: aggregate from user records' attendanceLogs arrays.
 */
export const fetchAndSyncAttendance = async () => {
  try {
    // Primary: dedicated attendance API
    const res = await fetch(API_BASE);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        console.log(`[AttendanceDB] Synced ${json.data.length} logs from /api/attendance`);
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[AttendanceDB] /api/attendance unreachable:', err.message);
  }

  // Fallback: aggregate from user records
  try {
    const res = await fetch(USERS_API);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        let allLogs = [];
        json.data.forEach(u => {
          if (u.attendanceLogs && Array.isArray(u.attendanceLogs)) {
            allLogs = [...allLogs, ...u.attendanceLogs];
          }
        });
        if (allLogs.length > 0) {
          console.log(`[AttendanceDB] Fallback: aggregated ${allLogs.length} logs from user records`);
          return allLogs;
        }
      }
    }
  } catch (err) {
    console.warn('[AttendanceDB] Users API fallback also failed:', err.message);
  }

  return [];
};

/**
 * No-op: attendance is not stored locally.
 */
export const initializeAttendanceDatabase = (defaultData) => {
  console.log('[AttendanceDB] Returning default attendance (no localStorage)');
  return defaultData;
};

/**
 * No-op: returns empty — all reads go through fetchAndSyncAttendance.
 */
export const getAllAttendanceLogs = () => {
  return [];
};

/**
 * No-op: attendance is not stored in localStorage.
 */
export const setAllAttendanceLogs = (data) => {
  // Intentionally empty — no localStorage
};

/**
 * Upsert a single attendance log directly to the backend.
 * This POSTs to /api/attendance which saves to attendance.json on the server.
 * No localStorage is touched at any point.
 *
 * IMPORTANT: This function is async and MUST be awaited so the backend has the
 * record before the next polling cycle overwrites optimistic React state.
 */
export const upsertAttendanceLog = async (logData) => {
  let newOrUpdatedLog = { ...logData };
  if (!newOrUpdatedLog.id) {
    newOrUpdatedLog.id = Date.now();
    newOrUpdatedLog.createdAt = new Date().toISOString();
  } else {
    newOrUpdatedLog.updatedAt = new Date().toISOString();
  }

  // Sync to backend via dedicated attendance API — awaited to prevent race conditions
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrUpdatedLog),
    });
    if (!res.ok) {
      console.error('[AttendanceDB] Backend POST failed:', res.status, res.statusText);
    } else {
      console.log('[AttendanceDB] ✅ Synced attendance log to backend for', newOrUpdatedLog.date);
    }
  } catch (err) {
    console.error('[AttendanceDB] Failed to sync attendance to backend:', err.message);
  }

  return newOrUpdatedLog;
};
