import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ROLES, DEPARTMENTS, DEPARTMENT_ROLES } from '../data/mockData';
import ProfileImageUpload from '../components/ProfileImageUpload';
import { can } from '../services/rbacService';
import { getRoleConfig, getVisibleUsers } from '../config/rolePermissions';
import { changePasswordOnServer } from '../services/passwordSyncService';

// Quick alert for user feedback
const showFeedback = (message, type = 'success') => {
  const colors = { success: '#27ae60', error: '#e74c3c', info: '#3498db' };
  const alert = document.createElement('div');
  alert.style.cssText = `position:fixed;bottom:24px;right:24px;background:${colors[type]};color:white;padding:12px 20px;border-radius:8px;font-weight:600;z-index:9999;animation:fadeIn 0.3s ease`;
  alert.textContent = message;
  document.body.appendChild(alert);
  setTimeout(() => alert.remove(), 3000);
};

// ── Employee ID Edit Modal (Admin only) ───────────────────────────────────────
const EmployeeIdModal = ({ user, onClose }) => {
  const { updateEmployeeId, allUsers } = useApp();
  const [newId, setNewId] = useState(user.employeeId);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = newId.trim().toUpperCase();
    if (trimmed === user.employeeId) { onClose(); return; }
    const conflict = allUsers.find(u => u.employeeId === trimmed && u.uuid !== user.uuid);
    if (conflict) { setError(`"${trimmed}" is already assigned to ${conflict.name}.`); return; }
    setSaving(true);
    try {
      updateEmployeeId(user.uuid, trimmed);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title">🪪 Edit Employee ID</div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
              ⚠️ <strong>Admin only.</strong> Employee ID is the business-facing identifier. The system UUID <code style={{ fontSize: 11 }}>{user.uuid}</code> remains immutable.
            </div>
            <div className="form-group">
              <label className="form-label">Internal UUID (Immutable)</label>
              <input className="form-control" value={user.uuid} readOnly
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12, cursor: 'not-allowed' }} />
              <div className="form-hint">🔒 Primary key — never editable</div>
            </div>
            <div className="form-group">
              <label className="form-label">Employee ID (Business Identifier) <span className="required">*</span></label>
              <input className="form-control" value={newId}
                onChange={e => { setNewId(e.target.value.toUpperCase()); setError(''); }}
                placeholder="EMP-001" required autoFocus />
              <div className="form-hint">Must be unique across all employees</div>
              {error && <div className="form-error">⚠️ {error}</div>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : '💾 Update ID'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── User Detail Modal ──────────────────────────────────────────────────────────
export const UserDetailModal = ({ user, onClose }) => {
  const { currentUser, rbac } = useApp();
  const canViewSensitive = can(currentUser, 'VIEW_SENSITIVE_DATA');
  const canViewImg = rbac.canUploadImageFor(user.uuid) || can(currentUser, 'VIEW_PROFILE_IMAGE');

  const InfoRow = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '58%' }}>{value || '—'}</span>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">👤 Employee Profile</div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
            <ProfileImageUpload targetUser={user} size={88} showMeta readOnly={!canViewImg} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{user.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{user.designation} · {user.department}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <span className={`badge ${user.role === ROLES.ADMIN ? 'badge-danger' : 'badge-primary'}`}>{user.role}</span>
                <span className="badge badge-success">{user.status || 'Active'}</span>
                <span className="badge badge-neutral" style={{ fontFamily: 'monospace' }}>{user.employeeId}</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                🔑 UUID: {user.uuid}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h4 style={{ marginBottom: 10, color: 'var(--primary)', fontSize: 13, fontWeight: 700 }}>📞 Contact</h4>
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Phone" value={user.phone} />
              <InfoRow label="WhatsApp" value={user.whatsapp} />
              <InfoRow label="Blood Group" value={user.bloodGroup} />
            </div>
            <div>
              <h4 style={{ marginBottom: 10, color: 'var(--primary)', fontSize: 13, fontWeight: 700 }}>💼 Professional</h4>
              <InfoRow label="Shift" value={user.shift} />
              <InfoRow label="Joined" value={user.dateOfJoining ? new Date(user.dateOfJoining).toLocaleDateString('en-IN') : '—'} />
              <InfoRow label="Salary" value={canViewSensitive && user.salary ? `₹${Number(user.salary).toLocaleString('en-IN')}` : '●●●●●'} />
            </div>
            <div>
              <h4 style={{ marginBottom: 10, color: 'var(--primary)', fontSize: 13, fontWeight: 700 }}>🔒 ID Documents</h4>
              <InfoRow label="PAN" value={user.pan ? (canViewSensitive ? user.pan : `${user.pan.slice(0, 3)}●●${user.pan.slice(-1)}`) : '—'} />
              <InfoRow label="Aadhaar" value={user.aadhaar ? `●●●●-●●●●-${user.aadhaar.slice(-4)}` : '—'} />
            </div>
            <div>
              <h4 style={{ marginBottom: 10, color: 'var(--primary)', fontSize: 13, fontWeight: 700 }}>🖼️ Profile Image</h4>
              <InfoRow label="Status" value={user.profileImageUrl ? '✅ Uploaded' : '⬜ Not set'} />
              <InfoRow label="Type" value={user.profileImageType ? user.profileImageType.split('/')[1].toUpperCase() : '—'} />
              <InfoRow label="Size" value={user.profileImageSize ? `${(user.profileImageSize / 1024).toFixed(1)} KB` : '—'} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ── Form Input Helper (Defined outside to prevent re-mounting) ──────────────────
const FormInput = ({ label, value, onChange, type = 'text', required, hint, error, disabled, readOnly }) => (
  <div className="form-group">
    <label className="form-label">{label}{required && <span className="required"> *</span>}</label>
    <input
      type={type}
      className={`form-control ${error ? 'input-error' : ''}`}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      style={readOnly || disabled ? { background: 'var(--bg-tertiary)', cursor: 'not-allowed' } : {}}
    />
    {hint && <div className="form-hint">{hint}</div>}
    {error && <div className="form-error">{error}</div>}
  </div>
);

// ── User Form Modal ────────────────────────────────────────────────────────────
export const UserFormModal = ({ user, onClose, onSave, isHR = false }) => {
  // Use ONE stable form state with nested sections for clarity as requested
  const [form, setForm] = useState({
    basic: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      whatsapp: user?.whatsapp || '',
      password: '',
      address: user?.address || '',
    },
    personal: {
      fatherName: user?.fatherName || '',
      motherName: user?.motherName || '',
      bloodGroup: user?.bloodGroup || '',
      foodPref: user?.foodPref || 'Veg',
      emergencyContact: user?.emergencyContact || '',
      hobbies: user?.hobbies || '',
      localStation: user?.localStation || '',
      localPostOffice: user?.localPostOffice || '',
      referredBy: user?.referredBy || '',
    },
    professional: {
      role: user?.role || '',
      department: user?.department || '',
      designation: user?.designation || '',
      dateOfJoining: user?.dateOfJoining || '',
      shift: user?.shift || '9:00 AM - 6:00 PM',
      salary: user?.salary || '',
      qualification: user?.qualification || '',
      experience: user?.experience || '',
    },
    identification: {
      pan: user?.pan || '',
      aadhaar: user?.aadhaar || '',
      voterId: user?.voterId || '',
    },
    mail: {
      useCustom: false,
      password: '',
      imapHost: 'mail.zsmeservices.com',
      imapPort: 993,
      smtpHost: 'mail.zsmeservices.com',
      smtpPort: 465,
    }
  });

  const [tab, setTab] = useState('basic');
  const [errors, setErrors] = useState({});

  // Reset form ONLY when user ID changes
  useEffect(() => {
    if (user?.uuid) {
      setForm({
        basic: { name: user.name, email: user.email, phone: user.phone, whatsapp: user.whatsapp, password: '', address: user.address },
        personal: { fatherName: user.fatherName, motherName: user.motherName, bloodGroup: user.bloodGroup, foodPref: user.foodPref || 'Veg', emergencyContact: user.emergencyContact, hobbies: user.hobbies, localStation: user.localStation, localPostOffice: user.localPostOffice, referredBy: user.referredBy },
        professional: { role: user.role, department: user.department, designation: user.designation, dateOfJoining: user.dateOfJoining, shift: user.shift, salary: user.salary, qualification: user.qualification, experience: user.experience },
        identification: { pan: user.pan, aadhaar: user.aadhaar, voterId: user.voterId },
        mail: {
          useCustom: user.mailConfig?.useCustom || false,
          password: user.mailConfig?.password || '',
          imapHost: user.mailConfig?.imapHost || 'mail.zsmeservices.com',
          imapPort: user.mailConfig?.imapPort || 993,
          smtpHost: user.mailConfig?.smtpHost || 'mail.zsmeservices.com',
          smtpPort: user.mailConfig?.smtpPort || 465,
        }
      });
    }
  }, [user?.uuid]);

  const validate = () => {
    const errs = {};
    if (!form.basic.name) errs.name = 'Required';
    if (!form.basic.email) errs.email = 'Required';
    if (!form.basic.phone) errs.phone = 'Required';
    if (!user && !form.basic.password) errs.password = 'Required';
    if (!form.professional.department) errs.department = 'Required';
    if (!form.professional.role) errs.role = 'Required';
    if (!form.professional.dateOfJoining) errs.dateOfJoining = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Flatten for parent
      const flattened = {
        ...form.basic,
        ...form.personal,
        ...form.professional,
        ...form.identification,
        mailConfig: form.mail
      };
      // If password is empty and editing, remove it so it doesn't overwrite
      if (user && !flattened.password) delete flattened.password;
      onSave(flattened);
    }
  };

  const updateField = (section, field, value) => {
    setForm(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const tabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'personal', label: 'Personal' },
    { id: 'professional', label: 'Professional' },
    { id: 'identification', label: 'ID Docs' },
    { id: 'mail', label: '📧 Mail Config' },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-title">{user ? '✏️ Edit Employee' : '➕ Add Employee'}</div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div className="tabs" style={{ padding: '0 24px', marginBottom: 0, borderBottom: 'none' }}>
              {tabs.map(t => (
                <button key={t.id} type="button"
                  className={`tab-btn ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
          <div className="modal-body">
            {tab === 'basic' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {user && (
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Internal UUID (Immutable — Primary Key)</label>
                    <input className="form-control" value={user.uuid} readOnly
                      style={{ background: 'var(--bg-tertiary)', fontFamily: 'monospace', fontSize: 12, cursor: 'not-allowed', color: 'var(--text-muted)' }} />
                    <div className="form-hint">🔒 This identifier is permanent and cannot be changed</div>
                  </div>
                )}
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Full Name <span className="required">*</span></label>
                  <input className="form-control" value={form.basic.name}
                    onChange={e => updateField('basic', 'name', e.target.value)}
                    readOnly={isHR}
                    style={isHR ? { background: 'var(--bg-tertiary)', cursor: 'not-allowed' } : {}}
                  />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                  {isHR && <div className="form-hint">🔒 Name can only be modified by an Admin</div>}
                </div>
                <FormInput label="Email (Login)" value={form.basic.email} onChange={v => updateField('basic', 'email', v)} type="email" required error={errors.email} readOnly={user?.email === 'admin@zsmeservices.com'} />
                <div className="form-group">
                  <label className="form-label">Password{!user && <span className="required"> *</span>}</label>
                  <input className="form-control" type="password" value={form.basic.password || ''}
                    onChange={e => updateField('basic', 'password', e.target.value)}
                    placeholder={user ? 'Leave blank to keep current' : 'Enter new password'} />
                  {form.basic.password && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ height: 3, background: '#eee', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${Math.min(100, (form.basic.password.length / 8) * 100)}%`,
                          background: form.basic.password.length < 8 ? '#ef4444' : '#10b981',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                        {form.basic.password.length < 8 ? '❌ Min 8 characters' : '✅ Password length OK'}
                      </div>
                    </div>
                  )}
                  {errors.password && <div className="form-error">{errors.password}</div>}
                </div>
                <FormInput label="Phone" value={form.basic.phone} onChange={v => updateField('basic', 'phone', v)} required error={errors.phone} />
                <FormInput label="WhatsApp" value={form.basic.whatsapp} onChange={v => updateField('basic', 'whatsapp', v)} />
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Home Address</label>
                  <textarea className="form-control" rows={2} value={form.basic.address || ''}
                    onChange={e => updateField('basic', 'address', e.target.value)} />
                </div>
              </div>
            )}
            {tab === 'personal' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormInput label="Father's Name" value={form.personal.fatherName} onChange={v => updateField('personal', 'fatherName', v)} />
                <FormInput label="Mother's Name" value={form.personal.motherName} onChange={v => updateField('personal', 'motherName', v)} />
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select className="form-control" value={form.personal.bloodGroup || ''}
                    onChange={e => updateField('personal', 'bloodGroup', e.target.value)}>
                    <option value="">Select</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg}>{bg}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Food Preference</label>
                  <select className="form-control" value={form.personal.foodPref || 'Veg'}
                    onChange={e => updateField('personal', 'foodPref', e.target.value)}>
                    <option>Veg</option><option>Non-Veg</option>
                  </select>
                </div>
                <FormInput label="Emergency Contact" value={form.personal.emergencyContact} onChange={v => updateField('personal', 'emergencyContact', v)} />
                <FormInput label="Hobbies" value={form.personal.hobbies} onChange={v => updateField('personal', 'hobbies', v)} />
                <FormInput label="Local Police Station" value={form.personal.localStation} onChange={v => updateField('personal', 'localStation', v)} />
                <FormInput label="Local Post Office" value={form.personal.localPostOffice} onChange={v => updateField('personal', 'localPostOffice', v)} />
                <FormInput label="Referred By" value={form.personal.referredBy} onChange={v => updateField('personal', 'referredBy', v)} />
              </div>
            )}
            {tab === 'professional' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Department <span className="required">*</span></label>
                  <select className="form-control" value={form.professional.department || ''}
                    onChange={e => {
                      const dept = e.target.value;
                      const allowedRoles = DEPARTMENT_ROLES[dept] || [];
                      const currentRole = form.professional.role;
                      // Auto-select first valid role if current role not in new department
                      if (!allowedRoles.includes(currentRole) && allowedRoles.length > 0) {
                        updateField('professional', 'role', allowedRoles[0]);
                      }
                      updateField('professional', 'department', dept);
                    }}
                    disabled={user?.email === 'admin@zsmeservices.com'}
                    required>
                    <option value="">-- Select Department --</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Role <span className="required">*</span></label>
                  <select className="form-control" value={form.professional.role}
                    onChange={e => updateField('professional', 'role', e.target.value)}
                    disabled={isHR || user?.email === 'admin@zsmeservices.com'}
                  >
                    {form.professional.department
                      ? (DEPARTMENT_ROLES[form.professional.department] || []).map(r => <option key={r} value={r}>{r}</option>)
                      : <option value="">-- Select Department First --</option>
                    }
                  </select>
                  {isHR && <div className="form-hint">🔒 Role can only be modified by an Admin</div>}
                </div>
                <FormInput label="Designation" value={form.professional.designation} onChange={v => updateField('professional', 'designation', v)} />
                <div className="form-group">
                  <label className="form-label">Date of Joining <span className="required">*</span></label>
                  <input className="form-control" type="date" value={form.professional.dateOfJoining || ''}
                    onChange={e => updateField('professional', 'dateOfJoining', e.target.value)} />
                  {errors.dateOfJoining && <div className="form-error">{errors.dateOfJoining}</div>}
                </div>
                <FormInput label="Shift Timing" value={form.professional.shift} onChange={v => updateField('professional', 'shift', v)} hint="e.g. 9:00 AM - 6:00 PM" />
                <FormInput label="Salary (₹)" value={form.professional.salary} onChange={v => updateField('professional', 'salary', v)} type="number" />
                <FormInput label="Qualification" value={form.professional.qualification} onChange={v => updateField('professional', 'qualification', v)} />
                <FormInput label="Experience" value={form.professional.experience} onChange={v => updateField('professional', 'experience', v)} />
              </div>
            )}
            {tab === 'identification' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ background: 'var(--warning-light)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', fontWeight: 500 }}>
                    🔒 Sensitive data is encrypted at rest and masked in UI for non-Admin roles.
                  </div>
                </div>
                <FormInput label="PAN Number" value={form.identification.pan} onChange={v => updateField('identification', 'pan', v)} hint="Format: ABCDE1234F" />
                <FormInput label="Aadhaar Number" value={form.identification.aadhaar} onChange={v => updateField('identification', 'aadhaar', v)} hint="Format: XXXX-XXXX-XXXX" />
                <FormInput label="Voter ID" value={form.identification.voterId} onChange={v => updateField('identification', 'voterId', v)} />
              </div>
            )}
            {tab === 'mail' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1/-1', background: 'var(--info-light)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--info)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--info-dark)', marginBottom: 5 }}>📧 Mail Provisioning</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Set the password for the <strong>{form.basic.email || 'user mailbox'}</strong>. This can be different from the CRM login password.</div>
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Mailbox Password</label>
                  <input className="form-control" type="password" value={form.mail.password} 
                    onChange={e => updateField('mail', 'password', e.target.value)}
                    placeholder="Enter mailbox password (AES-256 encrypted)" />
                </div>
                <FormInput label="IMAP Host" value={form.mail.imapHost} onChange={v => updateField('mail', 'imapHost', v)} />
                <FormInput label="IMAP Port" value={form.mail.imapPort} onChange={v => updateField('mail', 'imapPort', v)} type="number" />
                <FormInput label="SMTP Host" value={form.mail.smtpHost} onChange={v => updateField('mail', 'smtpHost', v)} />
                <FormInput label="SMTP Port" value={form.mail.smtpPort} onChange={v => updateField('mail', 'smtpPort', v)} type="number" />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {user ? '💾 Save Changes' : '➕ Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Users Page ────────────────────────────────────────────────────────────
const UsersPage = () => {
  const ctx = useApp() || {};
  const { currentUser, allUsers, createUser, updateUser, deleteUser, rbac, addAuditLog } = ctx;
  const safeAddAuditLog = (typeof addAuditLog === 'function') ? addAuditLog : ((...args) => console.warn('addAuditLog not available'));
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [empIdUser, setEmpIdUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [formError, setFormError] = useState('');

  const isAdmin = currentUser.role === ROLES.ADMIN;
  const isHR = currentUser.role === ROLES.HR;

  const config = getRoleConfig(currentUser.role, 'user_management');
  
  if (!config || !config.can_view) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Access Denied</div>
        <div className="empty-state-text">You do not have permission to view User Management.</div>
      </div>
    );
  }

  let filtered = getVisibleUsers(allUsers, currentUser, 'user_management', search, deptFilter, roleFilter);
  
  // Sort alphabetically by name
  filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const columns = config.visible_columns || [];

  const handleSave = async (formData) => {
    setFormError('');
    try {
      if (editUser) {
        const { uuid, id, password, ...safe } = formData;
        
        // Enforce constraints on primary admin
        if (editUser.email === 'admin@zsmeservices.com') {
          safe.email = 'admin@zsmeservices.com';
          safe.role = 'Admin';
          safe.department = 'Management';
        }
        
        if (password) {
          const res = await changePasswordOnServer(
            editUser.uuid, 
            password, 
            currentUser.uuid, 
            currentUser.email, 
            true
          );
          safe.password = res.hashedPassword;
          safe.must_change_password = false;
        }
        
        await updateUser(editUser.uuid, safe);
        try { safeAddAuditLog('User Updated', currentUser.name, `Updated employee: ${formData.name}`); } catch (e) { console.warn('Audit log failed:', e.message); }
        showFeedback('✅ Employee updated successfully!');
      } else {
        // New user password is encrypted by the backend POST /api/users
        createUser(formData);
        try { safeAddAuditLog('User Created', currentUser.name, `Created employee: ${formData.name}`); } catch (e) { console.warn('Audit log failed:', e.message); }
        showFeedback('✅ Employee created successfully!');
      }
      setShowForm(false);
      setEditUser(null);
    } catch (err) {
      setFormError(err.message);
      showFeedback('❌ Error: ' + err.message, 'error');
    }
  };

  const handleDelete = (uuid) => {
    deleteUser(uuid);
    setDeleteConfirm(null);
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-bar">
          🔍 <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or Employee ID…" />
        </div>
        <select className="form-control" style={{ width: 'auto' }}
          value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="All">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto' }}
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="All">All Roles</option>
          {Object.values(ROLES).map(r => <option key={r}>{r}</option>)}
        </select>
        {isAdmin && (
          <div className="toolbar-right">
            <button className="btn btn-primary"
              onClick={() => { setEditUser(null); setFormError(''); setShowForm(true); }}>
              + Add Employee
            </button>
          </div>
        )}
      </div>

      {/* Department chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {DEPARTMENTS.map(dept => {
          const count = allUsers.filter(u => u.department === dept).length;
          if (!count) return null;
          return (
            <div key={dept} style={{ padding: '5px 12px', background: 'white', borderRadius: 20, border: '1px solid var(--border-light)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {dept}: <span style={{ color: 'var(--primary)' }}>{count}</span>
            </div>
          );
        })}
      </div>
      {/* Role chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.values(ROLES).map(role => {
          const count = allUsers.filter(u => u.role === role).length;
          if (!count) return null;
          return (
            <div key={role} style={{ padding: '5px 12px', background: 'white', borderRadius: 20, border: '1px solid var(--border-light)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {role}: <span style={{ color: 'var(--primary)' }}>{count}</span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">👥 Employee Directory ({filtered.length})</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '4px 10px', borderRadius: 20 }}>
            🔑 Primary Key: UUID
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {columns.includes('Photo') && <th>Photo</th>}
                {columns.includes('Employee') && <th>Employee</th>}
                {columns.includes('Emp ID') && <th>Emp ID</th>}
                {columns.includes('UUID') && <th>UUID</th>}
                {columns.includes('Role') && <th>Role</th>}
                {columns.includes('Department') && <th>Department</th>}
                {columns.includes('Phone') && <th>Phone</th>}
                {columns.includes('Status') && <th>Status</th>}
                {columns.includes('Actions') && config.can_edit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.uuid}>
                  {columns.includes('Photo') && (
                    <td style={{ width: 52 }}>
                      <ProfileImageUpload
                        targetUser={user}
                        size={40}
                        readOnly={!rbac.canUploadImageFor(user.uuid)}
                      />
                    </td>
                  )}
                  {columns.includes('Employee') && (
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</div>
                    </td>
                  )}
                  {columns.includes('Emp ID') && (
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>
                          {user.employeeId}
                        </span>
                        {isAdmin && (
                          <button className="btn btn-icon btn-ghost" style={{ width: 22, height: 22, fontSize: 11 }}
                            onClick={() => setEmpIdUser(user)} title="Edit Employee ID">
                            ✏️
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  {columns.includes('UUID') && (
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>
                        {user.uuid.slice(0, 13)}…
                      </span>
                    </td>
                  )}
                  {columns.includes('Role') && (
                    <td>
                      <span className={`badge ${user.role === ROLES.ADMIN ? 'badge-danger' : user.role === ROLES.HR ? 'badge-warning' : user.role === ROLES.SALES ? 'badge-success' : (DEPARTMENT_ROLES['Graphics'] || []).includes(user.role) ? 'badge-info' : 'badge-primary'}`}>
                        {user.role}
                      </span>
                    </td>
                  )}
                  {columns.includes('Department') && <td>{user.department}</td>}
                  {columns.includes('Phone') && <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{user.phone}</td>}
                  {columns.includes('Status') && <td><span className={`badge ${user.status !== 'Inactive' ? 'badge-success' : 'badge-danger'}`}>{user.status || 'Active'}</span></td>}
                  {columns.includes('Actions') && config.can_edit && (
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setViewUser(user)}>👁</button>
                        <button className="btn btn-sm btn-outline"
                          onClick={() => { setEditUser(user); setFormError(''); setShowForm(true); }}>✏️</button>
                        {user.uuid !== currentUser.uuid && config.can_delete && user.email !== 'admin@zsmeservices.com' && (
                          <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(user)}>🗑</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <UserFormModal
          user={editUser}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSave={handleSave}
        />
      )}
      {formError && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--danger)', color: 'white', padding: '12px 20px', borderRadius: 10, fontWeight: 600, zIndex: 9999 }}>
          ⚠️ {formError}
        </div>
      )}
      {viewUser && <UserDetailModal user={viewUser} onClose={() => setViewUser(null)} />}
      {empIdUser && <EmployeeIdModal user={empIdUser} onClose={() => setEmpIdUser(null)} />}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">🗑 Confirm Delete</div>
              <button className="btn btn-icon btn-ghost" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Delete <strong>{deleteConfirm.name}</strong> ({deleteConfirm.employeeId})?</p>
              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>UUID: {deleteConfirm.uuid}</p>
              <p style={{ marginTop: 8, color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm.uuid)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
