import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ROLES } from '../data/mockData';

const ProjectsPage = () => {
  const { currentUser, allProjects, myProjects, allUsers, updateProject, addProjectReport } = useApp();
  const isAdmin = currentUser.role === ROLES.ADMIN;
  const projects = isAdmin ? allProjects : myProjects;

  const [viewProject, setViewProject] = useState(null);
  const [editProject, setEditProject] = useState(null);
  const [reportText, setReportText] = useState('');
  const [showCredentials, setShowCredentials] = useState({});
  const [search, setSearch] = useState('');

  const filtered = projects.filter(p =>
    !search || p.projectName.toLowerCase().includes(search.toLowerCase()) || p.clientName.toLowerCase().includes(search.toLowerCase())
  );

  const backendUsers = allUsers.filter(u => u.role === ROLES.BACKEND);

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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>👤 {proj.assignedToName || 'Unassigned'}</span>
                <span style={{ color: 'var(--text-muted)' }}>📅 {proj.startDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                <span>📊 {proj.reports?.length || 0} reports</span>
                {proj.wpUrl && <span>🌐 WP Connected</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-outline" style={{ flex: 1 }} onClick={() => setViewProject(proj)}>
                  👁 View
                </button>
                {isAdmin && (
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditProject(proj)}>
                    ✏️
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
                {/* Client Credentials */}
                <div>
                  <h4 style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 12 }}>🔑 Client Credentials</h4>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14 }}>
                    {[
                      { label: 'WordPress URL', val: viewProject.wpUrl },
                      { label: 'WP Username', val: viewProject.wpUsername },
                      { label: 'WP Password', key: 'wp_pass', val: viewProject.wpPassword },
                      { label: 'Domain Registrar', val: viewProject.domainRegistrar },
                      { label: 'Domain User', val: viewProject.domainUsername },
                      { label: 'Domain Pass', key: 'domain_pass', val: viewProject.domainPassword },
                      { label: 'CPanel User', val: viewProject.cpanelUser },
                      { label: 'CPanel Pass', key: 'cpanel_pass', val: viewProject.cpanelPass },
                      { label: 'Facebook', val: viewProject.facebookPage },
                      { label: 'Gmail', val: viewProject.gmailAcc },
                    ].map(({ label, key, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>
                            {key ? (showCredentials[key] ? (val || '—') : maskCred(val)) : (val || '—')}
                          </span>
                          {key && val && (
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
                    {viewProject.reports?.map((report, i) => (
                      <div key={i} style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 8, marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--primary)', marginBottom: 4 }}>
                          📅 {report.date} · {report.by}
                          {report.immutable && <span className="badge badge-neutral" style={{ marginLeft: 8, fontSize: 10 }}>🔒 Locked</span>}
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{report.summary}</div>
                      </div>
                    ))}
                    {(!viewProject.reports || viewProject.reports.length === 0) && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No reports yet</div>
                    )}
                  </div>
                  {(currentUser.role === ROLES.BACKEND && viewProject.assignedTo === currentUser.id) || isAdmin ? (
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
    assignedTo: project.assignedTo || '',
    assignedToName: project.assignedToName || 'Unassigned',
    status: project.status || 'Planning',
    wpUrl: project.wpUrl || '',
    wpUsername: project.wpUsername || '',
    wpPassword: project.wpPassword || '',
    domainRegistrar: project.domainRegistrar || '',
    domainUsername: project.domainUsername || '',
    domainPassword: project.domainPassword || '',
    cpanelUser: project.cpanelUser || '',
    cpanelPass: project.cpanelPass || '',
    facebookPage: project.facebookPage || '',
    youtubeChannel: project.youtubeChannel || '',
    instagramHandle: project.instagramHandle || '',
    gmailAcc: project.gmailAcc || '',
  });

  const handleAssignee = (userId) => {
    const user = backendUsers.find(u => u.id === parseInt(userId));
    setForm(p => ({ ...p, assignedTo: parseInt(userId), assignedToName: user?.name || 'Unassigned' }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="modal-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Assign To (Backend User)</label>
            <select className="form-control" value={form.assignedTo} onChange={e => handleAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {backendUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Project Status</label>
            <select className="form-control" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              {['Planning', 'In Progress', 'On Hold', 'Completed'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
              🌐 WordPress / Hosting Credentials
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">WordPress URL</label>
            <input className="form-control" value={form.wpUrl} onChange={e => setForm(p => ({ ...p, wpUrl: e.target.value }))} placeholder="www.example.com/wp-admin" />
          </div>
          <div className="form-group">
            <label className="form-label">WP Username</label>
            <input className="form-control" value={form.wpUsername} onChange={e => setForm(p => ({ ...p, wpUsername: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">WP Password</label>
            <input className="form-control" type="password" value={form.wpPassword} onChange={e => setForm(p => ({ ...p, wpPassword: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Domain Registrar</label>
            <input className="form-control" value={form.domainRegistrar} onChange={e => setForm(p => ({ ...p, domainRegistrar: e.target.value }))} placeholder="GoDaddy, Namecheap..." />
          </div>
          <div className="form-group">
            <label className="form-label">Domain Username</label>
            <input className="form-control" value={form.domainUsername} onChange={e => setForm(p => ({ ...p, domainUsername: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Domain Password</label>
            <input className="form-control" type="password" value={form.domainPassword} onChange={e => setForm(p => ({ ...p, domainPassword: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">CPanel Username</label>
            <input className="form-control" value={form.cpanelUser} onChange={e => setForm(p => ({ ...p, cpanelUser: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">CPanel Password</label>
            <input className="form-control" type="password" value={form.cpanelPass} onChange={e => setForm(p => ({ ...p, cpanelPass: e.target.value }))} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-light)' }}>
              📱 Social Media Credentials
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Facebook Page</label>
            <input className="form-control" value={form.facebookPage} onChange={e => setForm(p => ({ ...p, facebookPage: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">YouTube Channel</label>
            <input className="form-control" value={form.youtubeChannel} onChange={e => setForm(p => ({ ...p, youtubeChannel: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Instagram Handle</label>
            <input className="form-control" value={form.instagramHandle} onChange={e => setForm(p => ({ ...p, instagramHandle: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Gmail Account</label>
            <input className="form-control" type="email" value={form.gmailAcc} onChange={e => setForm(p => ({ ...p, gmailAcc: e.target.value }))} />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary">💾 Save Project</button>
      </div>
    </form>
  );
};

export default ProjectsPage;
