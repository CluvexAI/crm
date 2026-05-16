import React, { useState } from 'react';
import html2pdf from 'html2pdf.js';

const getHours = (start, end) => {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / (1000 * 60 * 60);
};

const SimpleBarChart = ({ data, title, color }) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ background: 'white', padding: 15, borderRadius: 8, border: '1px solid var(--border-light)', flex: 1, minWidth: 250 }}>
      <h4 style={{ marginBottom: 15, fontSize: 14, color: 'var(--text-main)' }}>{title}</h4>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: 150, gap: 8, paddingBottom: 5, borderBottom: '1px solid #eee' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div 
              title={`${d.label}: ${d.value}`}
              style={{ 
                width: '100%', 
                height: `${(d.value / maxVal) * 100}%`, 
                background: color, 
                borderRadius: '4px 4px 0 0',
                minHeight: d.value > 0 ? 4 : 0,
                transition: 'height 0.3s ease'
              }} 
            />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdvancedAttendanceReport = ({ allUsers, allAttendance, allLeaves, manuallyUpsertAttendanceLog }) => {
  const [employeeId, setEmployeeId] = useState('all');
  const [reportType, setReportType] = useState('Weekly');
  
  const [weekOffset, setWeekOffset] = useState(0); 
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [generatedReport, setGeneratedReport] = useState(null);

  // Manual Log Entry Modal State
  const [editingLog, setEditingLog] = useState(null);
  const [formData, setFormData] = useState({ login: '', logout: '', breaks: 0, meetings: 0, status: 'Present', notes: '' });

  const openLogModal = (log) => {
    const defaultLogin = log.login ? new Date(log.login).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '';
    const defaultLogout = log.logout ? new Date(log.logout).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '';
    
    setFormData({
      login: defaultLogin,
      logout: defaultLogout,
      breaks: log.breakHrs ? Math.round(log.breakHrs * 60) : 0,
      meetings: log.meetingHrs ? Math.round(log.meetingHrs * 60) : 0,
      status: log.status || 'Present',
      notes: log.notes || ''
    });
    setEditingLog(log);
  };

  const saveLog = () => {
    if (!editingLog) return;
    
    const buildIso = (timeStr) => {
      if (!timeStr) return null;
      return new Date(`${editingLog.date}T${timeStr}:00`).toISOString();
    };

    const newLog = {
      userId: editingLog.userId,
      userName: editingLog.userName,
      date: editingLog.date,
      loginTime: buildIso(formData.login),
      logoutTime: buildIso(formData.logout),
      breaks: formData.breaks > 0 ? [{ startTime: buildIso(formData.login) || new Date().toISOString(), endTime: new Date(new Date(buildIso(formData.login) || new Date()).getTime() + formData.breaks * 60000).toISOString(), duration: formData.breaks * 60 }] : [],
      meetings: formData.meetings > 0 ? [{ startTime: buildIso(formData.login) || new Date().toISOString(), endTime: new Date(new Date(buildIso(formData.login) || new Date()).getTime() + formData.meetings * 60000).toISOString(), duration: formData.meetings * 60 }] : [],
      status: formData.status,
      notes: formData.notes
    };

    if (manuallyUpsertAttendanceLog) {
      manuallyUpsertAttendanceLog(newLog);
      
      // We simulate a fast re-generation of the report to reflect local changes.
      setTimeout(() => {
        handleGenerate();
        setEditingLog(null);
      }, 100);
    } else {
      alert('Error: Backend connection missing.');
    }
  };

  const handleGenerate = () => {
    let targetStartDate = new Date();
    let targetEndDate = new Date();

    if (reportType === 'Weekly') {
      const today = new Date();
      const first = today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1) + (weekOffset * 7);
      targetStartDate = new Date(today.setDate(first));
      targetEndDate = new Date(targetStartDate);
      targetEndDate.setDate(targetStartDate.getDate() + 6);
    } else if (reportType === 'Monthly') {
      const [year, month] = selectedMonth.split('-');
      targetStartDate = new Date(year, month - 1, 1);
      targetEndDate = new Date(year, month, 0); 
    } else {
      if (!startDate || !endDate) return alert("Please select both dates");
      targetStartDate = new Date(startDate);
      targetEndDate = new Date(endDate);
    }

    targetStartDate.setHours(0, 0, 0, 0);
    targetEndDate.setHours(23, 59, 59, 999);

    const targetUsers = employeeId === 'all' 
      ? allUsers 
      : allUsers.filter(u => u.id === parseInt(employeeId) || u.uuid === employeeId);

    const dateArray = [];
    let currentDate = new Date(targetStartDate);
    while (currentDate <= targetEndDate) {
      dateArray.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    let summary = {
      totalWorkingDays: dateArray.filter(d => {
        const day = new Date(d).getDay();
        return day !== 0 && day !== 6; 
      }).length * targetUsers.length,
      daysPresent: 0,
      daysAbsent: 0,
      leaveTaken: 0,
      totalWorkingHours: 0,
      totalBreakTime: 0,
      totalMeetingHours: 0,
      lateLoginCount: 0,
      earlyLogoutCount: 0,
      logs: [],
      chartData: { attendance: [], hours: [], breaks: [], meetings: [] }
    };

    targetUsers.forEach(user => {
      dateArray.forEach(dateStr => {
        const isWeekend = new Date(dateStr).getDay() === 0 || new Date(dateStr).getDay() === 6;
        
        const attendance = allAttendance.find(a => a.userId === user.id && a.date === dateStr);
        const leave = allLeaves.find(l => l.userName === user.name && l.date === dateStr && l.status === 'Approved');

        let status = 'Absent';
        let login = null, logout = null, totalHrs = 0, breakHrs = 0, meetingHrs = 0;
        let breaks = 0, meetings = 0;
        let late = false, early = false;
        let notes = '';

        if (attendance) {
          status = attendance.status || 'Present';
          if (status === 'Present' || status === 'Half Day') summary.daysPresent++;
          login = attendance.loginTime;
          logout = attendance.logoutTime;
          notes = attendance.notes || '';

          if (login) {
            const loginDate = new Date(login);
            if (loginDate.getHours() >= 10 && loginDate.getMinutes() > 15) {
              late = true;
              summary.lateLoginCount++;
            }
          }
          if (logout) {
            const logoutDate = new Date(logout);
            if (logoutDate.getHours() < 18) {
              early = true;
              summary.earlyLogoutCount++;
            }
            totalHrs = getHours(login, logout);
          }

          attendance.breaks?.forEach(b => {
            if (b.endTime) breakHrs += getHours(b.startTime, b.endTime);
            breaks++;
          });
          attendance.meetings?.forEach(m => {
            if (m.endTime) meetingHrs += getHours(m.startTime, m.endTime);
            meetings++;
          });

          totalHrs -= breakHrs;
          if (totalHrs < 0) totalHrs = 0;

          summary.totalWorkingHours += totalHrs;
          summary.totalBreakTime += breakHrs;
          summary.totalMeetingHours += meetingHrs;

        } else if (leave) {
          status = 'Leave';
          summary.leaveTaken++;
        } else if (isWeekend) {
          status = 'Weekend';
        } else {
          summary.daysAbsent++;
        }

        if (employeeId !== 'all' || status !== 'Weekend') {
          summary.logs.push({
            date: dateStr,
            userId: user.id || user.uuid,
            userName: user.name,
            login, logout, totalHrs, breakHrs, meetingHrs, breaks, meetings, status, late, early, notes
          });
        }
      });
    });

    dateArray.forEach(dateStr => {
      const dayLogs = summary.logs.filter(l => l.date === dateStr);
      const dayLabel = dateStr.slice(5); 
      
      summary.chartData.attendance.push({
        label: dayLabel,
        value: dayLogs.filter(l => l.status === 'Present' || l.status === 'Half Day').length
      });
      summary.chartData.hours.push({
        label: dayLabel,
        value: dayLogs.reduce((acc, l) => acc + l.totalHrs, 0)
      });
      summary.chartData.breaks.push({
        label: dayLabel,
        value: dayLogs.reduce((acc, l) => acc + l.breakHrs, 0)
      });
      summary.chartData.meetings.push({
        label: dayLabel,
        value: dayLogs.reduce((acc, l) => acc + l.meetingHrs, 0)
      });
    });

    summary.attendancePercent = summary.totalWorkingDays > 0 
      ? Math.round((summary.daysPresent / summary.totalWorkingDays) * 100) 
      : 0;

    summary.startDate = targetStartDate.toISOString().split('T')[0];
    summary.endDate = targetEndDate.toISOString().split('T')[0];
    
    setGeneratedReport(summary);
  };

  const exportPDF = () => {
    const element = document.getElementById('report-content');
    html2pdf().from(element).save(`attendance-${reportType.toLowerCase()}-${employeeId}.pdf`);
  };

  const exportCSV = () => {
    if (!generatedReport) return;
    const headers = "Date,Employee,Login Time,Logout Time,Total Hours,Break Hours,Meeting Hours,Status,Late,Early Logout,Notes\n";
    const rows = generatedReport.logs.map(l => 
      `${l.date},"${l.userName}",${l.login ? new Date(l.login).toLocaleTimeString() : '-'},${l.logout ? new Date(l.logout).toLocaleTimeString() : '-'},${l.totalHrs.toFixed(2)},${l.breakHrs.toFixed(2)},${l.meetingHrs.toFixed(2)},${l.status},${l.late ? 'Yes' : 'No'},${l.early ? 'Yes' : 'No'},"${l.notes || ''}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${reportType.toLowerCase()}-${employeeId}.csv`;
    a.click();
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ background: 'var(--bg-secondary)' }}>
          <div className="card-title">🔍 Report Filter</div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, alignItems: 'end' }}>
          <div>
            <label className="form-label">Select Employee</label>
            <select className="form-control" value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
              <option value="all">All Employees</option>
              {allUsers.map(u => <option key={u.id || u.uuid} value={u.id || u.uuid}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Report Type</label>
            <select className="form-control" value={reportType} onChange={e => setReportType(e.target.value)}>
              <option>Weekly</option>
              <option>Monthly</option>
              <option>Between Two Dates</option>
            </select>
          </div>
          
          {reportType === 'Weekly' && (
            <div>
              <label className="form-label">Select Week</label>
              <select className="form-control" value={weekOffset} onChange={e => setWeekOffset(parseInt(e.target.value))}>
                <option value={0}>Current Week</option>
                <option value={-1}>Previous Week</option>
              </select>
            </div>
          )}

          {reportType === 'Monthly' && (
            <div>
              <label className="form-label">Select Month</label>
              <input type="month" className="form-control" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
            </div>
          )}

          {reportType === 'Between Two Dates' && (
            <>
              <div>
                <label className="form-label">Start Date</label>
                <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">End Date</label>
                <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </>
          )}

          <button className="btn btn-primary" onClick={handleGenerate} style={{ height: '38px' }}>
            Generate Report
          </button>
        </div>
      </div>

      {generatedReport && (
        <div id="report-content" style={{ background: 'white', padding: 20, borderRadius: 8, border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: 15, marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--primary)' }}>Attendance Report</h2>
              <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)' }}>
                {reportType} ({generatedReport.startDate} to {generatedReport.endDate})
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={exportPDF}>📄 PDF</button>
              <button className="btn btn-outline btn-sm" onClick={exportCSV}>📊 Excel/CSV</button>
              <button className="btn btn-outline btn-sm" onClick={() => window.print()}>🖨️ Print</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 15, marginBottom: 25 }}>
            {[
              { label: 'Working Days', val: generatedReport.totalWorkingDays, icon: '📅', color: '#34495e' },
              { label: 'Present', val: generatedReport.daysPresent, icon: '✅', color: '#27ae60' },
              { label: 'Absent', val: generatedReport.daysAbsent, icon: '❌', color: '#e74c3c' },
              { label: 'Leave', val: generatedReport.leaveTaken, icon: '🏖️', color: '#9b59b6' },
              { label: 'Late Logins', val: generatedReport.lateLoginCount, icon: '⏰', color: '#f39c12' },
              { label: 'Productive Hrs', val: generatedReport.totalWorkingHours.toFixed(1), icon: '⏱', color: '#2980b9' },
              { label: 'Attendance %', val: `${generatedReport.attendancePercent}%`, icon: '📈', color: generatedReport.attendancePercent > 80 ? '#27ae60' : '#e74c3c' },
            ].map((stat, i) => (
              <div key={i} style={{ padding: 15, background: '#f8f9fa', borderRadius: 8, borderLeft: `4px solid ${stat.color}` }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{stat.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 'bold', color: stat.color }}>{stat.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 15, marginBottom: 25 }}>
             <SimpleBarChart data={generatedReport.chartData.attendance} title="Attendance Trend" color="#27ae60" />
             <SimpleBarChart data={generatedReport.chartData.hours} title="Working Hours" color="#2980b9" />
             <SimpleBarChart data={generatedReport.chartData.breaks} title="Break Analysis" color="#f39c12" />
             <SimpleBarChart data={generatedReport.chartData.meetings} title="Meeting Participation" color="#9b59b6" />
          </div>

          <h3 style={{ marginBottom: 15 }}>Log Details</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  {employeeId === 'all' && <th>Employee</th>}
                  <th>Login</th>
                  <th>Logout</th>
                  <th>Total Hrs</th>
                  <th>Breaks</th>
                  <th>Meetings</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {generatedReport.logs.map((log, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{log.date}</td>
                    {employeeId === 'all' && <td>{log.userName}</td>}
                    <td>
                      {log.login ? new Date(log.login).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                      {log.late && <span className="badge" style={{ background: '#f39c12', color: 'white', marginLeft: 5, fontSize: 9 }}>LATE</span>}
                    </td>
                    <td>
                      {log.logout ? new Date(log.logout).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—'}
                      {log.early && <span className="badge" style={{ background: '#e74c3c', color: 'white', marginLeft: 5, fontSize: 9 }}>EARLY</span>}
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{log.totalHrs > 0 ? `${log.totalHrs.toFixed(1)}h` : '—'}</td>
                    <td>{log.breaks > 0 ? `${log.breakHrs.toFixed(1)}h (${log.breaks})` : '—'}</td>
                    <td>{log.meetings > 0 ? `${log.meetingHrs.toFixed(1)}h (${log.meetings})` : '—'}</td>
                    <td>
                      <span className={`badge`} style={{
                        background: log.status === 'Present' ? '#27ae60' : 
                                    log.status === 'Half Day' ? '#f39c12' : 
                                    log.status === 'Absent' ? '#e74c3c' : 
                                    log.status === 'Leave' ? '#9b59b6' : '#95a5a6',
                        color: 'white'
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.notes}</td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => openLogModal(log)}>+ Log</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {editingLog && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: 450, animation: 'slideUp 0.3s ease', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">✍️ Manual Log: {editingLog.userName}</div>
              <button className="btn btn-ghost" onClick={() => setEditingLog(null)}>✕</button>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: 15, fontSize: 13, background: 'var(--info-light)', padding: 10, borderRadius: 6, color: 'var(--text-main)' }}>
                You are updating attendance for <b>{editingLog.date}</b>.
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Login Time</label>
                  <input type="time" className="form-control" value={formData.login} onChange={e => setFormData({...formData, login: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Logout Time</label>
                  <input type="time" className="form-control" value={formData.logout} onChange={e => setFormData({...formData, logout: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Break (mins)</label>
                  <input type="number" className="form-control" value={formData.breaks} onChange={e => setFormData({...formData, breaks: parseInt(e.target.value) || 0})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Meeting (mins)</label>
                  <input type="number" className="form-control" value={formData.meetings} onChange={e => setFormData({...formData, meetings: parseInt(e.target.value) || 0})} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option>Present</option>
                  <option>Half Day</option>
                  <option>Absent</option>
                  <option>Leave</option>
                  <option>Holiday</option>
                  <option>Weekend</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea className="form-control" rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Reason for late/early etc." />
              </div>

              <button className="btn btn-primary w-full" onClick={saveLog}>Save Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedAttendanceReport;
