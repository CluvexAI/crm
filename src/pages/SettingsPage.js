import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const SettingsPage = () => {
  const { currentUser } = useApp();
  const [activeTab, setActiveTab] = useState('payment_gateway');
  const [stripeConfig, setStripeConfig] = useState({
    secretKey: '',
    publishableKey: '',
    testMode: true,
    webhookSecret: '',
    defaultCurrency: 'USD',
    successUrl: 'https://crm.zsmeservices.com/success',
    cancelUrl: 'https://crm.zsmeservices.com/cancel',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings/stripe')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config) {
          setStripeConfig(data.config);
        }
      })
      .catch(err => console.error('Failed to load Stripe config', err));
  }, []);

  const showMsg = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleSaveStripe = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stripeConfig)
      });
      const data = await res.json();
      if (data.success) {
        showMsg('✅ Stripe Configuration Saved!');
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Failed to save configuration');
    }
    setLoading(false);
  };

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/stripe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stripeConfig)
      });
      const data = await res.json();
      if (data.success) {
        showMsg('✅ Stripe Keys Verified Successfully!');
      } else {
        alert(`❌ Verification Failed: ${data.message}`);
      }
    } catch (err) {
      alert('Verification Failed');
    }
    setLoading(false);
  };

  if (currentUser?.role !== 'Admin') {
    return <div className="empty-state">Access Denied</div>;
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {message && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#27ae60', color: 'white', padding: '12px 20px', borderRadius: 8, zIndex: 999 }}>
          {message}
        </div>
      )}

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${activeTab === 'payment_gateway' ? 'active' : ''}`} onClick={() => setActiveTab('payment_gateway')}>Payment Gateway</button>
      </div>

      <div className="card">
        {activeTab === 'payment_gateway' && (
          <div className="card-body">
            <h3 style={{ marginBottom: 15 }}>💳 Stripe Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
              <div className="form-group">
                <label className="form-label">Stripe Secret Key</label>
                <input className="form-control" type="password" value={stripeConfig.secretKey} onChange={e => setStripeConfig({...stripeConfig, secretKey: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Stripe Publishable Key</label>
                <input className="form-control" value={stripeConfig.publishableKey} onChange={e => setStripeConfig({...stripeConfig, publishableKey: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Mode</label>
                <select className="form-control" value={stripeConfig.testMode ? 'test' : 'live'} onChange={e => setStripeConfig({...stripeConfig, testMode: e.target.value === 'test'})}>
                  <option value="test">Test Mode</option>
                  <option value="live">Live Mode</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Webhook Secret</label>
                <input className="form-control" type="password" value={stripeConfig.webhookSecret} onChange={e => setStripeConfig({...stripeConfig, webhookSecret: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Default Currency</label>
                <select className="form-control" value={stripeConfig.defaultCurrency} onChange={e => setStripeConfig({...stripeConfig, defaultCurrency: e.target.value})}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Success Redirect URL</label>
                <input className="form-control" value={stripeConfig.successUrl} onChange={e => setStripeConfig({...stripeConfig, successUrl: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Cancel Redirect URL</label>
                <input className="form-control" value={stripeConfig.cancelUrl} onChange={e => setStripeConfig({...stripeConfig, cancelUrl: e.target.value})} />
              </div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleSaveStripe} disabled={loading}>💾 Save Configuration</button>
              <button className="btn btn-outline" onClick={handleTestConnection} disabled={loading}>{loading ? 'Testing...' : '🔄 Verify Stripe Keys'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
