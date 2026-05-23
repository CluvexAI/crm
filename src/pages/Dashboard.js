import React from 'react';
import { useApp } from '../context/AppContext';
import { ROLES, DEPARTMENTS, DEPARTMENT_ROLES } from '../data/mockData';

const Dashboard = () => {
  const { currentUser, allUsers, allLeads, allSales, allInvoices, allProjects, allAttendance, myLeads, myCustomers, myProjects, myInvoices, allLeaves, setActivePage } = useApp();

  const graphicsRoles = DEPARTMENT_ROLES['Graphics'] || [];
  const isGraphics = graphicsRoles.includes(currentUser.role);
  const isAdmin = currentUser.role === ROLES.ADMIN;
  const isSales = currentUser.role === ROLES.SALES;
  const isHR = currentUser.role === ROLES.HR;
  const isBackend = currentUser.role === ROLES.BACKEND;

  const today = new Date().toISOString().split('T')[0];

  const stats = {
    totalUsers: allUsers.length,
    activeLeads: isAdmin ? allLeads.filter(l => !['Closed (Won)', 'Closed (Lost)', 'Expired'].includes(l.status)).length : myLeads.filter(l => !['Closed (Won)', 'Closed (Lost)', 'Expired'].includes(l.status)).length,
    closedWon: isAdmin ? allLeads.filter(l => l.status === 'Closed (Won)').length : myLeads.filter(l => l.status === 'Closed (Won)').length,
    totalRevenue: isAdmin ? allSales.filter(s => s.saleStatus === 'Closed').reduce((sum, s) => sum + s.amount, 0) : myCustomers.filter(s => s.saleStatus === 'Closed').reduce((sum, s) => sum + s.amount, 0),
    pendingInvoices: isAdmin ? allInvoices.filter(i => i.status === 'Pending').length : myInvoices.filter(i => i.status === 'Pending').length,
    todayAttendance: allAttendance.filter(a => a.date === today).length,
    pendingLeaves: allLeaves.filter(l => l.status === 'Pending').length,
    myLeads: myLeads.length,
    myFollowUps: myLeads.filter(l => l.status === 'Follow-Up').length,
    myConversions: myLeads.filter(l => l.status === 'Closed (Won)').length,
    myProjects: myProjects.length,
    activeProjects: myProjects.filter(p => p.status === 'In Progress').length,
    myCustomers: myCustomers.length,
    myTotalSales: isAdmin 
      ? allInvoices.reduce((sum, inv) => sum + (inv.lockedTotal || inv.totalAmount || 0), 0)
      : myInvoices.reduce((sum, inv) => sum + (inv.lockedTotal || inv.totalAmount || 0), 0),
    myTotalCollected: isAdmin
      ? allInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0)
      : myInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0),
    myTotalDue: isAdmin
      ? allInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0)
      : myInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0),
  };

  const recentLeads = isAdmin 
    ? [...allLeads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
    : [...myLeads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const recentSales = isAdmin 
    ? [...allSales].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4)
    : [...myCustomers].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);

  const statusColor = (s) => {
    const map = {
      'New Lead': 'badge-info', 'Follow-Up': 'badge-warning', 'Pending': 'badge-secondary',
      'Closed (Won)': 'badge-success', 'Closed (Lost)': 'badge-danger', 'Expired': 'badge-neutral',
    };
    return map[s] || 'badge-neutral';
  };

  const formatCurrency = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

  const leadStageData = [
    { label: 'New', count: allLeads.filter(l => l.status === 'New Lead').length, color: '#3b82f6' },
    { label: 'Follow-Up', count: allLeads.filter(l => l.status === 'Follow-Up').length, color: '#f59e0b' },
    { label: 'Pending', count: allLeads.filter(l => l.status === 'Pending').length, color: '#8b5cf6' },
    { label: 'Won', count: allLeads.filter(l => l.status === 'Closed (Won)').length, color: '#10b981' },
    { label: 'Lost', count: allLeads.filter(l => l.status === 'Closed (Lost)').length, color: '#ef4444' },
  ];

  const totalLeadCount = leadStageData.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 60%, #0d7ab5 100%)',
        borderRadius: 'var(--radius-xl)', padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: 'white', boxShadow: '0 8px 24px rgba(14,84,145,0.25)',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            👋 Welcome back, {currentUser.name.split(' ')[0]}!
          </div>
          <div style={{ fontSize: 14, opacity: 0.8 }}>
            {currentUser.role} · {currentUser.department} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {(isAdmin || isSales) && (
            <button className="btn btn-secondary" onClick={() => setActivePage('leads')}>
              + Add Lead
            </button>
          )}
          <button className="btn" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', backdropFilter: 'blur(8px)' }}
            onClick={() => setActivePage('attendance')}>
            📋 Attendance
          </button>
        </div>
      </div>

      {/* Admin Stats */}
      {isAdmin && (
        <>
          <div className="stats-grid">
            <div className="stat-card" onClick={() => setActivePage('users')}>
              <div className="stat-icon blue">👥</div>
              <div className="stat-info">
                <div className="stat-value">{stats.totalUsers}</div>
                <div className="stat-label">Total Employees</div>
                <div className="stat-change up">↑ Active Team</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('leads')}>
              <div className="stat-icon orange">📞</div>
              <div className="stat-info">
                <div className="stat-value">{stats.activeLeads}</div>
                <div className="stat-label">Active Leads</div>
                <div className="stat-change up">↑ {stats.closedWon} Won</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('sales')}>
              <div className="stat-icon green">💰</div>
              <div className="stat-info">
                <div className="stat-value">€{Number(stats.totalRevenue).toLocaleString('en-IN')}</div>
                <div className="stat-label">Total Revenue</div>
                <div className="stat-change up">↑ This Month</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('invoices')}>
              <div className="stat-icon red">🧾</div>
              <div className="stat-info">
                <div className="stat-value">{stats.pendingInvoices}</div>
                <div className="stat-label">Pending Invoices</div>
                <div className="stat-change down">⚠ Requires Action</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('hr')}>
              <div className="stat-icon teal">📋</div>
              <div className="stat-info">
                <div className="stat-value">{stats.todayAttendance}</div>
                <div className="stat-label">Present Today</div>
                <div className="stat-change up">of {stats.totalUsers - 1} staff</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('projects')}>
              <div className="stat-icon purple">🔄</div>
              <div className="stat-info">
                <div className="stat-value">{allProjects.length}</div>
                <div className="stat-label">Total Projects</div>
                <div className="stat-change up">↑ Active</div>
              </div>
            </div>
          </div>

          {/* Department-wise Employee Count */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">🏢 Department-wise Employees</div>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                {DEPARTMENTS.map(dept => {
                  const count = allUsers.filter(u => u.department === dept).length;
                  const deptColors = {
                    Sales: '#10b981', Backend: '#8b5cf6', HR: '#f59e0b',
                    Accounts: '#ef4444', Support: '#3b82f6', Quality: '#06b6d4',
                    Management: '#0E5491', Graphics: '#ec4899',
                  };
                  return (
                    <div key={dept} style={{
                      padding: '14px 16px', borderRadius: 12, background: `${deptColors[dept] || '#6b7280'}10`,
                      border: `1px solid ${deptColors[dept] || '#6b7280'}30`,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: deptColors[dept] || '#6b7280' }}>{count}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>{dept}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Lead Pipeline Chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">📊 Lead Pipeline</div>
                <button className="btn btn-sm btn-outline" onClick={() => setActivePage('leads')}>View All</button>
              </div>
              <div className="card-body">
                {leadStageData.map((stage) => (
                  <div key={stage.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5, fontWeight: 600 }}>
                      <span>{stage.label}</span>
                      <span style={{ color: stage.color }}>{stage.count}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${(stage.count / totalLeadCount) * 100}%`,
                        background: stage.color,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">🏆 Top Sales</div>
              </div>
              <div className="card-body">
                {recentSales.map((sale, idx) => (
                  <div key={sale.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sale.businessName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sale.proposalType}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', whiteSpace: 'nowrap' }}>{formatCurrency(sale.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Leads Table */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">📞 Recent Leads</div>
              <button className="btn btn-sm btn-primary" onClick={() => setActivePage('leads')}>View All Leads</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Contact</th>
                    <th>Business</th>
                    <th>Category</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Last Follow-Up</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map(lead => (
                    <tr key={lead.id}>
                      <td><span style={{ fontWeight: 600 }}>{lead.contactName}</span></td>
                      <td>{lead.businessName}</td>
                      <td><span className="badge badge-neutral">{lead.businessCategory}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{lead.ownerPhone}</td>
                      <td><span className={`badge ${statusColor(lead.status)}`}>{lead.status}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(lead.lastFollowUp).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Sales Agent Dashboard */}
      {isSales && (
        <>
          <div className="stats-grid">
            <div className="stat-card" onClick={() => setActivePage('leads')}>
              <div className="stat-icon orange">📞</div>
              <div className="stat-info">
                <div className="stat-value">{stats.myLeads}</div>
                <div className="stat-label">My Leads</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('leads')}>
              <div className="stat-icon teal">🔁</div>
              <div className="stat-info">
                <div className="stat-value">{stats.myFollowUps}</div>
                <div className="stat-label">Follow-Ups Due</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('sales')}>
              <div className="stat-icon green">🤝</div>
              <div className="stat-info">
                <div className="stat-value">{stats.myCustomers}</div>
                <div className="stat-label">My Customers</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">📈</div>
              <div className="stat-info">
                <div className="stat-value">{stats.myLeads > 0 ? Math.round((stats.myCustomers / stats.myLeads) * 100) : 0}%</div>
                <div className="stat-label">Conversion Rate</div>
              </div>
            </div>
          </div>

          <div className="stats-grid" style={{ marginTop: 16 }}>
            <div className="stat-card" onClick={() => setActivePage('sales')}>
              <div className="stat-icon green">💰</div>
              <div className="stat-info">
                <div className="stat-value">€{Number(stats.myTotalSales || 0).toLocaleString('en-IN')}</div>
                <div className="stat-label">Total Sales Value</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('invoices')}>
              <div className="stat-icon blue">✅</div>
              <div className="stat-info">
                <div className="stat-value">€{Number(stats.myTotalCollected || 0).toLocaleString('en-IN')}</div>
                <div className="stat-label">Total Collected</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('invoices')}>
              <div className="stat-icon red">⏳</div>
              <div className="stat-info">
                <div className="stat-value">€{Number(stats.myTotalDue || 0).toLocaleString('en-IN')}</div>
                <div className="stat-label">Total Due</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('sales')}>
              <div className="stat-icon orange">📊</div>
              <div className="stat-info">
                <div className="stat-value">{stats.myConversions}</div>
                <div className="stat-label">Closed Won</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">📞 My Active Leads</div>
              <button className="btn btn-sm btn-primary" onClick={() => setActivePage('leads')}>Manage Leads</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Contact</th><th>Business</th><th>Proposal</th><th>Status</th><th>Last Activity</th></tr>
                </thead>
                <tbody>
                  {myLeads.filter(l => !['Closed (Won)', 'Closed (Lost)'].includes(l.status)).slice(0, 6).map(lead => (
                    <tr key={lead.id}>
                      <td><span style={{ fontWeight: 600 }}>{lead.contactName}</span></td>
                      <td>{lead.businessName}</td>
                      <td>{lead.proposalType || '—'}</td>
                      <td><span className={`badge ${statusColor(lead.status)}`}>{lead.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(lead.lastFollowUp).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Backend Dashboard */}
      {isBackend && (
        <>
          <div className="stats-grid">
            <div className="stat-card" onClick={() => setActivePage('projects')}>
              <div className="stat-icon purple">🔄</div>
              <div className="stat-info">
                <div className="stat-value">{stats.myProjects}</div>
                <div className="stat-label">My Projects</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">⚡</div>
              <div className="stat-info">
                <div className="stat-value">{stats.activeProjects}</div>
                <div className="stat-label">In Progress</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">🔄 Assigned Projects</div>
              <button className="btn btn-sm btn-primary" onClick={() => setActivePage('projects')}>View All</button>
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Start Date</th><th>Reports</th></tr></thead>
                <tbody>
                  {myProjects.map(proj => (
                    <tr key={proj.id}>
                      <td><span style={{ fontWeight: 600 }}>{proj.projectName}</span></td>
                      <td>{proj.clientName}</td>
                      <td><span className={`badge ${proj.status === 'In Progress' ? 'badge-success' : proj.status === 'Planning' ? 'badge-info' : 'badge-neutral'}`}>{proj.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{proj.startDate}</td>
                      <td>{proj.reports?.length || 0} reports</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Graphics Dashboard */}
      {isGraphics && (
        <>
          <div className="stats-grid">
            <div className="stat-card" onClick={() => setActivePage('projects')}>
              <div className="stat-icon purple">🎨</div>
              <div className="stat-info">
                <div className="stat-value">{stats.myProjects}</div>
                <div className="stat-label">My Projects</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">⚡</div>
              <div className="stat-info">
                <div className="stat-value">{stats.activeProjects}</div>
                <div className="stat-label">In Progress</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">🎨 Assigned Design Projects</div>
              <button className="btn btn-sm btn-primary" onClick={() => setActivePage('projects')}>View All</button>
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Start Date</th><th>Reports</th></tr></thead>
                <tbody>
                  {myProjects.map(proj => (
                    <tr key={proj.id}>
                      <td><span style={{ fontWeight: 600 }}>{proj.projectName}</span></td>
                      <td>{proj.clientName}</td>
                      <td><span className={`badge ${proj.status === 'In Progress' ? 'badge-success' : proj.status === 'Planning' ? 'badge-info' : 'badge-neutral'}`}>{proj.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{proj.startDate}</td>
                      <td>{proj.reports?.length || 0} reports</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* HR Dashboard */}
      {isHR && (
        <>
          <div className="stats-grid">
            <div className="stat-card" onClick={() => setActivePage('hr')}>
              <div className="stat-icon teal">📋</div>
              <div className="stat-info">
                <div className="stat-value">{stats.todayAttendance}</div>
                <div className="stat-label">Present Today</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('hr')}>
              <div className="stat-icon orange">📅</div>
              <div className="stat-info">
                <div className="stat-value">{stats.pendingLeaves}</div>
                <div className="stat-label">Pending Leaves</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setActivePage('users')}>
              <div className="stat-icon blue">👥</div>
              <div className="stat-info">
                <div className="stat-value">{allUsers.length}</div>
                <div className="stat-label">Total Employees</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
