import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import ProfileImageUpload from '../components/ProfileImageUpload';
import { can } from '../services/rbacService';
import { formatFileSize } from '../services/uploadService';
import { encrypt, maskPassword } from '../services/cryptoService';

const InfoRow = ({ label, value, editing, field, type = 'text', readOnly = false, form, setForm }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-light)', gap: 16 }}>
    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, minWidth: 130, flexShrink: 0 }}>{label}</span>
    {editing && !readOnly ? (
      <input className="form-control" type={type} style={{ maxWidth: 240, marginLeft: 'auto' }}
        value={form[field] || ''}
        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
    ) : (
      <span style={{ fontWeight: 600, fontSize: 13.5, textAlign: 'right' }}>{value || '—'}</span>
    )}
  </div>
);

const ProfilePage = () => {
  const { currentUser, updateUser } = useApp();
  const [isEditing, setIsEditing]   = useState(false);
  const [form, setForm]             = useState({ ...currentUser });
  const [tab, setTab]               = useState('profile');
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!currentUser) return null;

  const canEditEmpId = can(currentUser, 'EDIT_EMPLOYEE_ID');

  const handleSave = () => {
    // Strip uuid & id so they can't be overwritten accidentally
    const { uuid, id, ...safe } = form;
    updateUser(currentUser.uuid, safe);
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };


  const getInitials = (name) =>
    name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U';

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', maxWidth: 940, margin: '0 auto' }}>

      {/* ── Hero banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)',
        borderRadius: 'var(--radius-xl)', padding: '28px 32px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 28, color: 'white',
        boxShadow: '0 8px 28px rgba(14,84,145,0.25)',
      }}>
        {/* Profile Image */}
        <div style={{ flexShrink: 0 }}>
          <ProfileImageUpload targetUser={currentUser} size={100} showMeta={false} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 3 }}>{currentUser.name}</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>{currentUser.designation} · {currentUser.department}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.18)', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              {currentUser.role}
            </span>
            <span style={{ background: 'rgba(255,255,255,0.12)', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontFamily: 'monospace' }}>
              {currentUser.employeeId}
            </span>
            {canEditEmpId && (
              <span style={{ background: 'rgba(239,68,68,0.3)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                🔑 Admin
              </span>
            )}
          </div>
          {/* UUID display (always visible, immutable) */}
          <div style={{ marginTop: 10, fontSize: 10, opacity: 0.55, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
            UUID: {currentUser.uuid}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {saveSuccess && (
            <span style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              ✅ Saved
            </span>
          )}
          {!isEditing ? (
            <button className="btn" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
              onClick={() => { setIsEditing(true); setForm({ ...currentUser }); }}>
              ✏️ Edit Profile
            </button>
          ) : (
            <>
              <button className="btn btn-danger" onClick={() => { setIsEditing(false); setForm({ ...currentUser }); }}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={handleSave}>💾 Save</button>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>👤 Profile</button>
        <button className={`tab-btn ${tab === 'image' ? 'active' : ''}`} onClick={() => setTab('image')}>🖼️ Profile Image</button>
        <button className={`tab-btn ${tab === 'security' ? 'active' : ''}`} onClick={() => setTab('security')}>🔒 Security</button>
        <button className={`tab-btn ${tab === 'identity' ? 'active' : ''}`} onClick={() => setTab('identity')}>🔑 Identity</button>
        <button className={`tab-btn ${tab === 'email' ? 'active' : ''}`} onClick={() => setTab('email')}>📧 Email Settings</button>
      </div>

      {/* ── Profile Tab ── */}
      {tab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">📞 Contact</div></div>
            <div className="card-body">
              <InfoRow label="Email" value={currentUser.email} editing={isEditing} field="email" type="email" form={form} setForm={setForm} />
              <InfoRow label="Phone" value={currentUser.phone} editing={isEditing} field="phone" form={form} setForm={setForm} />
              <InfoRow label="WhatsApp" value={currentUser.whatsapp} editing={isEditing} field="whatsapp" form={form} setForm={setForm} />
              <InfoRow label="Address" value={currentUser.address} editing={isEditing} field="address" form={form} setForm={setForm} />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">💼 Professional</div></div>
            <div className="card-body">
              <InfoRow label="Designation" value={currentUser.designation} editing={false} form={form} setForm={setForm} />
              <InfoRow label="Department" value={currentUser.department} editing={false} form={form} setForm={setForm} />
              <InfoRow label="Shift" value={currentUser.shift} editing={false} form={form} setForm={setForm} />
              <InfoRow label="Date of Joining" value={currentUser.dateOfJoining ? new Date(currentUser.dateOfJoining).toLocaleDateString('en-IN') : '—'} editing={false} form={form} setForm={setForm} />
              <InfoRow label="Blood Group" value={currentUser.bloodGroup} editing={isEditing} field="bloodGroup" form={form} setForm={setForm} />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">👨‍👩‍👦 Personal</div></div>
            <div className="card-body">
              <InfoRow label="Father's Name" value={currentUser.fatherName} editing={isEditing} field="fatherName" form={form} setForm={setForm} />
              <InfoRow label="Mother's Name" value={currentUser.motherName} editing={isEditing} field="motherName" form={form} setForm={setForm} />
              <InfoRow label="Food Preference" value={currentUser.foodPref} editing={isEditing} field="foodPref" form={form} setForm={setForm} />
              <InfoRow label="Hobbies" value={currentUser.hobbies} editing={isEditing} field="hobbies" form={form} setForm={setForm} />
              <InfoRow label="Emergency Contact" value={currentUser.emergencyContact} editing={isEditing} field="emergencyContact" form={form} setForm={setForm} />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">🔒 ID Documents</div></div>
            <div className="card-body">
              <div style={{ background: 'var(--warning-light)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e', fontWeight: 500 }}>
                🔒 Sensitive fields masked. Contact Admin to update.
              </div>
              <InfoRow label="PAN" value={currentUser.pan ? `${currentUser.pan.slice(0, 3)}●●${currentUser.pan.slice(-1)}` : '—'} editing={false} form={form} setForm={setForm} />
              <InfoRow label="Aadhaar" value={currentUser.aadhaar ? `●●●●-●●●●-${currentUser.aadhaar.slice(-4)}` : '—'} editing={false} form={form} setForm={setForm} />
              <InfoRow label="Voter ID" value={currentUser.voterId ? '●●●●●●●●' : '—'} editing={false} form={form} setForm={setForm} />
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Image Tab ── */}
      {tab === 'image' && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-header">
            <div className="card-title">🖼️ Profile Image Management</div>
          </div>
          <div className="card-body">
            {/* Rules panel */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 24, fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--primary)' }}>📋 Upload Rules</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['✅ Allowed formats', 'JPG, PNG, WEBP'],
                  ['📦 Max file size', '5 MB'],
                  ['🚫 Not allowed', 'Videos, PDFs, RAW files'],
                  ['🔄 Behavior', 'Replaces old image'],
                  ['☁️ Storage', 'Cloud (URL stored, not binary)'],
                  ['🔐 Access', 'Own image only (Admin: all)'],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '6px 10px', background: 'white', borderRadius: 6, border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{k}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upload widget */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <ProfileImageUpload targetUser={currentUser} size={120} showMeta />
            </div>

            {/* Current image metadata */}
            {currentUser.profileImageUrl && (
              <div style={{ background: 'var(--success-light)', borderRadius: 10, padding: 14, border: '1px solid var(--success)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#065f46', marginBottom: 8 }}>✅ Current Profile Image</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: 'var(--text-muted)' }}>File name:</span> <strong>{currentUser.profileImageName || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Size:</span> <strong>{formatFileSize(currentUser.profileImageSize)}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Type:</span> <strong>{currentUser.profileImageType?.toUpperCase() || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)' }}>Uploaded:</span> <strong>{currentUser.profileImageUploadedAt ? new Date(currentUser.profileImageUploadedAt).toLocaleDateString('en-IN') : '—'}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Security Tab ── */}
      {tab === 'security' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header"><div className="card-title">🔒 Password Management</div></div>
          <div className="card-body">
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: 8, fontSize: 14 }}>
                Password changes are securely managed by Insforge.
              </div>
              <p style={{ margin: 0 }}>
                To change your password, please <strong>log out</strong> and click the <strong>"Forgot Password"</strong> link on the login screen. You will receive an email verification code to securely update your credentials.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Identity Tab ── */}
      {tab === 'identity' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">🔑 System Identity</div></div>
            <div className="card-body">
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Internal UUID (Primary Key)
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--primary)', wordBreak: 'break-all' }}>
                  {currentUser.uuid}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ background: 'var(--danger-light)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 10, fontWeight: 700, fontSize: 11 }}>
                    🔒 IMMUTABLE
                  </span>
                  <span>Cannot be changed by anyone</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <strong>Purpose:</strong> Used as the primary key in the database for all internal relationships, API calls, and system operations. Not shown to clients or external parties.
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">🪪 Business Identifier</div>
              {!canEditEmpId && (
                <span className="badge badge-neutral" style={{ fontSize: 11 }}>🔒 Admin only</span>
              )}
            </div>
            <div className="card-body">
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Employee ID
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>
                  {currentUser.employeeId}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ background: canEditEmpId ? 'var(--success-light)' : 'var(--bg-tertiary)', color: canEditEmpId ? 'var(--success)' : 'var(--text-muted)', padding: '2px 8px', borderRadius: 10, fontWeight: 700, fontSize: 11 }}>
                    {canEditEmpId ? '✏️ EDITABLE' : '🔒 READ-ONLY'}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <strong>Purpose:</strong> Human-readable business identifier shown in HR reports, payslips, and internal communication. Editable by <strong>Admin only</strong>. Must remain unique across all employees.
              </div>
              {!canEditEmpId && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 8, padding: '8px 12px' }}>
                  💡 To change your Employee ID, contact an Admin.
                </div>
              )}
            </div>
          </div>
</div>
        )}

      {/* ── Email Settings Tab ── */}
      {tab === 'email' && (
        <EmailSettingsTab />
      )}
    </div>
  );
};

const EmailSettingsTab = () => {
  const { currentUser, updateEmailConfig, syncEmails } = useApp();
  const [showPassword] = useState(false);
  const [emailForm, setEmailForm] = useState({
    email: '',
    password: '',
    imap: { host: 'mail.zsmeservices.com', port: 993, secure: true },
    smtp: { host: 'mail.zsmeservices.com', port: 465, secure: true },
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [modal, setModal] = useState(null);

  // Load from Canonical Store on mount
  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        const { getEmailByUserId } = await import('../services/emailService');
        const uid = currentUser && (currentUser.uuid || currentUser.id);
        const uEmail = currentUser && currentUser.email;
        if (!uid) return;

        const accounts = getEmailByUserId(uid, uEmail);
        if (!accounts || !Array.isArray(accounts) || accounts.length === 0) return;

        const acc = accounts[0];
        if (!acc || typeof acc !== 'object' || !acc.email || typeof acc.email !== 'string') return;

        setEmailForm({
          email: acc.email || '',
          password: '',
          imap: {
            host: (acc.imapHost && typeof acc.imapHost === 'string') ? acc.imapHost : 'mail.zsmeservices.com',
            port: parseInt(acc.imapPort) || 993,
            secure: true
          },
          smtp: {
            host: (acc.smtpHost && typeof acc.smtpHost === 'string') ? acc.smtpHost : 'mail.zsmeservices.com',
            port: parseInt(acc.smtpPort) || 465,
            secure: true
          },
        });
        setIsConfigured(true);
      } catch (e) {
        console.warn('[EmailSettingsTab] loadConfig failed:', e.message);
      }
    };
    loadConfig();
  }, [currentUser]);

  const handleTest = async () => {
    if (!emailForm.email || !emailForm.password) {
      setTestResult({ success: false, message: 'Please enter email and password' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    
    const { testEmailConnection } = await import('../services/emailService');
    
    try {
      const result = await testEmailConnection({
        email: emailForm.email,
        password: emailForm.password,
        imap: emailForm.imap,
        smtp: emailForm.smtp,
      });
      
      setTesting(false);
      setTestResult({ 
        success: result.success, 
message: result.message,
        details: `SMTP: ${result.smtp} | IMAP: ${result.imap}`
      });
    } catch (error) {
      setTesting(false);
      setTestResult({ success: false, message: 'Connection failed: ' + error.message });
    }
  };

  const handleModalClose = () => {
    const isSaveSuccess = modal && modal.isSaveSuccess;
    setModal(null);
    if (isSaveSuccess) {
      setTimeout(async () => {
        try {
          await syncEmails();
          setModal({
            title: '✅ Sync Complete',
            message: 'Email sync complete!',
            isError: false,
          });
        } catch (e) {
          console.error('Sync error:', e);
        }
      }, 500);
    }
  };

  const handleSave = () => {
    if (!emailForm.email || !emailForm.password) {
      setModal({ title: '⚠️ Validation', message: 'Please enter email and password', isError: true });
      return;
    }
    setSaving(true);
    setTimeout(() => {
      const configToSave = {
        ...emailForm,
        password: encrypt(emailForm.password),
        updatedAt: new Date().toISOString(),
      };
      updateEmailConfig(currentUser.id, configToSave);
      setSaving(false);
      setModal({ title: '✅ Configuration Saved', message: 'Email configuration saved!\n\nSyncing your emails...', isError: false, isSaveSuccess: true });
    }, 800);
  };



  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📧 Email Configuration</div>
      </div>
      <div className="card-body">
        <p style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          Configure your email account to send and receive emails within CRM. This is used for sending proposals and personal email.
        </p>
        
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>📧 Email Address</label>
            <input 
              className="form-control" 
              value={emailForm.email} 
              onChange={e => setEmailForm(p => ({ ...p, email: e.target.value }))}
              placeholder="yourname@zsmeservices.com"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>🔐 Password</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                className="form-control" 
                type={showPassword ? 'text' : 'password'}
                value={emailForm.showMasked ? maskPassword(emailForm.password) : emailForm.password} 
                onChange={e => setEmailForm(p => ({ ...p, password: e.target.value, showMasked: false }))}
                placeholder={isConfigured ? '••••••••••••' : 'Enter email password'}
                style={{ flex: 1 }}
              />
              {isConfigured && (
                <button 
                  className="btn btn-ghost" 
                  type="button"
                  onClick={() => setEmailForm(p => ({ ...p, showMasked: true, password: currentUser?.emailConfig?.password || '' }))}
                  title="Show saved password"
                >
                  👁
                </button>
              )}
            </div>
            {isConfigured && (
              <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>
                ✅ Password encrypted and stored securely
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>📥 IMAP Server</label>
              <input 
                className="form-control" 
                value={emailForm.imap?.host || ''} 
                onChange={e => setEmailForm(p => ({ ...p, imap: { ...p.imap, host: e.target.value } }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>📥 IMAP Port</label>
              <input 
                className="form-control" 
                type="number"
                value={emailForm.imap?.port || 993} 
                onChange={e => setEmailForm(p => ({ ...p, imap: { ...p.imap, port: parseInt(e.target.value) } }))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>📤 SMTP Server</label>
              <input 
                className="form-control" 
                value={emailForm.smtp?.host || ''} 
                onChange={e => setEmailForm(p => ({ ...p, smtp: { ...p.smtp, host: e.target.value } }))}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>📤 SMTP Port</label>
              <input 
                className="form-control" 
                type="number"
                value={emailForm.smtp?.port || 465} 
                onChange={e => setEmailForm(p => ({ ...p, smtp: { ...p.smtp, port: parseInt(e.target.value) } }))}
              />
            </div>
          </div>
        </div>

        {testResult && (
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            borderRadius: 8,
            background: testResult.success ? 'var(--success-light)' : 'var(--danger-light)',
            color: testResult.success ? 'var(--success)' : 'var(--danger)',
          }}>
            {testResult.message}
          </div>
        )}

        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={handleTest} disabled={testing}>
            {testing ? '⏳ Testing...' : '🔗 Test Connection'}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Saving...' : '💾 Save Configuration'}
          </button>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal.title}</div>
              <button className="btn btn-ghost" onClick={handleModalClose}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ whiteSpace: 'pre-line', margin: 0, lineHeight: 1.6 }}>{modal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleModalClose}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
