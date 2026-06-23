import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const LlmIntegrationTab = ({ showMsg }) => {
  const { currentUser } = useApp();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState({});
  const [models, setModels] = useState({});
  const [errorModal, setErrorModal] = useState(null);

  const fetchProviders = async () => {
    try {
      const res = await fetch((process.env.REACT_APP_API_URL || '') + '/api/settings/llm', {
        headers: { 'x-user-role': currentUser?.role }
      });
      const data = await res.json();
      if (data.success) {
        setProviders(data.providers);
        const newFormState = {};
        data.providers.forEach(p => {
          newFormState[p.provider] = {
            apiKey: '',
            model_id: p.model_id || ''
          };
          if (p.is_configured) {
            loadModels(p.provider);
          }
        });
        setFormState(newFormState);
      }
    } catch (err) {
      console.error('Failed to load LLM providers', err);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const loadModels = async (provider, apiKeyOverride) => {
    try {
      const headers = { 'x-user-role': currentUser?.role };
      if (apiKeyOverride) headers['x-api-key'] = apiKeyOverride;
      
      const res = await fetch((process.env.REACT_APP_API_URL || '') + `/api/settings/llm/${provider}/models`, {
        headers
      });
      const data = await res.json();
      if (data.success) {
        setModels(prev => ({ ...prev, [provider]: data.models }));
      }
    } catch (err) {
      console.error(`Failed to load models for ${provider}`, err);
    }
  };

  const handleUpdateField = (provider, field, value) => {
    setFormState(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value
      }
    }));
  };

  const handleVerifyAndSave = async (provider) => {
    setLoading(true);
    try {
      const state = formState[provider];
      
      // Test first
      const testRes = await fetch((process.env.REACT_APP_API_URL || '') + `/api/settings/llm/${provider}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role
        },
        body: JSON.stringify({ apiKey: state.apiKey, model_id: state.model_id })
      });
      const testData = await testRes.json();
      
      if (!testData.success) {
        setErrorModal(`❌ Configuration Failed: ${testData.message}`);
        setLoading(false);
        return;
      }
      
      // Save if test passes
      const payload = { model_id: state.model_id };
      if (state.apiKey) payload.apiKey = state.apiKey;
      
      const saveRes = await fetch((process.env.REACT_APP_API_URL || '') + `/api/settings/llm/${provider}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser?.role,
          'x-user-id': currentUser?.uuid || 'admin'
        },
        body: JSON.stringify(payload)
      });
      const saveData = await saveRes.json();
      
      if (saveData.success) {
        showMsg(`✅ ${provider} Configuration Saved!`);
        await fetchProviders();
        if (state.apiKey) loadModels(provider, state.apiKey);
        handleUpdateField(provider, 'apiKey', ''); // clear the plain text key from state
      } else {
        setErrorModal(`❌ Save Failed: ${saveData.message}`);
      }
    } catch (err) {
      setErrorModal('❌ Verification Failed. Please try again.');
    }
    setLoading(false);
  };

  const handleActivate = async (provider) => {
    setLoading(true);
    try {
      const res = await fetch((process.env.REACT_APP_API_URL || '') + `/api/settings/llm/${provider}/activate`, {
        method: 'POST',
        headers: {
          'x-user-role': currentUser?.role,
          'x-user-id': currentUser?.uuid || 'admin'
        }
      });
      const data = await res.json();
      if (data.success) {
        showMsg(`✅ ${provider} is now the active provider!`);
        fetchProviders();
      } else {
        setErrorModal(`❌ Failed to activate: ${data.message}`);
      }
    } catch (err) {
      setErrorModal('❌ Failed to activate provider');
    }
    setLoading(false);
  };

  return (
    <div className="card-body" style={{ position: 'relative' }}>
      {errorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg-primary, white)', padding: 24, borderRadius: 12, maxWidth: 500, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--danger, #ef4444)' }}>Action Required</h3>
            <div style={{ color: 'var(--text-primary, #333)', lineHeight: 1.5, marginBottom: 24, whiteSpace: 'pre-wrap' }}>
              {errorModal}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setErrorModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: 15 }}>🧠 LLM Integration</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Configure the LLM providers used for the Research feature. You can configure multiple providers but only one can be active at a time.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {['anthropic', 'openai', 'xai'].map(providerName => {
          const pData = providers.find(p => p.provider === providerName) || {};
          const fState = formState[providerName] || { apiKey: '', model_id: '' };
          const pModels = models[providerName] || [];
          
          const getDisplayName = (p) => {
            if (p === 'anthropic') return 'Anthropic (Claude)';
            if (p === 'openai') return 'OpenAI (GPT)';
            if (p === 'xai') return 'xAI (Grok)';
            return p;
          };

          return (
            <div key={providerName} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <h4 style={{ margin: 0, textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {getDisplayName(providerName)}
                  {pData.is_configured ? (
                    <span style={{ fontSize: 10, background: 'var(--success)', color: 'white', padding: '2px 6px', borderRadius: 10 }}>Configured</span>
                  ) : (
                    <span style={{ fontSize: 10, background: 'var(--border)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: 10 }}>Not Configured</span>
                  )}
                  {pData.is_active && (
                    <span style={{ fontSize: 10, background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: 10 }}>Active Provider</span>
                  )}
                </h4>
                <div>
                  <button 
                    className="btn btn-outline" 
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => handleActivate(providerName)}
                    disabled={loading || !pData.is_configured || pData.is_active}
                  >
                    {pData.is_active ? 'Currently Active' : 'Set as Active'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input 
                    className="form-control" 
                    type="password" 
                    placeholder={pData.maskedKey ? `Existing key: ${pData.maskedKey}` : "Enter API Key"} 
                    value={fState.apiKey} 
                    onChange={e => handleUpdateField(providerName, 'apiKey', e.target.value)} 
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Leave blank to keep existing key.
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Default Model</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <select 
                      className="form-control" 
                      value={fState.model_id} 
                      onChange={e => handleUpdateField(providerName, 'model_id', e.target.value)}
                    >
                      <option value="">-- Select Model --</option>
                      {pModels.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => loadModels(providerName, fState.apiKey)}
                      title="Load models"
                      style={{ padding: '0 10px' }}
                    >
                      🔄
                    </button>
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: 15 }}>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleVerifyAndSave(providerName)} 
                  disabled={loading || (!fState.apiKey && !pData.is_configured)}
                >
                  💾 Verify & Save Configuration
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LlmIntegrationTab;
