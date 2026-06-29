
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import EmailSidebar from './EmailSidebar';
import EmailList    from './EmailList';
import EmailViewer  from './EmailViewer';
import ComposeModal from './ComposeModal';
import { colors, generateId, getInitials, getRolePermissions } from './emailStyles';
import {
  getEmailByUserId, sendEmailViaSMTP, syncEmails as syncEmailsFromServer
} from '../../services/emailService';
import { decrypt } from '../../services/cryptoService';

/* ── Local storage helpers ─────────────────────────── */
const SK = (uid, k) => `zsm_email_v2_${uid}_${k}`;
const load = (uid, k, def) => { try { const d = localStorage.getItem(SK(uid, k)); return d ? JSON.parse(d) : def; } catch { return def; } };
const save = (uid, k, v) => { try { localStorage.setItem(SK(uid, k), JSON.stringify(v)); } catch {} };

/* ── Toast Component ───────────────────────────────── */
const Toast = ({ toasts, onDismiss }) => (
  <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 8 }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        background: t.type === 'error' ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${t.type === 'error' ? '#fca5a5' : '#86efac'}`,
        borderRadius: 8, padding: '10px 16px', fontSize: 13,
        color: t.type === 'error' ? '#dc2626' : '#16a34a',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', gap: 10, minWidth: 260,
        animation: 'toastIn 0.3s ease-out',
      }}>
        <span>{t.type === 'error' ? '⚠️' : '✅'}</span>
        <span style={{ flex: 1 }}>{t.message}</span>
        <span onClick={() => onDismiss(t.id)} style={{ cursor: 'pointer', opacity: 0.6 }}>×</span>
      </div>
    ))}
  </div>
);

/* ── Notification Dropdown ─────────────────────────── */
const NotifDropdown = ({ notifications, onClose }) => (
  <div style={{
    position: 'absolute', right: 0, top: 44, width: 320, background: colors.surface,
    border: `1px solid ${colors.border}`, borderRadius: 10, zIndex: 9990,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
  }}>
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, fontWeight: 600, fontSize: 14, color: colors.text }}>
      Notifications
    </div>
    {notifications.length === 0 ? (
      <div style={{ padding: 24, textAlign: 'center', color: colors.textMuted, fontSize: 13 }}>No new notifications</div>
    ) : notifications.slice(0, 8).map(n => (
      <div key={n.id} style={{
        padding: '10px 16px', borderBottom: `1px solid ${colors.borderLight}`,
        fontSize: 13, color: colors.textSecondary, cursor: 'pointer',
      }}
      onMouseEnter={e => e.currentTarget.style.background = colors.bg}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ fontWeight: 500, marginBottom: 2 }}>{n.title}</div>
        <div style={{ color: colors.textMuted }}>{n.message}</div>
      </div>
    ))}
  </div>
);

/* ── User Avatar Dropdown ──────────────────────────── */
const AvatarDropdown = ({ user, onNavigate, onLogout, onClose }) => (
  <div style={{
    position: 'absolute', right: 0, top: 44, width: 200, background: colors.surface,
    border: `1px solid ${colors.border}`, borderRadius: 10, zIndex: 9990,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
  }}>
    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${colors.border}` }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{user?.name}</div>
      <div style={{ fontSize: 12, color: colors.textMuted }}>{user?.email}</div>
    </div>
    {['Profile', 'Email Settings', 'Switch Account'].map(item => (
      <div key={item} onClick={() => { onNavigate(item); onClose(); }} style={{
        padding: '10px 16px', fontSize: 13, cursor: 'pointer', color: colors.textSecondary,
      }}
      onMouseEnter={e => e.currentTarget.style.background = colors.bg}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >{item}</div>
    ))}
    <div onClick={() => { onLogout(); onClose(); }} style={{
      padding: '10px 16px', fontSize: 13, cursor: 'pointer',
      color: colors.danger, borderTop: `1px solid ${colors.borderLight}`,
    }}
    onMouseEnter={e => e.currentTarget.style.background = colors.dangerBg}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >Sign Out</div>
  </div>
);

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
const OutlookEmailPage = () => {
  const { currentUser, logout, setActivePage,
          allNotifications, getUnreadNotificationsCount } = useApp();

  const uid = currentUser?.id || 'guest';
  const perms = getRolePermissions(currentUser?.role || '');

  // ── Email account from Canonical Storage (Single Source of Truth) ──
  const [emailAccount, setEmailAccount] = useState(null);
  useEffect(() => {
    if (!currentUser) return;
    
    const refreshAccount = () => {
      // Look for account by UUID OR by the user's email address as fallback
      const accounts = getEmailByUserId(currentUser.uuid || currentUser.id, currentUser.email);
      if (accounts && accounts.length > 0 && accounts[0]?.email) {
        setEmailAccount(accounts[0]);
      } else {
        // Demo mode: Use shared demo email for non-admin users when no account configured
        const demoAccount = {
          id: 'demo_account',
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          email: 'admin@zsmeservices.com',
          password: 'Admin#2026@zsm',
          isDemo: true,
          imapStatus: 'connected',
          smtpStatus: 'connected',
          active: true
        };
        setEmailAccount(demoAccount);
      }
    };

    refreshAccount();
    
    // Listen for storage changes (e.g. from Admin or Profile updates)
    window.addEventListener('storage', refreshAccount);
    const interval = setInterval(refreshAccount, 5000); // Polling as secondary sync
    
    return () => {
      window.removeEventListener('storage', refreshAccount);
      clearInterval(interval);
    };
  }, [currentUser]);

  // ── State ──────────────────────────────────────────
  const [emails, setEmails]           = useState(() => load(uid, 'emails', []));
  const [templates]                   = useState(() => load(uid, 'templates', []));
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState(null);
  const [isSyncing, setIsSyncing]     = useState(false);
  const [toasts, setToasts]           = useState([]);
  const [notifOpen, setNotifOpen]     = useState(false);
  const [avatarOpen, setAvatarOpen]   = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef();

  // Persist emails on change
  useEffect(() => { save(uid, 'emails', emails); }, [uid, emails]);

  // ── Toast helpers ──────────────────────────────────
  const addToast = useCallback((message, type = 'success') => {
    const id = generateId();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);

  // ── Sync ───────────────────────────────────────────
  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    if (!emailAccount) {
      addToast('No email account configured. Go to Email Configuration to set up your account.', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      // Demo accounts have plain text passwords
      const password = emailAccount.isDemo ? emailAccount.password : decrypt(emailAccount.password);
      const result = await syncEmailsFromServer({ ...emailAccount, password, userId: uid });
      const newEmails = [
        ...(result.inbox || []).map(m => ({
          id: `in_${m.id}_${uid}`, userId: uid,
          fromEmail: m.fromEmail || m.from, fromName: m.fromEmail || m.from,
          subject: m.subject, body: m.body || '',
          preview: (m.body || m.subject || '').replace(/<[^>]*>/g, '').substring(0, 80),
          type: 'inbox', status: 'unread', isStarred: false,
          createdAt: m.createdAt || m.date || new Date().toISOString(),
        })),
        ...(result.sent || []).map(m => ({
          id: `sent_${m.id}_${uid}`, userId: uid,
          fromEmail: emailAccount.email, toEmail: m.toEmail || m.to,
          subject: m.subject, body: m.body || '',
          preview: (m.body || m.subject || '').replace(/<[^>]*>/g, '').substring(0, 80),
          type: 'sent', status: 'sent', isStarred: false,
          createdAt: m.createdAt || m.date || new Date().toISOString(),
        })),
      ];
      if (newEmails.length > 0) {
        setEmails(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          return [...newEmails.filter(e => !existingIds.has(e.id)), ...prev];
        });
        addToast(`Synced ${result.inbox?.length || 0} inbox, ${result.sent?.length || 0} sent emails`);
      } else {
        addToast('Inbox is up to date');
      }
    } catch (err) {
      addToast('Sync failed: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, emailAccount, uid, addToast]);

  // ── Filtered emails ────────────────────────────────
  const filteredEmails = useMemo(() => {
    let list = [...emails];

    if (activeFolder === 'inbox')      list = list.filter(e => e.type === 'inbox' && e.status !== 'trash');
    else if (activeFolder === 'sent')  list = list.filter(e => e.type === 'sent');
    else if (activeFolder === 'drafts') list = list.filter(e => e.type === 'draft');
    else if (activeFolder === 'trash') list = list.filter(e => e.status === 'trash');
    else if (activeFolder === 'starred' || activeFolder === 'flagged') list = list.filter(e => e.isStarred && e.status !== 'trash');
    else if (activeFolder === 'templates') return templates;
    else if (activeFolder === 'archive') list = list.filter(e => e.status === 'archived');
    else if (activeFolder === 'spam')  list = list.filter(e => e.status === 'spam');
    else if (activeFolder === 'important') list = list.filter(e => e.isImportant && e.status !== 'trash');
    else if (activeFolder === 'scheduled') list = list.filter(e => e.scheduledAt);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        (e.subject || '').toLowerCase().includes(q) ||
        (e.fromName || '').toLowerCase().includes(q) ||
        (e.fromEmail || '').toLowerCase().includes(q) ||
        (e.body || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [emails, templates, activeFolder, searchQuery]);

  // ── Folder counts ──────────────────────────────────
  const counts = useMemo(() => ({
    inbox:     emails.filter(e => e.type === 'inbox' && e.status === 'unread').length,
    drafts:    emails.filter(e => e.type === 'draft').length,
    templates: templates.length,
  }), [emails, templates]);

  const notifCount  = getUnreadNotificationsCount ? getUnreadNotificationsCount(uid) : 0;

  // ── Email actions ──────────────────────────────────
  const handleSelectEmail = useCallback((email) => {
    if (email.toggleStar) {
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isStarred: !e.isStarred } : e));
      return;
    }
    if (email.type === 'draft') {
      setComposeData(email);
      setComposeOpen(true);
      return;
    }
    // Mark as read
    if (email.status === 'unread') {
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, status: 'read' } : e));
    }
    setSelectedEmail({ ...email, status: email.status === 'unread' ? 'read' : email.status });
  }, []);

  const handleDelete = useCallback((ids) => {
    const idSet = Array.isArray(ids) ? new Set(ids) : new Set([ids.id]);
    setEmails(prev => prev.map(e => idSet.has(e.id)
      ? (e.status === 'trash' ? null : { ...e, status: 'trash' })
      : e
    ).filter(Boolean));
    if (selectedEmail && idSet.has(selectedEmail.id)) setSelectedEmail(null);
    addToast(`${idSet.size} email(s) moved to trash`);
  }, [selectedEmail, addToast]);

  const handleArchive = useCallback((ids) => {
    const idSet = new Set(ids);
    setEmails(prev => prev.map(e => idSet.has(e.id) ? { ...e, status: 'archived' } : e));
    addToast(`${ids.length} email(s) archived`);
  }, [addToast]);

  const handleMarkUnread = useCallback((ids) => {
    const idSet = new Set(ids);
    setEmails(prev => prev.map(e => idSet.has(e.id) ? { ...e, status: 'unread' } : e));
  }, []);

  const handleStar = useCallback((email) => {
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isStarred: !e.isStarred } : e));
    setSelectedEmail(prev => prev?.id === email.id ? { ...prev, isStarred: !prev.isStarred } : prev);
  }, []);

  const handleReply = useCallback((email) => {
    setComposeData({
      to: email.fromEmail, isReply: true,
      subject: email.subject?.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `<br><br><hr><div style="color:#6b7280;font-size:13px">From: ${email.fromName || email.fromEmail}<br>Date: ${new Date(email.createdAt).toLocaleString()}</div><br>${email.body || ''}`,
    });
    setComposeOpen(true);
  }, []);

  const handleForward = useCallback((email) => {
    setComposeData({
      to: '', isForward: true,
      subject: email.subject?.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `<br><br><hr><div style="color:#6b7280;font-size:13px">---------- Forwarded message ----------<br>From: ${email.fromName || email.fromEmail}<br>Subject: ${email.subject}</div><br>${email.body || ''}`,
    });
    setComposeOpen(true);
  }, []);

  const handleSend = useCallback(async (emailData, draftId) => {
    if (!emailAccount) {
      throw new Error('No email account configured. Please go to Email Configuration to set up your account.');
    }
    try {
      const password = emailAccount.isDemo ? emailAccount.password : decrypt(emailAccount.password);
      await sendEmailViaSMTP(
        { ...emailAccount, password, name: currentUser?.name || emailAccount.email },
        emailData.to,
        emailData.subject,
        emailData.body || '',
        emailData.attachments || []
      );
      const sent = {
        id: generateId(), userId: uid,
        fromEmail: emailAccount.email, fromName: currentUser?.name,
        toEmail: emailData.to, cc: emailData.cc, bcc: emailData.bcc,
        subject: emailData.subject, body: emailData.body,
        preview: (emailData.body || '').replace(/<[^>]*>/g, '').substring(0, 80),
        type: 'sent', status: 'sent', isStarred: false,
        hasAttachments: (emailData.attachments || []).length > 0,
        attachments: emailData.attachments,
        createdAt: new Date().toISOString(),
      };
      
      setEmails(prev => {
        let filtered = prev;
        if (draftId) {
          filtered = prev.filter(e => e.id !== draftId);
        }
        return [sent, ...filtered];
      });
      
      addToast('Email sent successfully! ✉️');
    } catch (err) {
      throw new Error(err.message);
    }
  }, [uid, currentUser, emailAccount, addToast]);

  const handleSaveDraft = useCallback((draftData) => {
    let draftId = draftData.id;
    if (!draftId) {
      draftId = `draft_${generateId()}`;
    }

    const toStr = Array.isArray(draftData.to) ? draftData.to.join(', ') : (draftData.to || '');
    const ccStr = Array.isArray(draftData.cc) ? draftData.cc.join(', ') : (draftData.cc || '');
    const bccStr = Array.isArray(draftData.bcc) ? draftData.bcc.join(', ') : (draftData.bcc || '');

    const draft = {
      id: draftId,
      userId: uid,
      fromEmail: currentUser?.email || emailAccount?.email,
      fromName: currentUser?.name,
      toEmail: toStr,
      cc: ccStr,
      bcc: bccStr,
      subject: draftData.subject || '(No Subject)',
      body: draftData.body || '',
      preview: (draftData.body || '').replace(/<[^>]*>/g, '').substring(0, 80) || '(No content)',
      type: 'draft',
      status: 'draft',
      isStarred: false,
      hasAttachments: (draftData.attachments || []).length > 0,
      attachments: draftData.attachments || [],
      createdAt: new Date().toISOString(),
    };

    setEmails(prev => {
      const idx = prev.findIndex(e => e.id === draftId);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...draft, createdAt: updated[idx].createdAt };
        return updated;
      } else {
        return [draft, ...prev];
      }
    });

    return draft;
  }, [uid, currentUser, emailAccount]);

  const handleDiscardDraft = useCallback((draftId) => {
    if (draftId) {
      setEmails(prev => prev.filter(e => e.id !== draftId));
      addToast('Draft discarded successfully');
    }
  }, [addToast]);

  const handleCompose = useCallback(() => {
    if (!perms.canComposeExternal && activeFolder !== 'drafts') {
      addToast('Agents can only reply to assigned contacts', 'error');
      return;
    }
    setComposeData(null);
    setComposeOpen(true);
  }, [perms.canComposeExternal, activeFolder, addToast]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = () => { setNotifOpen(false); setAvatarOpen(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const initials = getInitials(currentUser?.name || '');

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: colors.bg,
      fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* ── NO ACCOUNT BANNER ──────────────────────────── */}
      {emailAccount?.isDemo && (
        <div style={{
          background: '#dbeafe', borderBottom: '1px solid #3b82f6',
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <span>ℹ️</span>
          <span style={{ fontSize: 13, color: '#1e40af', flex: 1 }}>
            <strong>Demo Mode:</strong> Using shared email account. Contact Admin to configure your own email account.
          </span>
        </div>
      )}

      {/* ── HEADER BAR ────────────────────────────────── */}
      <div style={{
        height: 65, background: colors.surface, borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
        zIndex: 100, position: 'sticky', top: 0, flexShrink: 0,
      }}>
        {/* Left group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill={colors.primaryDark}/>
              <text x="14" y="19" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="sans-serif">Z</text>
            </svg>
            <span style={{ fontSize: 17, fontWeight: 700, color: colors.primaryDark, letterSpacing: '-0.3px' }}>
              ZSM Mail
            </span>
            {emailAccount && (
              <span style={{ fontSize: 11, color: colors.textMuted, marginLeft: 6, fontWeight: 400 }}>
                ({emailAccount.email})
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, fontSize: 18, color: colors.textMuted }}
            title="Toggle sidebar"
          >☰</button>
        </div>

        {/* Center: Search */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: 550 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: colors.textMuted, fontSize: 15, pointerEvents: 'none' }}>🔍</span>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search mail, contacts, files..."
              style={{
                width: '100%', height: 42, paddingLeft: 38, paddingRight: 16,
                border: `1px solid ${searchFocused ? colors.primary : colors.border}`,
                borderRadius: 8, fontSize: 14, background: '#f9fafb',
                outline: 'none', boxSizing: 'border-box',
                boxShadow: searchFocused ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
                transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
                color: colors.text,
              }}
            />
          </div>
        </div>

        {/* Right group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={handleSync} title="Refresh" style={hdrBtn}>
            <span style={{ display: 'inline-block', animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
          </button>
          <button title="Filter" style={hdrBtn}>🔽</button>

          {/* Notification bell */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { setNotifOpen(o => !o); setAvatarOpen(false); }} style={hdrBtn}>
              🔔
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2, width: 16, height: 16,
                  background: colors.danger, color: 'white', borderRadius: '50%',
                  fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                }}>
                  {Math.min(notifCount, 9)}
                </span>
              )}
            </button>
            {notifOpen && (
              <NotifDropdown
                notifications={allNotifications?.filter(n => n.userId === uid) || []}
                onClose={() => setNotifOpen(false)}
              />
            )}
          </div>

          <button onClick={() => setActivePage('email_config')} title="Email Settings" style={hdrBtn}>⚙️</button>

          {/* User avatar */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setAvatarOpen(o => !o); setNotifOpen(false); }}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: colors.primaryBg, color: colors.primaryDark,
                fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {initials}
            </button>
            {avatarOpen && (
              <AvatarDropdown
                user={currentUser}
                onNavigate={item => {
                  if (item === 'Profile') setActivePage('profile');
                  if (item === 'Email Settings') setActivePage('email_config');
                }}
                onLogout={logout}
                onClose={() => setAvatarOpen(false)}
              />
            )}
          </div>

          {/* Back to CRM */}
          <button
            onClick={() => setActivePage('dashboard')}
            style={{ ...hdrBtn, fontSize: 12, padding: '0 10px', width: 'auto', color: colors.primaryDark, fontWeight: 600 }}
          >
            ← CRM
          </button>
        </div>
      </div>

      {/* ── THREE-COLUMN BODY ────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LEFT SIDEBAR */}
        <EmailSidebar
          activeFolder={activeFolder}
          onFolderSelect={f => { setActiveFolder(f); setSelectedEmail(null); }}
          onCompose={handleCompose}
          counts={counts}
          collapsed={!sidebarOpen}
        />

        {/* CENTER: EMAIL LIST */}
        <EmailList
          emails={filteredEmails}
          selectedId={selectedEmail?.id}
          onSelect={handleSelectEmail}
          activeFolder={activeFolder}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onMarkUnread={handleMarkUnread}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* RIGHT: EMAIL VIEWER */}
        <EmailViewer
          email={selectedEmail}
          onReply={handleReply}
          onReplyAll={handleReply}
          onForward={handleForward}
          onDelete={e => handleDelete([e.id])}
          onStar={handleStar}
        />
      </div>

      {/* ── COMPOSE MODAL ────────────────────────────── */}
      {composeOpen && (
        <ComposeModal
          initialData={composeData}
          onSend={handleSend}
          onSaveDraft={handleSaveDraft}
          onDiscardDraft={handleDiscardDraft}
          onClose={() => { setComposeOpen(false); setComposeData(null); }}
        />
      )}

      {/* ── TOASTS ───────────────────────────────────── */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes toastIn { from { transform: translateX(60px); opacity:0; } to { transform: translateX(0); opacity:1; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>
    </div>
  );
};

const hdrBtn = {
  width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer',
  borderRadius: 6, fontSize: 16, color: colors.textMuted, position: 'relative',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.1s',
};

export default OutlookEmailPage;
