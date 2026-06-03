import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ROLES, DEPARTMENTS, DEPARTMENT_ROLES } from '../data/mockData';
import { UserFormModal, UserDetailModal } from './UsersPage';
import ReportsTab from './ReportsTab';
import AdvancedAttendanceReport from '../components/AdvancedAttendanceReport';
import ActivityReports from '../components/ActivityReports';
import { getRoleConfig, getVisibleUsers } from '../config/rolePermissions';

const EmployeesTab = ({ allUsers, currentUser, updateUser, addAuditLog }) => {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const isHR = currentUser.role === ROLES.HR;

  const config = getRoleConfig(currentUser.role, 'hr_module');
  
  if (!config || !config.can_view) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Access Denied</div>
        <div className="empty-state-text">You do not have permission to view this module.</div>
      </div>
    );
  }

  const visibleUsers = getVisibleUsers(allUsers, currentUser, 'hr_module', search);
  const columns = config.visible_columns || [];

  const handleSave = (formData) => {
    try {
      if (editUser) {
        updateUser(editUser.uuid, formData);
        addAuditLog('User Updated', currentUser.name, `HR updated employee: ${formData.name}`);
      }
      setShowForm(false);
      setEditUser(null);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="toolbar">
        <div className="search-bar">
          🔍 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..." />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">📁 Employee Management ({visibleUsers.length})</div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {columns.includes('Employee') && <th>Employee</th>}
                {columns.includes('Emp ID') && <th>Emp ID</th>}
                {columns.includes('Role') && <th>Role</th>}
                {columns.includes('Department') && <th>Department</th>}
                {columns.includes('Status') && <th>Status</th>}
                {columns.includes('Actions') && config.can_edit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(user => (
                <tr key={user.uuid}>
                  {columns.includes('Employee') && (
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</div>
                    </td>
                  )}
                  {columns.includes('Emp ID') && <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{user.employeeId}</td>}
                  {columns.includes('Role') && (
                    <td>
                      <span className={`badge ${user.role === ROLES.ADMIN ? 'badge-danger' : (DEPARTMENT_ROLES['Graphics'] || []).includes(user.role) ? 'badge-info' : 'badge-primary'}`}>
                        {user.role}
                      </span>
                    </td>
                  )}
                  {columns.includes('Department') && <td>{user.department}</td>}
                  {columns.includes('Status') && <td><span className="badge badge-success">{user.status || 'Active'}</span></td>}
                  {columns.includes('Actions') && config.can_edit && (
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setViewUser(user)} title="View Details">👁</button>
                        <button className="btn btn-sm btn-outline" onClick={() => { setEditUser(user); setShowForm(true); }} title="Edit Employee">✏️</button>
                        {user.uuid !== currentUser.uuid && config.can_delete && (
                          <button className="btn btn-sm btn-danger" onClick={() => {/* Handle delete if supported in HRPage */}}>🗑</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <UserFormModal
          user={editUser}
          isHR={isHR}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSave={handleSave}
        />
      )}
      {viewUser && <UserDetailModal user={viewUser} onClose={() => setViewUser(null)} />}
    </div>
  );
};

const AttendanceTab = ({ allAttendance, allUsers, today, isHR, currentUser, markAttendance, allLeaves, manuallyUpsertAttendanceLog }) => {
  const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'advanced'
  const [dateFilter, setDateFilter] = useState(today);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [timers, setTimers] = useState({ break: 0 });
  const [selectedRec, setSelectedRec] = useState(null);

  const filtered = allAttendance.filter(a => {
    const matchDate = a.date === dateFilter;
    const matchSearch = !search || a.userName.toLowerCase().includes(search.toLowerCase());
    const matchUser = userFilter === 'all' || String(a.userId) === String(userFilter);
    if (!isHR) return String(a.userId) === String(currentUser.id) && matchDate;
    return matchDate && matchSearch && matchUser;
  });

  const todayRecord = allAttendance.find(a => String(a.userId) === String(currentUser.id) && a.date === today);
  const activeBreak = todayRecord?.breaks?.find(b => !b.endTime);
  const activeMeeting = todayRecord?.meetings?.find(m => !m.endTime);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers({
        break: activeBreak ? Math.floor((new Date() - new Date(activeBreak.startTime)) / 1000) : 0,
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeBreak]);

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatTimestamp = (isoString) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">⏰ My Attendance</div></div>
          <div className="card-body">
            {!todayRecord ? (
              <button className="btn btn-success" onClick={() => markAttendance(currentUser.id, currentUser.name, 'login')}>🟢 Mark Login</button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-success">Login: {formatTimestamp(todayRecord.loginTime)}</span>
                  {todayRecord.logoutTime && <span className="badge badge-danger">Logout: {formatTimestamp(todayRecord.logoutTime)}</span>}
                </div>
                {!todayRecord.logoutTime && <button className="btn btn-danger btn-sm" onClick={() => markAttendance(currentUser.id, currentUser.name, 'logout')}>🔴 Logout</button>}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><div className="card-title">☕ Break Status</div></div>
          <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace' }}>{formatTime(timers.break)}</div>
            <button
              className={`btn ${activeBreak ? 'btn-danger' : 'btn-success'}`}
              onClick={() => markAttendance(currentUser.id, currentUser.name, activeBreak ? 'break-out' : 'break-in')}
              disabled={!todayRecord || !!todayRecord.logoutTime || !!activeMeeting}
            >
              {activeBreak ? 'End Break' : 'Start Break'}
            </button>
          </div>
        </div>
      </div>

      <div className="toolbar">
        {isHR && (
          <>
            <div className="search-bar"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name..." /></div>
            <select className="form-control" style={{ width: 'auto' }} value={userFilter} onChange={e => setUserFilter(e.target.value)}>
              <option value="all">All Employees</option>
              {allUsers.filter(u => u.role !== ROLES.ADMIN).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </>
        )}
        <input type="date" className="form-control" style={{ width: 'auto' }} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">📅 Daily Attendance Log</div></div>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Employee</th><th>Login</th><th>Logout</th><th>Breaks</th><th>Meetings</th><th>Action</th></tr>
            </thead>
            <tbody>
              {filtered.map(rec => (
                <tr key={rec.id} style={selectedRec?.id === rec.id ? { background: 'var(--info-light)' } : {}}>
                  <td>{rec.userName}</td>
                  <td>{formatTimestamp(rec.loginTime)}</td>
                  <td>{rec.logoutTime ? formatTimestamp(rec.logoutTime) : <span className="badge badge-success">Online</span>}</td>
                  <td>{rec.breaks.length} sessions</td>
                  <td>{rec.meetings.length} sessions</td>
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => setSelectedRec(selectedRec?.id === rec.id ? null : rec)}>
                      {selectedRec?.id === rec.id ? 'Hide Details' : 'View Details'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRec && (
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, animation: 'slideUp 0.3s ease' }}>
          <div className="card">
            <div className="card-header" style={{ background: 'var(--warning-light)' }}>
              <div className="card-title">☕ Break Breakup: {selectedRec.userName}</div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Start</th><th>End</th><th>Duration</th></tr>
                </thead>
                <tbody>
                  {selectedRec.breaks.length === 0 ? (
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No breaks taken</td></tr>
                  ) : (
                    selectedRec.breaks.map((b, i) => (
                      <tr key={i}>
                        <td>{formatTimestamp(b.startTime)}</td>
                        <td>{b.endTime ? formatTimestamp(b.endTime) : <span className="badge badge-warning">Active</span>}</td>
                        <td>{formatTime(b.duration)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ background: 'var(--info-light)' }}>
              <div className="card-title">🎥 Meeting Breakup: {selectedRec.userName}</div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Start</th><th>End</th><th>Duration</th></tr>
                </thead>
                <tbody>
                  {selectedRec.meetings.length === 0 ? (
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No meetings held</td></tr>
                  ) : (
                    selectedRec.meetings.map((m, i) => (
                      <tr key={i}>
                        <td>{formatTimestamp(m.startTime)}</td>
                        <td>{m.endTime ? formatTimestamp(m.endTime) : <span className="badge badge-info">Active</span>}</td>
                        <td>{formatTime(m.duration)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ApplyLeaveTab = ({ applyLeave, addAuditLog, currentUser }) => {
  const [formData, setFormData] = useState({ date: '', type: 'Sick Leave', reason: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    applyLeave(formData);
    setFormData({ date: '', type: 'Sick Leave', reason: '' });
    alert('Leave request submitted!');
  };

  return (
    <div className="card" style={{ maxWidth: 500 }}>
      <div className="card-header"><div className="card-title">📅 Apply for Leave</div></div>
      <form onSubmit={handleSubmit} className="card-body">
        <div className="form-group">
          <label className="form-label">Date</label>
          <input type="date" className="form-control" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="form-control" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
            <option>Sick Leave</option>
            <option>Casual Leave</option>
            <option>Earned Leave</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Reason</label>
          <textarea className="form-control" rows={3} value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary w-full">Submit Application</button>
      </form>
    </div>
  );
};

const HRPage = ({ defaultTab }) => {
  const {
    currentUser, allUsers, allAttendance, allLeaves,
    updateLeave, applyLeave, markAttendance, submitDailyReport, updateUser, addAuditLog, deleteLeave
  } = useApp();

  const isHR = currentUser?.role === ROLES.HR || currentUser?.role === ROLES.ADMIN;
  const [tab, setTab] = useState(defaultTab || (isHR ? 'dashboard' : 'attendance'));

  if (!currentUser) return null;

  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = allAttendance.filter(a => a.date === today);

  const hrTabs = [
    { id: 'dashboard', name: '📊 Dashboard', roles: [ROLES.ADMIN, ROLES.HR] },
    { id: 'employees', name: '📁 Employee Management', roles: [ROLES.ADMIN, ROLES.HR] },
    { id: 'attendance', name: '⏱ Attendance', roles: ['all'] },
    { id: 'leaves', name: '📅 Leave Requests', roles: [ROLES.ADMIN, ROLES.HR] },
    { id: 'apply', name: '➕ Apply Leave', roles: ['all'] },
    { id: 'reports', name: '📈 Reports', roles: [ROLES.ADMIN, ROLES.HR] }
  ];

  const availableTabs = hrTabs.filter(t => t.roles.includes('all') || t.roles.includes(currentUser.role));

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="tabs">
        {availableTabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.name}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && isHR && (
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
              <div className="stat-label">Pending Leaves</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'employees' && isHR && (
        <EmployeesTab
          allUsers={allUsers}
          currentUser={currentUser}
          updateUser={updateUser}
          addAuditLog={addAuditLog}
        />
      )}

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

      {tab === 'leaves' && isHR && (
        <div className="card">
          <div className="card-header"><div className="card-title">📅 Leave Requests</div></div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Employee</th><th>Type</th><th>Date</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {allLeaves.map(leave => (
                  <tr key={leave.id}>
                    <td>{leave.userName}</td>
                    <td>{leave.type}</td>
                    <td>{leave.date}</td>
                    <td><span className={`badge ${leave.status === 'Approved' ? 'badge-success' : leave.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>{leave.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {leave.status === 'Pending' && (
                          <>
                            <button className="btn btn-sm btn-success" onClick={() => updateLeave(leave.id, 'Approved')}>✅</button>
                            <button className="btn btn-sm btn-danger" onClick={() => updateLeave(leave.id, 'Rejected')}>✕</button>
                          </>
                        )}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteLeave(leave.id)}>🗑 Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'apply' && (
        <ApplyLeaveTab applyLeave={applyLeave} addAuditLog={addAuditLog} currentUser={currentUser} />
      )}

      {tab === 'reports' && isHR && (
        <ReportsTab
          allUsers={allUsers}
          allAttendance={allAttendance}
          allLeaves={allLeaves}
          isHR={isHR}
        />
      )}
    </div>
  );
};

export default HRPage;
