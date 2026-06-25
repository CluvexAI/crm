import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const WebsiteAuditPage = () => {
  const { currentUser } = useApp();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showRaw, setShowRaw] = useState(false);

  const fetchHistory = async () => {
    try {
      const res = await fetch((process.env.REACT_APP_API_URL || '') + `/api/audit/history?type=website&userId=${currentUser.id}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    let interval;
    if (jobId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch((process.env.REACT_APP_API_URL || '') + `/api/audit/status/${jobId}`);
          const data = await res.json();
          if (data.status === 'completed') {
            clearInterval(interval);
            setLoading(false);
            setJobId(null);
            setReport(data.report);
            fetchHistory();
          } else if (data.status === 'failed') {
            clearInterval(interval);
            setLoading(false);
            setJobId(null);
            setError(data.error || 'Audit failed');
          }
        } catch (err) {
          console.error('Polling error', err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId]);

  const handleRunAudit = async () => {
    if (!url.trim()) {
      setError('Please enter a valid Website URL.');
      return;
    }
    setError(null);
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch((process.env.REACT_APP_API_URL || '') + '/api/audit/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, userId: currentUser.id })
      });
      const data = await res.json();
      if (data.success) {
        setJobId(data.jobId);
      } else {
        setError(data.message || 'Failed to start audit');
        setLoading(false);
      }
    } catch (err) {
      setError('Network error');
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#4caf50';
    if (score >= 50) return '#ff9800';
    return '#f44336';
  };

  return (
    <div className="page-container" style={{ padding: 20 }}>
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ marginBottom: 16 }}>Website SEO & Technical Audit</h2>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <input
            type="text"
            className="input-field"
            placeholder="Enter Website URL (e.g. https://example.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleRunAudit} disabled={loading}>
            {loading ? 'Running Audit...' : 'Run Audit'}
          </button>
        </div>
        {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
        {loading && (
          <div style={{ marginTop: 20, textAlign: 'center', color: '#666' }}>
            <div className="spinner" style={{ margin: '0 auto 10px auto' }}></div>
            Fetching website HTML and running AI analysis... This may take up to a minute.
          </div>
        )}
      </div>

      {report && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 24 }}>Website Audit Report</h3>
              <p style={{ margin: '4px 0 0 0', color: '#666' }}>
                <a href={report.target_url} target="_blank" rel="noreferrer">{report.target_url}</a>
              </p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: getScoreColor(report.score) }}>
                {report.score} / 100
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>Health Score</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ background: '#f5f5f5', padding: 15, borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Domain Analysis Summary</h4>
              <p style={{ margin: 0, fontSize: 14 }}>{report.domain_summary}</p>
            </div>
            <div style={{ background: '#f5f5f5', padding: 15, borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 10px 0' }}>UI/UX Score Breakdown</h4>
              <p style={{ margin: 0, fontSize: 14 }}>{report.ux_score_breakdown}</p>
            </div>
          </div>

          <div style={{ background: '#f5f5f5', padding: 15, borderRadius: 8, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Keyword & Ranking Summary</h4>
            <p style={{ margin: 0, fontSize: 14 }}>{report.keyword_summary}</p>
          </div>

          {report.technical_errors && report.technical_errors.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Technical Errors</h4>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#f44336' }}>
                {report.technical_errors.map((err, idx) => <li key={idx} style={{ marginBottom: 4 }}>{err}</li>)}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Prioritized Recommendations</h4>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {report.recommendations?.map((rec, idx) => (
                <li key={idx} style={{ marginBottom: 8 }}>
                  <strong style={{ 
                    color: rec.priority === 'Critical' ? '#f44336' : rec.priority === 'Moderate' ? '#ff9800' : '#4caf50' 
                  }}>
                    [{rec.priority}]
                  </strong> {rec.action}
                  <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{rec.rationale}</div>
                </li>
              ))}
            </ul>
          </div>

          <button className="btn btn-secondary" onClick={() => setShowRaw(!showRaw)} style={{ fontSize: 12 }}>
            {showRaw ? 'Hide Raw Data' : 'View Raw Scraped Data'}
          </button>
          
          {showRaw && (
            <pre style={{ background: '#333', color: '#fff', padding: 15, borderRadius: 4, marginTop: 10, overflowX: 'auto', fontSize: 12 }}>
              {JSON.stringify(report.raw_data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Past Audits</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Target URL</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a href={item.input_url} target="_blank" rel="noreferrer">{item.input_url}</a>
                  </td>
                  <td>
                    <span style={{ fontWeight: 'bold', color: getScoreColor(item.score) }}>{item.score}</span>
                  </td>
                  <td>
                    <button className="btn btn-small" onClick={() => {
                      setUrl(item.input_url);
                      setReport(item.report);
                      window.scrollTo(0, 0);
                    }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WebsiteAuditPage;
