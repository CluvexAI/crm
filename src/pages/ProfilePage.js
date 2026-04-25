import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import ProfileImageUpload from '../components/ProfileImageUpload';
import { can } from '../services/rbacService';
import { formatFileSize } from '../services/uploadService';

const ProfilePage = () => {
  const { currentUser, updateUser } = useApp();
  const [isEditing, setIsEditing]   = useState(false);
  const [form, setForm]             = useState({ ...currentUser });
  const [tab, setTab]               = useState('profile');
  const [changePass, setChangePass] = useState({ current: '', newPass: '', confirm: '' });
  const [passError, setPassError]   = useState('');
  const [passSuccess, setPassSuccess] = useState(false);
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

  const handlePassChange = async (e) => {
    e.preventDefault();
    setPassError('');
    
    const { current, newPass, confirm } = changePass;
    
    if (!current) { setPassError('Please enter current password.'); return; }
    if (!newPass) { setPassError('Please enter new password.'); return; }
    if (!confirm) { setPassError('Please confirm new password.'); return; }
    if (newPass.length < 8) { setPassError('New password must be at least 8 characters.'); return; }
    if (newPass !== confirm) { setPassError('Passwords do not match.'); return; }
    if (current === newPass) { setPassError('New password must be different from current password.'); return; }
    
    const { verifyPassword, hashPassword } = await import('../services/passwordService');
    
    const isValidCurrent = await verifyPassword(current, currentUser.password);
    if (!isValidCurrent) { setPassError('Current password is incorrect.'); return; }
    
    const isDifferent = await verifyPassword(newPass, currentUser.password).then(r => !r);
    if (!isDifferent) { setPassError('New password must be different from current password.'); return; }
    
    const newHashedPassword = await hashPassword(newPass);
    updateUser(currentUser.uuid, { 
      password: newHashedPassword,
      passwordChangedAt: new Date().toISOString()
    });
    setPassSuccess(true);
    setChangePass({ current: '', newPass: '', confirm: '' });
    setTimeout(() => setPassSuccess(false), 3500);
  };

  const getInitials = (name) =>
    name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U';

  const InfoRow = ({ label, value, editing, field, type = 'text', readOnly = false }) => (
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
      </div>

      {/* ── Profile Tab ── */}
      {tab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">📞 Contact</div></div>
            <div className="card-body">
              <InfoRow label="Email" value={currentUser.email} editing={isEditing} field="email" type="email" />
              <InfoRow label="Phone" value={currentUser.phone} editing={isEditing} field="phone" />
              <InfoRow label="WhatsApp" value={currentUser.whatsapp} editing={isEditing} field="whatsapp" />
              <InfoRow label="Address" value={currentUser.address} editing={isEditing} field="address" />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">💼 Professional</div></div>
            <div className="card-body">
              <InfoRow label="Designation" value={currentUser.designation} editing={false} />
              <InfoRow label="Department" value={currentUser.department} editing={false} />
              <InfoRow label="Shift" value={currentUser.shift} editing={false} />
              <InfoRow label="Date of Joining" value={currentUser.dateOfJoining ? new Date(currentUser.dateOfJoining).toLocaleDateString('en-IN') : '—'} editing={false} />
              <InfoRow label="Blood Group" value={currentUser.bloodGroup} editing={isEditing} field="bloodGroup" />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">👨‍👩‍👦 Personal</div></div>
            <div className="card-body">
              <InfoRow label="Father's Name" value={currentUser.fatherName} editing={isEditing} field="fatherName" />
              <InfoRow label="Mother's Name" value={currentUser.motherName} editing={isEditing} field="motherName" />
              <InfoRow label="Food Preference" value={currentUser.foodPref} editing={isEditing} field="foodPref" />
              <InfoRow label="Hobbies" value={currentUser.hobbies} editing={isEditing} field="hobbies" />
              <InfoRow label="Emergency Contact" value={currentUser.emergencyContact} editing={isEditing} field="emergencyContact" />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">🔒 ID Documents</div></div>
            <div className="card-body">
              <div style={{ background: 'var(--warning-light)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e', fontWeight: 500 }}>
                🔒 Sensitive fields masked. Contact Admin to update.
              </div>
              <InfoRow label="PAN" value={currentUser.pan ? `${currentUser.pan.slice(0, 3)}●●${currentUser.pan.slice(-1)}` : '—'} editing={false} />
              <InfoRow label="Aadhaar" value={currentUser.aadhaar ? `●●●●-●●●●-${currentUser.aadhaar.slice(-4)}` : '—'} editing={false} />
              <InfoRow label="Voter ID" value={currentUser.voterId ? '●●●●●●●●' : '—'} editing={false} />
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
          <div className="card-header"><div className="card-title">🔒 Change Password</div></div>
          <div className="card-body">
            {passSuccess && (
              <div style={{ background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#065f46', fontWeight: 600, fontSize: 13 }}>
                ✅ Password updated successfully!
              </div>
            )}
            {passError && (
              <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--danger)', fontWeight: 600, fontSize: 13 }}>
                ⚠️ {passError}
              </div>
            )}
            <form onSubmit={handlePassChange}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input className="form-control" type="password" value={changePass.current}
                  onChange={e => setChangePass(p => ({ ...p, current: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-control" type="password" value={changePass.newPass}
                  onChange={e => setChangePass(p => ({ ...p, newPass: e.target.value }))} required />
                <div className="form-hint">Minimum 6 characters</div>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input className="form-control" type="password" value={changePass.confirm}
                  onChange={e => setChangePass(p => ({ ...p, confirm: e.target.value }))} required />
              </div>
              <button type="submit" className="btn btn-primary">🔒 Update Password</button>
            </form>
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
    </div>
  );
};

export default ProfilePage;
