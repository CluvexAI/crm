import React, { useState, useMemo } from 'react';
import { ROLES } from '../data/mockData';

const ActivityReports = ({ allAttendance, allUsers, allLeaves, currentUser, isHR, submitDailyReport }) => {
  const [view, setView] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [selectedUser, setSelectedUser] = useState(isHR ? 'all' : currentUser.id);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [newWorkSummary, setNewWorkSummary] = useState('');

  const handleSubmitReport = () => {
    if (!newWorkSummary.trim()) {
      alert('Please enter a work summary before submitting.');
      return;
    }
    submitDailyReport(currentUser.id, currentUser.name, selectedDate, newWorkSummary);
    setNewWorkSummary('');
    alert('Daily report submitted successfully!');
  };

  // Get date range helpers
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  const getWeekEnd = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + 6;
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  const getMonthStart = (date) => {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };

  const getMonthEnd = (date) => {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  };

  // Filter records based on selected user
  const userRecords = useMemo(() => {
    let filteredAttendance = allAttendance;
    
    if (currentUser.role === ROLES.ADMIN) {
      const salesUserIds = new Set(allUsers.filter(u => u.role === ROLES.SALES).map(u => parseInt(u.id)));
      filteredAttendance = filteredAttendance.filter(a => !salesUserIds.has(parseInt(a.userId)));
    }

    if (!isHR || selectedUser === 'all') {
      return filteredAttendance;
    }
    return filteredAttendance.filter(a => String(a.userId) === String(selectedUser));
  }, [allAttendance, selectedUser, isHR, currentUser.role, allUsers]);

  // Daily Report Data
  const dailyData = useMemo(() => {
    return userRecords.filter(a => a.date === selectedDate);
  }, [userRecords, selectedDate]);

  // Weekly Report Data
  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);
  
  const weeklyData = useMemo(() => {
    return userRecords.filter(a => a.date >= weekStart && a.date <= weekEnd);
  }, [userRecords, weekStart, weekEnd]);

  // Monthly Report Data
  const monthStart = getMonthStart(selectedDate);
  const monthEnd = getMonthEnd(selectedDate);
  
  const monthlyData = useMemo(() => {
    return userRecords.filter(a => a.date >= monthStart && a.date <= monthEnd);
  }, [userRecords, monthStart, monthEnd]);

  // Calculate statistics
  const calculateStats = (records) => {
    const stats = {
      totalDays: new Set(records.map(r => r.date)).size,
      presentDays: records.length,
      totalHours: 0,
      totalBreakTime: 0,
      totalMeetingTime: 0,
      avgLoginTime: null,
      avgLogoutTime: null,
    };

    records.forEach(r => {
      if (r.loginTime && r.logoutTime) {
        const login = new Date(`2000-01-01 ${r.loginTime}`);
        const logout = new Date(`2000-01-01 ${r.logoutTime}`);
        const duration = (logout - login) / (1000 * 60 * 60);
        stats.totalHours += Math.max(0, duration);
      }

      (r.breaks || []).forEach(b => {
        if (b.startTime && b.endTime) {
          const start = new Date(`2000-01-01 ${b.startTime}`);
          const end = new Date(`2000-01-01 ${b.endTime}`);
          stats.totalBreakTime += (end - start) / (1000 * 60);
        }
      });

      (r.meetings || []).forEach(m => {
        if (m.startTime && m.endTime) {
          const start = new Date(`2000-01-01 ${m.startTime}`);
          const end = new Date(`2000-01-01 ${m.endTime}`);
          stats.totalMeetingTime += (end - start) / (1000 * 60);
        }
      });
    });

    return stats;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    return timeStr.substring(0, 5);
  };

  const formatDuration = (minutes) => {
    if (!minutes || minutes < 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatHours = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // DAILY REPORT
  // ═══════════════════════════════════════════════════════════════════════════
  const renderDailyReport = () => {
    const dailyStats = calculateStats(dailyData);

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">📅 Daily Activity Report</div>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: 150, margin: 0 }} 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)} 
            />
          </div>
        </div>

        {currentUser.role === ROLES.HR && selectedDate === new Date().toISOString().split('T')[0] && (
          <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--primary)' }}>
            <div className="card-header">
              <div className="card-title">📝 Submit Today's Report</div>
            </div>
            <div className="card-body">
              <textarea
                className="form-control"
                rows="3"
                placeholder="Write your work summary for today..."
                value={newWorkSummary}
                onChange={e => setNewWorkSummary(e.target.value)}
              />
              <button 
                className="btn btn-primary" 
                style={{ marginTop: 10 }}
                onClick={handleSubmitReport}
              >
                Submit Report
              </button>
            </div>
          </div>
        )}

        {dailyData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No Activity Today</div>
            <div className="empty-state-text">No attendance records found for {selectedDate}</div>
          </div>
        ) : (
          <>
            {/* Daily Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon teal">⏱️</div>
                <div className="stat-info">
                  <div className="stat-value">{formatHours(dailyStats.totalHours)}</div>
                  <div className="stat-label">Total Duration</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange">☕</div>
                <div className="stat-info">
                  <div className="stat-value">{formatDuration(dailyStats.totalBreakTime)}</div>
                  <div className="stat-label">Break Time</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue">📞</div>
                <div className="stat-info">
                  <div className="stat-value">{formatDuration(dailyStats.totalMeetingTime)}</div>
                  <div className="stat-label">Meeting Time</div>
                </div>
              </div>
            </div>

            {/* Daily Details */}
            {dailyData.map(record => (
              <div key={record.id} className="card" style={{ marginBottom: 16 }}>
                <div className="card-header" style={{ background: 'var(--info-light)' }}>
                  <div className="card-title">{record.userName} - {record.date}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatTime(record.loginTime)} - {record.logoutTime ? formatTime(record.logoutTime) : <span style={{ color: 'var(--success)' }}>● Online</span>}
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Login/Logout */}
                    <div>
                      <h4 style={{ marginBottom: 12, fontSize: 13, fontWeight: 600 }}>⏰ Time Log</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                          <span>Login:</span>
                          <span style={{ fontWeight: 600 }}>{formatTime(record.loginTime)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                          <span>Logout:</span>
                          <span style={{ fontWeight: 600 }}>
                            {record.logoutTime ? formatTime(record.logoutTime) : <span style={{ color: 'var(--success)' }}>Still Online</span>}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                          <span>Total Hours:</span>
                          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                            {record.logoutTime ? formatHours(calculateStats([record]).totalHours) : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Breaks & Meetings */}
                    <div>
                      <h4 style={{ marginBottom: 12, fontSize: 13, fontWeight: 600 }}>📊 Activities</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                          <span>Breaks:</span>
                          <span style={{ fontWeight: 600 }}>{record.breaks.length}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                          <span>Total Break Time:</span>
                          <span style={{ fontWeight: 600 }}>{formatDuration(calculateStats([record]).totalBreakTime)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                          <span>Meetings:</span>
                          <span style={{ fontWeight: 600 }}>{record.meetings.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Work Summary Display */}
                  {record.workSummary && (
                    <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                      <h4 style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>📝 Work Summary</h4>
                      <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{record.workSummary}</div>
                    </div>
                  )}

                  {/* Breaks Table */}
                  {record.breaks.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ marginBottom: 10, fontSize: 12, fontWeight: 600 }}>☕ Breaks</h4>
                      <div className="table-container">
                        <table style={{ fontSize: 12 }}>
                          <thead>
                            <tr><th>Start</th><th>End</th><th>Duration</th></tr>
                          </thead>
                          <tbody>
                            {record.breaks.map((b, i) => {
                              const start = new Date(`2000-01-01 ${b.startTime}`);
                              const end = b.endTime ? new Date(`2000-01-01 ${b.endTime}`) : null;
                              const duration = end ? (end - start) / (1000 * 60) : null;
                              return (
                                <tr key={i}>
                                  <td>{formatTime(b.startTime)}</td>
                                  <td>{b.endTime ? formatTime(b.endTime) : <span style={{ color: 'var(--warning)' }}>● Active</span>}</td>
                                  <td>{duration ? formatDuration(duration) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Meetings Table */}
                  {record.meetings.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <h4 style={{ marginBottom: 10, fontSize: 12, fontWeight: 600 }}>📞 Meetings</h4>
                      <div className="table-container">
                        <table style={{ fontSize: 12 }}>
                          <thead>
                            <tr><th>Start</th><th>End</th><th>Duration</th></tr>
                          </thead>
                          <tbody>
                            {record.meetings.map((m, i) => {
                              const start = new Date(`2000-01-01 ${m.startTime}`);
                              const end = m.endTime ? new Date(`2000-01-01 ${m.endTime}`) : null;
                              const duration = end ? (end - start) / (1000 * 60) : null;
                              return (
                                <tr key={i}>
                                  <td>{formatTime(m.startTime)}</td>
                                  <td>{m.endTime ? formatTime(m.endTime) : <span style={{ color: 'var(--warning)' }}>● Active</span>}</td>
                                  <td>{duration ? formatDuration(duration) : '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEKLY REPORT
  // ═══════════════════════════════════════════════════════════════════════════
  const renderWeeklyReport = () => {
    const weeklyStats = calculateStats(weeklyData);
    const attendancePercentage = weeklyStats.totalDays > 0 ? 
      (weeklyStats.presentDays / weeklyStats.totalDays * 100).toFixed(1) : 0;

    // Group by employee for HR view
    const userGroups = {};
    weeklyData.forEach(record => {
      if (!userGroups[record.userId]) {
        userGroups[record.userId] = [];
      }
      userGroups[record.userId].push(record);
    });

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">📊 Weekly Activity Report</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Week of {weekStart} to {weekEnd}
            </div>
          </div>
        </div>

        {weeklyData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No Activity This Week</div>
            <div className="empty-state-text">No attendance records found for this week</div>
          </div>
        ) : (
          <>
            {/* Weekly Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon teal">📅</div>
                <div className="stat-info">
                  <div className="stat-value">{weeklyStats.presentDays}/{weeklyStats.totalDays}</div>
                  <div className="stat-label">Days Present</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green">📈</div>
                <div className="stat-info">
                  <div className="stat-value">{attendancePercentage}%</div>
                  <div className="stat-label">Attendance Rate</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue">⏰</div>
                <div className="stat-info">
                  <div className="stat-value">{formatHours(weeklyStats.totalHours)}</div>
                  <div className="stat-label">Total Hours</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange">☕</div>
                <div className="stat-info">
                  <div className="stat-value">{formatDuration(weeklyStats.totalBreakTime)}</div>
                  <div className="stat-label">Break Time</div>
                </div>
              </div>
            </div>

            {/* Weekly Summary Table */}
            <div className="card">
              <div className="card-header"><div className="card-title">📋 Weekly Summary</div></div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Date</th>
                      <th>Login</th>
                      <th>Logout</th>
                      <th>Total Hours</th>
                      <th>Breaks</th>
                      <th>Meetings</th>
                      <th>Work Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyData.sort((a, b) => b.date.localeCompare(a.date)).map(record => {
                      const recordStats = calculateStats([record]);
                      return (
                        <tr key={record.id}>
                          <td style={{ fontWeight: 600 }}>{record.userName}</td>
                          <td>{record.date}</td>
                          <td>{formatTime(record.loginTime)}</td>
                          <td>{record.logoutTime ? formatTime(record.logoutTime) : <span style={{ color: 'var(--success)' }}>● Online</span>}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                            {record.logoutTime ? formatHours(recordStats.totalHours) : '—'}
                          </td>
                          <td>{record.breaks.length}</td>
                          <td>{record.meetings.length}</td>
                          <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={record.workSummary || ''}>
                            {record.workSummary || <span style={{ color: 'var(--text-muted)' }}>No summary</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* By Employee Summary */}
            {isHR && Object.keys(userGroups).length > 1 && (
              <div className="card" style={{ marginTop: 24 }}>
                <div className="card-header"><div className="card-title">👥 By Employee</div></div>
                <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                  {Object.entries(userGroups).map(([userId, records]) => {
                    const empStats = calculateStats(records);
                    const empUser = allUsers.find(u => u.id === parseInt(userId));
                    return (
                      <div key={userId} style={{ 
                        border: '1px solid var(--border-light)', 
                        borderRadius: 8, 
                        padding: 12,
                        background: 'var(--bg-secondary)'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: 10 }}>{empUser?.name || 'Unknown'}</div>
                        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Days Present:</span>
                            <span style={{ fontWeight: 600 }}>{empStats.presentDays}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Total Hours:</span>
                            <span style={{ fontWeight: 600 }}>{formatHours(empStats.totalHours)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Break Time:</span>
                            <span style={{ fontWeight: 600 }}>{formatDuration(empStats.totalBreakTime)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Meetings:</span>
                            <span style={{ fontWeight: 600 }}>{records.reduce((sum, r) => sum + r.meetings.length, 0)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MONTHLY REPORT
  // ═══════════════════════════════════════════════════════════════════════════
  const renderMonthlyReport = () => {
    const monthlyStats = calculateStats(monthlyData);
    const attendancePercentage = monthlyStats.totalDays > 0 ? 
      (monthlyStats.presentDays / monthlyStats.totalDays * 100).toFixed(1) : 0;

    // Group by employee for HR view
    const userGroups = {};
    monthlyData.forEach(record => {
      if (!userGroups[record.userId]) {
        userGroups[record.userId] = [];
      }
      userGroups[record.userId].push(record);
    });

    // Group by date for calendar view
    const dateGroups = {};
    monthlyData.forEach(record => {
      if (!dateGroups[record.date]) {
        dateGroups[record.date] = [];
      }
      dateGroups[record.date].push(record);
    });

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">📈 Monthly Activity Report</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {monthStart} to {monthEnd}
            </div>
          </div>
        </div>

        {monthlyData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No Activity This Month</div>
            <div className="empty-state-text">No attendance records found for this month</div>
          </div>
        ) : (
          <>
            {/* Monthly Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon teal">📅</div>
                <div className="stat-info">
                  <div className="stat-value">{monthlyStats.presentDays}</div>
                  <div className="stat-label">Total Working Days</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green">📊</div>
                <div className="stat-info">
                  <div className="stat-value">{attendancePercentage}%</div>
                  <div className="stat-label">Attendance Rate</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue">⏰</div>
                <div className="stat-info">
                  <div className="stat-value">{formatHours(monthlyStats.totalHours)}</div>
                  <div className="stat-label">Total Hours</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon orange">☕</div>
                <div className="stat-info">
                  <div className="stat-value">{formatDuration(monthlyStats.totalBreakTime)}</div>
                  <div className="stat-label">Total Break Time</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon purple">📞</div>
                <div className="stat-info">
                  <div className="stat-value">{formatDuration(monthlyStats.totalMeetingTime)}</div>
                  <div className="stat-label">Total Meeting Time</div>
                </div>
              </div>
            </div>

            {/* Daily Breakdown */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header"><div className="card-title">📋 Daily Breakdown</div></div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Days Present</th>
                      <th>Total Hours</th>
                      <th>Break Time</th>
                      <th>Meetings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(dateGroups).sort(([a], [b]) => b.localeCompare(a)).map(([date, records]) => {
                      const dayStats = calculateStats(records);
                      return (
                        <tr key={date}>
                          <td style={{ fontWeight: 600 }}>{date}</td>
                          <td>{records.length}</td>
                          <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{formatHours(dayStats.totalHours)}</td>
                          <td>{formatDuration(dayStats.totalBreakTime)}</td>
                          <td>{records.reduce((sum, r) => sum + r.meetings.length, 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Employee Performance */}
            {isHR && Object.keys(userGroups).length > 0 && (
              <div className="card">
                <div className="card-header"><div className="card-title">👥 Employee Performance</div></div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Days Present</th>
                        <th>Total Hours</th>
                        <th>Avg Hours/Day</th>
                        <th>Break Time</th>
                        <th>Meetings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(userGroups).map(([userId, records]) => {
                        const empStats = calculateStats(records);
                        const empUser = allUsers.find(u => u.id === parseInt(userId));
                        const avgHours = empStats.presentDays > 0 ? empStats.totalHours / empStats.presentDays : 0;
                        return (
                          <tr key={userId}>
                            <td style={{ fontWeight: 600 }}>{empUser?.name || 'Unknown'}</td>
                            <td>{empStats.presentDays}</td>
                            <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{formatHours(empStats.totalHours)}</td>
                            <td>{formatHours(avgHours)}</td>
                            <td>{formatDuration(empStats.totalBreakTime)}</td>
                            <td>{records.reduce((sum, r) => sum + r.meetings.length, 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* View Selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className={`btn ${view === 'daily' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setView('daily')}
        >
          📅 Daily Report
        </button>
        <button
          className={`btn ${view === 'weekly' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setView('weekly')}
        >
          📊 Weekly Report
        </button>
        <button
          className={`btn ${view === 'monthly' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setView('monthly')}
        >
          📈 Monthly Report
        </button>

        {/* User Filter for HR */}
        {isHR && (
          <select
            className="form-control"
            style={{ width: 'auto', marginLeft: 'auto' }}
            value={selectedUser}
            onChange={e => setSelectedUser(e.target.value)}
          >
            <option value="all">All Employees</option>
            {allUsers.filter(u => u.role !== 'Admin').map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Report Views */}
      {view === 'daily' && renderDailyReport()}
      {view === 'weekly' && renderWeeklyReport()}
      {view === 'monthly' && renderMonthlyReport()}
    </div>
  );
};

export default ActivityReports;
