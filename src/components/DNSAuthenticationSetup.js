import React, { useState, useEffect } from 'react';
import {
  getDnsConfig, verifySpfRecord, verifyDkimRecord, 
  verifyDmarcRecord, generateDkimKey, copyToClipboard, getDnsStatusSummary
} from '../services/dnsService';

const DNSAuthenticationSetup = ({ domain = 'zsmeservices.com' }) => {
  const [dnsConfig, setDnsConfig] = useState(getDnsConfig());
  const [dnsStatus, setDnsStatus] = useState(getDnsStatusSummary());
  const [domainInput, setDomainInput] = useState(domain);
  const [ttl, setTTL] = useState(3600);
  const [loading, setLoading] = useState({ spf: false, dkim: false, dmarc: false, mx: false });
  const [messages, setMessages] = useState({});
  const [dmarcPolicy, setDmarcPolicy] = useState('quarantine');
  const [dkimSelector, setDkimSelector] = useState('mail');
  const [showDkimKey, setShowDkimKey] = useState(false);
  const [mxRecords, setMxRecords] = useState([]);
  const [newMxPriority, setNewMxPriority] = useState('');
  const [newMxExchange, setNewMxExchange] = useState('');
  const [editingMxId, setEditingMxId] = useState(null);

  useEffect(() => {
    setDnsConfig(getDnsConfig());
    setDnsStatus(getDnsStatusSummary());
    const interval = setInterval(() => {
      handleVerifyAll();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleVerifyAll = async () => {
    await handleVerifySpf();
    await handleVerifyDkim(dkimSelector);
    await handleVerifyDmarc();
  };

  const showMessage = (key, msg) => {
    setMessages({ ...messages, [key]: msg });
    setTimeout(() => {
      setMessages(prev => ({ ...prev, [key]: '' }));
    }, 3000);
  };

  const handleVerifySpf = async () => {
    setLoading({ ...loading, spf: true });
    try {
      const result = await verifySpfRecord();
      showMessage('spf', `SPF: ${result.status} - ${result.message}`);
    } catch (err) {
      showMessage('spf', `Error: ${err.message}`);
    } finally {
      setLoading({ ...loading, spf: false });
      setDnsStatus(getDnsStatusSummary());
    }
  };

  const handleVerifyDkim = async (selector) => {
    setLoading({ ...loading, dkim: true });
    try {
      const result = await verifyDkimRecord(selector || dkimSelector);
      showMessage('dkim', `DKIM: ${result.status} - ${result.message}`);
    } catch (err) {
      showMessage('dkim', `Error: ${err.message}`);
    } finally {
      setLoading({ ...loading, dkim: false });
      setDnsStatus(getDnsStatusSummary());
    }
  };

  const handleVerifyDmarc = async () => {
    setLoading({ ...loading, dmarc: true });
    try {
      const result = await verifyDmarcRecord();
      showMessage('dmarc', `DMARC: ${result.status} - ${result.message}`);
    } catch (err) {
      showMessage('dmarc', `Error: ${err.message}`);
    } finally {
      setLoading({ ...loading, dmarc: false });
      setDnsStatus(getDnsStatusSummary());
    }
  };

  const handleGenerateDkim = async () => {
    try {
      await generateDkimKey(dkimSelector);
      setDnsConfig(getDnsConfig());
      showMessage('dkim', 'DKIM key generated successfully!');
      setShowDkimKey(true);
    } catch (err) {
      showMessage('dkim', `Error: ${err.message}`);
    }
  };

  const handleCopySPF = async () => {
    const record = `v=spf1 include:mail.${domainInput} ~all`;
    await copyToClipboard(record);
    showMessage('spf', 'SPF record copied!');
  };

  const handleCopyDKIM = async () => {
    if (!dnsConfig.dkim.publicKey) {
      showMessage('dkim', 'Generate DKIM key first');
      return;
    }
    const record = `v=DKIM1; k=rsa; p=${dnsConfig.dkim.publicKey}`;
    await copyToClipboard(record);
    showMessage('dkim', 'DKIM record value copied!');
  };

  const handleCopyDMARC = async () => {
    const email = prompt('Enter admin email for DMARC reports:', 'admin@' + domainInput);
    if (email) {
      const record = `v=DMARC1; p=${dmarcPolicy}; rua=mailto:${email}; fo=1`;
      await copyToClipboard(record);
      showMessage('dmarc', 'DMARC record copied!');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'valid': { bg: '#27ae60', text: '✅ Valid' },
      'invalid': { bg: '#e74c3c', text: '❌ Invalid' },
      'not_found': { bg: '#f39c12', text: '⏳ Not Found' },
      'pending': { bg: '#3498db', text: '⏸️ Pending' },
      'unknown': { bg: '#95a5a6', text: '❓ Unknown' },
    };
    const badge = badges[status] || badges['unknown'];
    return (
      <span style={{
        display: 'inline-block',
        background: badge.bg,
        color: '#fff',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '12px',
        marginRight: '8px'
      }}>
        {badge.text}
      </span>
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Domain Selection */}
      <div style={{ marginBottom: 25, padding: 15, background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3>📌 Domain Configuration</h3>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={handleVerifyAll}
            disabled={loading.spf || loading.dkim || loading.dmarc}
          >
            🔄 Re-Verify DNS
          </button>
        </div>
        <div style={{ marginBottom: 12, padding: 10, background: 'rgba(39,174,96,0.1)', border: '1px solid rgba(39,174,96,0.3)', borderRadius: 6, fontSize: 12, color: '#145a32' }}>
          🌐 <strong>Connected to Hosting:</strong> These records must be added in your hosting control panel (cPanel → Zone Editor, or Cloudflare DNS). Once added, click "Verify" — the system performs a live DNS lookup to confirm propagation.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Domain Name</label>
            <input
              className="form-control"
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="example.com"
            />
          </div>
          <div>
            <label className="form-label">TTL (seconds)</label>
            <input
              className="form-control"
              type="number"
              value={ttl}
              onChange={(e) => setTTL(parseInt(e.target.value) || 3600)}
              min="300"
              placeholder="3600"
            />
          </div>
        </div>
        <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 8 }}>
          Update DNS records at your hosting provider (cPanel, Cloudflare, GoDaddy, etc.) then click Verify to confirm live propagation.
        </small>
      </div>

      {/* SPF Record */}
      <div style={{ marginBottom: 20, border: '2px solid #3498db', padding: 15, borderRadius: 8, background: 'rgba(52, 152, 219, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>🛡️ SPF Record</h3>
          {getStatusBadge(dnsStatus.spf.status)}
        </div>
        <div style={{ background: 'white', border: '1px solid var(--border-light)', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Type:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', marginTop: 4 }}>TXT</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Name:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', marginTop: 4 }}>zsmeservices.com</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>TTL:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', marginTop: 4 }}>{ttl}</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, marginBottom: 12, borderLeft: '4px solid #3498db' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Value:</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', color: '#2c3e50' }}>
            v=spf1 include:mail.{domainInput} ~all
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleVerifySpf}
            disabled={loading.spf}
            style={{ flex: '0 0 auto' }}
          >
            {loading.spf ? '⏳ Verifying...' : '✓ Verify SPF'}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleCopySPF}
            style={{ flex: '0 0 auto' }}
          >
            📋 Copy Record
          </button>
        </div>
        {messages.spf && (
          <div style={{ marginTop: 10, padding: 8, background: '#d4edda', color: '#155724', borderRadius: 4, fontSize: 12 }}>
            {messages.spf}
          </div>
        )}
      </div>

      {/* DKIM Record */}
      <div style={{ marginBottom: 20, border: '2px solid #9b59b6', padding: 15, borderRadius: 8, background: 'rgba(155, 89, 182, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>🔐 DKIM Record</h3>
          {getStatusBadge(dnsStatus.dkim.status)}
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border-light)', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Type:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', marginTop: 4 }}>TXT</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>TTL:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', marginTop: 4 }}>{ttl}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Selector:</span>
              <input
                className="form-control"
                type="text"
                value={dkimSelector}
                onChange={(e) => setDkimSelector(e.target.value)}
                placeholder="mail"
                style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Name:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', marginTop: 4, fontSize: 11 }}>
                {dkimSelector}._domainkey.{domainInput}
              </div>
            </div>
          </div>
        </div>

        {dnsConfig.dkim.publicKey && (
          <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, marginBottom: 12, borderLeft: '4px solid #9b59b6' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Record Value (TXT):</div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                wordBreak: 'break-all',
                color: '#2c3e50',
                maxHeight: showDkimKey ? '200px' : '60px',
                overflow: showDkimKey ? 'auto' : 'hidden',
                cursor: 'pointer',
                padding: 8,
                background: 'white',
                borderRadius: 4,
                border: '1px solid #ddd'
              }}
              onClick={() => setShowDkimKey(!showDkimKey)}
            >
              v=DKIM1; k=rsa; p={dnsConfig.dkim.publicKey}
            </div>
            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
              Click to expand/collapse
            </small>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-warning btn-sm"
            onClick={handleGenerateDkim}
            style={{ flex: '0 0 auto' }}
          >
            ⚙️ Generate Key
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleVerifyDkim(dkimSelector)}
            disabled={loading.dkim}
            style={{ flex: '0 0 auto' }}
          >
            {loading.dkim ? '⏳ Verifying...' : '✓ Verify DKIM'}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleCopyDKIM}
            disabled={!dnsConfig.dkim.publicKey}
            style={{ flex: '0 0 auto' }}
          >
            📋 Copy Record
          </button>
        </div>
        {messages.dkim && (
          <div style={{ marginTop: 10, padding: 8, background: '#d4edda', color: '#155724', borderRadius: 4, fontSize: 12 }}>
            {messages.dkim}
          </div>
        )}
      </div>

      {/* DMARC Record */}
      <div style={{ marginBottom: 20, border: '2px solid #e74c3c', padding: 15, borderRadius: 8, background: 'rgba(231, 76, 60, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>🚫 DMARC Record</h3>
          {getStatusBadge(dnsStatus.dmarc.status)}
        </div>

        <div style={{ background: 'white', border: '1px solid var(--border-light)', padding: 12, borderRadius: 6, marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Type:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', marginTop: 4 }}>TXT</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Name:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', marginTop: 4 }}>_dmarc.{domainInput}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>TTL:</span>
              <div style={{ fontFamily: 'monospace', fontWeight: 'bold', marginTop: 4 }}>{ttl}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Policy:</span>
              <select
                className="form-control"
                value={dmarcPolicy}
                onChange={(e) => setDmarcPolicy(e.target.value)}
                style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12 }}
              >
                <option value="none">None (p=none)</option>
                <option value="quarantine">Quarantine (p=quarantine)</option>
                <option value="reject">Reject (p=reject)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 6, marginBottom: 12, borderLeft: '4px solid #e74c3c' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Value:</div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', color: '#2c3e50' }}>
            v=DMARC1; p={dmarcPolicy}; rua=mailto:admin@{domainInput}; fo=1
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleVerifyDmarc}
            disabled={loading.dmarc}
            style={{ flex: '0 0 auto' }}
          >
            {loading.dmarc ? '⏳ Verifying...' : '✓ Verify DMARC'}
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleCopyDMARC}
            style={{ flex: '0 0 auto' }}
          >
            📋 Copy Record
          </button>
        </div>
        {messages.dmarc && (
          <div style={{ marginTop: 10, padding: 8, background: '#d4edda', color: '#155724', borderRadius: 4, fontSize: 12 }}>
            {messages.dmarc}
          </div>
        )}
      </div>

      {/* Instructions Panel */}
      <div style={{ padding: 15, background: '#ecf0f1', borderRadius: 8, border: '1px solid #bdc3c7' }}>
        <h4 style={{ marginBottom: 10 }}>📝 Setup Instructions</h4>
        <ol style={{ marginLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
          <li>Copy each DNS record (SPF, DKIM, DMARC) by clicking the <strong>Copy Record</strong> button</li>
          <li>Log into your domain hosting provider (cPanel, Cloudflare, GoDaddy, etc.)</li>
          <li>Navigate to <strong>DNS Management</strong> or <strong>DNS Records</strong></li>
          <li>Create a new <strong>TXT record</strong> with the Name and Value from above</li>
          <li>Set TTL to <strong>3600</strong> seconds</li>
          <li>Save the record and wait 24-48 hours for DNS propagation</li>
          <li>Click the <strong>Verify</strong> buttons to confirm records are live</li>
        </ol>
      </div>

      {/* Status Summary */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div style={{ padding: 12, border: '1px solid var(--border-light)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SPF Status</div>
          <div style={{ marginTop: 8, fontWeight: 'bold' }}>{getStatusBadge(dnsStatus.spf.status)}</div>
        </div>
        <div style={{ padding: 12, border: '1px solid var(--border-light)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DKIM Status</div>
          <div style={{ marginTop: 8, fontWeight: 'bold' }}>{getStatusBadge(dnsStatus.dkim.status)}</div>
        </div>
        <div style={{ padding: 12, border: '1px solid var(--border-light)', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DMARC Status</div>
          <div style={{ marginTop: 8, fontWeight: 'bold' }}>{getStatusBadge(dnsStatus.dmarc.status)}</div>
        </div>
      </div>
    </div>
  );
};

export default DNSAuthenticationSetup;
