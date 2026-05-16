import React, { useState, useEffect } from 'react';

const PROXY = 'http://localhost:5001';

const AdminPasswordResetLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${PROXY}/api/auth/reset-logs`);
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

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Password Reset Logs</h3>
        <button onClick={fetchLogs} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={thStyle}>User / Email</th>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>IP Address</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No password reset attempts found.</td></tr>
            ) : logs.map((log, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{log.userName || 'Unknown'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{log.email}</div>
                </td>
                <td style={tdStyle}>
                  <div style={{ color: '#374151' }}>{new Date(log.createdAt).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Expires: {new Date(log.expiresAt).toLocaleTimeString()}</div>
                </td>
                <td style={tdStyle}>
                  <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{log.ip || '0.0.0.0'}</code>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: log.status === 'Success' ? '#dcfce7' : log.status === 'Pending' ? '#fef3c7' : '#fee2e2',
                    color: log.status === 'Success' ? '#166534' : log.status === 'Pending' ? '#854d0e' : '#991b1b',
                  }}>
                    {log.status || (log.used ? 'Used' : 'Expired')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const thStyle = { padding: '12px 24px', fontSize: 12, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '16px 24px', fontSize: 14 };

export default AdminPasswordResetLogs;
