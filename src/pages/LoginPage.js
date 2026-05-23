import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ForgotPasswordModal } from '../components/ResetPasswordFlow';

const LoginPage = () => {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const demoUsers = [
    { email: 'admin@zsmeservices.com', password: 'admin123', role: 'Admin', color: '#0E5491' },
    { email: 'rahul@zsmeservices.com', password: 'rahul123', role: 'Sales Agent', color: '#10b981' },
    { email: 'priya@zsmeservices.com', password: 'priya123', role: 'HR Manager', color: '#f59e0b' },
    { email: 'arjun@zsmeservices.com', password: 'arjun123', role: 'Backend User', color: '#8b5cf6' },
    { email: 'vikram@zsmeservices.com', password: 'vikram123', role: 'Accounts', color: '#ef4444' },
    { email: 'neha@zsmeservices.com', password: 'neha123', role: 'Graphics Manager', color: '#ec4899' },
    { email: 'rohan.d@zsmeservices.com', password: 'rohan123', role: 'Graphic Designer', color: '#ec4899' },
    { email: 'kavya@zsmeservices.com', password: 'kavya123', role: 'Jr. Graphic Designer', color: '#ec4899' },
    { email: 'arun.m@zsmeservices.com', password: 'arun123', role: 'Video Editor', color: '#ec4899' },
    { email: 'pooja@zsmeservices.com', password: 'pooja123', role: 'Motion Graphic Designer', color: '#ec4899' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[LoginPage] Submitting:', email, password);
    setLoading(true);
    setError('');
    try {
      const result = await login(email, password);
      console.log('[LoginPage] Result:', result);
      if (!result.success) {
        setError(result.error || 'Invalid email or password. Please try again.');
      }
    } catch (err) {
      console.error('[LoginPage] Error:', err);
      setError('Login failed. Please try again.');
    }
    setLoading(false);
  };

  const quickLogin = (u) => {
    setEmail(u.email);
    setPassword(u.password);
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-bg-shapes">
        <div className="login-shape" style={{ width: 400, height: 400, top: -100, right: -80 }} />
        <div className="login-shape" style={{ width: 300, height: 300, bottom: -60, left: -80 }} />
        <div className="login-shape" style={{ width: 200, height: 200, top: '40%', left: '10%', background: 'rgba(80,193,223,0.08)' }} />
      </div>

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">Z</div>
          <div className="login-title">ZSM CRM</div>
          <div className="login-subtitle">Internal Office Management System</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>📧</span>
              <input
                className="form-control"
                style={{ paddingLeft: 38 }}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                id="login-email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔒</span>
              <input
                className="form-control"
                style={{ paddingLeft: 38, paddingRight: 44 }}
                type={showPass ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                id="login-password"
              />
              <button type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          )}

          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading} id="login-submit">
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <span style={{ animation: 'pulse 1s infinite' }}>⏳</span> Signing In...
              </span>
            ) : 'Sign In →'}
          </button>

          {/* Forgot Password — right-aligned, below Sign In */}
          <div style={{ textAlign: 'right', marginTop: 10 }}>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              id="forgot-password-link"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#667eea', fontSize: 13, fontWeight: 500, padding: 0,
              }}
              onMouseEnter={e => e.target.style.textDecoration = 'underline'}
              onMouseLeave={e => e.target.style.textDecoration = 'none'}
            >
              Forgot Password?
            </button>
          </div>
        </form>

        <div style={{ marginTop: 24, borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 10, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase' }}>
            Quick Login (Demo)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {demoUsers.map((u) => (
              <button key={u.email} onClick={() => quickLogin(u)}
                style={{
                  flex: '1 1 calc(50% - 6px)', padding: '8px 10px', border: `1.5px solid ${u.color}22`,
                  borderRadius: 8, background: `${u.color}08`, cursor: 'pointer', fontSize: 12,
                  color: u.color, fontWeight: 600, transition: 'all 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={e => e.currentTarget.style.background = `${u.color}15`}
                onMouseLeave={e => e.currentTarget.style.background = `${u.color}08`}
              >
                {u.role}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
};

export default LoginPage;
