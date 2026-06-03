import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ForgotPasswordModal } from '../components/ResetPasswordFlow';

function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let raf;
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 500;
      canvas.height = canvas.parentElement?.clientHeight || 800;
    };
    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.5 + 0.1;
      }
      update() {
        this.x += this.speedX; this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
      }
      draw() {
        ctx.fillStyle = `rgba(128,207,255,${this.opacity})`;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    const init = () => { particles = Array.from({ length: 60 }, () => new Particle()); };
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('resize', resize);
    resize(); init(); tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

const LoginPage = () => {
  const { login } = useApp();
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('zsm_remembered_email');
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    if (rememberMe) localStorage.setItem('zsm_remembered_email', email);
    else localStorage.removeItem('zsm_remembered_email');
    try {
      const result = await login(email, password);
      if (!result.success) setError(result.error || 'Invalid email or password.');
    } catch { setError('Login failed. Please try again.'); }
    setLoading(false);
  };


  const features = [
    { icon: 'insights',  accent: '#80cfff', bg: 'rgba(128,207,255,.12)', delay: '0s',    title: 'Project Intelligence',    desc: 'Advanced AI-driven predictive modeling for complex workflows.' },
    { icon: 'groups',    accent: '#a0caff', bg: 'rgba(160,202,255,.12)', delay: '1.5s',  title: 'Team Collaboration',      desc: 'Real-time sync and role-based access for global enterprises.' },
    { icon: 'analytics', accent: '#80cfff', bg: 'rgba(128,207,255,.12)', delay: '.75s',  title: 'Client Growth Analytics', desc: 'Granular tracking of retention and lifetime value metrics.' },
  ];

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,1&display=swap" rel="stylesheet" />
      <style>{`
        .lp * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes lpFloat      { 0%,100%{transform:translateY(0)}   50%{transform:translateY(-10px)} }
        @keyframes lpPulseAura  { 0%,100%{opacity:.3;filter:blur(40px)} 50%{opacity:.6;filter:blur(60px)} }
        @keyframes lpShimmer    { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes lpFadeUp     { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lpSpin       { to{transform:rotate(360deg)} }
        .lp-float { animation: lpFloat 4s ease-in-out infinite; }
        .lp { display:flex; min-height:100vh; background:#031425; color:#d3e4fb; font-family:'Poppins',sans-serif; overflow:hidden; }
        .lp-left {
          flex:0 0 50%; display:flex; flex-direction:column; justify-content:space-between;
          padding:40px; position:relative; overflow:hidden;
          background-image:radial-gradient(at 0% 0%,rgba(26,98,161,.45) 0,transparent 55%),
                           radial-gradient(at 100% 100%,rgba(67,168,220,.3) 0,transparent 55%);
          border-right:1px solid rgba(255,255,255,.05);
        }
        .lp-aura1 { position:absolute;top:25%;left:25%;width:384px;height:384px;background:rgba(26,98,161,.35);border-radius:50%;mix-blend-mode:screen;animation:lpPulseAura 8s ease-in-out infinite; }
        .lp-aura2 { position:absolute;bottom:25%;right:25%;width:256px;height:256px;background:rgba(47,154,205,.3);border-radius:50%;mix-blend-mode:screen;animation:lpPulseAura 12s ease-in-out infinite;animation-delay:2s; }
        .lp-feature { background:rgba(18,35,52,.7);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:20px 24px;display:flex;align-items:center;gap:16px;transition:transform .3s,box-shadow .3s; }
        .lp-feature:hover { transform:scale(1.02) translateY(-2px);box-shadow:0 20px 48px rgba(0,0,0,.4); }
        .lp-right { flex:1;display:flex;align-items:center;justify-content:center;padding:24px;background:#000f1f;position:relative; }
        .lp-card { background:rgba(18,35,52,.7);backdrop-filter:blur(12px);border:1px solid rgba(128,207,255,.2);border-radius:24px;padding:40px;box-shadow:0 32px 80px rgba(0,0,0,.5);position:relative;animation:lpFadeUp .5s ease both;width:100%;max-width:460px; }
        .lp-wrap { display:flex;align-items:center;position:relative;background:rgba(27,43,61,.5);border:1px solid rgba(255,255,255,.1);border-radius:12px;transition:box-shadow .25s,border-color .25s; }
        .lp-wrap:focus-within { box-shadow:0 0 0 3px rgba(128,207,255,.2);border-color:#80cfff; }
        .lp-ico { position:absolute;left:16px;color:#8b919b;font-size:20px;pointer-events:none; }
        .lp-wrap:focus-within .lp-ico { color:#a0caff; }
        .lp-inp { flex:1;background:transparent;border:none;outline:none;padding:14px 16px 14px 48px;color:#fff;font-family:'Poppins',sans-serif;font-size:14px; }
        .lp-inp::placeholder { color:#414750; }
        .lp-eye { background:none;border:none;cursor:pointer;padding:0 14px;color:#8b919b;display:flex;align-items:center;transition:color .2s; }
        .lp-eye:hover { color:#fff; }
        .lp-eye .material-symbols-outlined { font-size:20px; }
        .lp-btn { width:100%;padding:15px;border-radius:12px;border:none;cursor:pointer;font-family:'Poppins',sans-serif;font-size:16px;font-weight:600;color:#fff;background:linear-gradient(135deg,#1a62a1,#2f9acd);box-shadow:0 8px 24px rgba(26,98,161,.3);transition:box-shadow .3s,transform .15s;display:flex;align-items:center;justify-content:center;gap:10px;position:relative;overflow:hidden; }
        .lp-btn::after { content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent);transform:translateX(-100%);animation:lpShimmer 3s infinite; }
        .lp-btn:hover:not(:disabled) { box-shadow:0 12px 32px rgba(26,98,161,.5); }
        .lp-btn:active:not(:disabled) { transform:scale(.97); }
        .lp-btn:disabled { opacity:.7;cursor:not-allowed; }
        .lp-spin { width:18px;height:18px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:lpSpin .7s linear infinite; }

        .lp-chk { appearance:none;width:16px;height:16px;border:1px solid #414750;border-radius:4px;background:#0b1d2d;cursor:pointer;position:relative;transition:all .2s;flex-shrink:0; }
        .lp-chk:checked { background:#1a62a1;border-color:#a0caff; }
        .lp-chk:checked::after { content:'';display:block;width:10px;height:10px;background:#fff;position:absolute;top:2px;left:2px;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' fill='white'/%3E%3C/svg%3E") center/contain no-repeat; }
        @media(max-width:900px){ .lp-left{display:none!important;} }
      `}</style>

      <div className="lp">
        {/* ── LEFT PANEL ── */}
        <div className="lp-left">
          <ParticleCanvas />
          <div className="lp-aura1" />
          <div className="lp-aura2" />

          {/* Brand */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,#1a62a1,#80cfff)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 32px rgba(160,202,255,.2)' }}>
                <span className="material-symbols-outlined" style={{ color:'#fff',fontSize:28 }}>dataset</span>
              </div>
              <span style={{ fontSize:32,fontWeight:700,letterSpacing:'-0.5px',color:'#fff' }}>ZSM CRM</span>
            </div>
            <p style={{ fontSize:18,fontWeight:600,color:'#80cfff',marginTop:8 }}>Smart Client Relationship Management</p>
          </div>

          {/* Features */}
          <div style={{ display:'flex',flexDirection:'column',gap:20,position:'relative',zIndex:10 }}>
            {features.map(f => (
              <div key={f.title} className="lp-feature lp-float" style={{ borderLeft:`4px solid ${f.accent}`,animationDelay:f.delay }}>
                <div style={{ width:44,height:44,borderRadius:10,background:f.bg,color:f.accent,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize:22 }}>{f.icon}</span>
                </div>
                <div>
                  <div style={{ fontSize:16,fontWeight:600,color:'#fff',marginBottom:4 }}>{f.title}</div>
                  <div style={{ fontSize:12,fontWeight:500,color:'#c1c7d2',lineHeight:1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize:11,color:'#B7C9D8',opacity:.55,position:'relative',zIndex:10 }}>© 2026 ZSM eServices Pvt Ltd. Intelligence in Motion.</p>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="lp-right">
          <div style={{ position:'absolute',inset:0,background:'radial-gradient(circle at 50% 50%,rgba(40,128,191,.06) 0,transparent 70%)',pointerEvents:'none' }} />

          <div className="lp-card">
            {/* Glow accents */}
            <div style={{ position:'absolute',top:-40,right:-40,width:96,height:96,background:'rgba(128,207,255,.15)',borderRadius:'50%',filter:'blur(32px)',zIndex:-1 }} />
            <div style={{ position:'absolute',bottom:-40,left:-40,width:128,height:128,background:'rgba(26,98,161,.15)',borderRadius:'50%',filter:'blur(40px)',zIndex:-1 }} />

            <div style={{ marginBottom:32 }}>
              <h2 style={{ fontSize:32,fontWeight:700,color:'#fff',marginBottom:6,fontFamily:'Poppins,sans-serif' }}>Welcome Back</h2>
              <p style={{ fontSize:14,color:'#B7C9D8' }}>Sign in to continue to your CRM workspace</p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12,fontWeight:500,letterSpacing:'.05em',color:'#c1c7d2',marginBottom:6,display:'block' }} htmlFor="lp-email">Email Address</label>
                <div className="lp-wrap">
                  <span className="lp-ico material-symbols-outlined">alternate_email</span>
                  <input id="lp-email" className="lp-inp" type="email" placeholder="name@company.com"
                    value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom:6 }}>
                <label style={{ fontSize:12,fontWeight:500,letterSpacing:'.05em',color:'#c1c7d2',marginBottom:6,display:'block' }} htmlFor="lp-password">Password</label>
                <div className="lp-wrap">
                  <span className="lp-ico material-symbols-outlined">lock</span>
                  <input id="lp-password" className="lp-inp" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
                  <button type="button" className="lp-eye" onClick={() => setShowPass(v => !v)}>
                    <span className="material-symbols-outlined">{showPass ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Remember / Forgot */}
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',margin:'14px 0' }}>
                <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer' }}>
                  <input type="checkbox" className="lp-chk" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                  <span style={{ fontSize:12,fontWeight:500,color:'#c1c7d2' }}>Remember me</span>
                </label>
                <button type="button" id="forgot-password-link"
                  style={{ fontSize:12,fontWeight:500,color:'#a0caff',background:'none',border:'none',cursor:'pointer',padding:0 }}
                  onClick={() => setShowForgot(true)}>
                  Forgot Password?
                </button>
              </div>

              {/* Error */}
              {error && (
                <div style={{ background:'rgba(147,0,10,.25)',border:'1px solid rgba(255,100,100,.3)',color:'#ffb4ab',padding:'10px 14px',borderRadius:10,fontSize:13,fontWeight:500,marginBottom:14,display:'flex',alignItems:'center',gap:8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize:18,flexShrink:0 }}>error</span>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button id="login-submit" type="submit" disabled={loading} className="lp-btn">
                {loading
                  ? <><div className="lp-spin" /> Signing In...</>
                  : <><span className="material-symbols-outlined" style={{ fontSize:20 }}>login</span> Access Dashboard</>}
              </button>
            </form>

            {/* Encrypted badge */}
            <div style={{ marginTop:28,paddingTop:28,borderTop:'1px solid rgba(255,255,255,.06)',display:'flex',alignItems:'center',justifyContent:'center',gap:8,color:'rgba(183,201,216,.5)',fontSize:12,fontWeight:500 }}>
              <span className="material-symbols-outlined" style={{ fontSize:16 }}>verified_user</span>
              Enterprise-grade encrypted access
            </div>


          </div>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </>
  );
};

export default LoginPage;

