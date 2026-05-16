import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const CRM_USERS = [
  { id: "U001", name: "Aisha Patel", email: "aisha.patel@crm.com", role: "Sales Manager", dept: "Sales", avatar: "AP", color: "#6366f1" },
  { id: "U002", name: "Marcus Rivera", email: "marcus.rivera@crm.com", role: "Account Executive", dept: "Sales", avatar: "MR", color: "#ec4899" },
  { id: "U003", name: "Priya Nair", email: "priya.nair@crm.com", role: "HR Manager", dept: "HR", avatar: "PN", color: "#10b981" },
  { id: "U004", name: "James Okonkwo", email: "james.okonkwo@crm.com", role: "Project Manager", dept: "Operations", avatar: "JO", color: "#f59e0b" },
  { id: "U005", name: "Sofia Chen", email: "sofia.chen@crm.com", role: "QA Lead", dept: "QA", avatar: "SC", color: "#8b5cf6" },
  { id: "U006", name: "David Mensah", email: "david.mensah@crm.com", role: "Data Analyst", dept: "Analytics", avatar: "DM", color: "#0ea5e9" },
  { id: "U007", name: "Lena Hoffmann", email: "lena.hoffmann@crm.com", role: "Marketing Lead", dept: "Marketing", avatar: "LH", color: "#ef4444" },
  { id: "U008", name: "Ravi Shankar", email: "ravi.shankar@crm.com", role: "DevOps Engineer", dept: "Engineering", avatar: "RS", color: "#14b8a6" },
];

const GLOBAL_TEMPLATES = [
  { id: "t1", name: "Offer Letter", subject: "Job Offer: {Role} at CRM Corp", body: "<p>Dear {Name},</p><p>We are pleased to offer you the position of <strong>{Role}</strong> at CRM Corp.</p><p>Please find the detailed offer attached.</p><p>Best regards,<br/>HR Team</p>" },
  { id: "t2", name: "Leave Approval", subject: "Leave Request Approved", body: "<p>Dear {Name},</p><p>Your leave request has been <strong>approved</strong>.</p><p>Please ensure your tasks are handed over before your leave period.</p><p>Best regards,<br/>HR Team</p>" },
  { id: "t3", name: "Interview Invite", subject: "Interview Invitation — {Date}", body: "<p>Dear Candidate,</p><p>Thank you for applying for the position. We would like to invite you for an interview on <strong>{Date}</strong>.</p><p>Please confirm your availability.</p><p>Best regards,<br/>HR Team</p>" },
  { id: "t4", name: "Probation Notice", subject: "Probation Period Notification", body: "<p>Dear Employee,</p><p>This is to inform you that your probation period will be completed on <strong>{Date}</strong>.</p><p>Please submit all required documents.</p><p>Best regards,<br/>HR Team</p>" },
  { id: "t5", name: "Welcome Email", subject: "Welcome to CRM Corp, {Name}!", body: "<p>Dear {Name},</p><p><strong>Welcome to CRM Corp!</strong></p><p>We are excited to have you on board.</p><p>Please complete your onboarding process by visiting HR.</p><p>Best regards,<br/>CRM Team</p>" },
];

const STORAGE_KEYS = {
  session: 'crm_email_session',
  inbox: (uid) => `crm_email_inbox_${uid}`,
  sent: (uid) => `crm_email_sent_${uid}`,
  drafts: (uid) => `crm_email_drafts_${uid}`,
  archive: (uid) => `crm_email_archive_${uid}`,
  junk: (uid) => `crm_email_junk_${uid}`,
  trash: (uid) => `crm_email_trash_${uid}`,
  templates: (uid) => `crm_email_templates_${uid}`,
  settings: (uid) => `crm_email_settings_${uid}`,
  globalTemplates: 'crm_email_global_templates',
};

const loadFromStorage = (key, defaultValue) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch { return defaultValue; }
};

const saveToStorage = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const generateId = () => `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const sanitizeHtml = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const scripts = doc.querySelectorAll('script, iframe, object, embed, form');
  scripts.forEach(el => el.remove());
  const elements = doc.querySelectorAll('*');
  elements.forEach(el => {
    [...el.attributes].forEach(attr => {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
};

const LoginScreen = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedUser) onLogin(selectedUser);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', fontFamily: 'DM Sans, sans-serif'
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 32px', width: 400, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏢</div>
           <h2 style={{ margin: 0, fontSize: 24, color: '#1e293b', fontWeight: 700 }}>Email</h2>
          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 14 }}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#374151' }}>Select User</label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: 8,
                  background: '#fff', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontSize: 14
                }}
              >
                {selectedUser ? (
                  <>
                    <span style={{
                      width: 32, height: 32, borderRadius: '50%', background: selectedUser.color,
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600
                    }}>{selectedUser.avatar}</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{selectedUser.name} — {selectedUser.email}</span>
                  </>
                ) : (
                  <span style={{ color: '#9ca3af' }}>Select a user...</span>
                )}
                <span style={{ color: '#9ca3af' }}>▾</span>
              </button>
              {showDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff',
                  border: '1px solid #d1d5db', borderRadius: 8, marginTop: 4, zIndex: 100, maxHeight: 300, overflow: 'auto'
                }}>
                  {CRM_USERS.map(user => (
                    <div
                      key={user.id}
                      onClick={() => { setSelectedUser(user); setShowDropdown(false); }}
                      style={{
                        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6'
                      }}
                    >
                      <span style={{
                        width: 32, height: 32, borderRadius: '50%', background: user.color,
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600
                      }}>{user.avatar}</span>
                      <div>
                        <div style={{ fontWeight: 500, color: '#1f2937' }}>{user.name}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{user.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#374151' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: 8,
                fontSize: 14, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={!selectedUser}
            style={{
              width: '100%', padding: '14px', background: selectedUser ? '#6366f1' : '#94a3b8',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: selectedUser ? 'pointer' : 'not-allowed'
            }}
          >
            Sign In →
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9ca3af' }}>
          Each user has their own inbox.
        </p>
      </div>
    </div>
  );
};

const EmailComposer = ({ user, onSend, onClose, onSaveDraft, replyingTo }) => {
  const editorRef = useRef(null);
  const [fromAlias, setFromAlias] = useState(user.email);
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [showCcInput, setShowCcInput] = useState(false);
  const [showBccInput, setShowBccInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [signatureOn, setSignatureOn] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [lastTextColor, setLastTextColor] = useState('#000000');
  const [lastHighlight, setLastHighlight] = useState('#fef08a');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalData, setLinkModalData] = useState({ text: '', url: '', newTab: true, noFollow: false });
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableSize, setTableSize] = useState({ rows: 3, cols: 4 });
  const [showCharModal, setShowCharModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showCodeView, setShowCodeView] = useState(false);
  const [codeContent, setCodeContent] = useState('');
  const [showFindBar, setShowFindBar] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findIndex, setFindIndex] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(null);
  const [error, setError] = useState('');
  const [draftSaved, setDraftSaved] = useState(null);

  const colorSwatches = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
    '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff', '#ff00ff',
    '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc'
  ];

  useEffect(() => {
    if (replyingTo) {
      setSubject(replyingTo.subject?.startsWith('Re:') ? replyingTo.subject : `Re: ${replyingTo.subject || ''}`);
      setTo([{ name: replyingTo.fromName, email: replyingTo.fromEmail }]);
    }
  }, [replyingTo]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (subject || editorRef.current?.innerHTML) {
        setDraftSaved(new Date());
        onSaveDraft({
          id: generateId(), subject, body: editorRef.current?.innerHTML || '',
          to, cc, bcc, from: fromAlias, attachments
        });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [subject, to, cc, bcc, fromAlias]);

  const execCmd = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  const insertLink = () => {
    const sel = window.getSelection();
    const text = sel.toString() || linkModalData.text;
    execCmd('insertHTML', `<a href="${linkModalData.url}" target="${linkModalData.newTab ? '_blank' : '_self'}" rel="${linkModalData.noFollow ? 'nofollow' : ''}">${text}</a>`);
    setShowLinkModal(false);
    setLinkModalData({ text: '', url: '', newTab: true, noFollow: false });
  };

  const insertTable = () => {
    let html = '<table style="border-collapse:collapse;width:100%">';
    for (let i = 0; i < tableSize.rows; i++) {
      html += '<tr>';
      for (let j = 0; j < tableSize.cols; j++) {
        html += `<td style="border:1px solid #e2e8f0;padding:8px"></td>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    execCmd('insertHTML', html);
    setShowTableModal(false);
  };

  const insertChar = (char) => {
    execCmd('insertText', char);
    setShowCharModal(false);
  };

  const insertImage = (url) => {
    execCmd('insertHTML', `<img src="${url}" style="max-width:100%" />`);
    setShowImageModal(false);
  };

  const insertMedia = (url) => {
    let embed = url;
    if (url.includes('youtube.com')) {
      const vid = url.split('v=')[1]?.split('&')[0];
      embed = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen></iframe>`;
    } else if (url.includes('vimeo.com')) {
      const vid = url.split('/').pop();
      embed = `<iframe src="https://player.vimeo.com/video/${vid}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;
    }
    execCmd('insertHTML', embed);
    setShowMediaModal(false);
  };

  const handleSend = async () => {
    setError('');
    if (!to.length) { setError('⚠ Add at least one recipient'); return; }
    if (!subject) {
      if (!window.confirm('No Subject — Send anyway?')) return;
    }
    if (!editorRef.current?.innerText?.trim() && !window.confirm('Empty message — Send anyway?')) return;

    setIsSending(true);
    await new Promise(r => setTimeout(r, 1500));

    const email = {
      id: generateId(),
      from: fromAlias,
      fromName: user.name,
      to: to,
      cc: cc.length ? cc : [],
      bcc: bcc.length ? bcc : [],
      subject,
      body: sanitizeHtml(editorRef.current.innerHTML),
      attachments,
      isStarred: false,
      createdAt: new Date().toISOString(),
      isRead: true
    };

    setIsSending(false);
    onSend(email);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const files = [...e.dataTransfer.files];
    const valid = files.filter(f => {
      if (f.size > 25 * 1024 * 1024) { setError(`File ${f.name} too large (max 25MB)`); return false; }
      return true;
    });
    setAttachments(prev => [...prev, ...valid].slice(0, 10));
  };

  const handleFileSelect = (e) => {
    const files = [...e.target.files];
    setAttachments(prev => [...prev, ...files].slice(0, 10));
  };

  const filteredUsers = CRM_USERS.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addRecipient = (list, setList, user) => {
    if (!list.find(r => r.email === user.email)) {
      setList([...list, { name: user.name, email: user.email }]);
    }
    setSearchQuery('');
  };

  const removeRecipient = (list, setList, idx) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const fontFamilies = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Trebuchet MS', 'Verdana', 'Tahoma'];
  const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];
  const specialChars = ['©', '®', '™', '§', '¶', '†', '‡', '•', '…', '–', '—', '′', '″', '€', '£', '¥', '°', '±', '×', '÷', '≤', '≥', '≠', '≈', '∞', '←', '→', '↑', '↓', '↔', '✓', '✗', '★', '♦', '♠', '♣', '♥', '©', '®'];

  return (
    <div style={{
      background: '#fff', width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'visible'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc'
      }}>
        <span style={{ fontWeight: 600, color: '#1e293b' }}>New Message</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowCodeView(!showCodeView)} style={iconBtn}>⟨⟩</button>
          <button style={iconBtn}>_</button>
          <button onClick={onClose} style={iconBtn}>×</button>
        </div>
      </div>

      {/* From */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 40, color: '#64748b', fontSize: 14 }}>From</span>
        <select
          value={fromAlias}
          onChange={(e) => setFromAlias(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
        >
          <option value={user.email}>{user.name} &lt;{user.email}&gt;</option>
        </select>
      </div>

      {/* To */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ width: 40, color: '#64748b', fontSize: 14 }}>To</span>
        {to.map((r, i) => (
          <div key={i} style={chipStyle}>
            <span style={chipAvatar}>{CRM_USERS.find(u => u.email === r.email)?.avatar || r.name[0]}</span>
            {r.name} <span style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => removeRecipient(to, setTo, i)}>×</span>
          </div>
        ))}
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filteredUsers.length) {
              addRecipient(to, setTo, filteredUsers[0]);
            }
          }}
          placeholder="type here..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, minWidth: 100 }}
        />
        {searchQuery && (
          <div style={suggestionDropdown}>
            {filteredUsers.slice(0, 5).map(u => (
              <div key={u.id} onClick={() => addRecipient(to, setTo, u)} style={suggestionItem}>
                <span style={chipAvatar}>{u.avatar}</span>
                <div><div style={{ fontWeight: 500 }}>{u.name}</div><div style={{ fontSize: 12, color: '#666' }}>{u.email}</div></div>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setShowCcInput(true)} style={linkBtn}>+CC</button>
        <button onClick={() => setShowBccInput(true)} style={linkBtn}>+BCC</button>
      </div>

      {/* CC */}
      {showCcInput && (
        <div style={{ padding: '8px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 40, color: '#64748b', fontSize: 14 }}>CC</span>
          {cc.map((r, i) => (
            <div key={i} style={chipStyle}>{r.name} <span style={{ cursor: 'pointer' }} onClick={() => removeRecipient(cc, setCc, i)}>×</span></div>
          ))}
          <input placeholder="email address" onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.value) {
              addRecipient(cc, setCc, { name: e.target.value.split('@')[0], email: e.target.value });
              e.target.value = '';
            }
          }} style={{ border: 'none', outline: 'none', fontSize: 14 }} />
        </div>
      )}

      {/* BCC */}
      {showBccInput && (
        <div style={{ padding: '8px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 40, color: '#64748b', fontSize: 14 }}>BCC</span>
          {bcc.map((r, i) => (
            <div key={i} style={chipStyle}>{r.name} <span style={{ cursor: 'pointer' }} onClick={() => removeRecipient(bcc, setBcc, i)}>×</span></div>
          ))}
          <input placeholder="email address" onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.value) {
              addRecipient(bcc, setBcc, { name: e.target.value.split('@')[0], email: e.target.value });
              e.target.value = '';
            }
          }} style={{ border: 'none', outline: 'none', fontSize: 14 }} />
        </div>
      )}

      {/* Subject */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line..."
          style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14 }}
        />
      </div>

      {error && <div style={{ padding: '8px 20px', color: '#dc2626', fontSize: 13 }}>{error}</div>}

      {/* Toolbar */}
      <div style={toolbarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 8, borderBottom: '1px solid #bae6fd' }}>
          <button onClick={() => execCmd('removeFormat')} style={toolbarBtn} title="Clear">×</button>
          <button onClick={() => execCmd('bold')} style={toolbarBtn} title="Bold (Ctrl+B)"><b>B</b></button>
          <button onClick={() => execCmd('italic')} style={toolbarBtn} title="Italic (Ctrl+I)"><i>I</i></button>
          <button onClick={() => execCmd('underline')} style={toolbarBtn} title="Underline (Ctrl+U)"><u>U</u></button>
          <span style={separator} />
          <button onClick={() => execCmd('justifyLeft')} style={toolbarBtn}>≡L</button>
          <button onClick={() => execCmd('justifyCenter')} style={toolbarBtn}>≡C</button>
          <button onClick={() => execCmd('justifyRight')} style={toolbarBtn}>≡R</button>
          <button onClick={() => execCmd('justifyFull')} style={toolbarBtn}>≡J</button>
          <span style={separator} />
          <select onChange={(e) => execCmd('fontName', e.target.value)} style={toolbarSelect}>
            <option value="Verdana">Verdana</option>
            {fontFamilies.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select onChange={(e) => execCmd('fontSize', e.target.value)} style={{ ...toolbarSelect, width: 65 }}>
            {fontSizes.map(s => <option key={s} value={s}>{s}pt</option>)}
          </select>
          <span style={separator} />
          <div style={{ position: 'relative' }}>
            <button onClick={() => execCmd('foreColor', lastTextColor)} style={{ ...toolbarBtn, borderBottom: `4px solid ${lastTextColor}` }}>A</button>
            <button onClick={() => setShowColorPicker('text')} style={{ ...toolbarBtn, fontSize: 10, padding: '2px 4px' }}>▾</button>
            {showColorPicker === 'text' && (
              <div style={colorPickerStyle}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {colorSwatches.map(c => (
                    <button key={c} onClick={() => { execCmd('foreColor', c); setLastTextColor(c); setShowColorPicker(null); }} style={{ ...colorSwatch, background: c }} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => execCmd('backColor', lastHighlight)} style={toolbarBtn}>🖊</button>
            <button onClick={() => setShowColorPicker('highlight')} style={{ ...toolbarBtn, fontSize: 10, padding: '2px 4px' }}>▾</button>
            {showColorPicker === 'highlight' && (
              <div style={colorPickerStyle}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {['#fef08a', '#d9f99d', '#a5f3fc', '#fbcfe8', '#fed7aa', '#ffffff'].map(c => (
                    <button key={c} onClick={() => { execCmd('backColor', c); setLastHighlight(c); setShowColorPicker(null); }} style={{ ...colorSwatch, background: c }} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMoreMenu(!showMoreMenu)} style={toolbarBtn}>···</button>
            {showMoreMenu && (
              <div style={{ position: 'absolute', top: '100%', left: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 4, zIndex: 100 }}>
                <button onClick={() => execCmd('strikethrough')} style={{ display: 'block', padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer' }}>Strikethrough</button>
                <button onClick={() => execCmd('superscript')} style={{ display: 'block', padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer' }}>Superscript</button>
                <button onClick={() => execCmd('subscript')} style={{ display: 'block', padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer' }}>Subscript</button>
                <button onClick={() => execCmd('code')} style={{ display: 'block', padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer' }}>Code Inline</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 8 }}>
          <button onClick={() => execCmd('insertUnorderedList')} style={toolbarBtn}>•</button>
          <button onClick={() => execCmd('insertOrderedList')} style={toolbarBtn}>1.</button>
          <button onClick={() => execCmd('outdent')} style={toolbarBtn}>←</button>
          <button onClick={() => execCmd('indent')} style={toolbarBtn}>→</button>
          <button onClick={() => execCmd('formatBlock', 'p')} style={toolbarBtn}>¶L</button>
          <button onClick={() => execCmd('formatBlock', 'blockquote')} style={toolbarBtn}>¶R</button>
          <span style={separator} />
          <button onClick={() => { const sel = window.getSelection(); setLinkModalData({ ...linkModalData, text: sel.toString() }); setShowLinkModal(true); }} style={toolbarBtn}>🔗</button>
          <button onClick={() => execCmd('unlink')} style={toolbarBtn}>✂</button>
          <button onClick={() => setShowTableModal(true)} style={toolbarBtn}>⊞</button>
          <span style={separator} />
          <button onClick={() => setShowCharModal(true)} style={toolbarBtn}>Ω</button>
          <button onClick={() => setShowImageModal(true)} style={toolbarBtn}>🖼</button>
          <button onClick={() => setShowMediaModal(true)} style={toolbarBtn}>▶</button>
          <span style={separator} />
          <button onClick={() => { setCodeContent(editorRef.current.innerHTML); setShowCodeView(true); }} style={toolbarBtn}>&lt;/&gt;</button>
          <button onClick={() => setShowFindBar(true)} style={toolbarBtn}>🔍</button>
          <button onClick={() => execCmd('undo')} style={toolbarBtn}>↩</button>
          <button onClick={() => execCmd('redo')} style={toolbarBtn}>↪</button>
        </div>
      </div>

      {/* Editor */}
      <div style={{ width: 864, height: 566, padding: 20, margin: '0 auto', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        {showCodeView ? (
          <textarea
            value={codeContent}
            onChange={(e) => setCodeContent(e.target.value)}
            onBlur={() => { if (editorRef.current) editorRef.current.innerHTML = codeContent; }}
            style={{
              width: '100%', height: '100%', background: '#1e293b', color: '#10b981',
              fontFamily: 'DM Mono, monospace', fontSize: 13, padding: 16, border: 'none', outline: 'none', resize: 'none'
            }}
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            style={{ width: '100%', height: '100%', minHeight: 500, outline: 'none', fontFamily: 'Verdana, sans-serif', fontSize: 14 }}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'b') { e.preventDefault(); execCmd('bold'); }
              if (e.ctrlKey && e.key === 'i') { e.preventDefault(); execCmd('italic'); }
              if (e.ctrlKey && e.key === 'u') { e.preventDefault(); execCmd('underline'); }
              if (e.ctrlKey && e.key === 'Enter') handleSend();
            }}
          />
        )}
      </div>

      {/* Signature */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#64748b' }}>
        <span>── Signature ──</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={signatureOn} onChange={(e) => setSignatureOn(e.target.checked)} />
          {signatureOn ? 'ON' : 'OFF'}
        </label>
        {signatureOn && <span>Best regards, {user.name} — {user.role} | {user.dept}</span>}
      </div>

      {/* Attachments */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
      >
        <div style={{
          border: '2px dashed #cbd5e1', borderRadius: 8, padding: 20, textAlign: 'center',
          color: '#64748b', fontSize: 13
        }}>
          📎 Drag & Drop files here, or <label style={{ color: '#6366f1', cursor: 'pointer' }}>
            Browse <input type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
          </label>
          <div style={{ marginTop: 8, fontSize: 12 }}>PDF · Images · DOCX · XLSX · MP3 · MP4 · Max 25MB</div>
        </div>
        {attachments.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {attachments.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f1f5f9', padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>
                📄 {f.name} ({(f.size / 1024 / 1024).toFixed(1)}MB)
                <span style={{ cursor: 'pointer', color: '#dc2626' }} onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>×</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleSend} disabled={isSending} style={sendBtn}>
            {isSending ? '⟳ Sending...' : '▶ Send'}
          </button>
          <button onClick={() => onSaveDraft({ id: generateId(), subject, body: editorRef.current?.innerHTML || '', to, cc, bcc, from: fromAlias, attachments })} style={actionBtn}>💾 Draft</button>
          <button onClick={() => setShowTemplateModal(true)} style={actionBtn}>📋 Templates</button>
          <button onClick={onClose} style={{ ...actionBtn, color: '#dc2626' }}>🗑 Discard</button>
        </div>
        {draftSaved && <span style={{ fontSize: 12, color: '#64748b' }}>Auto-saved at {draftSaved.toLocaleTimeString()}</span>}
      </div>

      {/* Modals */}
      {showTemplateModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>📋 Templates</h3>
            {GLOBAL_TEMPLATES.map(t => (
              <div key={t.id} onClick={() => {
                if (window.confirm('Replace current content?')) {
                  setSubject(t.subject.replace('{Role}', user.role).replace('{Name}', user.name));
                  if (editorRef.current) editorRef.current.innerHTML = t.body.replace('{Role}', user.role).replace('{Name}', user.name);
                }
                setShowTemplateModal(false);
              }} style={{ padding: 12, borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <div style={{ fontWeight: 500 }}>★ {t.name}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{t.subject}</div>
              </div>
            ))}
            <button onClick={() => setShowTemplateModal(false)} style={{ marginTop: 12, ...actionBtn }}>Close</button>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>🔗 Insert Link</h3>
            <input placeholder="Display Text" value={linkModalData.text} onChange={(e) => setLinkModalData({ ...linkModalData, text: e.target.value })} style={modalInput} />
            <input placeholder="URL" value={linkModalData.url} onChange={(e) => setLinkModalData({ ...linkModalData, url: e.target.value })} style={modalInput} />
            <label><input type="checkbox" checked={linkModalData.newTab} onChange={(e) => setLinkModalData({ ...linkModalData, newTab: e.target.checked })} /> Open in new tab</label>
            <label><input type="checkbox" checked={linkModalData.noFollow} onChange={(e) => setLinkModalData({ ...linkModalData, noFollow: e.target.checked })} /> No follow</label>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button onClick={insertLink} style={sendBtn}>Insert</button>
              <button onClick={() => setShowLinkModal(false)} style={actionBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showTableModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>⊞ Insert Table</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 24px)', gap: 2, marginBottom: 12 }}>
              {Array(32).fill(0).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTableSize({ rows: Math.floor(i / 8) + 1, cols: (i % 8) + 1 })}
                  style={{
                    width: 24, height: 24, background: i < tableSize.rows * tableSize.cols ? '#6366f1' : '#e2e8f0',
                    border: 'none', cursor: 'pointer'
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 13, marginBottom: 12 }}>{tableSize.cols} × {tableSize.rows} Table</div>
            <button onClick={insertTable} style={sendBtn}>Insert</button>
          </div>
        </div>
      )}

      {showCharModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>Ω Special Characters</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 32px)', gap: 4 }}>
              {specialChars.map((c, i) => (
                <button key={i} onClick={() => insertChar(c)} style={{ padding: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 16 }}>{c}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showImageModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>🖼 Insert Image</h3>
            <input placeholder="Image URL" id="imgUrl" style={modalInput} />
            <button onClick={() => insertImage(document.getElementById('imgUrl').value)} style={sendBtn}>Insert</button>
          </div>
        </div>
      )}

      {showMediaModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>▶ Insert Media</h3>
            <input placeholder="Video URL (YouTube/Vimeo)" id="mediaUrl" style={modalInput} />
            <button onClick={() => insertMedia(document.getElementById('mediaUrl').value)} style={sendBtn}>Insert</button>
          </div>
        </div>
      )}
    </div>
  );
};

const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 16, color: '#64748b' };
const chipStyle = { display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', padding: '4px 8px', borderRadius: 16, fontSize: 13 };
const chipAvatar = { width: 20, height: 20, borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const linkBtn = { background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 13 };
const suggestionDropdown = { position: 'absolute', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, zIndex: 100, width: 300, maxHeight: 200, overflow: 'auto' };
const suggestionItem = { display: 'flex', alignItems: 'center', gap: 8, padding: 12, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' };
const toolbarStyle = { background: '#f0f9ff', borderTop: '1px solid #bae6fd', borderBottom: '1px solid #bae6fd', padding: '8px 16px' };
const toolbarBtn = { width: 28, height: 28, border: '1px solid transparent', borderRadius: 3, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: 14 };
const toolbarSelect = { width: 110, height: 28, border: '1px solid #d1d5db', borderRadius: 3, background: '#fff', fontSize: 13, paddingLeft: 8 };
const separator = { width: 1, height: 20, background: '#d1d5db', margin: '0 4px' };
const colorPickerStyle = { position: 'absolute', top: '100%', left: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 12, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const colorSwatch = { width: 20, height: 20, border: '1px solid #ddd', borderRadius: 2, cursor: 'pointer' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalContent = { background: '#fff', borderRadius: 12, padding: 24, width: 400, maxHeight: '80vh', overflow: 'auto' };
const modalInput = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, marginBottom: 12, boxSizing: 'border-box' };
const sendBtn = { background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', cursor: 'pointer', fontWeight: 600 };
const actionBtn = { background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 6, padding: '10px 16px', cursor: 'pointer', fontSize: 14 };

const EmailViewer = ({ email, onBack, onReply, onReplyAll, onForward, onDelete, onStar, onMove }) => {
  if (!email) return null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>←</button>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 16, color: '#1e293b' }}>{email.subject}</span>
        <button onClick={() => onStar(email.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>{email.isStarred ? '⭐' : '☆'}</button>
        <button onClick={() => onDelete(email.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>🗑</button>
        <div style={{ position: 'relative' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>⊞▾</button>
        </div>
      </div>

      {/* From/To */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
            {email.fromName.split(' ').map(n => n[0]).join('')}
          </span>
          <div>
            <div style={{ fontWeight: 500, color: '#1e293b' }}>{email.fromName} &lt;{email.from}&gt;</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              To: {email.to.map(t => t.email).join(', ')}
              {email.cc?.length > 0 && `, CC: ${email.cc.map(c => c.email).join(', ')}`}
            </div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
            {new Date(email.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
        <div dangerouslySetInnerHTML={{ __html: email.body }} />
        {email.attachments?.length > 0 && (
          <div style={{ marginTop: 20, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>📎 Attachments ({email.attachments.length})</div>
            {email.attachments.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
                📄 {f.name} ({(f.size / 1024 / 1024).toFixed(1)}MB)
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12 }}>
        <button onClick={() => onReply(email)} style={actionBtn}>↩ Reply</button>
        <button onClick={() => onReplyAll(email)} style={actionBtn}>↪ Reply All</button>
        <button onClick={() => onForward(email)} style={actionBtn}>→ Forward</button>
        <button onClick={() => onMove(email.id, 'junk')} style={actionBtn}>🚫 Mark as Junk</button>
      </div>
    </div>
  );
};

const SettingsPage = ({ user, onBack }) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({ name: user.name, displayName: user.name.split(' ')[0], phone: '', timezone: 'America/New_York' });
  const [emailSettings, setEmailSettings] = useState(() => loadFromStorage(STORAGE_KEYS.settings(user.id), {
    imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 587,
    smtpUser: user.email, smtpPass: '', fromAliases: [], signatureHtml: '', signatureOn: true,
    sigPosition: 'below_reply', autoReadDelay: 2, confirmDelete: true, emailsPerPage: 25
  }));
  const [signature, setSignature] = useState(emailSettings.signatureHtml || `<p>Best regards,<br/>${user.name}<br/>${user.role} | ${user.dept}</p>`);
  const [testStatus, setTestStatus] = useState({ imap: null, smtp: null });

  const saveSettings = () => {
    saveToStorage(STORAGE_KEYS.settings(user.id), { ...emailSettings, signatureHtml: signature });
    alert('Settings saved!');
  };

  const testConnection = async (type) => {
    setTestStatus({ ...testStatus, [type]: 'testing' });
    await new Promise(r => setTimeout(r, 1500));
    setTestStatus({ ...testStatus, [type]: 'success' });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>←</button>
        <span style={{ fontWeight: 600, fontSize: 18 }}>My Profile</span>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
        {['profile', 'email_settings', 'signature', 'security'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
              color: activeTab === tab ? '#6366f1' : '#64748b', fontWeight: 500
            }}
          >
            {tab === 'email_settings' ? 'Email Settings' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        {activeTab === 'profile' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: user.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 600, margin: '0 auto 12px' }}>
                {user.avatar}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#64748b' }}>Full Name</label>
              <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} style={settingsInput} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#64748b' }}>Display Name</label>
              <input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} style={settingsInput} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#64748b' }}>Role</label>
              <input value={user.role} disabled style={{ ...settingsInput, background: '#f1f5f9' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#64748b' }}>Department</label>
              <input value={user.dept} disabled style={{ ...settingsInput, background: '#f1f5f9' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#64748b' }}>Email</label>
              <input value={user.email} disabled style={{ ...settingsInput, background: '#f1f5f9' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#64748b' }}>Phone</label>
              <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+1 (555) ___-____" style={settingsInput} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: '#64748b' }}>Timezone</label>
              <select value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} style={settingsInput}>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </select>
            </div>
            <button onClick={() => alert('Profile saved!')} style={sendBtn}>Save Changes</button>
          </div>
        )}

        {activeTab === 'email_settings' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>Incoming Mail (IMAP)</h4>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>IMAP Server</label>
                <input value={emailSettings.imapHost} onChange={(e) => setEmailSettings({ ...emailSettings, imapHost: e.target.value })} style={settingsInput} />
              </div>
              <div style={{ marginBottom: 12, display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Port</label>
                  <input value={emailSettings.imapPort} onChange={(e) => setEmailSettings({ ...emailSettings, imapPort: e.target.value })} style={settingsInput} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Username</label>
                <input value={emailSettings.smtpUser} onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })} style={settingsInput} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Password</label>
                <input type="password" value={emailSettings.smtpPass} onChange={(e) => setEmailSettings({ ...emailSettings, smtpPass: e.target.value })} style={settingsInput} />
              </div>
              <button onClick={() => testConnection('imap')} style={actionBtn}>
                {testStatus.imap === 'testing' ? '⟳ Testing...' : testStatus.imap === 'success' ? '✓ Connected' : 'Test IMAP Connection'}
              </button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>Outgoing Mail (SMTP)</h4>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>SMTP Server</label>
                <input value={emailSettings.smtpHost} onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })} style={settingsInput} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>Port</label>
                <input value={emailSettings.smtpPort} onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })} style={settingsInput} />
              </div>
              <button onClick={() => testConnection('smtp')} style={actionBtn}>
                {testStatus.smtp === 'testing' ? '⟳ Testing...' : testStatus.smtp === 'success' ? '✓ Connected' : 'Test SMTP Connection'}
              </button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ marginBottom: 12 }}>Preferences</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input type="checkbox" checked={emailSettings.confirmDelete} onChange={(e) => setEmailSettings({ ...emailSettings, confirmDelete: e.target.checked })} />
                Ask before deleting
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input type="checkbox" defaultChecked /> Ctrl+Enter to send
              </label>
            </div>

            <button onClick={saveSettings} style={sendBtn}>Save Email Settings</button>
          </div>
        )}

        {activeTab === 'signature' && (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" checked={emailSettings.signatureOn} onChange={(e) => setEmailSettings({ ...emailSettings, signatureOn: e.target.checked })} />
              Enable Signature
            </label>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
              <textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                style={{ width: '100%', minHeight: 150, border: 'none', outline: 'none', fontSize: 14, resize: 'vertical' }}
              />
            </div>
            <button onClick={saveSettings} style={{ ...sendBtn, marginTop: 16 }}>Save Signature</button>
          </div>
        )}

        {activeTab === 'security' && (
          <div>
            <h4 style={{ marginBottom: 16 }}>Change Password</h4>
            <input type="password" placeholder="Current Password" style={{ ...settingsInput, marginBottom: 12 }} />
            <input type="password" placeholder="New Password" style={{ ...settingsInput, marginBottom: 12 }} />
            <input type="password" placeholder="Confirm Password" style={{ ...settingsInput, marginBottom: 16 }} />
            <button style={sendBtn}>Update Password</button>
            <div style={{ marginTop: 24 }}>
              <h4>Active Sessions</h4>
              <div style={{ padding: 12, background: '#f1f5f9', borderRadius: 8, marginBottom: 12 }}>
                This Session — Chrome, Windows · Now
              </div>
              <button style={actionBtn}>Sign Out All Other Sessions</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const settingsInput = { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' };

const CRMEmailApp = () => {
  const [user, setUser] = useState(null);
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [emails, setEmails] = useState({ inbox: [], sent: [], drafts: [], archive: [], junk: [], trash: [] });
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');

  useEffect(() => {
    const session = loadFromStorage(STORAGE_KEYS.session, null);
    if (session) {
      const foundUser = CRM_USERS.find(u => u.id === session.userId);
      if (foundUser) setUser(foundUser);
    }
  }, []);

  useEffect(() => {
    if (user) {
      const inbox = loadFromStorage(STORAGE_KEYS.inbox(user.id), getSampleEmails(user, 'inbox'));
      const sent = loadFromStorage(STORAGE_KEYS.sent(user.id), []);
      const drafts = loadFromStorage(STORAGE_KEYS.drafts(user.id), []);
      const archive = loadFromStorage(STORAGE_KEYS.archive(user.id), []);
      const junk = loadFromStorage(STORAGE_KEYS.junk(user.id), []);
      const trash = loadFromStorage(STORAGE_KEYS.trash(user.id), []);
      setEmails({ inbox, sent, drafts, archive, junk, trash });
    }
  }, [user]);

  const login = (selectedUser) => {
    saveToStorage(STORAGE_KEYS.session, { userId: selectedUser.id, loginTime: Date.now() });
    setUser(selectedUser);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.session);
    setUser(null);
    setSelectedEmail(null);
    setShowComposer(false);
    setShowSettings(false);
  };

  const handleSend = (email) => {
    const sent = [...emails.sent, { ...email, folder: 'sent', isRead: true }];
    setEmails({ ...emails, sent });
    saveToStorage(STORAGE_KEYS.sent(user.id), sent);

    email.to.forEach(recipient => {
      const recipientUser = CRM_USERS.find(u => u.email === recipient.email);
      if (recipientUser) {
        const inbox = loadFromStorage(STORAGE_KEYS.inbox(recipientUser.id), []);
        const newInbox = [{ ...email, to: [recipient], folder: 'inbox', isRead: false, id: generateId() }, ...inbox];
        saveToStorage(STORAGE_KEYS.inbox(recipientUser.id), newInbox);
      }
    });

    setShowComposer(false);
    alert('✓ Sent successfully!');
  };

  const handleSaveDraft = (draft) => {
    const drafts = [...emails.drafts, { ...draft, folder: 'draft', createdAt: new Date().toISOString() }];
    setEmails({ ...emails, drafts });
    saveToStorage(STORAGE_KEYS.drafts(user.id), drafts);
  };

  const handleDelete = (emailId) => {
    const email = findEmail(emailId);
    if (!email) return;

    const newEmails = { ...emails };
    Object.keys(newEmails).forEach(folder => {
      newEmails[folder] = newEmails[folder].filter(e => e.id !== emailId);
    });
    newEmails.trash = [...newEmails.trash, { ...email, folder: 'trash' }];
    setEmails(newEmails);
    Object.keys(newEmails).forEach(folder => {
      saveToStorage(STORAGE_KEYS[folder](user.id), newEmails[folder]);
    });
    setSelectedEmail(null);
  };

  const handleStar = (emailId) => {
    const newEmails = { ...emails };
    Object.keys(newEmails).forEach(folder => {
      newEmails[folder] = newEmails[folder].map(e => e.id === emailId ? { ...e, isStarred: !e.isStarred } : e);
    });
    setEmails(newEmails);
    Object.keys(newEmails).forEach(folder => {
      saveToStorage(STORAGE_KEYS[folder](user.id), newEmails[folder]);
    });
  };

  const handleMove = (emailId, targetFolder) => {
    const email = findEmail(emailId);
    if (!email) return;

    const newEmails = { ...emails };
    Object.keys(newEmails).forEach(folder => {
      newEmails[folder] = newEmails[folder].filter(e => e.id !== emailId);
    });
    newEmails[targetFolder] = [...newEmails[targetFolder], { ...email, folder: targetFolder }];
    setEmails(newEmails);
    Object.keys(newEmails).forEach(folder => {
      saveToStorage(STORAGE_KEYS[folder](user.id), newEmails[folder]);
    });
    setSelectedEmail(null);
  };

  const findEmail = (id) => {
    for (const folder of Object.keys(emails)) {
      const found = emails[folder].find(e => e.id === id);
      if (found) return found;
    }
    return null;
  };

  const getUnreadCount = () => emails.inbox.filter(e => !e.isRead).length;
  const getDraftCount = () => emails.drafts.length;
  const getJunkCount = () => emails.junk.length;

  const filteredEmails = useMemo(() => {
    let list = emails[currentFolder] || [];
    if (filterTab === 'unread') list = list.filter(e => !e.isRead);
    if (filterTab === 'starred') list = list.filter(e => e.isStarred);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => 
        e.subject?.toLowerCase().includes(q) || 
        e.fromName?.toLowerCase().includes(q) ||
        e.body?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [emails, currentFolder, filterTab, searchQuery]);

  const renderSidebar = () => (
    <div style={{ width: 260, flexShrink: 0, background: '#1e293b', color: '#94a3b8', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 20 }}>
        <button onClick={() => setShowComposer(true)} style={{ width: '100%', padding: '12px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          ✉ Compose
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {[
          { id: 'inbox', icon: '📥', label: 'Inbox', badge: getUnreadCount() },
          { id: 'sent', icon: '📤', label: 'Sent' },
          { id: 'drafts', icon: '📝', label: 'Drafts', badge: getDraftCount() },
          { id: 'archive', icon: '🗂', label: 'Archive' },
          { id: 'junk', icon: '🚫', label: 'Junk', badge: getJunkCount() },
          { id: 'trash', icon: '🗑', label: 'Trash' },
        ].map(f => (
          <div
            key={f.id}
            onClick={() => { setCurrentFolder(f.id); setSelectedEmail(null); }}
            style={{
              padding: '10px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
              background: currentFolder === f.id ? '#334155' : 'transparent',
              color: currentFolder === f.id ? '#fff' : '#94a3b8'
            }}
          >
            <span>{f.icon}</span>
            <span style={{ flex: 1 }}>{f.label}</span>
            {f.badge > 0 && (
              <span style={{ background: f.id === 'inbox' ? '#3b82f6' : '#64748b', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 12 }}>
                {f.badge}
              </span>
            )}
          </div>
        ))}

        <div style={{ padding: '16px 20px', borderTop: '1px solid #334155', marginTop: 16 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', marginBottom: 8, color: '#64748b' }}>Labels</div>
          {['Urgent', 'Follow Up', 'Resolved'].map(l => (
            <div key={l} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: l === 'Urgent' ? '#dc2626' : l === 'Follow Up' ? '#f59e0b' : '#10b981' }} />
              {l}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 16, borderTop: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: user.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
            {user.avatar}
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>{user.name}</div>
            <div style={{ fontSize: 12 }}>{user.role}</div>
          </div>
        </div>
        <button onClick={() => setShowSettings(true)} style={{ width: '100%', padding: '8px', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
          ⚙ My Profile
        </button>
      </div>
    </div>
  );

  const renderList = () => (
    <div style={{ width: 340, flexShrink: 0, background: '#f8fafc', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #e2e8f0' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search emails..."
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {['all', 'unread', 'starred'].map(f => (
            <button
              key={f}
              onClick={() => setFilterTab(f)}
              style={{
                padding: '6px 12px', border: 'none', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                background: filterTab === f ? '#6366f1' : '#e2e8f0', color: filterTab === f ? '#fff' : '#64748b'
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {filteredEmails.map(email => (
          <div
            key={email.id}
            onClick={() => { setSelectedEmail(email); if (!email.isRead) { handleMarkRead(email.id); }}}
            style={{
              padding: '12px 16px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer',
              background: selectedEmail?.id === email.id ? '#eff6ff' : email.isRead ? '#fff' : '#fafafa',
              borderLeft: selectedEmail?.id === email.id ? '3px solid #3b82f6' : '3px solid transparent'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              {email.isStarred && <span style={{ marginRight: 6, color: '#fbbf24' }}>⭐</span>}
              <span style={{ flex: 1, fontWeight: email.isRead ? 500 : 700, fontSize: 14, color: '#1f293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentFolder === 'sent' ? email.to.map(t => t.name).join(', ') : email.fromName}
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {new Date(email.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div style={{ fontWeight: email.isRead ? 400 : 600, fontSize: 13, color: '#374151', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.subject}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.body?.replace(/<[^>]*>/g, '').substring(0, 60)}...
            </div>
          </div>
        ))}
        {filteredEmails.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>No emails found</div>
        )}
      </div>
    </div>
  );

  const handleMarkRead = (emailId) => {
    const newEmails = { ...emails };
    Object.keys(newEmails).forEach(folder => {
      newEmails[folder] = newEmails[folder].map(e => e.id === emailId ? { ...e, isRead: true } : e);
    });
    setEmails(newEmails);
    Object.keys(newEmails).forEach(folder => {
      saveToStorage(STORAGE_KEYS[folder](user.id), newEmails[folder]);
    });
  };

  const renderRight = () => {
    if (showComposer) {
      return (
        <div style={{ width: 840, height: 'calc(100vh - 32px)', background: 'white', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <EmailComposer user={user} onSend={handleSend} onClose={() => setShowComposer(false)} onSaveDraft={handleSaveDraft} />
        </div>
      );
    }
    if (showSettings) {
      return <div style={{ width: 840, height: 'calc(100vh - 32px)', background: 'white', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}><SettingsPage user={user} onBack={() => setShowSettings(false)} /></div>;
    }
    if (selectedEmail) {
      return (
        <div style={{ width: 840, height: 'calc(100vh - 32px)', background: 'white', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <EmailViewer
            email={selectedEmail}
            onBack={() => setSelectedEmail(null)}
            onReply={(e) => setShowComposer(true)}
            onReplyAll={(e) => setShowComposer(true)}
            onForward={(e) => setShowComposer(true)}
            onDelete={handleDelete}
            onStar={handleStar}
            onMove={handleMove}
          />
        </div>
      );
    }
    return (
      <div style={{ width: 840, height: 'calc(100vh - 32px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: 'white', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <div>Select an email to view</div>
        </div>
      </div>
    );
  };

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'DM Sans, sans-serif', width: '100%', overflow: 'hidden' }}>
      {renderSidebar()}
      {renderList()}
      <div style={{ flex: 1, minWidth: 900, display: 'flex', justifyContent: 'center', padding: 16, background: '#f8fafc', overflow: 'hidden' }}>
        {renderRight()}
      </div>
    </div>
  );
};

function getSampleEmails(user, folder) {
  const samples = [
    { fromName: 'Marcus Rivera', from: 'marcus.rivera@crm.com', subject: 'Q1 Sales Report', body: '<p>Hi team,</p><p>Please find attached the Q1 sales report.</p><p>Best,<br/>Marcus</p>', isStarred: false, isRead: false },
    { fromName: 'Priya Nair', from: 'priya.nair@crm.com', subject: 'Leave Request Approved', body: '<p>Your leave request has been approved.</p>', isStarred: true, isRead: true },
    { fromName: 'James Okonkwo', from: 'james.okonkwo@crm.com', subject: 'Project Update', body: '<p>The project is on track for delivery.</p>', isStarred: false, isRead: false },
    { fromName: 'Sofia Chen', from: 'sofia.chen@crm.com', subject: 'QA Review Summary', body: '<p>Here is the QA review summary for the latest release.</p>', isStarred: false, isRead: true },
  ];
  return samples.map((e, i) => ({ ...e, id: `sample_${i}`, folder, createdAt: new Date(Date.now() - i * 3600000).toISOString(), to: [{ name: user.name, email: user.email }], cc: [], bcc: [], attachments: [] }));
}

export default CRMEmailApp;