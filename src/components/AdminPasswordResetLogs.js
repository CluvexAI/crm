import React, { useState, useEffect } from 'react';

const PROXY = 'http://localhost:5001';

const AdminPasswordResetLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${PROXY}/api/auth/password-audit`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch logs');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const statusBadge = (entry) => {
    if (entry.changeType === 'admin_reset') return { label: 'Admin Reset', bg: '#fef3c7', color: '#854d0e' };
    if (entry.changeType === 'self_change') return { label: 'Self Change', bg: '#dcfce7', color: '#166534' };
    if (entry.changeType === 'otp_reset') return { label: 'OTP Reset', bg: '#dbeafe', color: '#1e40af' };
    return { label: 'Unknown', bg: '#f3f4f6', color: '#374151' };
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Password Change Audit Log</h3>
        <button onClick={fetchLogs} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={thStyle}>User / Email</th>
              <th style={thStyle}>Changed By</th>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Type</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No password changes recorded yet.</td></tr>
            ) : logs.map((log, i) => {
              const badge = statusBadge(log);
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{log.userEmail || 'Unknown'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>ID: {log.userId?.slice(0, 13)}…</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ color: '#374151' }}>{log.changedByEmail || log.userEmail}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{log.changeType === 'self_change' ? 'Themselves' : 'Admin'}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ color: '#374151' }}>{new Date(log.timestamp).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{log.ipAddress}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: badge.bg, color: badge.color,
                    }}>
                      {badge.label}
                    </span>
                    {log.must_change_password && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#dc2626', fontWeight: 600 }}>Force</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const thStyle = { padding: '12px 24px', fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '16px 24px', fontSize: 14 };

export default AdminPasswordResetLogs;
