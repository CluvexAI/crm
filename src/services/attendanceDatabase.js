import { api } from './apiService';

const STORAGE_KEY = 'zsm_crm_attendance';

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
  let allLogs = getStorage() || [];
  
  try {
    // Sync from Insforge users table
    const users = await api.users.getAll();
    if (users && Array.isArray(users)) {
      let dbLogs = [];
      users.forEach(u => {
        if (u.attendanceLogs && Array.isArray(u.attendanceLogs)) {
          dbLogs = [...dbLogs, ...u.attendanceLogs];
        }
      });
      if (dbLogs.length > 0) {
        // Merge dbLogs and local logs, preferring dbLogs
        const logMap = new Map();
        allLogs.forEach(l => logMap.set(`${l.userId}_${l.date}`, l));
        dbLogs.forEach(l => logMap.set(`${l.userId}_${l.date}`, l));
        
        allLogs = Array.from(logMap.values());
        setStorage(allLogs);
        console.log(`[AttendanceDB] Synced ${dbLogs.length} logs from Insforge users table`);
      }
    }
  } catch (err) {
    console.warn('[AttendanceDB] Insforge sync failed:', err.message);
  }

  return allLogs;
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

export const upsertAttendanceLog = async (logData) => {
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

  // Sync to Insforge users table
  try {
    const userLogs = logs.filter(l => l.userId === logData.userId);
    await api.users.update(logData.userId, { attendanceLogs: userLogs });
    console.log('[AttendanceDB] Successfully synced to Insforge for user:', logData.userId);
  } catch (err) {
    console.error('[AttendanceDB] Failed to sync log to Insforge:', err.message);
  }

  return newOrUpdatedLog;
};
