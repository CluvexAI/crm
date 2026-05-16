import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ROLES } from '../data/mockData';
import {
  getMailConfig, saveMailConfig, getUserEmails, addUserEmail,
  deleteUserEmail, testImapConnection,
  testSmtpConnection, testMailServerConnection, runFullSync,
  getSyncState, getEmailAnalytics, DEFAULT_MAIL_CONFIG, sendTestEmail
} from '../services/emailService';
import DNSAuthenticationSetup from '../components/DNSAuthenticationSetup';
import DNSRecordsSetup from '../components/DNSRecordsSetup';

const EmailConfigurationPage = () => {
  const { currentUser, allUsers } = useApp();
  const [activeTab, setActiveTab] = useState('server');
  
  const [mailConfig, setMailConfig] = useState(DEFAULT_MAIL_CONFIG);
  const [userEmails, setUserEmails] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [syncState, setSyncState] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      setSyncState(getSyncState());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setMailConfig(getMailConfig());
    setUserEmails(getUserEmails());
    setAnalytics(getEmailAnalytics());
    setSyncState(getSyncState());
  };

  const showMsg = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  if (currentUser?.role !== ROLES.ADMIN) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Access Denied</div>
        <div className="empty-state-text">Email Configuration requires Admin role.</div>
      </div>
    );
  }

  const handleSaveMailConfig = () => {
    saveMailConfig(mailConfig);
    showMsg('Mail Server Configuration Saved!');
  };

  const handleTestConnection = async () => {
    setLoading(true);
    const res = await testMailServerConnection();
    showMsg(`IMAP: ${res.imap.message} | SMTP: ${res.smtp.message}`);
    setLoading(false);
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {message && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#27ae60', color: 'white', padding: '12px 20px', borderRadius: 8, zIndex: 999 }}>
          {message}
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${activeTab === 'server' ? 'active' : ''}`} onClick={() => setActiveTab('server')}>Global Server</button>
        <button className={`tab-btn ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')}>User Accounts</button>
        <button className={`tab-btn ${activeTab === 'dns_records' ? 'active' : ''}`} onClick={() => setActiveTab('dns_records')}>DNS Records</button>
        <button className={`tab-btn ${activeTab === 'dns' ? 'active' : ''}`} onClick={() => setActiveTab('dns')}>SPF, DKIM & DMARC</button>
        <button className={`tab-btn ${activeTab === 'sync' ? 'active' : ''}`} onClick={() => setActiveTab('sync')}>Sync System</button>
        <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Monitoring</button>
      </div>

      <div className="card">
        {activeTab === 'server' && (
          <ServerConfigTab 
            mailConfig={mailConfig} 
            setMailConfig={setMailConfig} 
            handleSave={handleSaveMailConfig} 
            handleTest={handleTestConnection}
            loading={loading}
          />
        )}
        {activeTab === 'accounts' && (
          <UserAccountsTab 
            userEmails={userEmails} 
            allUsers={allUsers} 
            loadData={loadData} 
            showMsg={showMsg}
          />
        )}
        {activeTab === 'dns_records' && (
          <DNSRecordsSetup />
        )}
        {activeTab === 'dns' && (
          <DNSAuthenticationSetup domain="zsmeservices.com" />
        )}
        {activeTab === 'sync' && (
          <SyncSystemTab 
            syncState={syncState} 
            loadData={loadData}
          />
        )}
        {activeTab === 'dashboard' && (
          <MonitoringTab 
            analytics={analytics} 
          />
        )}
      </div>
    </div>
  );
};

const ServerConfigTab = ({ mailConfig, setMailConfig, handleSave, handleTest, loading }) => (
  <div className="card-body">
    <h3 style={{ marginBottom: 15 }}>Global Mail Server Configuration</h3>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
      <div className="form-group">
        <label className="form-label">Mail Server Host</label>
        <input className="form-control" value={mailConfig.host} onChange={e => setMailConfig({...mailConfig, host: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">Encryption Type</label>
        <select className="form-control" value={mailConfig.encryption} onChange={e => setMailConfig({...mailConfig, encryption: e.target.value})}>
          <option>SSL/TLS</option>
          <option>STARTTLS</option>
          <option>None</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">IMAP Host</label>
        <input className="form-control" value={mailConfig.imapHost} onChange={e => setMailConfig({...mailConfig, imapHost: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">IMAP Port</label>
        <input className="form-control" type="number" value={mailConfig.imapPort} onChange={e => setMailConfig({...mailConfig, imapPort: parseInt(e.target.value)})} />
      </div>
      <div className="form-group">
        <label className="form-label">SMTP Host</label>
        <input className="form-control" value={mailConfig.smtpHost} onChange={e => setMailConfig({...mailConfig, smtpHost: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">SMTP Port</label>
        <input className="form-control" type="number" value={mailConfig.smtpPort} onChange={e => setMailConfig({...mailConfig, smtpPort: parseInt(e.target.value)})} />
      </div>
      <div className="form-group">
        <label className="form-label">Webmail URL</label>
        <input className="form-control" value={mailConfig.webmailUrl} onChange={e => setMailConfig({...mailConfig, webmailUrl: e.target.value})} />
      </div>
      <div className="form-group">
        <label className="form-label">Default From Name</label>
        <input className="form-control" value={mailConfig.defaultFromName} onChange={e => setMailConfig({...mailConfig, defaultFromName: e.target.value})} />
      </div>
    </div>
    <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
      <button className="btn btn-primary" onClick={handleSave}>💾 Save Configuration</button>
      <button className="btn btn-outline" onClick={handleTest} disabled={loading}>{loading ? 'Testing...' : '🔄 Test Connection'}</button>
    </div>
  </div>
);

const UserAccountsTab = ({ userEmails, allUsers, loadData, showMsg }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ userId: '', email: '', password: '' });
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [sendingTest, setSendingTest] = useState(null);

  const handleAdd = () => {
    try {
      const user = allUsers.find(u => u.uuid === form.userId);
      if(!user) throw new Error("Select a user");
      addUserEmail(user.uuid, user.name, user.role, form.email, form.password);
      setShowAdd(false);
      setForm({ userId: '', email: '', password: '' });
      loadData();
      showMsg('✅ Email Account Added! This account is now linked to the Email module.');
    } catch(err) {
      alert(err.message);
    }
  };

  const handleTestImap = async (id) => {
    showMsg('Testing IMAP connection...');
    const result = await testImapConnection(id);
    loadData();
    showMsg(result.success ? '✅ IMAP Connected!' : `❌ IMAP Failed: ${result.message}`);
  };

  const handleTestSmtp = async (id) => {
    showMsg('Testing SMTP connection...');
    const result = await testSmtpConnection(id);
    loadData();
    showMsg(result.success ? '✅ SMTP Connected!' : `❌ SMTP Failed: ${result.message}`);
  };

  const handleSendTestEmail = async (id) => {
    const recipient = testEmailTarget || prompt('Enter recipient email address for test:');
    if (!recipient) return;
    setSendingTest(id);
    showMsg(`Sending test email to ${recipient}...`);
    try {
      const result = await sendTestEmail(id, recipient);
      showMsg(result.success ? `✅ Test email sent to ${recipient}!` : `❌ Send failed: ${result.message}`);
    } catch(err) {
      showMsg(`❌ Error: ${err.message}`);
    } finally {
      setSendingTest(null);
    }
  };

  const handleDelete = (id) => {
    if(window.confirm('Delete this email configuration?')) {
      deleteUserEmail(id);
      loadData();
    }
  };

  return (
    <div className="card-body">
      <div style={{ marginBottom: 16, padding: 12, background: 'rgba(59,130,246,0.07)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)', fontSize: 13, color: '#1e40af' }}>
        <strong>ℹ️ How it works:</strong> Add email accounts for each user. The <strong>Email</strong> module will automatically use their configured account for sending and receiving. Test IMAP/SMTP after adding to verify connectivity.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 15 }}>
        <h3>User Email Accounts</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Email Account</button>
      </div>

      {showAdd && (
        <div style={{ background: 'var(--bg-secondary)', padding: 15, borderRadius: 8, marginBottom: 15 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
              <label className="form-label">User</label>
              <select className="form-control" value={form.userId} onChange={e => setForm({...form, userId: e.target.value})}>
                <option value="">Select User...</option>
                {allUsers.map(u => <option key={u.uuid} value={u.uuid}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
              <label className="form-label">Email Address</label>
              <input className="form-control" type="email" placeholder="user@zsmeservices.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
              <label className="form-label">Email Password</label>
              <input className="form-control" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            </div>
            <button className="btn btn-success" onClick={handleAdd}>Save</button>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email Account</th>
              <th>IMAP</th>
              <th>SMTP</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {userEmails.map(acc => (
              <tr key={acc.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{acc.userName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{acc.userRole}</div>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{acc.email}</td>
                <td>
                  <span className={`badge ${acc.imapStatus === 'connected' ? 'badge-success' : acc.imapStatus === 'error' ? 'badge-danger' : 'badge-neutral'}`}>
                    {acc.imapStatus}
                  </span>
                </td>
                <td>
                  <span className={`badge ${acc.smtpStatus === 'connected' ? 'badge-success' : acc.smtpStatus === 'error' ? 'badge-danger' : 'badge-neutral'}`}>
                    {acc.smtpStatus}
                  </span>
                </td>
                <td>
                  <span className={`badge ${acc.active ? 'badge-success' : 'badge-danger'}`}>
                    {acc.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => handleTestImap(acc.id)}>Test IMAP</button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleTestSmtp(acc.id)}>Test SMTP</button>
                    <button className="btn btn-sm btn-primary" onClick={() => handleSendTestEmail(acc.id)} disabled={sendingTest === acc.id}>
                      {sendingTest === acc.id ? '⌛ Sending...' : '📤 Send Test'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(acc.id)}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
            {userEmails.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>No email accounts configured yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click "+ Add Email Account" above to connect the first account</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SyncSystemTab = ({ syncState, loadData }) => {
  const [syncing, setSyncing] = useState(false);
  const doFullSync = async () => {
    setSyncing(true);
    await runFullSync();
    loadData();
    setSyncing(false);
  };

  return (
    <div className="card-body">
      <h3 style={{ marginBottom: 15 }}>Mailbox Synchronization</h3>
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <div style={{ flex: 1, padding: 15, background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <h4>Sync Status</h4>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: syncState?.status === 'running' ? 'var(--warning)' : 'var(--success)' }}>
            {syncState?.status === 'running' ? '⏳ Running...' : '✅ Idle'}
          </div>
        </div>
        <div style={{ flex: 1, padding: 15, background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <h4>Emails Synced</h4>
          <div style={{ fontSize: 24, fontWeight: 'bold' }}>{syncState?.totalSynced || 0}</div>
        </div>
        <div style={{ flex: 1, padding: 15, background: 'var(--bg-secondary)', borderRadius: 8 }}>
          <h4>Sync Errors</h4>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--danger)' }}>{syncState?.errors || 0}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={doFullSync} disabled={syncing}>
          {syncing ? 'Running Sync...' : '▶ Run Full Sync'}
        </button>
      </div>
    </div>
  );
};

const MonitoringTab = ({ analytics }) => {
  if(!analytics) return null;
  return (
    <div className="card-body">
      <h3 style={{ marginBottom: 15 }}>Email Delivery Monitoring</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 15 }}>
        <div style={{ padding: 15, border: '1px solid var(--border-light)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Delivery Rate</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--success)' }}>{analytics.deliveryRate}%</div>
        </div>
        <div style={{ padding: 15, border: '1px solid var(--border-light)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sent Emails</div>
          <div style={{ fontSize: 28, fontWeight: 'bold' }}>{analytics.totalSent}</div>
        </div>
        <div style={{ padding: 15, border: '1px solid var(--border-light)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Received Emails</div>
          <div style={{ fontSize: 28, fontWeight: 'bold' }}>{analytics.totalReceived}</div>
        </div>
        <div style={{ padding: 15, border: '1px solid var(--border-light)', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Failed / Errors</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--danger)' }}>{analytics.failedEmails}</div>
        </div>
      </div>
      
      <div style={{ marginTop: 20 }}>
        <h4>System Health</h4>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <span className="badge badge-neutral">Active Accounts: {analytics.activeAccounts} / {analytics.totalAccounts}</span>
          <span className="badge badge-success">IMAP Connected: {analytics.imapConnected}</span>
          <span className="badge badge-success">SMTP Connected: {analytics.smtpConnected}</span>
          <span className="badge badge-danger">Bounce Count: {analytics.bounceCount}</span>
          <span className="badge badge-danger">Spam Rejections: {analytics.spamRejections}</span>
        </div>
      </div>
    </div>
  );
};

export default EmailConfigurationPage;
