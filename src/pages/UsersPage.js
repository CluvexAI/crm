import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ROLES, DEPARTMENTS } from '../data/mockData';
import ProfileImageUpload from '../components/ProfileImageUpload';
import { can } from '../services/rbacService';

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
const UserDetailModal = ({ user, onClose }) => {
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
              <InfoRow label="PAN" value={user.pan ? (canViewSensitive ? user.pan : `${user.pan.slice(0,3)}●●${user.pan.slice(-1)}`) : '—'} />
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

// ── User Form Modal ────────────────────────────────────────────────────────────
const UserFormModal = React.memo(({ user, onClose, onSave }) => {
  const getInitialForm = React.useMemo(() => user ? { ...user } : {
    name: '', email: '', phone: '', whatsapp: '', password: '',
    role: ROLES.SALES, department: 'Sales', designation: '',
    dateOfJoining: '', shift: '9:00 AM - 6:00 PM', salary: '',
    bloodGroup: '', foodPref: 'Veg', address: '', employeeId: '',
    fatherName: '', motherName: '', pan: '', aadhaar: '', voterId: '',
    emergencyContact: '', localStation: '', localPostOffice: '',
    qualification: '', experience: '', referredBy: '', hobbies: '',
  }, [user]);

  const [form, setForm] = useState(getInitialForm);
  const [tab, setTab] = useState('basic');
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.name) errs.name = 'Required';
    if (!form.email) errs.email = 'Required';
    if (!form.phone) errs.phone = 'Required';
    if (!user && !form.password) errs.password = 'Required';
    if (!form.dateOfJoining) errs.dateOfJoining = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) onSave(form);
  };

  const tabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'personal', label: 'Personal' },
    { id: 'professional', label: 'Professional' },
    { id: 'identification', label: 'ID Docs' },
  ];

  const F = ({ label, field, type = 'text', required, hint }) => (
    <div className="form-group">
      <label className="form-label">{label}{required && <span className="required"> *</span>}</label>
      <input className="form-control" type={type} value={form[field] || ''}
        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
      {hint && <div className="form-hint">{hint}</div>}
      {errors[field] && <div className="form-error">{errors[field]}</div>}
    </div>
  );

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
                  <input className="form-control" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>
                <F label="Email (Login)" field="email" type="email" required />
                <div className="form-group">
                  <label className="form-label">Password{!user && <span className="required"> *</span>}</label>
                  <input className="form-control" type="password" value={form.password || ''}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder={user ? 'Leave blank to keep current' : ''} />
                  {errors.password && <div className="form-error">{errors.password}</div>}
                </div>
                <F label="Phone" field="phone" required />
                <F label="WhatsApp" field="whatsapp" />
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Home Address</label>
                  <textarea className="form-control" rows={2} value={form.address || ''}
                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
            )}
            {tab === 'personal' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <F label="Father's Name" field="fatherName" />
                <F label="Mother's Name" field="motherName" />
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select className="form-control" value={form.bloodGroup || ''}
                    onChange={e => setForm(p => ({ ...p, bloodGroup: e.target.value }))}>
                    <option value="">Select</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg}>{bg}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Food Preference</label>
                  <select className="form-control" value={form.foodPref || 'Veg'}
                    onChange={e => setForm(p => ({ ...p, foodPref: e.target.value }))}>
                    <option>Veg</option><option>Non-Veg</option>
                  </select>
                </div>
                <F label="Emergency Contact" field="emergencyContact" />
                <F label="Hobbies" field="hobbies" />
                <F label="Local Police Station" field="localStation" />
                <F label="Local Post Office" field="localPostOffice" />
                <F label="Referred By" field="referredBy" />
              </div>
            )}
            {tab === 'professional' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-control" value={form.role}
                    onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                    {Object.values(ROLES).map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-control" value={form.department || 'Sales'}
                    onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <F label="Designation" field="designation" />
                <div className="form-group">
                  <label className="form-label">Date of Joining <span className="required">*</span></label>
                  <input className="form-control" type="date" value={form.dateOfJoining || ''}
                    onChange={e => setForm(p => ({ ...p, dateOfJoining: e.target.value }))} />
                  {errors.dateOfJoining && <div className="form-error">{errors.dateOfJoining}</div>}
                </div>
                <F label="Shift Timing" field="shift" hint="e.g. 9:00 AM - 6:00 PM" />
                <F label="Salary (₹)" field="salary" type="number" />
                <F label="Qualification" field="qualification" />
                <F label="Experience" field="experience" />
              </div>
            )}
            {tab === 'identification' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ background: 'var(--warning-light)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', fontWeight: 500 }}>
                    🔒 Sensitive data is encrypted at rest and masked in UI for non-Admin roles.
                  </div>
                </div>
                <F label="PAN Number" field="pan" hint="Format: ABCDE1234F" />
                <F label="Aadhaar Number" field="aadhaar" hint="Format: XXXX-XXXX-XXXX" />
                <F label="Voter ID" field="voterId" />
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
});

// ── Main Users Page ────────────────────────────────────────────────────────────
const UsersPage = () => {
  const { currentUser, allUsers, createUser, updateUser, deleteUser, rbac, addAuditLog } = useApp();
  const [showForm, setShowForm]   = useState(false);
  const [editUser, setEditUser]   = useState(null);
  const [viewUser, setViewUser]   = useState(null);
  const [empIdUser, setEmpIdUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [formError, setFormError]   = useState('');

  const isAdmin = currentUser.role === ROLES.ADMIN;
  const isHR    = currentUser.role === ROLES.HR;

  if (!isAdmin && !isHR) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-title">Access Denied</div>
        <div className="empty-state-text">User management requires Admin or HR role.</div>
      </div>
    );
  }

  const filtered = allUsers.filter(u => {
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'All' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleSave = (formData) => {
    setFormError('');
    try {
      if (editUser) {
        const { uuid, id, ...safe } = formData;
        updateUser(editUser.uuid, safe);
        try { addAuditLog('User Updated', currentUser.name, `Updated employee: ${formData.name}`); } catch (e) { console.warn('Audit log failed:', e.message); }
        showFeedback('✅ Employee updated successfully!');
      } else {
        createUser(formData);
        try { addAuditLog('User Created', currentUser.name, `Created employee: ${formData.name}`); } catch (e) { console.warn('Audit log failed:', e.message); }
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
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option>All</option>
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
                <th>Photo</th>
                <th>Employee</th>
                <th>Emp ID</th>
                <th>UUID</th>
                <th>Role</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.uuid}>
                  <td style={{ width: 52 }}>
                    <ProfileImageUpload
                      targetUser={user}
                      size={40}
                      readOnly={!rbac.canUploadImageFor(user.uuid)}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</div>
                  </td>
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
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>
                      {user.uuid.slice(0, 13)}…
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.role === ROLES.ADMIN ? 'badge-danger' : user.role === ROLES.HR ? 'badge-warning' : user.role === ROLES.SALES ? 'badge-success' : 'badge-primary'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{user.department}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{user.phone}</td>
                  <td><span className={`badge ${user.status !== 'Inactive' ? 'badge-success' : 'badge-danger'}`}>{user.status || 'Active'}</span></td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setViewUser(user)}>👁</button>
                        <button className="btn btn-sm btn-outline"
                          onClick={() => { setEditUser(user); setFormError(''); setShowForm(true); }}>✏️</button>
                        {user.uuid !== currentUser.uuid && (
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
      {viewUser    && <UserDetailModal user={viewUser} onClose={() => setViewUser(null)} />}
      {empIdUser   && <EmployeeIdModal user={empIdUser} onClose={() => setEmpIdUser(null)} />}
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
