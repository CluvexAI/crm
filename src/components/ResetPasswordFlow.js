import React, { useState, useEffect, useRef } from 'react';
import { getAllUsers, updateUserRecord } from '../services/userDatabase';
import { validatePasswordStrength } from '../services/passwordService';

const PROXY = '';

// ─── Strength helpers ─────────────────────────────────────────────────────────
const getStrength = (pw) => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z\d]/.test(pw)) s++;
  return s;
};
const strengthLabel = ['', 'Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
const strengthColor = ['', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#059669'];

// ─── Shared styles ────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 20, backdropFilter: 'blur(6px)',
  },
  card: {
    background: '#fff', borderRadius: 14, width: '100%', maxWidth: 440,
    boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden',
    animation: 'rpfSlideUp 0.3s ease',
  },
  body: { padding: '28px 32px' },
  iconBox: (bg) => ({
    width: 48, height: 48, borderRadius: 10, background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, marginBottom: 18,
  }),
  h2: { margin: '0 0 6px', fontSize: 20, fontWeight: 700, color: '#1f2937' },
  sub: { margin: '0 0 22px', fontSize: 13.5, color: '#6b7280', lineHeight: 1.5 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: {
    width: '100%', padding: '11px 14px', fontSize: 14,
    border: '1.5px solid #e5e7eb', borderRadius: 8,
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  },
  btn: (disabled) => ({
    width: '100%', padding: '12px', fontSize: 14, fontWeight: 600,
    color: '#fff', background: disabled ? '#9ca3af' : '#1a73e8',
    border: 'none', borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 0.2s',
  }),
  link: {
    background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
    fontSize: 13, fontFamily: 'inherit', padding: 0, marginTop: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  err: {
    background: '#fef2f2', color: '#dc2626', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, marginBottom: 14,
    border: '1px solid #fecaca',
  },
  success: {
    background: '#f0fdf4', color: '#166534', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, marginBottom: 14,
    border: '1px solid #bbf7d0',
  },
};

const CSS = `
@keyframes rpfSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes rpfShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — Forgot Password (email input)
// ═══════════════════════════════════════════════════════════════════════════════
const Screen1 = ({ onNext, onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading'); setMessage('');

    try {
      const users = getAllUsers().map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
      const res = await fetch(`${PROXY}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), users }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setStatus('error'); setMessage(data.message); return;
      }
      if (!data.success || data.found === false) {
        setStatus('error'); setMessage(data.message || 'Email not found.'); return;
      }

      onNext({ email: email.trim().toLowerCase(), sessionId: data.sessionId, expiresAt: data.expiresAt });
    } catch {
      setStatus('error'); setMessage('Could not connect to server. Please try again.');
    }
  };

  return (
    <div style={S.body}>
      <div style={S.iconBox('#eff6ff')}>🔒</div>
      <h2 style={S.h2}>Forgot your password?</h2>
      <p style={S.sub}>
        Enter your registered email address. We'll check your account and send a one-time password (OTP) if the email is found.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 18 }}>
          <label style={S.label}>Email address</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com" required autoFocus
            style={{ ...S.input, borderColor: status === 'error' ? '#fca5a5' : '#e5e7eb' }}
            onFocus={e => e.target.style.borderColor = '#1a73e8'}
            onBlur={e => e.target.style.borderColor = status === 'error' ? '#fca5a5' : '#e5e7eb'}
          />
        </div>

        {status === 'error' && <div style={S.err}>⚠️ {message}</div>}

        <button type="submit" disabled={status === 'loading'} style={S.btn(status === 'loading')}>
          {status === 'loading' ? (<><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Sending...</>) : (<>✈ Send OTP</>)}
        </button>
      </form>

      <button onClick={onClose} style={S.link}>← Back to login</button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 2 — OTP Verification (6-cell input + countdown)
// ═══════════════════════════════════════════════════════════════════════════════
const Screen2 = ({ email, sessionId, expiresAt: initExpiry, onNext, onBack }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [expiresAt, setExpiresAt] = useState(initExpiry);
  const [sid, setSid] = useState(sessionId);
  const [resending, setResending] = useState(false);
  const refs = useRef([]);

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setRemaining(left);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  const handleChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(''));
      refs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    setStatus('loading'); setMessage('');

    try {
      const res = await fetch(`${PROXY}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, otp: code }),
      });
      const data = await res.json();

      if (data.success) {
        onNext({ sessionId: sid, userId: data.userId, email: data.email });
      } else {
        setStatus('error'); setMessage(data.message);
        setShake(true); setTimeout(() => setShake(false), 500);
        setOtp(['', '', '', '', '', '']);
        refs.current[0]?.focus();
      }
    } catch {
      setStatus('error'); setMessage('Connection error.');
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const users = getAllUsers().map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
      const res = await fetch(`${PROXY}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, users }),
      });
      const data = await res.json();
      if (data.success) {
        setSid(data.sessionId);
        setExpiresAt(data.expiresAt);
        setOtp(['', '', '', '', '', '']);
        setMessage(''); setStatus('idle');
        refs.current[0]?.focus();
      }
    } catch { /* silent */ }
    setResending(false);
  };

  return (
    <div style={S.body}>
      <div style={S.iconBox('#f0fdf4')}>📬</div>
      <div style={{ ...S.success, marginBottom: 12 }}>✉ OTP email sent</div>
      <h2 style={S.h2}>Check your inbox</h2>
      <p style={S.sub}>
        A 6-digit OTP has been sent to your email. Enter it below — the code is valid for <strong>1 hour</strong>.
      </p>

      <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 16 }}>
        ⏱ OTP delivered to <strong>{email}</strong>. If you don't see it, check your spam folder.
      </div>

      <div style={{ fontSize: 13, color: remaining <= 60 ? '#dc2626' : '#059669', fontWeight: 600, marginBottom: 14 }}>
        ⏳ Expires in {mm}:{ss}
      </div>

      <label style={S.label}>Enter 6-digit OTP</label>
      <div style={{
        display: 'flex', gap: 8, marginBottom: 16,
        animation: shake ? 'rpfShake 0.4s ease' : 'none',
      }} onPaste={handlePaste}>
        {otp.map((d, i) => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            type="text" inputMode="numeric" maxLength={1}
            value={d}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            style={{
              width: 48, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700,
              border: `2px solid ${d ? '#1a73e8' : '#e5e7eb'}`, borderRadius: 8,
              outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = '#1a73e8'}
            onBlur={e => e.target.style.borderColor = d ? '#1a73e8' : '#e5e7eb'}
          />
        ))}
      </div>

      {status === 'error' && <div style={S.err}>⚠️ {message}</div>}

      <button onClick={handleVerify} disabled={otp.join('').length !== 6 || status === 'loading'} style={S.btn(otp.join('').length !== 6 || status === 'loading')}>
        {status === 'loading' ? '⏳ Verifying...' : '🔄 Verify OTP'}
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
        <button onClick={onBack} style={{ ...S.link, marginTop: 0 }}>← Back</button>
        <button onClick={handleResend} disabled={resending} style={{ ...S.link, marginTop: 0, color: '#1a73e8' }}>
          {resending ? 'Sending...' : '↻ Resend OTP'}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 3 — Reset Password (new + confirm + strength meter)
// ═══════════════════════════════════════════════════════════════════════════════
const Screen3 = ({ sessionId, userId, onNext }) => {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const strength = getStrength(pw);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    const v = validatePasswordStrength(pw);
    if (!v.isValid) { setError(v.errors[0]); return; }

    setLoading(true);
    try {
      const res = await fetch(`${PROXY}/api/auth/reset-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, newPassword: pw }),
      });
      const data = await res.json();
      if (data.success) {
        // Update localStorage
        const allUsers = getAllUsers();
        const user = allUsers.find(u => String(u.id) === String(data.userId || userId));
        if (user) updateUserRecord(user.uuid, { password: data.hashedPassword });
        onNext();
      } else {
        setError(data.message || 'Reset failed.');
      }
    } catch {
      setError('Connection error.');
    }
    setLoading(false);
  };

  const checks = [
    ['At least 8 characters', pw.length >= 8],
    ['One uppercase letter', /[A-Z]/.test(pw)],
    ['One number', /\d/.test(pw)],
    ['One special character', /[^a-zA-Z\d]/.test(pw)],
  ];

  const eyeBtn = (show, toggle) => (
    <button type="button" onClick={toggle} style={{
      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
    }}>{show ? '🙈' : '👁'}</button>
  );

  return (
    <div style={S.body}>
      <div style={S.iconBox('#fef3c7')}>🔑</div>
      <h2 style={S.h2}>Reset your password</h2>
      <p style={S.sub}>Create a strong new password for your account.</p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>New Password</label>
          <div style={{ position: 'relative' }}>
            <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)}
              placeholder="Enter new password" required autoFocus
              style={{ ...S.input, paddingRight: 44 }}
              onFocus={e => e.target.style.borderColor = '#1a73e8'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
            {eyeBtn(showPw, () => setShowPw(!showPw))}
          </div>
          {pw && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 4,
                    background: i <= Math.min(strength, 4) ? strengthColor[Math.min(strength, 4)] : '#e5e7eb',
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

        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>Confirm Password</label>
          <div style={{ position: 'relative' }}>
            <input type={showCf ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm new password" required
              style={{ ...S.input, paddingRight: 44, borderColor: confirm && confirm !== pw ? '#ef4444' : '#e5e7eb' }}
              onFocus={e => e.target.style.borderColor = '#1a73e8'}
              onBlur={e => e.target.style.borderColor = confirm && confirm !== pw ? '#ef4444' : '#e5e7eb'}
            />
            {eyeBtn(showCf, () => setShowCf(!showCf))}
          </div>
          {confirm && confirm !== pw && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Passwords do not match</div>
          )}
          {confirm && confirm === pw && pw && (
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>✓ Passwords match</div>
          )}
        </div>

        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>Requirements:</div>
          {checks.map(([l, met]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ color: met ? '#10b981' : '#d1d5db', fontSize: 13 }}>{met ? '✓' : '○'}</span>
              <span style={{ color: met ? '#10b981' : '#9ca3af' }}>{l}</span>
            </div>
          ))}
        </div>

        {error && <div style={S.err}>⚠️ {error}</div>}

        <button type="submit" disabled={loading || strength < 3 || pw !== confirm || !confirm}
          style={S.btn(loading || strength < 3 || pw !== confirm || !confirm)}>
          {loading ? '⏳ Saving...' : '🔐 Reset Password'}
        </button>
      </form>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 4 — Success
// ═══════════════════════════════════════════════════════════════════════════════
const Screen4 = ({ onClose }) => {
  const [countdown, setCountdown] = useState(5);
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(t); onClose(); }
      return c - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [onClose]);

  return (
    <div style={{ ...S.body, textAlign: 'center' }}>
      <div style={{ ...S.iconBox('#f0fdf4'), margin: '0 auto 18px' }}>✅</div>
      <h2 style={S.h2}>Password successfully reset</h2>
      <p style={S.sub}>
        Your password has been updated. The OTP has been invalidated. You can now sign in with your new credentials.
      </p>
      <div style={{ ...S.success, textAlign: 'left', fontSize: 12 }}>
        <div>✓ Email verified</div>
        <div>✓ OTP sent &amp; verified</div>
        <div>✓ Password hashed &amp; saved</div>
        <div>✓ OTP invalidated</div>
      </div>
      <p style={{ color: '#9ca3af', fontSize: 13, margin: '16px 0' }}>
        Redirecting to login in <strong style={{ color: '#1a73e8' }}>{countdown}s</strong>...
      </p>
      <button onClick={onClose} style={S.btn(false)}>← Return to Login</button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — ForgotPasswordModal (orchestrates all 4 screens)
// ═══════════════════════════════════════════════════════════════════════════════
export const ForgotPasswordModal = ({ onClose }) => {
  const [screen, setScreen] = useState(1);
  const [ctx, setCtx] = useState({});

  return (
    <div style={S.overlay}>
      <style>{CSS}</style>
      <div style={S.card}>
        {screen === 1 && (
          <Screen1
            onNext={(data) => { setCtx(data); setScreen(2); }}
            onClose={onClose}
          />
        )}
        {screen === 2 && (
          <Screen2
            email={ctx.email}
            sessionId={ctx.sessionId}
            expiresAt={ctx.expiresAt}
            onNext={(data) => { setCtx(prev => ({ ...prev, ...data })); setScreen(3); }}
            onBack={() => setScreen(1)}
          />
        )}
        {screen === 3 && (
          <Screen3
            sessionId={ctx.sessionId}
            userId={ctx.userId}
            onNext={() => setScreen(4)}
          />
        )}
        {screen === 4 && <Screen4 onClose={onClose} />}
      </div>
    </div>
  );
};

// Keep backward-compatible export (no longer used, but avoids import errors)
export const ResetPasswordPage = ({ onBack }) => {
  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={{ ...S.body, textAlign: 'center' }}>
          <div style={S.iconBox('#fef3c7')}>⚠️</div>
          <h2 style={S.h2}>Link-Based Reset Deprecated</h2>
          <p style={S.sub}>Password resets now use OTP verification. Please use the "Forgot Password?" link on the login page.</p>
          <button onClick={onBack} style={S.btn(false)}>← Back to Login</button>
        </div>
      </div>
    </div>
  );
};
