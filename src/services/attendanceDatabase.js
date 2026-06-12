import apiService from './apiService';

export const fetchAndSyncAttendance = async () => {
  try {
    const dbLogs = await apiService.attendance.getAll();
    if (dbLogs && Array.isArray(dbLogs) && dbLogs.length > 0) {
      console.log(`[AttendanceDB] Synced ${dbLogs.length} logs from Insforge attendance table`);
      return dbLogs;
    }
  } catch (err) {
    console.warn('[AttendanceDB] Insforge sync failed:', err.message);
  }
  return [];
};

export const initializeAttendanceDatabase = (defaultData) => {
  return defaultData;
};

export const getAllAttendanceLogs = () => {
  return [];
};

export const setAllAttendanceLogs = (data) => {
};

export async function saveAttendance(record) {
  return await apiService.attendance.upsert(record);
}

export const upsertAttendanceLog = async (logData) => {
  return await saveAttendance(logData);
};
