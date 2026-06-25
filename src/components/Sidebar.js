import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ROLES } from '../data/mockData';
import { getTotalUnreadCount, subscribeToChatUpdates } from '../services/chatService';

const navItems = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard', roles: ['all'] },
  { id: 'leads', icon: '📞', label: 'Lead Management', roles: [ROLES.ADMIN, ROLES.SALES], excludeDepts: ['Backend', 'HR', 'Support', 'Quality', 'Graphics'] },
  { id: 'mycustomers', icon: '🤝', label: 'My Customers', roles: [ROLES.ADMIN, ROLES.SALES], excludeDepts: ['Backend', 'HR', 'Support', 'Quality', 'Graphics'] },
  { id: 'sales', icon: '💰', label: 'Sales', roles: [ROLES.ADMIN, ROLES.SALES, ROLES.ACCOUNTS], excludeDepts: ['Backend', 'HR', 'Support', 'Quality', 'Graphics'] },
  { id: 'invoices', icon: '🧾', label: 'Invoices', roles: [ROLES.ADMIN, ROLES.ACCOUNTS], excludeDepts: ['Backend', 'HR', 'Support', 'Quality', 'Graphics'] },
  { id: 'projects', icon: '🔄', label: 'Projects', roles: [ROLES.ADMIN, ROLES.BACKEND, ROLES.GRAPHICS_MANAGER, ROLES.GRAPHIC_DESIGNER, ROLES.JUNIOR_GRAPHIC_DESIGNER, ROLES.VIDEO_EDITOR, ROLES.MOTION_GRAPHIC_DESIGNER] },
  { id: 'users', icon: '👥', label: 'User Management', roles: [ROLES.ADMIN] },
  { id: 'hr', icon: '🧑‍💼', label: 'HR Module', roles: [ROLES.ADMIN, ROLES.HR] },
  { id: 'attendance', icon: '📋', label: 'Attendance', roles: ['all'] },
  { id: 'whatsapp', icon: '📱', label: 'WhatsApp', roles: [ROLES.ADMIN] },
  { id: 'chat', icon: '💬', label: 'Internal Chat', roles: ['all'] },
  { id: 'email', icon: '📧', label: 'Email', roles: ['all'] },
  { id: 'email_config', icon: '⚙️', label: 'Email Configuration', roles: [ROLES.ADMIN] },
  { id: 'audit', icon: '🔒', label: 'Audit Logs', roles: [ROLES.ADMIN] },
  { id: 'reports', icon: '📊', label: 'Activity Reports', roles: ['all'], includeDepts: ['Backend', 'Support', 'Quality', 'Graphics', 'Account', 'Accounts', 'HR', 'Management'] },
  { id: 'activity_calendar', icon: '📅', label: 'Activity Calendar', roles: ['all'], excludeRoles: [ROLES.SALES] },
  { id: 'audit_analysis', icon: '🔍', label: 'Audit & Analysis', roles: [ROLES.ADMIN, ROLES.SALES], excludeDepts: ['Backend', 'HR', 'Support', 'Quality', 'Graphics'], subItems: [
    { id: 'gmb_audit', icon: '📍', label: 'GMB Audit' },
    { id: 'website_audit', icon: '🌐', label: 'Website Analysis' }
  ]},
  { id: 'settings', icon: '⚙️', label: 'Settings', roles: [ROLES.ADMIN] },
  { id: 'profile', icon: '👤', label: 'My Profile', roles: ['all'] },
];

const Sidebar = () => {
  const { currentUser, activePage, setActivePage, unreadMessages, allLeads, allSales, myLeads, myCustomers } = useApp();
  const [chatUnread, setChatUnread] = useState(0);
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    // Initial count
    setChatUnread(getTotalUnreadCount(currentUser.id));
    // Subscribe to real-time updates
    const unsubscribe = subscribeToChatUpdates((event) => {
      if (event === 'message' || event === 'read' || event === 'sync') {
        setChatUnread(getTotalUnreadCount(currentUser.id));
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === ROLES.ADMIN;
  const canAccess = (item) => {
    // 1. Role-based check
    let roleOk = item.roles[0] === 'all' || item.roles.includes(currentUser.role);
    if (!roleOk) return false;

    // 1b. Exclude specific roles (e.g., Sales Agent)
    if (item.excludeRoles && item.excludeRoles.includes(currentUser.role)) {
      return false;
    }

    // 2. Department-based check (Lockdown/Inclusion)
    if (item.excludeDepts && item.excludeDepts.includes(currentUser.department)) {
      return false;
    }
    
    if (item.includeDepts && !item.includeDepts.includes(currentUser.department) && currentUser.role !== ROLES.ADMIN) {
      return false;
    }

    return true;
  };

  const pendingLeads = isAdmin 
    ? allLeads.filter(l => l.status === 'New Lead' || l.status === 'Follow-Up').length 
    : myLeads.filter(l => l.status === 'New Lead' || l.status === 'Follow-Up').length;
  const pendingSales = isAdmin 
    ? allSales.filter(s => s.saleStatus === 'Pending').length
    : myCustomers.filter(s => s.saleStatus === 'Pending').length;

  const getBadge = (id) => {
    if (id === 'leads') return pendingLeads > 0 ? pendingLeads : null;
    if (id === 'sales') return pendingSales > 0 ? pendingSales : null;
    if (id === 'chat') return (unreadMessages + chatUnread) > 0 ? unreadMessages + chatUnread : null;
    return null;
  };

  const mainNav = navItems.filter(i => !['profile', 'attendance', 'whatsapp'].includes(i.id));
  const profileNav = navItems.filter(i => ['profile', 'attendance', 'whatsapp'].includes(i.id));

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
          const isActive = activePage === item.id || (item.subItems && item.subItems.find(sub => sub.id === activePage));
          const isExpanded = expandedSection === item.id;
          
          return (
            <div key={item.id}>
              <div
                className={`sidebar-item ${isActive && !item.subItems ? 'active' : ''}`}
                onClick={() => {
                  if (item.subItems) {
                    setExpandedSection(isExpanded ? null : item.id);
                  } else {
                    setActivePage(item.id);
                  }
                }}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge && <span className="sidebar-badge">{badge}</span>}
                {item.subItems && (
                  <span style={{ fontSize: 10 }}>{isExpanded ? '▼' : '▶'}</span>
                )}
              </div>
              {item.subItems && isExpanded && (
                <div style={{ paddingLeft: 30, marginTop: 4, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {item.subItems.map(subItem => (
                    <div
                      key={subItem.id}
                      className={`sidebar-item ${activePage === subItem.id ? 'active' : ''}`}
                      style={{ padding: '6px 12px', minHeight: 32, fontSize: 13 }}
                      onClick={() => setActivePage(subItem.id)}
                    >
                      <span className="sidebar-item-icon" style={{ width: 20 }}>{subItem.icon}</span>
                      <span>{subItem.label}</span>
                    </div>
                  ))}
                </div>
              )}
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
