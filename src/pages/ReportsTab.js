import React, { useState, useMemo } from 'react';
import { ROLES, DEPARTMENTS } from '../data/mockData';
import { getAllMeetingLogs } from '../services/meetingService';

const SHIFT_START = 9 * 60;
const SHIFT_END = 18 * 60;
const WORK_HOURS = 9;

const toMinutes = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

const diffMins = (start, end) => {
  if (!start || !end) return 0;
  return (new Date(end) - new Date(start)) / 60000;
};

const fmtMins = (mins) => {
  if (!mins && mins !== 0) return '\u2014';
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.floor(Math.abs(mins) % 60);
  const sign = mins < 0 ? '-' : '';
  return `${sign}${h}h ${m}m`;
};

const fmtDate = (d) => {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateShort = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const fmtTime = (iso) => {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getWeekRange = (dateStr) => {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return { start: mon.toISOString().split('T')[0], end: sun.toISOString().split('T')[0] };
};

const getMonthRange = (year, month) => {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

const eachDay = (start, end) => {
  const days = [];
  let cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    days.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

const inRange = (dateStr, start, end) => dateStr >= start && dateStr <= end;

const CHART_COLORS = ['#0E5491', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'];
const DEPT_COLORS = {
  Sales: '#10b981', Backend: '#8b5cf6', HR: '#f59e0b',
  Accounts: '#ef4444', Support: '#3b82f6', Quality: '#06b6d4',
  Management: '#0E5491', Graphics: '#ec4899',
};

// ─── Export helpers ──────────────────────────────────────────────────────────

const downloadCSV = (filename, headers, rows) => {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};

const printReport = (reportTitle) => {
  const styles = Array.from(document.styleSheets).map(s => {
    try { return Array.from(s.cssRules || []).map(r => r.cssText).join(''); }
    catch (e) { return ''; }
  }).join('');
  const content = document.getElementById('report-content')?.innerHTML || '';
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>${reportTitle}</title><style>${styles} body { padding: 20px; font-family: Arial; } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 12px; } th { background: #0E5491; color: white; } .no-print { display: none; }</style></head><body><h2>${reportTitle}</h2>${content}</body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); w.close(); }, 500);
};

// ─── ReportsTab Component ────────────────────────────────────────────────────

const ReportsTab = ({ allUsers, allAttendance, allLeaves, isHR }) => {
  const today = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [reportType, setReportType] = useState('attendance');
  const [duration, setDuration] = useState('weekly');
  const [weekStart, setWeekStart] = useState(getWeekRange(today).start);
  const [weekEnd, setWeekEnd] = useState(getWeekRange(today).end);
  const [monthYear, setMonthYear] = useState(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const meetingLogs = useMemo(() => getAllMeetingLogs(), []);

  const dateRange = useMemo(() => {
    if (duration === 'weekly') return { start: weekStart, end: weekEnd };
    if (duration === 'monthly') {
      const [y, m] = monthYear.split('-').map(Number);
      return getMonthRange(y, m);
    }
    return { start: fromDate || today, end: toDate || today };
  }, [duration, weekStart, weekEnd, monthYear, fromDate, toDate, today]);

  const { start: rangeStart, end: rangeEnd } = dateRange;

  // ─── Filtered users ────────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      if (employeeFilter !== 'all' && u.uuid !== employeeFilter) return false;
      if (deptFilter !== 'all' && u.department !== deptFilter) return false;
      if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.employeeId?.toLowerCase().includes(search.toLowerCase())) return false;
      return u.status !== 'Deleted';
    });
  }, [allUsers, employeeFilter, deptFilter, search]);

  // ─── Computed attendance report data ────────────────────────────────────────

  const attendanceReport = useMemo(() => {
    return filteredUsers.map(u => {
      const records = allAttendance.filter(a => a.userId === u.id && inRange(a.date, rangeStart, rangeEnd));
      const daysInRange = eachDay(rangeStart, rangeEnd).filter(d => {
        const day = new Date(d).getDay();
        return day !== 0;
      });
      const presentDays = records.filter(r => r.status === 'Present');
      const absentDays = daysInRange.filter(d => !records.some(r => r.date === d));
      const lateDays = presentDays.filter(r => {
        const loginMin = toMinutes(r.loginTime);
        return loginMin !== null && loginMin > SHIFT_START + 15;
      });
      let totalWorkMins = 0;
      let totalBreakMins = 0;
      presentDays.forEach(r => {
        totalWorkMins += diffMins(r.loginTime, r.logoutTime || new Date().toISOString());
        (r.breaks || []).forEach(b => { totalBreakMins += (b.duration || 0) / 60; });
      });
      const netWorkMins = totalWorkMins - totalBreakMins;
      const avgWorkMins = presentDays.length > 0 ? netWorkMins / presentDays.length : 0;
      const overtimeMins = presentDays.reduce((sum, r) => {
        const logoutMin = toMinutes(r.logoutTime);
        return sum + (logoutMin && logoutMin > SHIFT_END ? logoutMin - SHIFT_END : 0);
      }, 0);
      const undertimeMins = presentDays.reduce((sum, r) => {
        const loginMin = toMinutes(r.loginTime);
        return sum + (loginMin && loginMin > SHIFT_START ? loginMin - SHIFT_START : 0);
      }, 0);

      return {
        user: u,
        totalPresent: presentDays.length,
        totalAbsent: absentDays.length,
        totalLate: lateDays.length,
        avgWorkMins,
        totalWorkMins: netWorkMins,
        overtimeMins,
        undertimeMins,
        totalBreakMins,
        days: daysInRange.length,
        records: presentDays,
      };
    });
  }, [filteredUsers, allAttendance, rangeStart, rangeEnd]);

  // ─── Computed break report data ────────────────────────────────────────────

  const breakReport = useMemo(() => {
    return filteredUsers.map(u => {
      const records = allAttendance.filter(a => a.userId === u.id && inRange(a.date, rangeStart, rangeEnd) && a.status === 'Present');
      let totalBreaks = 0;
      let totalBreakMins = 0;
      const breakDetails = [];
      records.forEach(r => {
        (r.breaks || []).forEach(b => {
          if (b.duration) {
            totalBreaks++;
            totalBreakMins += b.duration / 60;
            breakDetails.push({ date: r.date, start: b.startTime, end: b.endTime, duration: b.duration / 60 });
          }
        });
      });
      const avgBreakMins = totalBreaks > 0 ? totalBreakMins / totalBreaks : 0;
      const longBreaks = breakDetails.filter(b => b.duration > 30);
      return {
        user: u,
        totalBreaks,
        totalBreakMins,
        avgBreakMins,
        longBreaks: longBreaks.length,
        breakDetails,
      };
    });
  }, [filteredUsers, allAttendance, rangeStart, rangeEnd]);

  // ─── Computed meeting report data ──────────────────────────────────────────

  const meetingReport = useMemo(() => {
    return filteredUsers.map(u => {
      const attendanceMeetings = [];
      allAttendance.filter(a => a.userId === u.id && inRange(a.date, rangeStart, rangeEnd)).forEach(r => {
        (r.meetings || []).forEach(m => {
          attendanceMeetings.push({
            date: r.date,
            startTime: m.startTime,
            endTime: m.endTime,
            duration: (m.duration || 0) / 60,
            title: m.title || 'Meeting',
            source: 'attendance',
          });
        });
      });
      const serviceMeetings = meetingLogs.filter(m => m.userId === u.id && inRange(m.startTime?.split('T')[0] || '', rangeStart, rangeEnd));
      serviceMeetings.forEach(m => {
        attendanceMeetings.push({
          date: m.startTime?.split('T')[0] || '',
          startTime: m.startTime,
          endTime: m.endTime,
          duration: (m.durationSeconds || 0) / 60,
          title: 'Meeting',
          source: 'service',
        });
      });
      const totalMins = attendanceMeetings.reduce((s, m) => s + (m.duration || 0), 0);
      const attendedCount = attendanceMeetings.filter(m => m.endTime).length;
      const missedCount = attendanceMeetings.filter(m => !m.endTime).length;
      return {
        user: u,
        meetings: attendanceMeetings,
        totalMeetings: attendanceMeetings.length,
        totalMins,
        attendedCount,
        missedCount,
        avgMins: attendanceMeetings.length > 0 ? totalMins / attendanceMeetings.length : 0,
      };
    });
  }, [filteredUsers, allAttendance, meetingLogs, rangeStart, rangeEnd]);

  // ─── Computed leave report data ────────────────────────────────────────────

  const leaveReport = useMemo(() => {
    return filteredUsers.map(u => {
      const leaves = allLeaves.filter(l => l.userId === u.id && inRange(l.date, rangeStart, rangeEnd));
      const sickLeaves = leaves.filter(l => l.type === 'Sick Leave');
      const casualLeaves = leaves.filter(l => l.type === 'Casual Leave');
      const earnedLeaves = leaves.filter(l => l.type === 'Earned Leave');
      const approved = leaves.filter(l => l.status === 'Approved');
      const pending = leaves.filter(l => l.status === 'Pending');
      const rejected = leaves.filter(l => l.status === 'Rejected');
      return {
        user: u,
        leaves,
        totalLeaves: leaves.length,
        approvedCount: approved.length,
        pendingCount: pending.length,
        rejectedCount: rejected.length,
        sickCount: sickLeaves.length,
        casualCount: casualLeaves.length,
        earnedCount: earnedLeaves.length,
        approved,
        pending,
        rejected,
      };
    });
  }, [filteredUsers, allLeaves, rangeStart, rangeEnd]);

  // ─── Summary stats ────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const presentToday = allAttendance.filter(a => a.date === today).length;
    const onLeave = allLeaves.filter(l => l.date === today && l.status === 'Approved').length;
    const todayRecords = allAttendance.filter(a => a.date === today && a.status === 'Present');
    let totalWorkMinsToday = 0;
    let totalBreakMinsToday = 0;
    let meetingCountToday = 0;
    todayRecords.forEach(r => {
      totalWorkMinsToday += diffMins(r.loginTime, r.logoutTime || new Date().toISOString());
      (r.breaks || []).forEach(b => { totalBreakMinsToday += (b.duration || 0) / 60; });
      meetingCountToday += (r.meetings || []).length;
    });
    const todayMeetingLogs = meetingLogs.filter(m => m.startTime?.split('T')[0] === today);
    meetingCountToday += todayMeetingLogs.length;
    const avgWorkMinsToday = todayRecords.length > 0 ? (totalWorkMinsToday - totalBreakMinsToday) / todayRecords.length : 0;
    return {
      totalEmployees: allUsers.filter(u => u.status !== 'Deleted').length,
      presentToday,
      onLeave,
      totalMeetings: meetingCountToday,
      avgWorkHours: avgWorkMinsToday / 60,
      totalBreakHours: totalBreakMinsToday / 60,
    };
  }, [allUsers, allAttendance, allLeaves, today, meetingLogs]);

  // ─── Chart data ────────────────────────────────────────────────────────────

  const attendanceTrend = useMemo(() => {
    const days = eachDay(rangeStart, rangeEnd).filter(d => new Date(d).getDay() !== 0);
    return days.map(d => {
      const present = allAttendance.filter(a => a.date === d && a.status === 'Present').length;
      const absent = filteredUsers.length - present;
      return { date: d, present, absent };
    });
  }, [allAttendance, filteredUsers, rangeStart, rangeEnd]);

  const deptWiseAttendance = useMemo(() => {
    return DEPARTMENTS.map(dept => {
      const deptUsers = allUsers.filter(u => u.department === dept && u.status !== 'Deleted');
      const present = deptUsers.filter(u => allAttendance.some(a => a.userId === u.id && a.date === today && a.status === 'Present')).length;
      return { dept, total: deptUsers.length, present, absent: deptUsers.length - present };
    });
  }, [allUsers, allAttendance, today]);

  const leaveStats = useMemo(() => {
    const stats = leaveReport.reduce((acc, r) => {
      acc.sick += r.sickCount;
      acc.casual += r.casualCount;
      acc.earned += r.earnedCount;
      return acc;
    }, { sick: 0, casual: 0, earned: 0 });
    return stats;
  }, [leaveReport]);

  const totalLeaveCount = leaveStats.sick + leaveStats.casual + leaveStats.earned || 1;

  // ─── Filtered report data based on status filter ───────────────────────────

  const getFilteredData = (reportData) => {
    let data = reportData;
    if (statusFilter === 'present') data = data.filter(r => r.totalPresent > 0);
    else if (statusFilter === 'absent') data = data.filter(r => r.totalAbsent > 0 && r.totalPresent === 0);
    else if (statusFilter === 'late') data = data.filter(r => r.totalLate > 0);
    else if (statusFilter === 'approved') data = data.filter(r => r.approvedCount > 0);
    else if (statusFilter === 'pending') data = data.filter(r => r.pendingCount > 0);
    else if (statusFilter === 'rejected') data = data.filter(r => r.rejectedCount > 0);
    return data;
  };

  const statusOptions = reportType === 'attendance'
    ? [{ value: 'all', label: 'All Status' }, { value: 'present', label: 'Present' }, { value: 'absent', label: 'Absent' }, { value: 'late', label: 'Late' }]
    : reportType === 'leave'
    ? [{ value: 'all', label: 'All Status' }, { value: 'approved', label: 'Approved' }, { value: 'pending', label: 'Pending' }, { value: 'rejected', label: 'Rejected' }]
    : [{ value: 'all', label: 'All' }];

  // ─── Render helpers ────────────────────────────────────────────────────────

  const renderSummaryCards = () => (
    <div className="stats-grid" style={{ marginBottom: 20 }}>
      <div className="stat-card"><div className="stat-icon blue">👥</div><div className="stat-info"><div className="stat-value">{summary.totalEmployees}</div><div className="stat-label">Total Employees</div></div></div>
      <div className="stat-card"><div className="stat-icon teal">✅</div><div className="stat-info"><div className="stat-value">{summary.presentToday}</div><div className="stat-label">Present Today</div></div></div>
      <div className="stat-card"><div className="stat-icon orange">📅</div><div className="stat-info"><div className="stat-value">{summary.onLeave}</div><div className="stat-label">On Leave</div></div></div>
      <div className="stat-card"><div className="stat-icon purple">🎥</div><div className="stat-info"><div className="stat-value">{summary.totalMeetings}</div><div className="stat-label">Total Meetings</div></div></div>
      <div className="stat-card"><div className="stat-icon green">⏱</div><div className="stat-info"><div className="stat-value">{summary.avgWorkHours.toFixed(1)}h</div><div className="stat-label">Avg Working Hours</div></div></div>
      <div className="stat-card"><div className="stat-icon red">☕</div><div className="stat-info"><div className="stat-value">{fmtMins(summary.totalBreakHours * 60)}</div><div className="stat-label">Total Break Time</div></div></div>
    </div>
  );

  const renderFilters = () => (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-body">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Report Type</label>
            <select className="form-control" value={reportType} onChange={e => { setReportType(e.target.value); setPage(1); }}>
              <option value="attendance">📋 Attendance</option>
              <option value="break">☕ Break</option>
              <option value="meeting">🎥 Meeting</option>
              <option value="leave">📅 Leave</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 120 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Duration</label>
            <select className="form-control" value={duration} onChange={e => { setDuration(e.target.value); setPage(1); }}>
              <option value="weekly">📆 Weekly</option>
              <option value="monthly">📅 Monthly</option>
              <option value="custom">🎯 Custom</option>
            </select>
          </div>
          {duration === 'weekly' && (
            <>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Week Start</label>
                <input className="form-control" type="date" value={weekStart} onChange={e => { setWeekStart(e.target.value); setPage(1); }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Week End</label>
                <input className="form-control" type="date" value={weekEnd} onChange={e => { setWeekEnd(e.target.value); setPage(1); }} />
              </div>
            </>
          )}
          {duration === 'monthly' && (
            <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Month</label>
              <input className="form-control" type="month" value={monthYear} onChange={e => { setMonthYear(e.target.value); setPage(1); }} />
            </div>
          )}
          {duration === 'custom' && (
            <>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                <label className="form-label" style={{ fontSize: 11 }}>From Date</label>
                <input className="form-control" type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
                <label className="form-label" style={{ fontSize: 11 }}>To Date</label>
                <input className="form-control" type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} />
              </div>
            </>
          )}
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Department</label>
            <select className="form-control" value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }}>
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 140 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Employee</label>
            <select className="form-control" value={employeeFilter} onChange={e => { setEmployeeFilter(e.target.value); setPage(1); }}>
              <option value="all">All Employees</option>
              {allUsers.filter(u => u.status !== 'Deleted').map(u => <option key={u.uuid} value={u.uuid}>{u.name} ({u.employeeId})</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 120 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Status</label>
            <select className="form-control" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 160, flex: 1 }}>
            <label className="form-label" style={{ fontSize: 11 }}>Search</label>
            <div className="search-bar" style={{ minWidth: 'unset' }}>
              🔍 <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search employee..." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTable = (headers, rows, emptyMsg) => (
    <div className="table-container">
      <table>
        <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{emptyMsg || 'No data found'}</td></tr>
          ) : (
            rows.map((row, i) => <tr key={i}>{row}</tr>)
          )}
        </tbody>
      </table>
    </div>
  );

  const renderPagination = (total) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '0 4px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Showing {Math.min(total, page * pageSize)} of {total}</div>
      {total > page * pageSize && (
        <button className="btn btn-sm btn-outline" onClick={() => setPage(p => p + 1)}>Load More ↓</button>
      )}
      {page > 1 && (
        <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))}>↑ Previous</button>
      )}
    </div>
  );

  const renderExportBar = (reportTitle, headers, dataRows) => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', flex: 1, alignSelf: 'center' }}>
        {reportTitle} ({rangeStart} to {rangeEnd})
      </span>
      <button className="btn btn-sm btn-outline" onClick={() => downloadCSV(`${reportTitle.replace(/\s+/g, '_')}_${rangeStart}_to_${rangeEnd}.csv`, headers, dataRows)}>📥 CSV</button>
      <button className="btn btn-sm btn-outline" onClick={() => printReport(reportTitle)}>🖨️ Print</button>
    </div>
  );

  // ─── Attendance Report View ────────────────────────────────────────────────

  const renderAttendanceReport = () => {
    const data = getFilteredData(attendanceReport).slice(0, page * pageSize);
    const csvHeaders = ['Employee', 'Emp ID', 'Department', 'Present Days', 'Absent Days', 'Late Days', 'Avg Working Hours', 'Total Hours', 'Overtime', 'Undertime'];
    const csvRows = data.map(r => [r.user.name, r.user.employeeId, r.user.department, r.totalPresent, r.totalAbsent, r.totalLate, (r.avgWorkMins / 60).toFixed(1), (r.totalWorkMins / 60).toFixed(1), (r.overtimeMins / 60).toFixed(1), (r.undertimeMins / 60).toFixed(1)]);
    const total = getFilteredData(attendanceReport).length;

    return (
      <div>
        {renderExportBar('Attendance Report', csvHeaders, csvRows)}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 Attendance Details</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>✅ Present: {attendanceReport.reduce((s, r) => s + r.totalPresent, 0)}</span>
              <span>❌ Absent: {attendanceReport.reduce((s, r) => s + r.totalAbsent, 0)}</span>
              <span>⏰ Late: {attendanceReport.reduce((s, r) => s + r.totalLate, 0)}</span>
            </div>
          </div>
          <div id="report-content">
            {renderTable(
              ['Employee', 'Department', 'Present', 'Absent', 'Late', 'Avg Hours', 'Total Hours', 'Overtime', 'Undertime'],
              data.map(r => [
                <td key="n"><div style={{ fontWeight: 600 }}>{r.user.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.user.employeeId}</div></td>,
                <td key="d">{r.user.department}</td>,
                <td key="p"><span className="badge badge-success">{r.totalPresent}</span></td>,
                <td key="a"><span className="badge badge-danger">{r.totalAbsent}</span></td>,
                <td key="l"><span className={`badge ${r.totalLate > 0 ? 'badge-warning' : 'badge-neutral'}`}>{r.totalLate}</span></td>,
                <td key="ah">{(r.avgWorkMins / 60).toFixed(1)}h</td>,
                <td key="th">{(r.totalWorkMins / 60).toFixed(1)}h</td>,
                <td key="ot" style={{ color: r.overtimeMins > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{r.overtimeMins > 0 ? fmtMins(r.overtimeMins) : '\u2014'}</td>,
                <td key="ut" style={{ color: r.undertimeMins > 30 ? 'var(--danger)' : 'var(--text-muted)' }}>{r.undertimeMins > 0 ? fmtMins(r.undertimeMins) : '\u2014'}</td>,
              ]),
              'No attendance records found for this period.'
            )}
          </div>
          {renderPagination(total)}
        </div>
      </div>
    );
  };

  // ─── Break Report View ─────────────────────────────────────────────────────

  const renderBreakReport = () => {
    const data = breakReport.filter(r => r.totalBreaks > 0).slice(0, page * pageSize);
    const csvHeaders = ['Employee', 'Emp ID', 'Dept', 'Total Breaks', 'Total Break Time', 'Avg Break Time', 'Long Break Alerts'];
    const csvRows = data.map(r => [r.user.name, r.user.employeeId, r.user.department, r.totalBreaks, fmtMins(r.totalBreakMins), fmtMins(r.avgBreakMins), r.longBreaks]);
    const total = breakReport.filter(r => r.totalBreaks > 0).length;
    const totalBreakMinsAll = breakReport.reduce((s, r) => s + r.totalBreakMins, 0);
    const totalBreaksAll = breakReport.reduce((s, r) => s + r.totalBreaks, 0);
    const longBreaksAll = breakReport.reduce((s, r) => s + r.longBreaks, 0);

    return (
      <div>
        {renderExportBar('Break Report', csvHeaders, csvRows)}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div className="stat-card" style={{ flex: 1 }}><div className="stat-icon orange">☕</div><div className="stat-info"><div className="stat-value">{totalBreaksAll}</div><div className="stat-label">Total Breaks</div></div></div>
          <div className="stat-card" style={{ flex: 1 }}><div className="stat-icon blue">⏱</div><div className="stat-info"><div className="stat-value">{fmtMins(totalBreakMinsAll)}</div><div className="stat-label">Total Break Time</div></div></div>
          <div className="stat-card" style={{ flex: 1 }}><div className="stat-icon red">⚠️</div><div className="stat-info"><div className="stat-value">{longBreaksAll}</div><div className="stat-label">Long Breaks</div></div></div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">☕ Break Details</div></div>
          <div id="report-content">
            {renderTable(
              ['Employee', 'Department', 'Breaks', 'Total Duration', 'Avg Duration', 'Long Breaks'],
              data.map(r => [
                <td key="n"><div style={{ fontWeight: 600 }}>{r.user.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.user.employeeId}</div></td>,
                <td key="d">{r.user.department}</td>,
                <td key="b">{r.totalBreaks}</td>,
                <td key="t">{fmtMins(r.totalBreakMins)}</td>,
                <td key="a">{fmtMins(r.avgBreakMins)}</td>,
                <td key="l">{r.longBreaks > 0 ? <span className="badge badge-danger">{r.longBreaks} alerts</span> : <span className="badge badge-neutral">None</span>}</td>,
              ]),
              'No break records found.'
            )}
          </div>
          {renderPagination(total)}
        </div>
      </div>
    );
  };

  // ─── Meeting Report View ───────────────────────────────────────────────────

  const renderMeetingReport = () => {
    const data = meetingReport.filter(r => r.totalMeetings > 0).slice(0, page * pageSize);
    const csvHeaders = ['Employee', 'Emp ID', 'Dept', 'Total Meetings', 'Attended', 'Missed', 'Total Time', 'Avg Duration'];
    const csvRows = data.map(r => [r.user.name, r.user.employeeId, r.user.department, r.totalMeetings, r.attendedCount, r.missedCount, fmtMins(r.totalMins), fmtMins(r.avgMins)]);
    const total = meetingReport.filter(r => r.totalMeetings > 0).length;
    const totalMinsAll = meetingReport.reduce((s, r) => s + r.totalMins, 0);
    const totalMeetingsAll = meetingReport.reduce((s, r) => s + r.totalMeetings, 0);

    return (
      <div>
        {renderExportBar('Meeting Report', csvHeaders, csvRows)}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div className="stat-card" style={{ flex: 1 }}><div className="stat-icon purple">🎥</div><div className="stat-info"><div className="stat-value">{totalMeetingsAll}</div><div className="stat-label">Total Meetings</div></div></div>
          <div className="stat-card" style={{ flex: 1 }}><div className="stat-icon blue">⏱</div><div className="stat-info"><div className="stat-value">{fmtMins(totalMinsAll)}</div><div className="stat-label">Total Meeting Time</div></div></div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">🎥 Meeting Details</div></div>
          <div id="report-content">
            {renderTable(
              ['Employee', 'Department', 'Meetings', 'Attended', 'Missed', 'Total Time', 'Avg Duration'],
              data.map(r => [
                <td key="n"><div style={{ fontWeight: 600 }}>{r.user.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.user.employeeId}</div></td>,
                <td key="d">{r.user.department}</td>,
                <td key="m">{r.totalMeetings}</td>,
                <td key="at"><span className="badge badge-success">{r.attendedCount}</span></td>,
                <td key="mi">{r.missedCount > 0 ? <span className="badge badge-danger">{r.missedCount}</span> : <span className="badge badge-neutral">0</span>}</td>,
                <td key="tt">{fmtMins(r.totalMins)}</td>,
                <td key="av">{fmtMins(r.avgMins)}</td>,
              ]),
              'No meeting records found.'
            )}
          </div>
          {renderPagination(total)}
        </div>
      </div>
    );
  };

  // ─── Leave Report View ─────────────────────────────────────────────────────

  const renderLeaveReport = () => {
    const data = getFilteredData(leaveReport).filter(r => r.totalLeaves > 0).slice(0, page * pageSize);
    const csvHeaders = ['Employee', 'Emp ID', 'Dept', 'Total Leaves', 'Approved', 'Pending', 'Rejected', 'Sick', 'Casual', 'Earned'];
    const csvRows = data.map(r => [r.user.name, r.user.employeeId, r.user.department, r.totalLeaves, r.approvedCount, r.pendingCount, r.rejectedCount, r.sickCount, r.casualCount, r.earnedCount]);
    const total = getFilteredData(leaveReport).filter(r => r.totalLeaves > 0).length;

    const leaveBalance = (type) => {
      const annual = { 'Sick Leave': 12, 'Casual Leave': 12, 'Earned Leave': 15 };
      return annual[type] || 0;
    };

    return (
      <div>
        {renderExportBar('Leave Report', csvHeaders, csvRows)}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div className="stat-card" style={{ flex: 1 }}><div className="stat-icon orange">📅</div><div className="stat-info"><div className="stat-value">{leaveStats.sick}</div><div className="stat-label">Sick Leave</div></div></div>
          <div className="stat-card" style={{ flex: 1 }}><div className="stat-icon blue">📅</div><div className="stat-info"><div className="stat-value">{leaveStats.casual}</div><div className="stat-label">Casual Leave</div></div></div>
          <div className="stat-card" style={{ flex: 1 }}><div className="stat-icon green">📅</div><div className="stat-info"><div className="stat-value">{leaveStats.earned}</div><div className="stat-label">Earned Leave</div></div></div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">📅 Leave Details</div></div>
          <div id="report-content">
            {renderTable(
              ['Employee', 'Department', 'Total', 'Approved', 'Pending', 'Rejected', 'Sick', 'Casual', 'Earned', 'Balance'],
              data.map(r => [
                <td key="n"><div style={{ fontWeight: 600 }}>{r.user.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.user.employeeId}</div></td>,
                <td key="d">{r.user.department}</td>,
                <td key="tot">{r.totalLeaves}</td>,
                <td key="ap"><span className="badge badge-success">{r.approvedCount}</span></td>,
                <td key="pe">{r.pendingCount > 0 ? <span className="badge badge-warning">{r.pendingCount}</span> : <span className="badge badge-neutral">0</span>}</td>,
                <td key="re">{r.rejectedCount > 0 ? <span className="badge badge-danger">{r.rejectedCount}</span> : <span className="badge badge-neutral">0</span>}</td>,
                <td key="sk">{r.sickCount}</td>,
                <td key="ca">{r.casualCount}</td>,
                <td key="ea">{r.earnedCount}</td>,
                <td key="bl">{leaveBalance('Sick Leave') - r.sickCount + leaveBalance('Casual Leave') - r.casualCount + leaveBalance('Earned Leave') - r.earnedCount} days</td>,
              ]),
              'No leave records found.'
            )}
          </div>
          {renderPagination(total)}
        </div>
      </div>
    );
  };

  // ─── Charts & Analytics View ───────────────────────────────────────────────

  const renderCharts = () => (
    <div style={{ marginTop: 24 }}>
      <div className="card-header" style={{ paddingLeft: 0 }}><div className="card-title">📊 Charts & Analytics</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 16 }}>

        {/* Attendance Trend */}
        <div className="card">
          <div className="card-header"><div className="card-title">📈 Attendance Trend</div></div>
          <div className="card-body">
            {attendanceTrend.slice(0, 14).map(d => {
              const total = d.present + d.absent || 1;
              return (
                <div key={d.date} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span>{fmtDateShort(d.date)}</span>
                    <span>{d.present}/{total}</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-fill" style={{ width: `${(d.present / total) * 100}%`, background: 'var(--success)', height: 8 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave Statistics */}
        <div className="card">
          <div className="card-header"><div className="card-title">📊 Leave Statistics</div></div>
          <div className="card-body">
            {[
              { label: 'Sick Leave', count: leaveStats.sick, color: '#f59e0b' },
              { label: 'Casual Leave', count: leaveStats.casual, color: '#3b82f6' },
              { label: 'Earned Leave', count: leaveStats.earned, color: '#10b981' },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5, fontWeight: 600 }}>
                  <span>{item.label}</span>
                  <span style={{ color: item.color }}>{item.count}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(item.count / totalLeaveCount) * 100}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Working Hours Graph */}
        <div className="card">
          <div className="card-header"><div className="card-title">⏱ Working Hours (Top 10)</div></div>
          <div className="card-body">
            {[...attendanceReport].sort((a, b) => b.totalWorkMins - a.totalWorkMins).slice(0, 10).map((r, i) => {
              const maxMins = Math.max(...attendanceReport.map(x => x.totalWorkMins), 1);
              return (
                <div key={r.user.uuid} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600 }}>{r.user.name}</span>
                    <span>{(r.totalWorkMins / 60).toFixed(1)}h</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-fill" style={{ width: `${(r.totalWorkMins / maxMins) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length], height: 8 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Department-wise Attendance */}
        <div className="card">
          <div className="card-header"><div className="card-title">🏢 Department-wise Attendance</div></div>
          <div className="card-body">
            {deptWiseAttendance.map(d => {
              const total = d.total || 1;
              return (
                <div key={d.dept} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600 }}>{d.dept}</span>
                    <span>{d.present}/{d.total}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 2, height: 10 }}>
                    <div style={{ flex: d.present, background: DEPT_COLORS[d.dept] || '#10b981', borderRadius: 4, transition: 'flex 0.3s' }} title={`Present: ${d.present}`} />
                    <div style={{ flex: d.absent || 1, background: '#e5e7eb', borderRadius: 4, transition: 'flex 0.3s' }} title={`Absent: ${d.absent}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Performance Insights */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header"><div className="card-title">📊 Monthly Performance Insights</div></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Avg Attendance Rate</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', marginTop: 6 }}>
                  {attendanceReport.length > 0 ? Math.round((attendanceReport.reduce((s, r) => s + r.totalPresent, 0) / Math.max(attendanceReport.reduce((s, r) => s + r.days, 0), 1)) * 100) : 0}%
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Avg Working Hours</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', marginTop: 6 }}>
                  {attendanceReport.length > 0 ? (attendanceReport.reduce((s, r) => s + r.avgWorkMins, 0) / attendanceReport.length / 60).toFixed(1) : 0}h
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Late Arrival Rate</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: attendanceReport.reduce((s, r) => s + r.totalLate, 0) > 3 ? 'var(--danger)' : 'var(--text-secondary)', marginTop: 6 }}>
                  {attendanceReport.reduce((s, r) => s + r.totalLate, 0)}
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Total Leave Days</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--warning)', marginTop: 6 }}>
                  {leaveReport.reduce((s, r) => s + r.totalLeaves, 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {renderSummaryCards()}
      {renderFilters()}

      {reportType === 'attendance' && renderAttendanceReport()}
      {reportType === 'break' && renderBreakReport()}
      {reportType === 'meeting' && renderMeetingReport()}
      {reportType === 'leave' && renderLeaveReport()}

      {renderCharts()}
    </div>
  );
};

export default ReportsTab;
