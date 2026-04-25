import React from 'react';
import { useApp } from '../context/AppContext';
import { ROLES } from '../data/mockData';

const navItems = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard', roles: ['all'] },
  { id: 'leads', icon: '📞', label: 'Lead Management', roles: [ROLES.ADMIN, ROLES.SALES] },
  { id: 'sales', icon: '💰', label: 'Sales', roles: [ROLES.ADMIN, ROLES.SALES, ROLES.ACCOUNTS] },
  { id: 'invoices', icon: '🧾', label: 'Invoices', roles: [ROLES.ADMIN, ROLES.ACCOUNTS] },
  { id: 'projects', icon: '🔄', label: 'Projects', roles: [ROLES.ADMIN, ROLES.BACKEND] },
  { id: 'users', icon: '👥', label: 'User Management', roles: [ROLES.ADMIN] },
  { id: 'hr', icon: '🧑‍💼', label: 'HR Module', roles: [ROLES.ADMIN, ROLES.HR] },
  { id: 'attendance', icon: '📋', label: 'Attendance', roles: ['all'] },
  { id: 'chat', icon: '💬', label: 'Internal Chat', roles: ['all'] },
  { id: 'audit', icon: '🔒', label: 'Audit Logs', roles: [ROLES.ADMIN] },
  { id: 'profile', icon: '👤', label: 'My Profile', roles: ['all'] },
];

const Sidebar = () => {
  const { currentUser, activePage, setActivePage, unreadMessages, allLeads, allSales } = useApp();

  if (!currentUser) return null;

  const canAccess = (item) => {
    if (item.roles[0] === 'all') return true;
    return item.roles.includes(currentUser.role);
  };

  const pendingLeads = allLeads.filter(l => l.status === 'New Lead' || l.status === 'Follow-Up').length;
  const pendingSales = allSales.filter(s => s.saleStatus === 'Pending').length;

  const getBadge = (id) => {
    if (id === 'leads') return pendingLeads > 0 ? pendingLeads : null;
    if (id === 'sales') return pendingSales > 0 ? pendingSales : null;
    if (id === 'chat') return unreadMessages > 0 ? unreadMessages : null;
    return null;
  };

  const mainNav = navItems.filter(i => !['profile', 'attendance'].includes(i.id));
  const profileNav = navItems.filter(i => ['profile', 'attendance'].includes(i.id));

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">Z</div>
        <div>
          <div className="sidebar-logo-text">ZSM CRM</div>
          <div className="sidebar-logo-sub">Internal Office Suite</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Main Menu</div>
        {mainNav.filter(canAccess).map(item => {
          const badge = getBadge(item.id);
          return (
            <div
              key={item.id}
              className={`sidebar-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              <span>{item.label}</span>
              {badge && <span className="sidebar-badge">{badge}</span>}
            </div>
          );
        })}

        <div className="sidebar-section-label" style={{ marginTop: 8 }}>Account</div>
        {profileNav.filter(canAccess).map(item => (
          <div
            key={item.id}
            className={`sidebar-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>
            {currentUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{currentUser.name}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{currentUser.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
