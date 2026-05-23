import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const ReportsPage = () => {
  const { currentUser } = useApp();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportText, setReportText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(currentUser.role === 'Admin' ? 'team' : 'daily');
  
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const alreadySubmitted = reports.find(r => r.reportDate === todayStr && r.userId === currentUser.id);
  
  const allowedDepts = ['Backend', 'Support', 'Quality', 'Graphics', 'Account', 'Accounts'];
  const isAdmin = currentUser.role === 'Admin';
  const isAllowed = allowedDepts.includes(currentUser.department) || isAdmin;
  const isTimeWindowOk = new Date().getHours() >= 9;

  useEffect(() => {
    fetchReports();
  }, [currentUser.id, activeTab]);

  const fetchReports = async () => {
    try {
      const endpoint = activeTab === 'team' && isAdmin ? '/api/reports/all' : `/api/reports/${currentUser.id}`;
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success) {
        const sorted = json.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setReports(sorted);
      }
    } catch (e) {
      console.error('[REPORT] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportText.trim()) {
      console.warn('[REPORT] Empty submission blocked');
      return;
    }
    
    console.log('[REPORT] Initiating submission for:', todayStr);
    setSubmitting(true);
    try {
      const res = await fetch('/api/reports/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          department: currentUser.department,
          reportText,
          date: todayStr
        })
      });
      
      const json = await res.json();
      if (res.ok && json.success) {
        console.log('[REPORT] Submission success');
        setReportText('');
        await fetchReports(); // Force re-fetch to lock the UI
        alert('Report submitted and locked! ✅');
      } else {
        console.error('[REPORT] Submission rejected:', json.message);
        alert(json.message);
      }
    } catch (e) {
      console.error('[REPORT] Pipeline error:', e);
      alert('Network error: Could not reach reporting server.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAllowed) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Not Authorized</div>
        <div className="empty-state-text">Activity reporting is only enabled for technical, accounts and creative departments.</div>
      </div>
    );
  }

  const getWeeklySummary = () => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });
    return reports.filter(r => last7Days.includes(r.reportDate) && (activeTab === 'team' || r.userId === currentUser.id));
  };

  const getMonthlySummary = () => {
    const last30Days = [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });
    return reports.filter(r => last30Days.includes(r.reportDate) && (activeTab === 'team' || r.userId === currentUser.id));
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="tabs" style={{ marginBottom: 24 }}>
        {isAdmin && <button className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>👥 Team Overview</button>}
        <button className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`} onClick={() => setActiveTab('daily')}>📅 Daily Report</button>
        <button className={`tab-btn ${activeTab === 'weekly' ? 'active' : ''}`} onClick={() => setActiveTab('weekly')}>📊 Weekly View</button>
        <button className={`tab-btn ${activeTab === 'monthly' ? 'active' : ''}`} onClick={() => setActiveTab('monthly')}>📈 Monthly View</button>
      </div>

      {activeTab === 'daily' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">📝 Today's Report ({new Date().toLocaleDateString()})</div>
            </div>
            <div className="card-body">
              {alreadySubmitted ? (
                <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success-dark)' }}>Report Locked</div>
                  <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Today's report has been submitted and cannot be modified.</p>
                  <div style={{ marginTop: 24, padding: 16, background: 'white', borderRadius: 8, textAlign: 'left', border: '1px solid var(--border-light)', whiteSpace: 'pre-wrap' }}>
                    {alreadySubmitted.reportText}
                  </div>
                </div>
              ) : !isTimeWindowOk ? (
                <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🕒</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#92400e' }}>Window Not Open</div>
                  <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Reporting window opens daily at 9:00 AM.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">Work Summary</label>
                    <textarea 
                      className="form-control" 
                      rows={10} 
                      placeholder="What did you work on today? List your tasks and progress..."
                      value={reportText}
                      onChange={e => setReportText(e.target.value)}
                      required
                    />
                    <div className="form-hint">🔒 This report will be locked permanently once submitted.</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Locking & Saving...' : '🚀 Submit Today\'s Report'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <div className="card-title">🛡️ Reporting Rules</div>
            </div>
            <div className="card-body" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <ul style={{ paddingLeft: 16 }}>
                <li style={{ marginBottom: 10 }}><strong>Today Only:</strong> You can only file reports for the current date.</li>
                <li style={{ marginBottom: 10 }}><strong>No Edits:</strong> Once you click submit, the report is locked forever.</li>
                <li style={{ marginBottom: 10 }}><strong>No Backfilling:</strong> If you miss a day, that record is lost permanently.</li>
                <li><strong>Deadline:</strong> Submissions close daily at 11:59 PM.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {(activeTab === 'weekly' || activeTab === 'monthly' || activeTab === 'team') && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              {activeTab === 'weekly' ? '📅 Last 7 Days Activity' : activeTab === 'monthly' ? '🗓️ Last 30 Days Activity' : '👥 Team Activity Logs'}
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  {activeTab === 'team' && <th>Employee</th>}
                  {activeTab === 'team' && <th>Dept</th>}
                  <th>Work Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'weekly' ? getWeeklySummary() : activeTab === 'monthly' ? getMonthlySummary() : reports).map(r => (
                  <tr key={r.id}>
                    <td style={{ width: 180 }}>
                      <div style={{ fontWeight: 600 }}>{r.reportDate}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        🕒 {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    {activeTab === 'team' && (
                      <td style={{ fontWeight: 600 }}>{r.userName}</td>
                    )}
                    {activeTab === 'team' && (
                      <td><span className="badge badge-neutral">{r.department}</span></td>
                    )}
                    <td style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5 }}>{r.reportText}</td>
                    <td><span className="badge badge-success">Locked</span></td>
                  </tr>
                ))}
                {(activeTab === 'weekly' ? getWeeklySummary() : activeTab === 'monthly' ? getMonthlySummary() : reports).length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'team' ? 5 : 3} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                      No reports found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
