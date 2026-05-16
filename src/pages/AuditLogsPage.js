import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ROLES } from '../data/mockData';
import AdminPasswordResetLogs from '../components/AdminPasswordResetLogs';

const AuditLogsPage = () => {
  const { currentUser, allAuditLogs } = useApp();
  const [activeTab, setActiveTab] = useState('system');

  if (currentUser.role !== ROLES.ADMIN) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Admin Access Only</div>
        <div className="empty-state-text">Audit logs are restricted to administrators.</div>
      </div>
    );
  }

  const actionIcon = (action) => {
    const map = {
      'User Login': '🔑', 'User Logout': '🚪', 'User Created': '👤', 'User Updated': '✏️', 'User Deleted': '🗑',
      'Lead Created': '📞', 'Lead Updated': '📝', 'Sale Created': '💰', 'Invoice Updated': '🧾',
      'Project Updated': '🔄', 'Project Assigned': '✅', 'Report Added': '📋',
      'Leave Applied': '📅', 'Leave Updated': '📅',
    };
    return map[action] || '📌';
  };

  const actionColor = (action) => {
    if (action.includes('Delete') || action.includes('Logout')) return 'var(--danger)';
    if (action.includes('Create') || action.includes('Login')) return 'var(--success)';
    if (action.includes('Update') || action.includes('Edit')) return 'var(--warning)';
    return 'var(--primary)';
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button 
          onClick={() => setActiveTab('system')}
          style={{ 
            padding: '10px 20px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer',
            background: activeTab === 'system' ? 'var(--primary)' : '#fff',
            color: activeTab === 'system' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'system' ? '0 4px 12px var(--primary-light)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          System Audit Logs
        </button>
        <button 
          onClick={() => setActiveTab('reset')}
          style={{ 
            padding: '10px 20px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer',
            background: activeTab === 'reset' ? 'var(--primary)' : '#fff',
            color: activeTab === 'reset' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'reset' ? '0 4px 12px var(--primary-light)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          Password Reset Logs
        </button>
      </div>

      {activeTab === 'system' ? (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🔒 System Audit Logs ({allAuditLogs.length})</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 20 }}>
              🔐 Admin Only
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Action</th>
                  <th>Performed By</th>
                  <th>Details</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {[...allAuditLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((log, idx) => (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{actionIcon(log.action)}</span>
                        <span style={{ fontWeight: 600, color: actionColor(log.action), fontSize: 13 }}>{log.action}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar" style={{ width: 26, height: 26, fontSize: 9, flexShrink: 0 }}>
                          {log.user.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{log.user}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{log.details}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <AdminPasswordResetLogs />
      )}
    </div>
  );
};

export default AuditLogsPage;
