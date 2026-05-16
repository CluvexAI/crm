const MEETING_STORAGE_KEY = 'zsm_meeting_logs';
const ACTIVE_MEETINGS_KEY = 'zsm_active_meetings';

const getActiveMeetingsMap = () => {
  const json = localStorage.getItem(ACTIVE_MEETINGS_KEY);
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
};

const saveActiveMeetingsMap = (map) => {
  localStorage.setItem(ACTIVE_MEETINGS_KEY, JSON.stringify(map));
};

export const startMeeting = (userId, userName) => {
  const activeMeetings = getActiveMeetingsMap();
  
  if (activeMeetings[userId]) {
    return null;
  }
  
  const startTime = Date.now();
  const activeMeeting = {
    userId,
    userName,
    startTime,
    id: generateMeetingId(),
  };
  
  activeMeetings[userId] = activeMeeting;
  saveActiveMeetingsMap(activeMeetings);
  
  return activeMeeting;
};

export const endMeeting = (userId) => {
  const activeMeetings = getActiveMeetingsMap();
  const activeMeeting = activeMeetings[userId];
  
  if (!activeMeeting) {
    return null;
  }
  
  const endTime = Date.now();
  const durationSeconds = Math.floor((endTime - activeMeeting.startTime) / 1000);
  
  const meetingLog = {
    id: activeMeeting.id,
    userId: activeMeeting.userId,
    userName: activeMeeting.userName,
    startTime: new Date(activeMeeting.startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    durationSeconds,
  };
  
  delete activeMeetings[userId];
  saveActiveMeetingsMap(activeMeetings);
  
  saveMeetingLog(meetingLog);
  
  return meetingLog;
};

export const getActiveMeeting = (userId) => {
  const activeMeetings = getActiveMeetingsMap();
  
  if (!userId) {
    return Object.values(activeMeetings);
  }
  
  return activeMeetings[userId] || null;
};

export const getMeetingDuration = (startTime) => {
  if (!startTime) return 0;
  
  const now = Date.now();
  const durationMs = now - startTime;
  
  return Math.floor(durationMs / 1000);
};

export const formatMeetingDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const getAllMeetingLogs = () => {
  const logsJson = localStorage.getItem(MEETING_STORAGE_KEY);
  
  if (!logsJson) {
    return [];
  }
  
  try {
    return JSON.parse(logsJson);
  } catch {
    return [];
  }
};

export const getMeetingLogsByUser = (userId) => {
  const allLogs = getAllMeetingLogs();
  return allLogs.filter(log => log.userId === userId);
};

export const getTodayMeetingLogs = (userId) => {
  const allLogs = getMeetingLogsByUser(userId);
  const today = new Date().toDateString();
  
  return allLogs.filter(log => {
    const logDate = new Date(log.startTime).toDateString();
    return logDate === today;
  });
};

export const getTotalMeetingTimeToday = (userId) => {
  const todayLogs = getTodayMeetingLogs(userId);
  return todayLogs.reduce((total, log) => total + log.durationSeconds, 0);
};

const saveMeetingLog = (meetingLog) => {
  const logs = getAllMeetingLogs();
  logs.unshift(meetingLog);
  localStorage.setItem(MEETING_STORAGE_KEY, JSON.stringify(logs));
};

const generateMeetingId = () => {
  return `mtg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const getMeetingStats = (userId, days = 7) => {
  const allLogs = getMeetingLogsByUser(userId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const filteredLogs = allLogs.filter(log => {
    const logDate = new Date(log.startTime);
    return logDate >= cutoffDate;
  });
  
  const totalSeconds = filteredLogs.reduce((total, log) => total + log.durationSeconds, 0);
  const meetingCount = filteredLogs.length;
  const avgDuration = meetingCount > 0 ? Math.round(totalSeconds / meetingCount) : 0;
  
  return {
    totalSeconds,
    meetingCount,
    avgDuration,
    logs: filteredLogs,
  };
};
