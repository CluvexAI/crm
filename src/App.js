import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import LeadsPage from './pages/LeadsPage';
import SalesPage from './pages/SalesPage';
import ProjectsPage from './pages/ProjectsPage';
import UsersPage from './pages/UsersPage';
import HRPage from './pages/HRPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import AuditLogsPage from './pages/AuditLogsPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import './index.css';

const pageConfig = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your CRM activities', component: Dashboard },
  leads: { title: 'Lead Management', subtitle: 'Track and manage all your leads', component: LeadsPage },
  sales: { title: 'Sales & Invoices', subtitle: 'Monitor revenue and billing', component: SalesPage },
  invoices: { title: 'Invoice Management', subtitle: 'Track payment status', component: SalesPage },
  projects: { title: 'Project Management', subtitle: 'Manage backend projects and reports', component: ProjectsPage },
  users: { title: 'User Management', subtitle: 'Manage employees and permissions', component: UsersPage },
  hr: { title: 'HR Module', subtitle: 'Attendance, leaves, and employee management', component: HRPage },
  attendance: { title: 'My Attendance', subtitle: 'Track your daily attendance', component: () => <HRPage defaultTab="attendance" /> },
  chat: { title: 'Internal Chat', subtitle: 'Message your colleagues', component: ChatPage },
  profile: { title: 'My Profile', subtitle: 'View and edit your profile information', component: ProfilePage },
  audit: { title: 'Audit Logs', subtitle: 'System activity and security logs', component: AuditLogsPage },
};

const AppInner = () => {
  const { currentUser, logout, activePage } = useApp();

  useEffect(() => {
    const handleLogout = () => logout();
    document.addEventListener('logout', handleLogout);
    return () => document.removeEventListener('logout', handleLogout);
  }, [logout]);

  if (!currentUser) return <LoginPage />;

  const config = pageConfig[activePage] || pageConfig.dashboard;
  const PageComponent = config.component;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Header title={config.title} subtitle={config.subtitle} />
        <main className="page-content">
          <PageComponent />
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}

export default App;
