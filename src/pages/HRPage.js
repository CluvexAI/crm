import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ROLES } from '../data/mockData';
import { getAllMeetingLogs, getActiveMeeting, getMeetingDuration, formatMeetingDuration } from '../services/meetingService';

const HRPage = () => {
  const { currentUser, allUsers, allAttendance, allLeaves, applyLeave, updateLeave, markAttendance } = useApp();
  const [tab, setTab] = useState('attendance');

  const isHR = currentUser.role === ROLES.HR || currentUser.role === ROLES.ADMIN;
  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = allAttendance.filter(a => a.date === today);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon teal">✅</div>
          <div className="stat-info">
            <div className="stat-value">{todayAttendance.length}</div>
            <div className="stat-label">Present Today</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">❌</div>
          <div className="stat-info">
            <div className="stat-value">{Math.max(0, allUsers.length - 1 - todayAttendance.length)}</div>
            <div className="stat-label">Absent Today</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">📅</div>
          <div className="stat-info">
            <div className="stat-value">{allLeaves.filter(l => l.status === 'Pending').length}</div>
            <div className="stat-label">Pending Leave Requests</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✓</div>
          <div className="stat-info">
            <div className="stat-value">{allLeaves.filter(l => l.status === 'Approved').length}</div>
            <div className="stat-label">Approved Leaves</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>📋 Attendance</button>
        <button className={`tab-btn ${tab === 'leaves' ? 'active' : ''}`} onClick={() => setTab('leaves')}>📅 Leave Requests</button>
        {!isHR && <button className={`tab-btn ${tab === 'apply' ? 'active' : ''}`} onClick={() => setTab('apply')}>➕ Apply Leave</button>}
        {(isHR || tab === 'meetings') && <button className={`tab-btn ${tab === 'meetings' ? 'active' : ''}`} onClick={() => setTab('meetings')}>📹 Meeting Logs</button>}
      </div>

      {tab === 'attendance' && (
        <AttendanceTab
          allAttendance={allAttendance}
          allUsers={allUsers}
          today={today}
          isHR={isHR}
          currentUser={currentUser}
          markAttendance={markAttendance}
        />
      )}

      {tab === 'leaves' && (
        <LeavesTab allLeaves={allLeaves} isHR={isHR} updateLeave={updateLeave} currentUser={currentUser} />
      )}

      {tab === 'apply' && (
        <ApplyLeaveTab applyLeave={applyLeave} onApplied={() => setTab('leaves')} />
      )}

      {tab === 'meetings' && (
        <MeetingsTab allUsers={allUsers} isHR={isHR} currentUser={currentUser} />
      )}
    </div>
  );
};

const MeetingsTab = ({ allUsers, isHR, currentUser }) => {
  const [search, setSearch] = useState('');
  const [daysFilter, setDaysFilter] = useState(7);
  const [activeMeetings, setActiveMeetings] = useState({});
  const [liveSeconds, setLiveSeconds] = useState({});

  useEffect(() => {
    const updateLiveTimers = () => {
      const active = {};
      const live = {};
      
      allUsers.forEach(user => {
        const meeting = getActiveMeeting(user.id);
        if (meeting) {
          active[user.id] = meeting;
          live[user.id] = getMeetingDuration(meeting.startTime);
        }
      });
      
      setActiveMeetings(active);
      setLiveSeconds(live);
    };
    
    updateLiveTimers();
    const interval = setInterval(updateLiveTimers, 1000);
    
    return () => clearInterval(interval);
  }, [allUsers]);

  const allLogs = getAllMeetingLogs();
  
  const statsByUser = allUsers.reduce((acc, user) => {
    const userLogs = allLogs.filter(log => log.userId === user.id);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysFilter);
    
    const recentLogs = userLogs.filter(log => new Date(log.startTime) >= cutoffDate);
    const totalSeconds = recentLogs.reduce((sum, log) => sum + log.durationSeconds, 0);
    
    acc[user.id] = {
      userName: user.name,
      totalSeconds,
      meetingCount: recentLogs.length,
      avgDuration: recentLogs.length > 0 ? Math.round(totalSeconds / recentLogs.length) : 0,
      logs: recentLogs.slice(0, 5),
      isLive: !!activeMeetings[user.id],
      liveSeconds: liveSeconds[user.id] || 0,
    };
    return acc;
  }, {});

  const filteredStats = Object.entries(statsByUser).filter(([userId, data]) => {
    if (!isHR && userId !== currentUser.id) return false;
    if (!search) return true;
    return data.userName.toLowerCase().includes(search.toLowerCase());
  });

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const activeCount = Object.keys(activeMeetings).length;

  return (
    <div>
      <div className="toolbar">
        <div className="search-bar">
          🔍 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..." />
        </div>
        <select className="form-control" style={{ width: 'auto' }} value={daysFilter} onChange={e => setDaysFilter(parseInt(e.target.value))}>
          <option value={1}>Today</option>
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
        </select>
      </div>

      {/* Stats Summary */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {activeCount > 0 && (
          <div className="stat-card" style={{ background: 'var(--danger-light)', borderColor: 'var(--danger)' }}>
            <div className="stat-icon red">🔴</div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{activeCount}</div>
              <div className="stat-label" style={{ color: 'var(--danger)' }}>In Meeting Now</div>
            </div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-icon blue">📹</div>
          <div className="stat-info">
            <div className="stat-value">{filteredStats.reduce((sum, [, data]) => sum + data.meetingCount, 0)}</div>
            <div className="stat-label">Total Meetings</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">⏱</div>
          <div className="stat-info">
            <div className="stat-value">{formatDuration(filteredStats.reduce((sum, [, data]) => sum + data.totalSeconds, 0))}</div>
            <div className="stat-label">Total Meeting Time</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon teal">📊</div>
          <div className="stat-info">
            <div className="stat-value">{filteredStats.length}</div>
            <div className="stat-label">Employees with Meetings</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📹 Meeting Logs</div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Status</th>
                <th>Meetings</th>
                <th>Total Time</th>
                <th>Avg Duration</th>
                <th>Recent Activity</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.map(([userId, data]) => (
                <tr key={userId} style={{ background: data.isLive ? 'var(--danger-light)' : '' }}>
                  <td style={{ fontWeight: 600 }}>{data.userName}</td>
                  <td>
                    {data.isLive ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 600, fontFamily: 'monospace' }}>
                        📹 {formatMeetingDuration(data.liveSeconds)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>— Idle</span>
                    )}
                  </td>
                  <td><span className="badge badge-primary">{data.meetingCount}</span></td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{formatDuration(data.totalSeconds)}</td>
                  <td style={{ fontSize: 13 }}>{formatDuration(data.avgDuration)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {data.logs.length > 0 ? (
                      <span>Last: {new Date(data.logs[0].startTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} ({formatDuration(data.logs[0].durationSeconds)})</span>
                    ) : 'No meetings'}
                  </td>
                </tr>
              ))}
              {filteredStats.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                    No meeting records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AttendanceTab = ({ allAttendance, allUsers, today, isHR, currentUser, markAttendance }) => {
  const [dateFilter, setDateFilter] = useState(today);
  const [search, setSearch] = useState('');
  const [breakTimer, setBreakTimer] = useState(0);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState(null);

  const filtered = allAttendance.filter(a => {
    const matchDate = a.date === dateFilter;
    const matchSearch = !search || a.userName.toLowerCase().includes(search.toLowerCase());
    if (!isHR) return a.userId === currentUser.id && matchDate;
    return matchDate && matchSearch;
  });

  const todayRecord = allAttendance.find(a => a.userId === currentUser.id && a.date === today);

  const getStoredBreak = () => {
    const stored = localStorage.getItem('zsm_break_state');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.date === today && data.userId === currentUser.id) {
          return data;
        }
      } catch {}
    }
    return null;
  };

  const saveBreakState = (isOnBreak, breakStartTime, breakTimer) => {
    localStorage.setItem('zsm_break_state', JSON.stringify({
      date: today,
      userId: currentUser.id,
      isOnBreak,
      breakStartTime,
      breakTimer,
    }));
  };

  useEffect(() => {
    const stored = getStoredBreak();
    if (stored && stored.isOnBreak && stored.breakStartTime) {
      setIsOnBreak(true);
      setBreakStartTime(stored.breakStartTime);
      setBreakTimer(stored.breakTimer);
    }
  }, []);

  useEffect(() => {
    let interval;
    if (isOnBreak && breakStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - breakStartTime) / 1000);
        setBreakTimer(elapsed);
        saveBreakState(true, breakStartTime, elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOnBreak, breakStartTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleStartBreak = () => {
    const startTime = Date.now();
    setIsOnBreak(true);
    setBreakStartTime(startTime);
    setBreakTimer(0);
    saveBreakState(true, startTime, 0);
  };

  const handleEndBreak = () => {
    setIsOnBreak(false);
    setBreakStartTime(null);
    setBreakTimer(0);
    localStorage.removeItem('zsm_break_state');
  };

  return (
    <div>
      {/* My Attendance + Break Timer - For ALL users */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: 280 }}>
          <div className="card-header">
            <div className="card-title">⏰ My Attendance — Today</div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {!todayRecord ? (
                <button className="btn btn-success btn-lg" onClick={() => markAttendance(currentUser.id, currentUser.name, 'login')}>
                  🟢 Mark Login
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ padding: '10px 16px', background: 'var(--success-light)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>
                    ✅ Logged In: {todayRecord.loginTime}
                    </div>
                    {!todayRecord.logoutTime && (
                      <button className="btn btn-danger" onClick={() => markAttendance(currentUser.id, currentUser.name, 'logout')}>
                        🔴 Mark Logout
                      </button>
                    )}
                    {todayRecord.logoutTime && (
                      <div style={{ padding: '10px 16px', background: 'var(--danger-light)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>
                        🔴 Logged Out: {todayRecord.logoutTime}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ flex: 1, minWidth: 220 }}>
            <div className="card-header">
              <div className="card-title">☕ Break Timer</div>
            </div>
            <div className="card-body">
              {isOnBreak && (
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', marginBottom: 8 }}>
                  {formatTime(breakTimer)}
                </div>
              )}
              <button
                onClick={isOnBreak ? handleEndBreak : handleStartBreak}
                disabled={!isOnBreak && !todayRecord?.loginTime}
                style={{
                  backgroundColor: isOnBreak ? '#e74c3c' : '#2ecc71',
                  color: '#fff',
                  padding: '10px 15px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: (!isOnBreak && !todayRecord?.loginTime) ? 'not-allowed' : 'pointer',
                  opacity: (!isOnBreak && !todayRecord?.loginTime) ? 0.6 : 1,
                }}
              >
                {isOnBreak ? '⏹️ End Break' : '▶️ Start Break'}
              </button>
            </div>
          </div>
        </div>
      }

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {isHR && (
          <div className="search-bar">
            🔍 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..." />
          </div>
        )}
        <input type="date" className="form-control" style={{ width: 'auto' }} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 Attendance Records — {dateFilter}</div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{filtered.length} records</span>
        </div>
        <div className="table-container">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No attendance records</div>
              <div className="empty-state-text">No records found for {dateFilter}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Login Time</th>
                  <th>Logout Time</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rec => {
                  const duration = rec.loginTime && rec.logoutTime
                    ? (() => {
                      const [lh, lm] = rec.loginTime.split(':').map(Number);
                      const [oh, om] = rec.logoutTime.split(':').map(Number);
                      const mins = (oh * 60 + om) - (lh * 60 + lm);
                      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                    })()
                    : '—';
                  return (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 600 }}>{rec.userName}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rec.date}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--success)', fontFamily: 'monospace' }}>{rec.loginTime}</span>
                      </td>
                      <td>
                        {rec.logoutTime
                          ? <span style={{ fontWeight: 600, color: 'var(--danger)', fontFamily: 'monospace' }}>{rec.logoutTime}</span>
                          : <span className="badge badge-warning">Still In</span>}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{duration}</td>
                      <td><span className={`badge ${rec.status === 'Present' ? 'badge-success' : 'badge-danger'}`}>{rec.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const LeavesTab = ({ allLeaves, isHR, updateLeave, currentUser }) => {
  const myLeaves = isHR ? allLeaves : allLeaves.filter(l => l.userId === currentUser.id);

  const checkLeaveEligibility = (userId, dateOfJoining) => {
    const monthsWorked = Math.floor((new Date() - new Date(dateOfJoining)) / (1000 * 60 * 60 * 24 * 30));
    return monthsWorked >= 12;
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📅 Leave Requests ({myLeaves.length})</div>
      </div>
      <div className="table-container">
        {myLeaves.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">No leave requests</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                {isHR && <th>Employee</th>}
                <th>Type</th>
                <th>Date</th>
                <th>Reason</th>
                <th>Applied On</th>
                <th>Status</th>
                {isHR && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {myLeaves.map(leave => (
                <tr key={leave.id}>
                  {isHR && <td style={{ fontWeight: 600 }}>{leave.userName}</td>}
                  <td><span className={`badge ${leave.type === 'Full Day' ? 'badge-info' : 'badge-warning'}`}>{leave.type}</span></td>
                  <td style={{ fontWeight: 600 }}>{leave.date}</td>
                  <td style={{ fontSize: 13 }}>{leave.reason}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{leave.appliedOn}</td>
                  <td>
                    <span className={`badge ${leave.status === 'Approved' ? 'badge-success' : leave.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                      {leave.status}
                    </span>
                  </td>
                  {isHR && leave.status === 'Pending' && (
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-success" onClick={() => updateLeave(leave.id, 'Approved')}>✅ Approve</button>
                        <button className="btn btn-sm btn-danger" onClick={() => updateLeave(leave.id, 'Rejected')}>✕</button>
                      </div>
                    </td>
                  )}
                  {isHR && leave.status !== 'Pending' && <td>—</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const ApplyLeaveTab = ({ applyLeave, onApplied }) => {
  const { currentUser, allUsers } = useApp();
  const [form, setForm] = useState({ type: 'Full Day', date: '', reason: '' });
  const [submitted, setSubmitted] = useState(false);

  const myUser = allUsers.find(u => u.id === currentUser.id);
  const monthsWorked = myUser?.dateOfJoining
    ? Math.floor((new Date() - new Date(myUser.dateOfJoining)) / (1000 * 60 * 60 * 24 * 30))
    : 0;
  const isEligible = monthsWorked >= 12;

  // Check if selected date is Tuesday-Thursday
  const isValidDay = (dateStr) => {
    if (!dateStr) return true;
    const day = new Date(dateStr).getDay();
    return day >= 2 && day <= 4; // Tue=2, Wed=3, Thu=4
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValidDay(form.date)) {
      alert('Paid leave can only be taken on Tuesday, Wednesday, or Thursday.');
      return;
    }
    applyLeave(form);
    setSubmitted(true);
    setTimeout(() => { onApplied(); setSubmitted(false); }, 1500);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">➕ Apply for Leave</div>
      </div>
      <div className="card-body" style={{ maxWidth: 500 }}>
        {!isEligible && (
          <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
            ⚠️ <strong>Leave Eligibility:</strong> You need at least 12 months of service to be eligible for paid leave.
            You have worked for <strong>{monthsWorked} months</strong>.
          </div>
        )}
        {isEligible && (
          <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
            ✅ You are eligible for 1 paid leave per month (Tuesday–Thursday only)
          </div>
        )}
        {submitted && (
          <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, fontWeight: 600 }}>
            ✅ Leave application submitted successfully!
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Leave Type</label>
            <select className="form-control" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} disabled={!isEligible}>
              <option>Full Day</option>
              <option>Half Day</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Leave Date <span className="required">*</span></label>
            <input className="form-control" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required disabled={!isEligible} />
            <div className="form-hint">📅 Paid leave allowed only on Tuesday, Wednesday, or Thursday</div>
            {form.date && !isValidDay(form.date) && (
              <div className="form-error">This day is not allowed for paid leave. Choose Tue–Thu.</div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Reason <span className="required">*</span></label>
            <textarea className="form-control" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={3} required disabled={!isEligible} placeholder="Reason for leave..." />
          </div>
          <button type="submit" className="btn btn-primary" disabled={!isEligible}>
            Submit Leave Application
          </button>
        </form>
      </div>
    </div>
  );
};

export default HRPage;
