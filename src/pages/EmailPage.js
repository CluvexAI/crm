import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  connectSocket,
  disconnectSocket,
  fetchInbox,
  fetchSent,
  fetchDrafts,
  syncImapInbox,
  sendLiveMail,
  saveDraftToServer,
  deleteMail,
  markAsRead,
  toggleStar,
} from '../services/liveMailService';

const generateId = () => `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getStorageKey = (userId, key) => `crm_email_${userId}_${key}`;

const loadFromStorage = (userId, key, defaultValue) => {
  try {
    const data = localStorage.getItem(getStorageKey(userId, key));
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = (userId, key, value) => {
  localStorage.setItem(getStorageKey(userId, key), JSON.stringify(value));
};

const EmailListItem = ({ email, isSelected, onClick }) => {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #e5e7eb',
        cursor: 'pointer',
        background: isSelected ? '#eff6ff' : email.status === 'unread' ? '#fafafa' : 'white',
        borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
        transition: 'background 0.15s'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        {email.isStarred && <span style={{ marginRight: 6, color: '#fbbf24' }}>⭐</span>}
        <span style={{
          fontWeight: email.status === 'unread' ? 700 : 500,
          fontSize: 14,
          color: '#1f2937',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {email.type === 'inbox' ? email.fromName : email.toEmail}
        </span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          {formatDate(email.createdAt)}
        </span>
      </div>
      <div style={{
        fontWeight: email.status === 'unread' ? 600 : 400,
        fontSize: 13,
        color: '#374151',
        marginBottom: 4,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {email.subject}
      </div>
      <div style={{
        fontSize: 12,
        color: '#6b7280',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {email.preview || email.body.substring(0, 80)}
      </div>
      {email.hasAttachments && (
        <span style={{ fontSize: 11, color: '#6b7280', marginTop: 4, display: 'inline-block' }}>
          📎 Attachment
        </span>
      )}
    </div>
  );
};

const EmailView = ({ email, onBack, onReply, onDelete, onStar, onForward }) => {
  if (!email) {
    return null;
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            color: '#374151'
          }}
        >
          ← Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onStar(email)} title="Star" style={{
            padding: '8px 12px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14
          }}>
            {email.isStarred ? '⭐' : '☆'}
          </button>
          <button onClick={() => onReply(email)} title="Reply" style={{
            padding: '8px 12px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14
          }}>
            ↩️ Reply
          </button>
          <button onClick={() => onForward(email)} title="Forward" style={{
            padding: '8px 12px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14
          }}>
            ↪️ Forward
          </button>
          <button onClick={() => onDelete(email)} title="Delete" style={{
            padding: '8px 12px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            color: '#dc2626'
          }}>
            🗑️
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', marginBottom: 16 }}>
          {email.subject}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
            fontSize: 14,
            fontWeight: 600,
            color: '#374151'
          }}>
            {email.type === 'inbox' ? email.fromName.split(' ').map(n => n[0]).join('') : 'ME'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937' }}>
              {email.type === 'inbox' ? email.fromName : `To: ${email.toEmail}`}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {email.type === 'inbox' ? `From: ${email.fromEmail}` : email.toEmail}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            {formatDate(email.createdAt)}
          </div>
        </div>

        {email.hasAttachments && (
          <div style={{ marginBottom: 16, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>📎 Attachments</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              document.pdf (245 KB)
            </div>
          </div>
        )}

        <div style={{ fontSize: 14, lineHeight: 1.6, color: '#374151', whiteSpace: 'pre-wrap' }}>
          {email.body}
        </div>
      </div>
    </div>
  );
};

const EmailComposer = ({ onSend, onCancel, initialData = null }) => {
  const [to, setTo] = useState(initialData?.to || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [body, setBody] = useState(initialData?.body || '');
  const [isHtml, setIsHtml] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to || !subject) {
      alert('Please fill in recipient and subject');
      return;
    }
    setSending(true);
    await new Promise(r => setTimeout(r, 500));
    onSend({ to, cc, subject, body: body || subject, isHtml });
    setSending(false);
  };

  const handleSaveDraft = () => {
    if (!subject && !body) {
      alert('Nothing to save');
      return;
    }
    onCancel({ type: 'draft', to, cc, subject, body });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'white' }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
          {initialData?.isReply ? '↩️ Reply' : initialData?.isForward ? '↪️ Forward' : '✉️ New Email'}
        </span>
        <button
          onClick={() => onCancel(null)}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: '#f3f4f6',
            cursor: 'pointer',
            fontSize: 16
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <label style={{ width: 50, fontSize: 13, color: '#6b7280', fontWeight: 500 }}>To:</label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@email.com"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <label style={{ width: 50, fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Cc:</label>
          <input
            type="text"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="cc@email.com"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ width: 50, fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Sub:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => setIsHtml(!isHtml)}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              background: isHtml ? '#eff6ff' : 'white',
              cursor: 'pointer',
              marginRight: 8
            }}
          >
            {isHtml ? 'Rich Text' : 'Plain Text'}
          </button>
        </div>
        {isHtml ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="<p>Write your email...</p>"
            style={{
              flex: 1,
              padding: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              resize: 'none',
              fontFamily: 'monospace'
            }}
          />
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            style={{
              flex: 1,
              padding: 12,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              resize: 'none'
            }}
          />
        )}
      </div>

      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={handleSaveDraft}
          style={{
            padding: '8px 16px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            color: '#374151'
          }}
        >
          💾 Save Draft
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onCancel(null)}
            style={{
              padding: '8px 16px',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              color: '#374151'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              padding: '8px 20px',
              background: sending ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: 6,
              cursor: sending ? 'not-allowed' : 'pointer',
              fontSize: 13,
              color: 'white',
              fontWeight: 500
            }}
          >
            {sending ? 'Sending...' : '📤 Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

const TemplateEditor = ({ template, onSave, onCancel, onUse }) => {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [body, setBody] = useState(template?.body || '');

  const handleSave = () => {
    if (!name || !subject) {
      alert('Please fill in template name and subject');
      return;
    }
    onSave({ ...template, name, subject, body });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'white' }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#1f2937' }}>
          {template?.id ? '✏️ Edit Template' : '➕ New Template'}
        </span>
        <button
          onClick={onCancel}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: '#f3f4f6',
            cursor: 'pointer',
            fontSize: 16
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: 20, flex: 1, overflow: 'auto' }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
            Template Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Welcome Email, Follow-up"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
            Subject Line
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}>
            Body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Template content..."
            style={{ width: '100%', height: 200, padding: 12, border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 14, resize: 'vertical' }}
          />
        </div>

        <div style={{ fontSize: 12, color: '#6b7280', padding: 12, background: '#f9fafb', borderRadius: 6 }}>
          💡 Tip: Use variables like {'{{name}}'}, {'{{company}}'}, {'{{date}}'} for personalization
        </div>
      </div>

      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8
      }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            color: '#374151'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '8px 20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            color: 'white',
            fontWeight: 500
          }}
        >
          💾 Save Template
        </button>
      </div>
    </div>
  );
};

const EmailPage = () => {
  const { currentUser } = useApp();
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [showComposer, setShowComposer] = useState(false);
  const [composerData, setComposerData] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveEmails, setLiveEmails] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const syncRef = useRef(false);

  const emails = liveEmails;

  // Socket + initial load
  useEffect(() => {
    if (!currentUser) return;
    const uid = String(currentUser.id);

    // Real-time socket
    connectSocket(
      uid,
      (email) => setLiveEmails(prev => {
        if (prev.find(e => e.id === email.id)) return prev;
        return [email, ...prev];
      }),
      (email) => setLiveEmails(prev => {
        if (prev.find(e => e.id === email.id)) return prev;
        return [email, ...prev];
      }),
      (id) => setLiveEmails(prev => prev.map(e => e.id === id ? { ...e, status: 'read' } : e))
    );

    // Initial load from server store
    const loadAll = async () => {
      const [inbox, sent, drafts] = await Promise.all([
        fetchInbox(uid),
        fetchSent(uid),
        fetchDrafts(uid),
      ]);
      setLiveEmails([...inbox, ...sent, ...drafts]);
    };
    loadAll();

    // IMAP sync (only if user has email configured)
    let emailConfig = null;
    try {
      const { getEmailByUserId } = require('../services/emailService');
      const accounts = getEmailByUserId(uid, currentUser?.email);
      emailConfig = accounts && accounts.length > 0 ? accounts[0] : null;
    } catch (e) { console.error(e); }
    if (emailConfig?.email && emailConfig?.password && !syncRef.current) {
      syncRef.current = true;
      setSyncing(true);
      syncImapInbox(emailConfig, uid)
        .then(() => fetchInbox(uid))
        .then(inbox => setLiveEmails(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const newOnes = inbox.filter(e => !existingIds.has(e.id));
          return newOnes.length ? [...newOnes, ...prev] : prev;
        }))
        .catch(e => console.warn('[EmailPage] IMAP sync:', e.message))
        .finally(() => setSyncing(false));
    }

    return () => disconnectSocket();
  }, [currentUser]);

  const folderCounts = useMemo(() => {
    const userEmails = emails;
    return {
      inbox: userEmails.filter(e => e.type === 'inbox' && e.status !== 'trash').length,
      unread: userEmails.filter(e => e.type === 'inbox' && e.status === 'unread').length,
      sent: userEmails.filter(e => e.type === 'sent').length,
      drafts: userEmails.filter(e => e.type === 'draft').length,
      templates: loadFromStorage(currentUser?.id, 'templates', []).length,
      trash: userEmails.filter(e => e.status === 'trash').length,
    };
  }, [emails, currentUser]);

  const filteredEmails = useMemo(() => {
    if (!currentUser) return [];
    let userEmails = emails;
    
    if (activeFolder === 'inbox') {
      userEmails = userEmails.filter(e => e.type === 'inbox' && e.status !== 'trash');
    } else if (activeFolder === 'sent') {
      userEmails = userEmails.filter(e => e.type === 'sent');
    } else if (activeFolder === 'drafts') {
      userEmails = userEmails.filter(e => e.type === 'draft');
    } else if (activeFolder === 'trash') {
      userEmails = userEmails.filter(e => e.status === 'trash');
    } else if (activeFolder === 'starred') {
      userEmails = userEmails.filter(e => e.isStarred && e.status !== 'trash');
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      userEmails = userEmails.filter(e => 
        e.subject.toLowerCase().includes(q) ||
        e.fromName?.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q)
      );
    }
    
    return userEmails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [emails, currentUser, activeFolder, searchQuery]);

  const handleSendEmail = async (emailData) => {
    if (!currentUser) return;
    let emailConfig = null;
    try {
      const { getEmailByUserId } = await import('../services/emailService');
      const uid = currentUser?.uuid || currentUser?.id;
      const accounts = getEmailByUserId(uid, currentUser?.email);
      emailConfig = accounts && accounts.length > 0 ? accounts[0] : null;
    } catch (e) { console.error(e); }
    if (!emailConfig?.email || !emailConfig?.password) {
      alert('Please configure your email account first in Profile → Email Settings.');
      return;
    }
    try {
      await sendLiveMail(emailConfig, String(currentUser.id), {
        to: emailData.to,
        cc: emailData.cc || undefined,
        subject: emailData.subject,
        text: emailData.body,
        html: emailData.isHtml ? emailData.body : `<div style="font-family:sans-serif;white-space:pre-wrap">${emailData.body}</div>`,
      });
      // Refresh sent
      fetchSent(String(currentUser.id)).then(sent =>
        setLiveEmails(prev => [...prev.filter(e => e.type !== 'sent'), ...sent])
      );
    } catch (error) {
      alert('Send failed: ' + error.message);
      console.error('Send email error:', error);
    }
    setActiveFolder('sent');
    setShowComposer(false);
    setComposerData(null);
  };

  const handleSaveDraft = async (draftData) => {
    if (!currentUser) return;
    const draft = {
      id: draftData.id || generateId(),
      userId: String(currentUser.id),
      fromEmail: currentUser.email || '',
      fromName: currentUser.name || '',
      toEmail: draftData.to || '',
      cc: draftData.cc || '',
      subject: draftData.subject || '(No Subject)',
      body: draftData.body || '',
      preview: (draftData.body || '').substring(0, 60) || '(No content)',
      type: 'draft',
      status: 'draft',
      hasAttachments: false,
      isStarred: false,
      createdAt: new Date().toISOString(),
    };
    const saved = await saveDraftToServer(String(currentUser.id), draft);
    if (saved) {
      setLiveEmails(prev => {
        const exists = prev.findIndex(e => e.id === saved.id);
        if (exists >= 0) { const n = [...prev]; n[exists] = saved; return n; }
        return [saved, ...prev];
      });
    }
    setShowComposer(false);
    setComposerData(null);
    setActiveFolder('drafts');
  };

  const handleDeleteEmail = async (email) => {
    if (!currentUser) return;
    if (email.status === 'trash') {
      if (!window.confirm('Permanently delete this email?')) return;
    }
    await deleteMail(String(currentUser.id), email.id);
    if (email.status === 'trash') {
      setLiveEmails(prev => prev.filter(e => e.id !== email.id));
    } else {
      setLiveEmails(prev => prev.map(e => e.id === email.id ? { ...e, status: 'trash' } : e));
    }
    setSelectedEmail(null);
    setViewMode('list');
  };

  const handleStarEmail = async (email) => {
    if (!currentUser) return;
    await toggleStar(String(currentUser.id), email.id);
    setLiveEmails(prev => prev.map(e => e.id === email.id ? { ...e, isStarred: !e.isStarred } : e));
  };

  const handleReply = (email) => {
    setComposerData({
      to: email.fromEmail,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- Original Message ---\nFrom: ${email.fromName}\nDate: ${new Date(email.createdAt).toLocaleString()}\n\n${email.body}`,
      isReply: true
    });
    setShowComposer(true);
    setViewMode('compose');
  };

  const handleForward = (email) => {
    setComposerData({
      to: '',
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n--- Forwarded Message ---\nFrom: ${email.fromName}\nSubject: ${email.subject}\n\n${email.body}`,
      isForward: true
    });
    setShowComposer(true);
    setViewMode('compose');
  };

  const handleMarkAsRead = async (email) => {
    if (!currentUser || email.status !== 'unread') return;
    await markAsRead(String(currentUser.id), email.id);
    setLiveEmails(prev => prev.map(e => e.id === email.id ? { ...e, status: 'read' } : e));
  };

  const handleSaveTemplate = (template) => {
    if (!currentUser) return;
    const templates = loadFromStorage(currentUser.id, 'templates', []);
    const existing = templates.findIndex(t => t.id === template.id);
    if (existing >= 0) {
      templates[existing] = { ...template, updatedAt: new Date().toISOString() };
    } else {
      templates.push({ ...template, id: generateId(), createdAt: new Date().toISOString() });
    }
    saveToStorage(currentUser.id, 'templates', templates);
    setShowTemplateEditor(false);
    setEditingTemplate(null);
  };

  const handleUseTemplate = (template) => {
    setComposerData({
      to: '',
      subject: template.subject,
      body: template.body,
      isReply: false
    });
    setShowComposer(true);
    setViewMode('compose');
  };

  const handleDeleteTemplate = (templateId) => {
    if (!currentUser) return;
    if (window.confirm('Delete this template?')) {
      const templates = loadFromStorage(currentUser.id, 'templates', []);
      const filtered = templates.filter(t => t.id !== templateId);
      saveToStorage(currentUser.id, 'templates', filtered);
    }
  };

  if (!currentUser) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 20
      }}>
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: 40,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📧</div>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Email Module</h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
            Please log in to the CRM first to access your email.
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af' }}>
            Go to My Profile → Email Settings to configure your email account.
          </p>
        </div>
      </div>
    );
  }

  const renderMainContent = () => {
    if (showTemplateEditor) {
      return (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => { setShowTemplateEditor(false); setEditingTemplate(null); }}
        />
      );
    }

    if (viewMode === 'view' && selectedEmail) {
      return null;
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails..."
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: 13
            }}
          />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredEmails.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9ca3af'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <div style={{ fontSize: 16, marginBottom: 8 }}>No emails</div>
              <div style={{ fontSize: 13 }}>
                {activeFolder === 'inbox' && 'Your inbox is empty'}
                {activeFolder === 'sent' && 'No sent emails'}
                {activeFolder === 'drafts' && 'No saved drafts'}
                {activeFolder === 'starred' && 'No starred emails'}
                {activeFolder === 'trash' && 'Trash is empty'}
              </div>
            </div>
          ) : (
            filteredEmails.map(email => (
              <EmailListItem
                key={email.id}
                email={email}
                isSelected={selectedEmail?.id === email.id}
                onClick={() => {
                  setSelectedEmail(email);
                  setViewMode('view');
                  handleMarkAsRead(email);
                }}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f3f4f6' }}>
      <div style={{
        padding: '12px 20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24 }}>📧</div>
          <div>
            <div style={{ color: 'white', fontSize: 16, fontWeight: 600 }}>CRM Email</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{currentUser?.department} • {currentUser?.role}{syncing ? ' • 🔄 Syncing...' : ' • 🟢 Live'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'white' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: currentUser?.color || '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 600,
              color: 'white'
            }}>
              {currentUser?.name?.split(' ').map(n => n[0]).join('') || 'U'}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{currentUser?.name}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{currentUser?.email}</div>
            </div>
          </div>
        </div>
      </div>

<div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{
            width: 220,
            background: 'white',
            borderRight: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: 16 }}>
              <button
                onClick={() => { setShowComposer(true); setViewMode('compose'); setComposerData(null); }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ✉️ Compose
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
              {[
                { id: 'inbox', icon: '📥', label: 'Inbox' },
                { id: 'sent', icon: '📤', label: 'Sent' },
                { id: 'drafts', icon: '📝', label: 'Drafts' },
                { id: 'starred', icon: '⭐', label: 'Starred' },
                { id: 'trash', icon: '🗑️', label: 'Trash' },
              ].map(folder => (
                <div
                  key={folder.id}
                  onClick={() => { setActiveFolder(folder.id); setViewMode('list'); setSelectedEmail(null); }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 2,
                    background: activeFolder === folder.id ? '#eff6ff' : 'transparent',
                    color: activeFolder === folder.id ? '#3b82f6' : '#374151'
                  }}
                >
                  <span style={{ marginRight: 10, fontSize: 16 }}>{folder.icon}</span>
                  <span style={{ flex: 1, fontSize: 14, fontWeight: activeFolder === folder.id ? 600 : 400 }}>
                    {folder.label}
                  </span>
                  {folder.id === 'inbox' && folderCounts.unread > 0 && (
                    <span style={{
                      background: '#ef4444',
                      color: 'white',
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 10,
                      fontWeight: 600
                    }}>
                      {folderCounts.unread}
                    </span>
                  )}
                  {folder.id !== 'inbox' && folderCounts[folder.id] > 0 && (
                    <span style={{
                      background: '#e5e7eb',
                      color: '#6b7280',
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 10
                    }}>
                      {folderCounts[folder.id]}
                    </span>
                  )}
                </div>
              ))}

              <div style={{ marginTop: 16, padding: '0 12px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>📋 Templates</span>
                  <button
                    onClick={() => { setEditingTemplate(null); setShowTemplateEditor(true); }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: 'none',
                      background: '#e5e7eb',
                      cursor: 'pointer',
                      fontSize: 14
                    }}
                  >
                    +
                  </button>
                </div>
                {(() => {
                  const templates = loadFromStorage(currentUser.id, 'templates', []);
                  return templates.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                      No templates yet
                    </div>
                  ) : (
                    templates.map(t => (
                      <div
                        key={t.id}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          marginBottom: 4,
                          background: '#f9fafb',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 2 }}>
                          {t.name}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUseTemplate(t); }}
                            style={{
                              padding: '4px 8px',
                              fontSize: 11,
                              border: '1px solid #e5e7eb',
                              borderRadius: 4,
                              background: 'white',
                              cursor: 'pointer',
                              color: '#374151'
                            }}
                          >
                            Use
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingTemplate(t); setShowTemplateEditor(true); }}
                            style={{
                              padding: '4px 8px',
                              fontSize: 11,
                              border: '1px solid #e5e7eb',
                              borderRadius: 4,
                              background: 'white',
                              cursor: 'pointer',
                              color: '#374151'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                            style={{
                              padding: '4px 8px',
                              fontSize: 11,
                              border: '1px solid #fca5a5',
                              borderRadius: 4,
                              background: '#fee2e2',
                              cursor: 'pointer',
                              color: '#dc2626'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  );
                })()}
              </div>
            </div>
          </div>

          {showComposer || viewMode === 'compose' ? (
            <div style={{ flex: 1, background: 'white' }}>
              <EmailComposer
                initialData={composerData}
                onSend={handleSendEmail}
                onCancel={(data) => {
                  if (data?.type === 'draft') {
                    handleSaveDraft(data);
                  } else {
                    setShowComposer(false);
                    setComposerData(null);
                  }
                }}
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{
                width: '35%',
                minWidth: 280,
                maxWidth: 400,
                borderRight: '1px solid #e5e7eb',
                background: 'white',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#1f2937'
                }}>
                  {activeFolder === 'inbox' && `📥 Inbox (${folderCounts.inbox})`}
                  {activeFolder === 'sent' && `📤 Sent (${folderCounts.sent})`}
                  {activeFolder === 'drafts' && `📝 Drafts (${folderCounts.drafts})`}
                  {activeFolder === 'starred' && '⭐ Starred'}
                  {activeFolder === 'trash' && `🗑️ Trash (${folderCounts.trash})`}
                </div>
                {renderMainContent()}
              </div>

              <div style={{ flex: 1, background: 'white' }}>
                <EmailView
                  email={selectedEmail}
                  onBack={() => { setViewMode('list'); setSelectedEmail(null); }}
                  onReply={handleReply}
                  onDelete={handleDeleteEmail}
                  onStar={handleStarEmail}
                  onForward={handleForward}
                />
              </div>
            </div>
          )}
        </div>
    </div>
  );
};

export default EmailPage;