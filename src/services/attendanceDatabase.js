const STORAGE_KEY = 'zsm_crm_attendance';
const API_BASE = (process.env.REACT_APP_API_URL || '') + '/api/attendance';

const getStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch (e) {
    console.error('Error reading from localStorage:', e);
    return null;
  }
};

const setStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Error writing to localStorage:', e);
    return false;
  }
};

export const fetchAndSyncAttendance = async () => {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      setStorage(json.data);
      console.log(`[AttendanceDB] Synced ${json.data.length} logs from backend`);
      return json.data;
    }

    // Backend is empty, seed with local storage
    const localLogs = getStorage();
    if (localLogs && localLogs.length > 0) {
      const seedRes = await fetch(`${API_BASE}/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: localLogs })
      });
      const seedJson = await seedRes.json();
      if (seedJson.success) {
        console.log(`[AttendanceDB] Seeded backend with ${localLogs.length} logs`);
      }
      return localLogs;
    }
  } catch (err) {
    console.warn('[AttendanceDB] Backend unreachable — using localStorage fallback:', err.message);
  }
  return getStorage() || [];
};

export const initializeAttendanceDatabase = (defaultData) => {
  const stored = getStorage();
  if (stored) {
    console.log('[AttendanceDB] Loading attendance from localStorage');
    return stored;
  }
  console.log('[AttendanceDB] Initializing database with default attendance');
  setStorage(defaultData);
  return defaultData;
};

export const getAllAttendanceLogs = () => {
  const data = getStorage();
  return data || [];
};

export const setAllAttendanceLogs = (data) => {
  setStorage(data);
};

export const upsertAttendanceLog = (logData) => {
  const logs = getStorage() || [];
  const index = logs.findIndex(l => l.userId === logData.userId && l.date === logData.date);
  
  let newOrUpdatedLog;
  if (index === -1) {
    newOrUpdatedLog = { id: Date.now(), ...logData, createdAt: new Date().toISOString() };
    logs.push(newOrUpdatedLog);
    console.log('[AttendanceDB] Created log for', logData.date);
  } else {
    newOrUpdatedLog = { ...logs[index], ...logData, updatedAt: new Date().toISOString() };
    logs[index] = newOrUpdatedLog;
    console.log('[AttendanceDB] Updated log for', logData.date);
  }
  
  setStorage(logs);

  // Sync to backend asynchronously
  fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newOrUpdatedLog)
  }).catch(err => console.warn('[AttendanceDB] Failed to sync log to backend:', err.message));

  return newOrUpdatedLog;
};
