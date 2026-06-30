import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const LlmIntegrationTab = ({ showMsg }) => {
  const { currentUser } = useApp();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  
  const [formState, setFormState] = useState({
    provider: 'OpenRouter',
    api_key: '',
    base_url: 'https://openrouter.ai/api/v1',
    gateway_url: '',
    fallback_provider: 'None',
    default_model: '',
    enabled: true
  });
  
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch((process.env.REACT_APP_API_URL || '') + '/api/admin/llm/settings', {
        headers: { 'x-user-role': currentUser?.role }
      });
      const data = await res.json();
      if (data && data.provider) {
        setFormState({
          provider: data.provider || 'OpenRouter',
          api_key: data.api_key || '',
          base_url: data.base_url || 'https://openrouter.ai/api/v1',
          gateway_url: data.gateway_url || '',
          fallback_provider: data.fallback_provider || 'None',
          default_model: data.default_model || '',
          enabled: data.enabled !== false
        });
        setIsConfigured(!!data.api_key);
        if (data.api_key) fetchModels();
      }
    } catch (err) {
      console.error('Failed to load LLM settings', err);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch((process.env.REACT_APP_API_URL || '') + '/api/admin/llm/models', {
        headers: { 'x-user-role': currentUser?.role }
      });
      const data = await res.json();
      if (data.success && data.models) {
        setModels(data.models);
      }
    } catch (err) {
      console.error('Failed to load models', err);
    }
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch((process.env.REACT_APP_API_URL || '') + '/api/admin/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role },
        body: JSON.stringify({ 
          api_key: formState.api_key, 
          base_url: formState.base_url, 
          gateway_url: formState.gateway_url,
          provider: formState.provider 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ ${data.message || 'Connection Successful!'}`);
        fetchModels();
      } else {
        alert(`❌ Connection Failed: ${data.message}`);
      }
    } catch (err) {
      alert('Verification Failed');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch((process.env.REACT_APP_API_URL || '') + '/api/admin/llm/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': currentUser?.role },
        body: JSON.stringify(formState)
      });
      const data = await res.json();
      if (data.success) {
        showMsg('✅ LLM Configuration Saved!');
        setIsConfigured(true);
        fetchSettings();
      } else {
        alert(`❌ Save Failed: ${data.message || data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Failed to save settings: ${err.message || err}`);
    }
    setLoading(false);
  };

  return (
    <div className="card-body">
      <h3 style={{ marginBottom: 15 }}>🧠 LLM Integration</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
        Configure the LLM provider for the AI Research feature (Lead Qualification, Website Audit, etc.).
      </p>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 15 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h4 style={{ margin: 0 }}>Provider Settings</h4>
          {isConfigured ? (
            <span style={{ fontSize: 12, background: 'var(--success)', color: 'white', padding: '4px 8px', borderRadius: 12 }}>Configured</span>
          ) : (
            <span style={{ fontSize: 12, background: 'var(--danger, #ef4444)', color: 'white', padding: '4px 8px', borderRadius: 12 }}>Not Configured</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
          <div className="form-group">
            <label className="form-label">Provider</label>
            <select 
              className="form-control" 
              value={formState.provider} 
              onChange={e => setFormState({...formState, provider: e.target.value})}
            >
              <option value="Insforge Model Gateway">Insforge Model Gateway</option>
              <option value="OpenRouter">OpenRouter</option>
              <option value="OpenAI">OpenAI</option>
              <option value="Anthropic" disabled>Anthropic (Coming Soon)</option>
              <option value="Google Gemini">Google Gemini</option>
              <option value="Ollama" disabled>Ollama (Coming Soon)</option>
              <option value="Custom API" disabled>Custom API (Coming Soon)</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-label">Fallback Provider</label>
            <select 
              className="form-control" 
              value={formState.fallback_provider} 
              onChange={e => setFormState({...formState, fallback_provider: e.target.value})}
            >
              <option value="None">None</option>
              <option value="OpenRouter">OpenRouter</option>
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Used if the primary provider fails.
            </div>
          </div>

          <div className="form-group">
              <label className="form-label">
                {formState.provider === 'Insforge Model Gateway' ? 'Gateway URL' : 'Base URL'}
              </label>
              <input 
                className="form-control" 
                value={formState.provider === 'Insforge Model Gateway' ? formState.gateway_url : formState.base_url} 
                onChange={e => {
                  if (formState.provider === 'Insforge Model Gateway') {
                    setFormState({...formState, gateway_url: e.target.value});
                  } else {
                    setFormState({...formState, base_url: e.target.value});
                  }
                }} 
                placeholder={
                  formState.provider === 'Insforge Model Gateway' 
                    ? 'https://<insforge-gateway-endpoint>' 
                    : formState.provider === 'Google Gemini' 
                      ? 'https://generativelanguage.googleapis.com/v1beta'
                      : formState.provider === 'OpenAI'
                        ? 'https://api.openai.com/v1'
                        : 'https://openrouter.ai/api/v1'
                }
              />
          </div>

          <div className="form-group">
            <label className="form-label">API Key</label>
            <input 
              className="form-control" 
              type="password" 
              placeholder={formState.api_key.includes('***') ? formState.api_key : "Enter API Key"} 
              onChange={e => setFormState({...formState, api_key: e.target.value})} 
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Encrypted before storing. Leave blank to keep existing key.
            </div>
          </div>
          
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Default Model</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <select 
                className="form-control" 
                value={formState.default_model} 
                onChange={e => setFormState({...formState, default_model: e.target.value})}
              >
                <option value="">-- Select Model --</option>
                {formState.provider === 'OpenRouter' && (
                  <>
                    <option value="google/gemini-2.5-pro">google/gemini-2.5-pro</option>
                    <option value="google/gemini-2.5-flash">google/gemini-2.5-flash</option>
                    <option value="anthropic/claude-opus-4">anthropic/claude-opus-4</option>
                    <option value="anthropic/claude-sonnet-4">anthropic/claude-sonnet-4</option>
                    <option value="openai/gpt-5">openai/gpt-5</option>
                  </>
                )}
                {formState.provider === 'Insforge Model Gateway' && (
                  <>
                    <option value="gemma-3-27b-it">gemma-3-27b-it</option>
                    <option value="llama-4-maverick">llama-4-maverick</option>
                    <option value="deepseek-chat">deepseek-chat</option>
                  </>
                )}
                {formState.provider === 'Google Gemini' && (
                  <>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  </>
                )}
                {formState.provider === 'OpenAI' && (
                  <>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                  </>
                )}
                
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button 
                className="btn btn-outline" 
                onClick={fetchModels}
                title="Fetch available models from Provider"
                style={{ padding: '0 10px' }}
              >
                🔄
              </button>
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button 
            className="btn btn-primary" 
            onClick={handleSave} 
            disabled={loading}
          >
            💾 Save Settings
          </button>
          <button 
            className="btn btn-outline" 
            onClick={handleTestConnection} 
            disabled={loading || (!formState.api_key && !isConfigured)}
          >
            🔌 Test Connection
          </button>
        </div>
      </div>
    </div>
  );
};

export default LlmIntegrationTab;
