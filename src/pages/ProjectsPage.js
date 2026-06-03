import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ROLES, DEPARTMENT_ROLES } from '../data/mockData';
import { encrypt, decrypt } from '../services/cryptoService';
import MultiAssignTeamMember from '../components/MultiAssignTeamMember';

const ProjectsPage = () => {
  const { currentUser, allProjects, myProjects, allUsers, updateProject, deleteProject, addProjectReport } = useApp();
  const isAdmin = currentUser.role === ROLES.ADMIN;
  const projects = isAdmin ? allProjects : myProjects;

  const [viewProject, setViewProject] = useState(null);
  const [editProject, setEditProject] = useState(null);
  const [deleteProjectId, setDeleteProjectId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reportText, setReportText] = useState('');
  const [showCredentials, setShowCredentials] = useState({});
  const [search, setSearch] = useState('');

  const getAssignedDisplay = (proj) => {
    if (proj.assignedMembers && proj.assignedMembers.length > 0) {
      const names = proj.assignedMembers.map(id => {
        const u = allUsers.find(user => String(user.id) === String(id) || String(user.uuid) === String(id));
        return u ? (u.name || u.full_name) : null;
      }).filter(Boolean);
      if (names.length > 0) {
        if (names.length === 1) return names[0];
        return `${names[0]} (+${names.length - 1})`;
      }
    }
    return proj.assignedToName || 'Unassigned';
  };

  const isAuthorized = viewProject
    ? currentUser.role === ROLES.ADMIN ||
      String(currentUser.id) === String(viewProject.assignedTo) ||
      (viewProject.assignedMembers && Array.isArray(viewProject.assignedMembers) && viewProject.assignedMembers.map(String).includes(String(currentUser.id)))
    : false;

  const filtered = projects.filter(p =>
    !search || p.projectName.toLowerCase().includes(search.toLowerCase()) || p.clientName.toLowerCase().includes(search.toLowerCase())
  );

  const graphicsRoles = DEPARTMENT_ROLES['Graphics'] || [];
  const backendUsers = allUsers.filter(u => u.role === ROLES.BACKEND || graphicsRoles.includes(u.role));

  const handleAddReport = (projectId) => {
    if (!reportText.trim()) return;
    addProjectReport(projectId, reportText);
    setReportText('');
  };

  const toggleCred = (key) => {
    setShowCredentials(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskCred = (val) => val ? '●●●●●●●●' : '—';

  const statusColor = (s) => {
    const map = { 'In Progress': 'badge-success', 'Planning': 'badge-info', 'Completed': 'badge-neutral', 'On Hold': 'badge-warning' };
    return map[s] || 'badge-neutral';
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="toolbar">
        <div className="search-bar">
          🔍 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." />
        </div>
        <div className="toolbar-right">
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {filtered.length} projects
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>
        {filtered.map(proj => (
          <div key={proj.id} className="card" style={{ cursor: 'pointer', transition: 'var(--transition)' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = ''}>
            <div className="card-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{proj.projectName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{proj.clientName}</div>
              </div>
              <span className={`badge ${statusColor(proj.status)}`}>{proj.status}</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>👤 {getAssignedDisplay(proj)}</span>
                <span style={{ color: 'var(--text-muted)' }}>📅 {proj.deadline || proj.startDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 12 }}>
                <span className={`badge ${proj.priority === 'High' ? 'badge-danger' : proj.priority === 'Low' ? 'badge-neutral' : 'badge-warning'}`}>
                  ⚡ {proj.priority || 'Medium'}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>📊 {proj.reports?.length || 0} reports</span>
              </div>
              {proj.wpUrl && <span style={{ fontSize: 11, color: 'var(--success)' }}>🌐 WP Connected</span>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-outline" style={{ flex: 1 }} onClick={() => setViewProject(proj)}>
                  👁 View
                </button>
                {isAdmin && (
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditProject(proj)}>
                    ✏️
                  </button>
                )}
                {isAdmin && (
                  <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)', padding: '4px 8px', fontSize: 13 }} onClick={(e) => { e.stopPropagation(); setDeleteProjectId(proj); }} title="Delete Project">
                    🗑
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon">🔄</div>
            <div className="empty-state-title">No projects found</div>
            <div className="empty-state-text">Projects are auto-created when a sale is converted.</div>
          </div>
        )}
      </div>

      {/* View / Report Project Modal */}
      {viewProject && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">🔄 {viewProject.projectName}</div>
              <button className="btn btn-icon btn-ghost" onClick={() => setViewProject(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Client & Company Information */}
                <div>
                  <h4 style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 12 }}>👤 Client & Company Details</h4>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>👤 Client Information</div>
                    {[
                      { label: 'Client Name', val: viewProject.client?.name || viewProject.clientName },
                      { label: 'Phone Number', val: viewProject.client?.phone || viewProject.phone },
                      { label: 'Email Address', val: viewProject.client?.email || viewProject.email },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                        <span style={{ fontWeight: 600 }}>{val || '—'}</span>
                      </div>
                    ))}

                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', margin: '12px 0 8px', paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>🏢 Company Details</div>
                    {[
                      { label: 'Company Name', val: viewProject.company?.businessName || viewProject.businessName },
                      { label: 'Address', val: viewProject.company?.address || viewProject.address },
                      { label: 'Location', val: viewProject.company 
                        ? `${viewProject.company.state || ''}, ${viewProject.company.country || ''}`.replace(/^, /, '')
                        : `${viewProject.state || ''}, ${viewProject.country || ''}`.replace(/^, /, '') 
                      },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                        <span style={{ fontWeight: 600, textAlign: 'right' }}>{val || '—'}</span>
                      </div>
                    ))}
                  </div>

                  <h4 style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 12 }}>🔑 Client Credentials</h4>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>🌐 Website Details</div>
                    {[
                      { label: 'WordPress URL', val: viewProject.wpUrl },
                      { label: 'WP Username', val: viewProject.wpUsername },
                      { label: 'WP Password', key: 'wp_pass', val: viewProject.wpPassword },
                    ].map(({ label, key, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>
                            {key ? (
                              isAuthorized ? (
                                showCredentials[key] ? (decrypt(val) || '—') : maskCred(decrypt(val))
                              ) : (
                                val ? '●●●●●●●●' : '—'
                              )
                            ) : (val || '—')}
                          </span>
                          {key && val && isAuthorized && (
                            <button className="btn btn-sm btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => toggleCred(key)}>
                              {showCredentials[key] ? '🙈' : '👁'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', margin: '12px 0 8px', paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>📡 Domain Details</div>
                    {[
                      { label: 'Provider', val: viewProject.domainProvider || viewProject.domainRegistrar },
                      { label: 'Username', val: viewProject.domainUsername },
                      { label: 'Password', key: 'domain_pass', val: viewProject.domainPassword },
                    ].map(({ label, key, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>
                            {key ? (
                              isAuthorized ? (
                                showCredentials[key] ? (decrypt(val) || '—') : maskCred(decrypt(val))
                              ) : (
                                val ? '●●●●●●●●' : '—'
                              )
                            ) : (val || '—')}
                          </span>
                          {key && val && isAuthorized && (
                            <button className="btn btn-sm btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => toggleCred(key)}>
                              {showCredentials[key] ? '🙈' : '👁'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', margin: '12px 0 8px', paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>🖥️ Hosting (cPanel)</div>
                    {[
                      { label: 'Username', val: viewProject.cpanelUsername || viewProject.cpanelUser },
                      { label: 'Password', key: 'cpanel_pass', val: viewProject.cpanelPassword || viewProject.cpanelPass },
                    ].map(({ label, key, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>
                            {key ? (
                              isAuthorized ? (
                                showCredentials[key] ? (decrypt(val) || '—') : maskCred(decrypt(val))
                              ) : (
                                val ? '●●●●●●●●' : '—'
                              )
                            ) : (val || '—')}
                          </span>
                          {key && val && isAuthorized && (
                            <button className="btn btn-sm btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => toggleCred(key)}>
                              {showCredentials[key] ? '🙈' : '👁'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', margin: '12px 0 8px', paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>📱 Social Media</div>
                    {[
                      { label: 'Facebook', val: viewProject.facebookUsername || viewProject.facebookPage },
                      { label: 'Instagram', val: viewProject.instagramUsername },
                      { label: 'YouTube', val: viewProject.youtubeUsername },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                        <span style={{ fontWeight: 600 }}>{val || '—'}</span>
                      </div>
                    ))}

                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', margin: '12px 0 8px', paddingBottom: 4, borderBottom: '1px solid var(--border-light)' }}>📧 Google Access</div>
                    {[
                      { label: 'Gmail ID', val: viewProject.gmailId || viewProject.gmailAcc },
                      { label: 'Password', key: 'gmail_pass', val: viewProject.gmailPassword },
                    ].map(({ label, key, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>
                            {key ? (
                              isAuthorized ? (
                                showCredentials[key] ? (decrypt(val) || '—') : maskCred(decrypt(val))
                              ) : (
                                val ? '●●●●●●●●' : '—'
                              )
                            ) : (val || '—')}
                          </span>
                          {key && val && isAuthorized && (
                            <button className="btn btn-sm btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => toggleCred(key)}>
                              {showCredentials[key] ? '🙈' : '👁'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reports */}
                <div>
                  <h4 style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 12 }}>📋 Daily Reports</h4>
                  <div style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 12 }}>
                    {viewProject.reports?.map((report, i) => {
                      const formattedDate = report.timestamp
                        ? new Date(report.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : report.date;
                      return (
                        <div key={i} style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 8, marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--primary)', marginBottom: 4 }}>
                            📅 {formattedDate} · {report.by}
                            {report.immutable && <span className="badge badge-neutral" style={{ marginLeft: 8, fontSize: 10 }}>🔒 Locked</span>}
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{report.summary}</div>
                        </div>
                      );
                    })}
                    {(!viewProject.reports || viewProject.reports.length === 0) && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No reports yet</div>
                    )}
                  </div>
                  {((currentUser.role === ROLES.BACKEND || graphicsRoles.includes(currentUser.role)) && (String(viewProject.assignedTo) === String(currentUser.id) || (viewProject.assignedMembers && Array.isArray(viewProject.assignedMembers) && viewProject.assignedMembers.map(String).includes(String(currentUser.id))))) || isAdmin ? (
                    <div>
                      <textarea className="form-control" rows={3} value={reportText} onChange={e => setReportText(e.target.value)} placeholder="Write today's progress report... (Immutable after save)" />
                      <button className="btn btn-primary w-full mt-2" onClick={() => handleAddReport(viewProject.id)}>
                        📝 Submit Report (Permanent)
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setViewProject(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deleteProjectId && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">🗑 Delete Project</div>
              <button className="btn btn-icon btn-ghost" onClick={() => { setDeleteProjectId(null); setDeleting(false); }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Are you sure you want to permanently delete this backend project?<br />
                  <strong style={{ color: 'var(--text-primary)' }}>{deleteProjectId.projectName}</strong>
                </p>
                <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8, fontWeight: 600 }}>⚠️ This action cannot be undone.</p>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Project</span>
                  <span style={{ fontWeight: 600 }}>{deleteProjectId.projectName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Client</span>
                  <span style={{ fontWeight: 600 }}>{deleteProjectId.clientName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Assigned To</span>
                  <span style={{ fontWeight: 600 }}>{deleteProjectId.assignedToName || 'Unassigned'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status</span>
                  <span style={{ fontWeight: 600 }}>{deleteProjectId.status}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setDeleteProjectId(null); setDeleting(false); }}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  setDeleting(true);
                  try {
                    deleteProject(deleteProjectId.id);
                    window.showToast('Backend project deleted successfully.', 'success');
                    setDeleteProjectId(null);
                  } catch (err) {
                    window.showToast('Project deletion failed. Please try again.', 'error');
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                style={{ minWidth: 140 }}
              >
                {deleting ? '⏳ Deleting...' : '🗑 Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Assign Project Modal (Admin) */}
      {editProject && isAdmin && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">✏️ Edit Project — {editProject.projectName}</div>
              <button className="btn btn-icon btn-ghost" onClick={() => setEditProject(null)}>✕</button>
            </div>
            <ProjectEditForm
              project={editProject}
              backendUsers={backendUsers}
              onSave={(data) => { updateProject(editProject.id, data); setEditProject(null); }}
              onClose={() => setEditProject(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ProjectEditForm = ({ project, backendUsers, onSave, onClose }) => {
  const [form, setForm] = useState({
    assignedMembers: project.assignedMembers || (project.assignedTo ? [project.assignedTo] : []),
    assignedTo: project.assignedTo || '',
    assignedToName: project.assignedToName || 'Unassigned',
    status: project.status || 'Planning',
    priority: project.priority || 'Medium',
    deadline: project.deadline || '',
    wpUrl: project.wpUrl || '',
    wpUsername: project.wpUsername || '',
    wpPassword: project.wpPassword ? decrypt(project.wpPassword) : '',
    domainProvider: project.domainProvider || project.domainRegistrar || '',
    domainUsername: project.domainUsername || '',
    domainPassword: project.domainPassword ? decrypt(project.domainPassword) : '',
    cpanelUsername: project.cpanelUsername || project.cpanelUser || '',
    cpanelPassword: (project.cpanelPassword || project.cpanelPass) ? decrypt(project.cpanelPassword || project.cpanelPass) : '',
    facebookUsername: project.facebookUsername || project.facebookPage || '',
    facebookPassword: project.facebookPassword ? decrypt(project.facebookPassword) : '',
    instagramUsername: project.instagramUsername || '',
    instagramPassword: project.instagramPassword ? decrypt(project.instagramPassword) : '',
    youtubeUsername: project.youtubeUsername || '',
    youtubePassword: project.youtubePassword ? decrypt(project.youtubePassword) : '',
    gmailId: project.gmailId || project.gmailAcc || '',
    gmailPassword: project.gmailPassword ? decrypt(project.gmailPassword) : '',
    notes: project.notes || '',
  });

  const handleAssignmentChange = (ids, users) => {
    setForm(p => ({
      ...p,
      assignedMembers: ids,
      assignedTo: ids[0] || '',
      assignedToName: users.length ? users.map(u => u.name || u.full_name).join(', ') : 'Unassigned'
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const encryptedData = {
      ...form,
      wpPassword: form.wpPassword ? encrypt(form.wpPassword) : '',
      domainPassword: form.domainPassword ? encrypt(form.domainPassword) : '',
      cpanelPassword: form.cpanelPassword ? encrypt(form.cpanelPassword) : '',
      cpanelPass: form.cpanelPassword ? encrypt(form.cpanelPassword) : '',
      cpanelUser: form.cpanelUsername,
      domainRegistrar: form.domainProvider,
      facebookPage: form.facebookUsername,
      facebookPassword: form.facebookPassword ? encrypt(form.facebookPassword) : '',
      instagramPassword: form.instagramPassword ? encrypt(form.instagramPassword) : '',
      youtubePassword: form.youtubePassword ? encrypt(form.youtubePassword) : '',
      gmailAcc: form.gmailId,
      gmailPassword: form.gmailPassword ? encrypt(form.gmailPassword) : '',
    };
    onSave(encryptedData);
  };

  const SectionHeader = ({ icon, title }) => (
    <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
        {icon} {title}
      </div>
    </div>
  );

  const InputField = ({ label, field, placeholder, type = 'text', halfWidth = false }) => (
    <div className="form-group" style={halfWidth ? {} : { gridColumn: '1 / -1' }}>
      <label className="form-label">{label}</label>
      <input className="form-control" type={type} value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  const domainProviders = ['Lets Host', 'Blacknight', 'GoDaddy', 'Namecheap', 'Hostinger', 'Other'];

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">👤 Assign To (Backend / Graphics)</label>
            <MultiAssignTeamMember value={form.assignedMembers} onChange={handleAssignmentChange} />
          </div>
          <div className="form-group">
            <label className="form-label">📊 Project Status</label>
            <select className="form-control" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              {['Planning', 'In Progress', 'On Hold', 'Completed'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">⚡ Priority</label>
            <select className="form-control" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">📅 Deadline</label>
            <input className="form-control" type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
          </div>

          <SectionHeader icon="🌐" title="Website Details" />
          <InputField label="WordPress URL" field="wpUrl" placeholder="www.example.com/wp-admin" />
          <InputField label="WP Username" field="wpUsername" placeholder="admin" halfWidth />
          <InputField label="WP Password" field="wpPassword" type="password" halfWidth />

          <SectionHeader icon="🌍" title="Domain Details" />
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Provider</label>
            <select className="form-control" value={form.domainProvider} onChange={e => setForm(p => ({ ...p, domainProvider: e.target.value }))}>
              <option value="">Select Provider</option>
              {domainProviders.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <InputField label="Domain Username" field="domainUsername" halfWidth />
          <InputField label="Domain Password" field="domainPassword" type="password" halfWidth />

          <SectionHeader icon="🖥️" title="Hosting (cPanel)" />
          <InputField label="cPanel Username" field="cpanelUsername" halfWidth />
          <InputField label="cPanel Password" field="cpanelPassword" type="password" halfWidth />

          <SectionHeader icon="📱" title="Social Media Credentials" />
          <InputField label="Facebook Username" field="facebookUsername" halfWidth />
          <InputField label="Facebook Password" field="facebookPassword" type="password" halfWidth />
          <InputField label="Instagram Username" field="instagramUsername" halfWidth />
          <InputField label="Instagram Password" field="instagramPassword" type="password" halfWidth />
          <InputField label="YouTube Username" field="youtubeUsername" halfWidth />
          <InputField label="YouTube Password" field="youtubePassword" type="password" halfWidth />

          <SectionHeader icon="📧" title="Google Access" />
          <InputField label="Gmail ID" field="gmailId" type="email" halfWidth />
          <InputField label="Gmail Password" field="gmailPassword" type="password" halfWidth />

          <SectionHeader icon="📝" title="Notes" />
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Additional Instructions</label>
            <textarea className="form-control" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional instructions for the backend team..." />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">💾 Assign Project</button>
      </div>
    </form>
  );
};

export default ProjectsPage;
