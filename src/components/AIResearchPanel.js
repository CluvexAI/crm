import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import ReactMarkdown from 'react-markdown';

const AIResearchPanel = ({ lead, customer, onClose }) => {
  const { currentUser } = useApp();
  const [researchType, setResearchType] = useState('website');
  const [targetUrl, setTargetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  
  useEffect(() => {
    if (researchType === 'website') {
      setTargetUrl(lead?.website || customer?.website || '');
    } else {
      setTargetUrl(''); // GMB URL usually not in basic schema
    }
  }, [researchType, lead, customer]);

  const handleGenerate = async () => {
    if (!targetUrl) {
      setError('Please enter a valid URL');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch((process.env.REACT_APP_API_URL || '') + '/api/llm/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role },
        body: JSON.stringify({
          type: researchType,
          targetUrl,
          leadId: lead?.id,
          customerId: customer?.id,
          createdBy: currentUser?.uuid
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setReport(data.report);
      } else {
        setError(data.message || 'Failed to generate research');
      }
    } catch (err) {
      setError('Network error or AI service unavailable');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxWidth: 800 }}>
        <div className="modal-header">
          <div className="modal-title">
            🤖 AI Research & Analysis 
            {lead && ` — Lead: ${lead.businessName}`}
            {customer && ` — Customer: ${customer.companyName}`}
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 15, marginBottom: 20 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Analysis Type</label>
              <select 
                className="form-control" 
                value={researchType}
                onChange={e => {
                  setResearchType(e.target.value);
                  setReport(null);
                }}
              >
                <option value="website">Website Audit & Lead Qualification</option>
                <option value="gmb">Google Business Profile Analysis</option>
              </select>
            </div>
            
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label">Target URL</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input 
                  className="form-control"
                  placeholder={`https://...`}
                  value={targetUrl}
                  onChange={e => setTargetUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleGenerate} 
                  disabled={loading || !targetUrl}
                  style={{ minWidth: 120 }}
                >
                  {loading ? 'Analyzing...' : 'Generate'}
                </button>
              </div>
              {error && <div className="form-error">{error}</div>}
            </div>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: 40, animation: 'spin 2s linear infinite', marginBottom: 15 }}>⚙️</div>
              <div>AI is analyzing the profile... This may take up to 30 seconds.</div>
            </div>
          )}

          {report && !loading && (
            <div style={{ 
              background: 'var(--bg-secondary)', 
              padding: 20, 
              borderRadius: 8, 
              border: '1px solid var(--border)',
              maxHeight: '60vh',
              overflowY: 'auto',
              lineHeight: 1.6
            }}>
              <style>{`
                .markdown-body h1 { font-size: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
                .markdown-body h2 { font-size: 1.25em; margin-top: 1.5em; margin-bottom: 0.5em; }
                .markdown-body h3 { font-size: 1.1em; margin-top: 1.2em; }
                .markdown-body ul, .markdown-body ol { padding-left: 2em; margin-bottom: 1em; }
                .markdown-body li { margin-bottom: 0.3em; }
                .markdown-body strong { color: var(--text-primary); }
                .markdown-body { color: var(--text-secondary); font-size: 0.95em; }
              `}</style>
              <div className="markdown-body">
                <ReactMarkdown>{report}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIResearchPanel;
