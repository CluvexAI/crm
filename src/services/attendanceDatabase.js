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

export const upsertAttendanceLog = (logData) => {
  const logs = getStorage() || [];
  
  // Find if log exists for this user on this date
  const index = logs.findIndex(l => l.userId === logData.userId && l.date === logData.date);
  
  if (index === -1) {
    // Create new
    const newLog = {
      id: Date.now(),
      ...logData,
      createdAt: new Date().toISOString()
    };
    logs.push(newLog);
    setStorage(logs);
    console.log('[AttendanceDB] Created log for', logData.date);
    return newLog;
  } else {
    // Update existing
    const updatedLog = {
      ...logs[index],
      ...logData,
      updatedAt: new Date().toISOString()
    };
    logs[index] = updatedLog;
    setStorage(logs);
    console.log('[AttendanceDB] Updated log for', logData.date);
    return updatedLog;
  }
};
