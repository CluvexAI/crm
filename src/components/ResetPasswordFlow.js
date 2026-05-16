import React, { useState, useEffect, useCallback } from 'react';
import { getAllUsers, updateUserRecord } from '../services/userDatabase';
import { validatePasswordStrength } from '../services/passwordService';

const PROXY = ''; // Use relative path to work with production proxy

// ─── Forgot Password Modal ────────────────────────────────────────────────────
export const ForgotPasswordModal = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setMessage('');
    try {
      const users = getAllUsers().map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));
      const res = await fetch(`${PROXY}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), users }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setStatus('error');
        setMessage(data.message);
      } else {
        setStatus('success');
        setMessage(data.message || 'If that email is registered, a reset link has been sent.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Could not connect to server. Please try again.');
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)', overflow: 'hidden',
        animation: 'slideUp 0.25s ease',
      }}>
        <div style={{
          background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
          padding: '28px 32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>Forgot Password?</h2>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            Enter your email and we'll send a reset link
          </p>
        </div>

        <div style={{ padding: '32px' }}>
          {status === 'success' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>📬</div>
              <h3 style={{ margin: '0 0 8px', color: '#1f2937', fontSize: 17, fontWeight: 600 }}>Check Your Email</h3>
              <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
              <p style={{ color: '#9ca3af', fontSize: 12 }}>
                The link expires in <strong>30 minutes</strong>. Check your spam folder if you don't see it.
              </p>
              <button onClick={onClose} style={{
                marginTop: 24, padding: '10px 28px', background: 'linear-gradient(135deg,#667eea,#764ba2)',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 14, fontWeight: 600,
              }}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@zsmeservices.com"
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '11px 14px', fontSize: 14,
                    border: '1.5px solid #e5e7eb', borderRadius: 8,
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#667eea'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {status === 'error' && (
                <div style={{
                  background: '#fee2e2', color: '#dc2626', borderRadius: 8,
                  padding: '10px 14px', fontSize: 13, marginBottom: 16,
                }}>
                  ⚠️ {message}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={onClose} style={{
                  flex: 1, padding: '11px', background: '#f9fafb',
                  border: '1.5px solid #e5e7eb', borderRadius: 8,
                  cursor: 'pointer', fontSize: 14, color: '#374151', fontWeight: 500,
                }}>
                  Cancel
                </button>
                <button type="submit" disabled={status === 'loading'} style={{
                  flex: 2, padding: '11px', fontSize: 14, fontWeight: 600, color: '#fff',
                  background: status === 'loading' ? '#9ca3af' : 'linear-gradient(135deg,#667eea,#764ba2)',
                  border: 'none', borderRadius: 8, cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                }}>
                  {status === 'loading' ? '⏳ Sending...' : '📤 Send Reset Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
};

const getStrength = (pw) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z\d]/.test(pw)) score++;
  return score;
};

const strengthLabel = ['', 'Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
const strengthColor = ['', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#059669'];

export const ResetPasswordPage = ({ token, uid, onBack }) => {
  const [phase, setPhase] = useState('validating'); // validating | form | success | invalid
  const [userEmail, setUserEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const strength = getStrength(newPassword);

  useEffect(() => {
    if (!token || !uid) { setPhase('invalid'); return; }
    fetch(`${PROXY}/api/auth/validate-reset-token?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) { setUserEmail(data.email); setPhase('form'); }
        else setPhase('invalid');
      })
      .catch(() => setPhase('invalid'));
  }, [token, uid]);

  useEffect(() => {
    if (phase !== 'success') return;
    const t = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(t); onBack(); }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [phase, onBack]);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    setLoading(true);
    try {
      const users = getAllUsers().map(u => ({ id: u.id, email: u.email }));
      const res = await fetch(`${PROXY}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, uid, newPassword, users }),
      });
      const data = await res.json();
      if (data.success) {
        const allUsers = getAllUsers();
        const user = allUsers.find(u => String(u.id) === String(uid));
        if (user) {
          updateUserRecord(user.uuid, { password: data.hashedPassword });
        }
        setPhase('success');
      } else {
        setError(data.message || 'Reset failed. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    }
    setLoading(false);
  };

  if (phase === 'validating') return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⚙️</div>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Validating your reset link...</p>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (phase === 'invalid') return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>Link Invalid or Expired</h2>
        </div>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            This password reset link has expired (30 min limit), already been used, or is invalid.
          </p>
          <button onClick={onBack} style={btnPrimary}>← Back to Login</button>
        </div>
      </div>
    </div>
  );

  if (phase === 'success') return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>Password Reset Successful</h2>
        </div>
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
            Your password has been updated. You can now log in with your new password.
          </p>
          <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 24 }}>
            Redirecting to login in <strong style={{ color: '#667eea' }}>{countdown}s</strong>...
          </p>
          <button onClick={onBack} style={btnPrimary}>← Back to Login</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 700 }}>Create New Password</h2>
          {userEmail && <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{userEmail}</p>}
        </div>
        <div style={{ padding: '32px' }}>
          <form onSubmit={handleReset}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  autoFocus
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={e => e.target.style.borderColor = '#667eea'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                  {showNew ? '🙈' : '👁'}
                </button>
              </div>
              {newPassword && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 4, borderRadius: 4,
                        background: i <= strength ? strengthColor[strength] : '#e5e7eb',
                        transition: 'background 0.2s',
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: strengthColor[strength], fontWeight: 500 }}>
                    {strengthLabel[strength]}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  style={{ ...inputStyle, paddingRight: 44,
                    borderColor: confirmPassword && confirmPassword !== newPassword ? '#ef4444' : '#e5e7eb',
                  }}
                  onFocus={e => e.target.style.borderColor = '#667eea'}
                  onBlur={e => e.target.style.borderColor = confirmPassword && confirmPassword !== newPassword ? '#ef4444' : '#e5e7eb'}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                  {showConfirm ? '🙈' : '👁'}
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Passwords do not match</div>
              )}
            </div>

            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 12, color: '#6b7280' }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>Password requirements:</div>
              {[
                ['At least 8 characters', newPassword.length >= 8],
                ['One uppercase letter', /[A-Z]/.test(newPassword)],
                ['One lowercase letter', /[a-z]/.test(newPassword)],
                ['One number', /\d/.test(newPassword)],
                ['One special character', /[^a-zA-Z\d]/.test(newPassword)],
              ].map(([label, met]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ color: met ? '#10b981' : '#d1d5db', fontSize: 14 }}>{met ? '✓' : '○'}</span>
                  <span style={{ color: met ? '#10b981' : '#9ca3af' }}>{label}</span>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading || strength < 3} style={{
              ...btnPrimary,
              width: '100%',
              opacity: loading || strength < 3 ? 0.6 : 1,
              cursor: loading || strength < 3 ? 'not-allowed' : 'pointer',
            }}>
              {loading ? '⏳ Resetting...' : '🔐 Reset Password'}
            </button>

            <button type="button" onClick={onBack} style={{
              width: '100%', marginTop: 10, padding: '10px', background: 'none',
              border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13,
            }}>
              ← Back to Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: 20,
};
const cardStyle = {
  background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
  boxShadow: '0 25px 50px rgba(0,0,0,0.25)', overflow: 'hidden',
};
const headerStyle = {
  background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
  padding: '28px 32px', textAlign: 'center',
};
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };
const inputStyle = {
  width: '100%', padding: '11px 14px', fontSize: 14,
  border: '1.5px solid #e5e7eb', borderRadius: 8,
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};
const btnPrimary = {
  display: 'inline-block', padding: '11px 28px', fontSize: 14, fontWeight: 600,
  color: '#fff', background: 'linear-gradient(135deg,#667eea,#764ba2)',
  border: 'none', borderRadius: 8, cursor: 'pointer',
};
