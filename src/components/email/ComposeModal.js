
import React, { useState, useRef, useEffect } from 'react';
import { colors, generateId } from './emailStyles';
import { useApp } from '../../context/AppContext';

/* ─── Rich Text Toolbar ─────────────────────────────── */
const ToolbarBtn = ({ title, icon, onClick, active }) => (
  <button
    title={title}
    onMouseDown={e => { e.preventDefault(); onClick && onClick(); }}
    style={{
      width: 30, height: 30, border: 'none', cursor: 'pointer', borderRadius: 6,
      background: active ? colors.primaryBg : 'transparent',
      color: active ? colors.primary : colors.textSecondary,
      fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif', transition: 'background 0.1s',
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#e5e7eb'; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
  >
    {icon}
  </button>
);

const Divider = () => (
  <div style={{ width: 1, height: 20, background: colors.border, margin: '0 4px' }} />
);

/* ─── Tag Input for To / CC / BCC ──────────────────── */
const TagInput = ({ label, tags, onAdd, onRemove, placeholder, labelColor }) => {
  const [val, setVal] = useState('');

  const commit = () => {
    const trimmed = val.trim();
    if (trimmed && !tags.includes(trimmed)) onAdd(trimmed);
    setVal('');
  };

  return (
    <div style={{
      minHeight: 44, padding: '6px 16px', borderBottom: `1px solid ${colors.borderLight}`,
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
    }}>
      <span style={{
        width: 48, fontSize: 11, fontWeight: 700,
        color: labelColor || colors.textMuted, textTransform: 'uppercase',
        flexShrink: 0,
      }}>{label}</span>
      {tags.map(t => (
        <span key={t} style={{
          background: colors.primaryLight, color: colors.primaryDark,
          borderRadius: 20, padding: '2px 10px', fontSize: 13,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {t}
          <span onClick={() => onRemove(t)} style={{ cursor: 'pointer', opacity: 0.7 }}>×</span>
        </span>
      ))}
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={tags.length === 0 ? placeholder : ''}
        style={{
          flex: 1, minWidth: 120, border: 'none', outline: 'none',
          fontSize: 14, fontFamily: 'DM Sans, sans-serif', color: colors.text,
          background: 'transparent',
        }}
      />
    </div>
  );
};

/* ─── Main ComposeModal ─────────────────────────────── */
const ComposeModal = ({ initialData, onSend, onSaveDraft, onClose }) => {
  const [mode, setMode] = useState('normal'); // normal | minimized | maximized
  const [to, setTo]           = useState([]);
  const [cc, setCc]           = useState([]);
  const [bcc, setBcc]         = useState([]);
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [body, setBody]       = useState(initialData?.body || '');
  const [showCC, setShowCC]   = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const fileRef = useRef();
  const editorRef = useRef();

  const draftIdRef = useRef(initialData?.id || null);
  const isInitializedRef = useRef(false);
  const prevInitialDataRef = useRef(null);

  // Signature States
  const { currentUser } = useApp();
  const [includeSignature, setIncludeSignature] = useState(true);
  const [showSigSettings, setShowSigSettings] = useState(false);
  const [savedSignature, setSavedSignature] = useState(() => {
    return localStorage.getItem(`zsm_signature_${currentUser?.id || 'default'}`) || '';
  });
  const [tempSignature, setTempSignature] = useState('');
  const [tempSignatureName, setTempSignatureName] = useState('');
  const [sigUploadError, setSigUploadError] = useState('');

  const getSignature = (sig = savedSignature) => {
    if (!currentUser) return '';
    const baseSig = `<br><br><div class="agent-signature" style="color: #666; font-size: 13px; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px; text-align: left;">
      <b>Regards,</b><br>
      ${currentUser.name || 'Agent'}<br>
      ${currentUser.role || 'Sales Representative'}<br>
      ${currentUser.department || 'ZSM CRM'}
    </div>`;
    if (sig) {
      return `${baseSig}<br><img src="${sig}" alt="Signature" style="max-height: 60px; max-width: 200px; object-fit: contain; margin-top: 10px; border-radius: 4px;" />`;
    }
    return baseSig;
  };

  const handleIncludeSignatureToggle = (checked) => {
    setIncludeSignature(checked);
    if (!editorRef.current) return;

    let currentHtml = editorRef.current.innerHTML || '';
    if (checked) {
      const sigHtml = getSignature();
      const updated = currentHtml + sigHtml;
      setBody(updated);
      editorRef.current.innerHTML = updated;
    } else {
      // Strip signature using the exact match or general pattern
      const sigRegex = /<br\s*\/?>\s*<br\s*\/?>\s*<div class="agent-signature"[\s\S]*?<\/div>(\s*<br\s*\/?>\s*<img[\s\S]*?>)?/gi;
      const updated = currentHtml.replace(sigRegex, '');
      setBody(updated);
      editorRef.current.innerHTML = updated;
    }
  };

  const handleSigFileChange = (e) => {
    const file = e.target.files[0];
    setSigUploadError('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSigUploadError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSigUploadError('Image size exceeds 2MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setTempSignature(event.target.result);
      setTempSignatureName(file.name);
    };
    reader.onerror = () => {
      setSigUploadError('Error reading file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSig = () => {
    if (tempSignature) {
      const key = `zsm_signature_${currentUser?.id || 'default'}`;
      localStorage.setItem(key, tempSignature);
      setSavedSignature(tempSignature);
      setTempSignature('');
      setTempSignatureName('');
      
      // Update active body if includeSignature is checked
      if (includeSignature && editorRef.current) {
        const sigRegex = /<br\s*\/?>\s*<br\s*\/?>\s*<div class="agent-signature"[\s\S]*?<\/div>(\s*<br\s*\/?>\s*<img[\s\S]*?>)?/gi;
        let currentHtml = editorRef.current.innerHTML || '';
        const stripped = currentHtml.replace(sigRegex, '');
        const updated = stripped + getSignature(tempSignature);
        setBody(updated);
        editorRef.current.innerHTML = updated;
      }
      
      alert('Signature saved successfully!');
    }
  };

  const handleClearSig = () => {
    if (window.confirm('Are you sure you want to remove your saved signature?')) {
      const key = `zsm_signature_${currentUser?.id || 'default'}`;
      localStorage.removeItem(key);
      setSavedSignature('');
      setTempSignature('');
      setTempSignatureName('');
      
      // Update active body if includeSignature is checked
      if (includeSignature && editorRef.current) {
        const sigRegex = /<br\s*\/?>\s*<br\s*\/?>\s*<div class="agent-signature"[\s\S]*?<\/div>(\s*<br\s*\/?>\s*<img[\s\S]*?>)?/gi;
        let currentHtml = editorRef.current.innerHTML || '';
        const stripped = currentHtml.replace(sigRegex, '');
        const updated = stripped + getSignature('');
        setBody(updated);
        editorRef.current.innerHTML = updated;
      }
    }
  };

  // Prefill fields if provided (robust parsing for reply/forward and editing drafts)
  useEffect(() => {
    if (initialData) {
      draftIdRef.current = initialData.id || null;

      // To field
      if (initialData.to) {
        if (Array.isArray(initialData.to)) {
          setTo(initialData.to);
        } else if (typeof initialData.to === 'string') {
          setTo(initialData.to.split(',').map(s => s.trim()).filter(Boolean));
        }
      } else if (initialData.toEmail) {
        if (Array.isArray(initialData.toEmail)) {
          setTo(initialData.toEmail);
        } else if (typeof initialData.toEmail === 'string') {
          setTo(initialData.toEmail.split(',').map(s => s.trim()).filter(Boolean));
        }
      }

      // CC field
      if (initialData.cc) {
        if (Array.isArray(initialData.cc)) {
          setCc(initialData.cc);
          setShowCC(true);
        } else if (typeof initialData.cc === 'string') {
          setCc(initialData.cc.split(',').map(s => s.trim()).filter(Boolean));
          setShowCC(true);
        }
      }

      // BCC field
      if (initialData.bcc) {
        if (Array.isArray(initialData.bcc)) {
          setBcc(initialData.bcc);
          setShowCC(true);
        } else if (typeof initialData.bcc === 'string') {
          setBcc(initialData.bcc.split(',').map(s => s.trim()).filter(Boolean));
          setShowCC(true);
        }
      }

      // Subject field
      if (initialData.subject) {
        setSubject(initialData.subject);
      }

      // Attachments field
      if (initialData.attachments) {
        setAttachments(initialData.attachments);
      }
    }
  }, [initialData]);

  // Handle mounting and initialData loading (e.g. templates, reply, forward, edits)
  useEffect(() => {
    if (currentUser) {
      const dataChanged = prevInitialDataRef.current !== initialData;
      if (!isInitializedRef.current || dataChanged) {
        let initialBody = '';
        if (initialData?.body) {
          initialBody = initialData.body;
          if (includeSignature && !initialBody.includes('class="agent-signature"')) {
            initialBody += getSignature();
          }
        } else {
          if (includeSignature) {
            initialBody = '<p><br></p>' + getSignature();
          }
        }
        setBody(initialBody);
        if (editorRef.current) {
          editorRef.current.innerHTML = initialBody;
        }
        isInitializedRef.current = true;
        prevInitialDataRef.current = initialData;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData, currentUser]);

  // Create a mutable state ref to avoid resetting the interval on keystrokes
  const stateRef = useRef({ to, cc, bcc, subject, body, attachments });
  useEffect(() => {
    stateRef.current = { to, cc, bcc, subject, body, attachments };
  }, [to, cc, bcc, subject, body, attachments]);

  // Autosave every 10s using stateRef
  useEffect(() => {
    const interval = setInterval(async () => {
      const { to, cc, bcc, subject, body, attachments } = stateRef.current;
      if (!subject && !body && to.length === 0 && cc.length === 0 && bcc.length === 0) return;
      
      if (onSaveDraft) {
        try {
          const savedDraft = await onSaveDraft({
            id: draftIdRef.current,
            to,
            cc,
            bcc,
            subject,
            body,
            attachments
          });
          if (savedDraft && savedDraft.id) {
            draftIdRef.current = savedDraft.id;
          }
          setLastSaved(new Date());
        } catch (err) {
          console.error('[ComposeModal] Autosave failed:', err);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [onSaveDraft]);

  const execCmd = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  const handleSend = async () => {
    if (to.length === 0) { alert('Please add a recipient.'); return; }
    if (!subject)        { alert('Please add a subject.'); return; }
    setSending(true);
    try {
      await onSend({ to: to.join(', '), cc: cc.join(', '), bcc: bcc.join(', '), subject, body, attachments }, draftIdRef.current);
      onClose();
    } catch (err) {
      alert('Failed to send: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleAttach = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(prev => [...prev, ...files.map(f => ({
      id: generateId(), name: f.name,
      size: (f.size / 1024).toFixed(1) + ' KB', file: f,
    }))]);
  };

  const removeAttachment = (id) => setAttachments(prev => prev.filter(a => a.id !== id));

  // Dimensions per mode
  const dims = {
    normal:    { width: 960, height: 680, borderRadius: 12, position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    maximized: { width: '100vw', height: '100vh', borderRadius: 0, position: 'fixed', top: 0, left: 0, transform: 'none' },
    minimized: { width: 320, height: 48, borderRadius: 8, position: 'fixed', bottom: 20, right: 20, transform: 'none', top: 'auto', left: 'auto' },
  };

  const dim = dims[mode];
  const HEADER = 48, FIELDS = 44 * (showCC ? 4 : 2), TOOLBAR = 44, FOOTER = 64;
  const ATTACH_BAR = attachments.length > 0 ? 48 : 0;
  const SIG_BAR = 36;
  const SIG_SETTINGS = showSigSettings ? 140 : 0;
  const editorH = (mode === 'maximized' ? window.innerHeight : 680) - HEADER - FIELDS - TOOLBAR - FOOTER - ATTACH_BAR - SIG_BAR - SIG_SETTINGS;

  const scheduleOptions = [
    'Tonight at 7:00 PM', 'Tomorrow morning at 8:00 AM',
    'Tomorrow afternoon at 1:00 PM', 'Next Monday at 8:00 AM', 'Custom date & time...',
  ];

  return (
    <>
      {/* Backdrop (not shown when minimized) */}
      {mode !== 'minimized' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 9998,
        }} onClick={() => setMode('minimized')} />
      )}

      {/* Modal */}
      <div style={{
        ...dim, zIndex: 9999, background: colors.surface,
        boxShadow: '0 25px 60px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', fontFamily: 'DM Sans, sans-serif',
        animation: 'composeIn 0.18s ease-out',
      }}>
        {/* Header */}
        <div style={{
          height: HEADER, background: colors.headerBg, color: 'white',
          borderRadius: mode === 'normal' ? '12px 12px 0 0' : 0,
          padding: '0 16px', display: 'flex', alignItems: 'center',
          flexShrink: 0, cursor: 'move',
        }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
            {initialData?.isReply ? 'Reply' : initialData?.isForward ? 'Forward' : 'New Message'}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setMode(m => m === 'minimized' ? 'normal' : 'minimized')}
              style={headerBtn}>─</button>
            <button onClick={() => setMode(m => m === 'maximized' ? 'normal' : 'maximized')}
              style={headerBtn}>⤢</button>
            <button onClick={() => {
              if (!body && !subject) { onClose(); return; }
              if (window.confirm('Discard this email?')) onClose();
            }} style={headerBtn}>✕</button>
          </div>
        </div>

        {mode === 'minimized' ? null : <>
          {/* TO field */}
          <TagInput
            label="TO"
            tags={to} onAdd={t => setTo(p => [...p, t])} onRemove={t => setTo(p => p.filter(x => x !== t))}
            placeholder="Recipient email..."
          />
          {/* CC toggle */}
          {!showCC && (
            <div style={{ padding: '0 16px', height: 32, display: 'flex', alignItems: 'center' }}>
              <span onClick={() => setShowCC(true)} style={{ fontSize: 12, color: colors.primary, cursor: 'pointer' }}>
                + Add CC / BCC
              </span>
              {lastSaved && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: colors.textMuted }}>
                  Draft saved at {lastSaved.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
          {showCC && (
            <TagInput label="CC" tags={cc} onAdd={t => setCc(p => [...p, t])} onRemove={t => setCc(p => p.filter(x => x !== t))} placeholder="CC..." />
          )}
          {showCC && (
            <TagInput label="BCC" tags={bcc} onAdd={t => setBcc(p => [...p, t])} onRemove={t => setBcc(p => p.filter(x => x !== t))} placeholder="BCC..." labelColor={colors.danger} />
          )}
          {/* Subject */}
          <div style={{
            height: 44, padding: '0 16px', borderBottom: `1px solid ${colors.borderLight}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 48, fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase' }}>SUB</span>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              style={{
                flex: 1, border: 'none', outline: 'none', fontSize: 14, fontWeight: 500,
                color: colors.text, fontFamily: 'DM Sans, sans-serif',
              }}
            />
          </div>

          {/* Rich Text Toolbar */}
          <div style={{
            height: TOOLBAR, background: '#f8fafc', borderBottom: `1px solid ${colors.border}`,
            padding: '0 12px', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
          }}>
            <select onChange={e => execCmd('fontName', e.target.value)} style={selectStyle}>
              <option>DM Sans</option><option>Georgia</option>
              <option>Courier New</option><option>Arial</option>
            </select>
            <select onChange={e => execCmd('fontSize', e.target.value)} style={{ ...selectStyle, width: 56 }}>
              {[1,2,3,4,5,6,7].map(s => <option key={s} value={s}>{[10,12,14,16,18,20,24][s-1]}</option>)}
            </select>
            <Divider />
            <ToolbarBtn icon="B" title="Bold (Ctrl+B)" onClick={() => execCmd('bold')} />
            <ToolbarBtn icon={<em>I</em>} title="Italic (Ctrl+I)" onClick={() => execCmd('italic')} />
            <ToolbarBtn icon={<u>U</u>} title="Underline (Ctrl+U)" onClick={() => execCmd('underline')} />
            <ToolbarBtn icon={<s>S</s>} title="Strikethrough" onClick={() => execCmd('strikeThrough')} />
            <Divider />
            <ToolbarBtn icon="≡" title="Bullet List" onClick={() => execCmd('insertUnorderedList')} />
            <ToolbarBtn icon="1≡" title="Numbered List" onClick={() => execCmd('insertOrderedList')} />
            <ToolbarBtn icon="⟵" title="Align Left" onClick={() => execCmd('justifyLeft')} />
            <ToolbarBtn icon="≡" title="Center" onClick={() => execCmd('justifyCenter')} />
            <ToolbarBtn icon="⟶" title="Align Right" onClick={() => execCmd('justifyRight')} />
            <Divider />
            <ToolbarBtn icon="🔗" title="Insert Link" onClick={() => {
              const url = prompt('Enter URL:');
              if (url) execCmd('createLink', url);
            }} />
            <ToolbarBtn icon="📎" title="Attach File" onClick={() => fileRef.current?.click()} />
            <ToolbarBtn icon="😊" title="Emoji" onClick={() => {
              const e = prompt('Enter emoji or text:');
              if (e) execCmd('insertText', e);
            }} />
            <Divider />
            <ToolbarBtn 
              icon="✍" 
              title="Manage Signature Settings" 
              active={showSigSettings}
              onClick={() => setShowSigSettings(!showSigSettings)} 
            />
          </div>

          {/* Attachment Bar */}
          {attachments.length > 0 && (
            <div style={{
              height: 48, padding: '0 16px', borderBottom: `1px solid ${colors.borderLight}`,
              display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', flexShrink: 0,
            }}>
              {attachments.map(att => (
                <div key={att.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: colors.bg, borderRadius: 20, padding: '4px 10px', fontSize: 12,
                  color: colors.textSecondary, whiteSpace: 'nowrap',
                }}>
                  <span>📄</span>
                  <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.name}</span>
                  <span style={{ color: colors.textFaint }}>{att.size}</span>
                  <span onClick={() => removeAttachment(att.id)} style={{ cursor: 'pointer', opacity: 0.6 }}>×</span>
                </div>
              ))}
            </div>
          )}

          {/* Editor Body — contentEditable div (no external dep) */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={e => setBody(e.currentTarget.innerHTML)}
            data-placeholder="Write your message here..."
            style={{
              height: Math.max(editorH, 120), overflowY: 'auto',
              padding: '24px 28px', fontSize: 14, lineHeight: 1.75,
              color: colors.text, outline: 'none', background: colors.surface,
              wordBreak: 'break-word',
            }}
          />

          {/* Signature Control Bar */}
          <div style={{
            height: SIG_BAR,
            borderTop: `1px solid ${colors.borderLight}`,
            borderBottom: showSigSettings ? `1px solid ${colors.borderLight}` : 'none',
            background: '#f8fafc',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: colors.textSecondary,
            flexShrink: 0,
          }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={includeSignature}
                onChange={(e) => handleIncludeSignatureToggle(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Include email signature at the bottom</span>
            </label>
            <button
              onClick={() => setShowSigSettings(!showSigSettings)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.primary,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontFamily: 'DM Sans, sans-serif',
                padding: '4px 8px',
                borderRadius: 4,
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = colors.primaryLight}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              ✍️ {showSigSettings ? 'Hide Settings' : 'Manage Signature'}
            </button>
          </div>

          {/* Signature Settings Card */}
          {showSigSettings && (
            <div style={{
              height: SIG_SETTINGS,
              background: '#ffffff',
              borderBottom: `1px solid ${colors.border}`,
              padding: '12px 20px',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              flexShrink: 0,
              overflowY: 'auto',
              animation: 'settingsSlide 0.2s ease-out',
            }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>Agent Signature Settings</div>
                <div style={{ fontSize: 11, color: colors.textMuted }}>
                  Upload an image of your signature (PNG, JPG or WEBP, max 2MB).
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input
                    type="file"
                    accept="image/*"
                    id="sig-file-input"
                    onChange={handleSigFileChange}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="sig-file-input"
                    style={{
                      padding: '6px 12px',
                      border: `1px dashed ${colors.primary}`,
                      borderRadius: 6,
                      background: colors.primaryLight,
                      color: colors.primaryDark,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    📁 {tempSignatureName ? 'Change Image' : 'Choose Image'}
                  </label>
                  {tempSignatureName && (
                    <span style={{ fontSize: 11, color: colors.textSecondary, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tempSignatureName}
                    </span>
                  )}
                  
                  {tempSignature && (
                    <button
                      onClick={handleSaveSig}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: 6,
                        background: '#10b981',
                        color: 'white',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      💾 Save
                    </button>
                  )}
                  
                  {savedSignature && (
                    <button
                      onClick={handleClearSig}
                      style={{
                        padding: '6px 12px',
                        border: `1px solid ${colors.danger}`,
                        borderRadius: 6,
                        background: 'transparent',
                        color: colors.danger,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      🗑 Delete Saved
                    </button>
                  )}
                </div>
                {sigUploadError && (
                  <div style={{ fontSize: 11, color: colors.danger, fontWeight: 500, marginTop: 2 }}>
                    ⚠️ {sigUploadError}
                  </div>
                )}
              </div>

              {/* Signature Image Preview */}
              <div style={{
                width: 160,
                height: 72,
                border: `1px dashed ${tempSignature ? '#10b981' : colors.border}`,
                borderRadius: 8,
                background: colors.bg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                padding: 4,
              }}>
                {tempSignature ? (
                  <>
                    <img src={tempSignature} alt="Temp Sig Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(16, 185, 129, 0.9)', color: 'white', fontSize: 8, padding: '1px 3px', borderRadius: 2, fontWeight: 700 }}>STAGED</div>
                  </>
                ) : savedSignature ? (
                  <>
                    <img src={savedSignature} alt="Saved Sig Preview" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    <div style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(37, 99, 235, 0.9)', color: 'white', fontSize: 8, padding: '1px 3px', borderRadius: 2, fontWeight: 700 }}>ACTIVE</div>
                  </>
                ) : (
                  <span style={{ fontSize: 10, color: colors.textFaint, textAlign: 'center' }}>No Signature<br/>Image Saved</span>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            height: FOOTER, borderTop: `1px solid ${colors.border}`,
            padding: '0 20px', display: 'flex', alignItems: 'center',
            background: colors.surface,
            borderRadius: mode === 'normal' ? '0 0 12px 12px' : 0,
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1 }}>
              {/* Send */}
              <button onClick={handleSend} disabled={sending} style={{
                height: 40, background: sending ? '#9ca3af' : colors.primary, color: 'white',
                border: 'none', borderRadius: 8, padding: '0 24px', fontWeight: 600,
                fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'DM Sans, sans-serif',
              }}>
                {sending ? '⌛ Sending...' : '📤 Send'}
              </button>

              {/* Schedule Send */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setScheduleOpen(o => !o)} style={outlineBtn}>
                  🕐 Schedule ▾
                </button>
                {scheduleOpen && (
                  <div style={{
                    position: 'absolute', bottom: 48, left: 0,
                    background: colors.surface, border: `1px solid ${colors.border}`,
                    borderRadius: 8, padding: '6px 0', zIndex: 10,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 220,
                  }}>
                    {scheduleOptions.map(opt => (
                      <div key={opt} onClick={() => { alert(`Scheduled: ${opt}`); setScheduleOpen(false); }}
                        style={{ padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: colors.textSecondary }}
                        onMouseEnter={e => e.currentTarget.style.background = colors.bg}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >{opt}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Save Draft */}
              <button onClick={async () => {
                if (onSaveDraft) {
                  try {
                    const savedDraft = await onSaveDraft({
                      id: draftIdRef.current,
                      to,
                      cc,
                      bcc,
                      subject,
                      body,
                      attachments
                    });
                    if (savedDraft && savedDraft.id) {
                      draftIdRef.current = savedDraft.id;
                    }
                    setLastSaved(new Date());
                  } catch (err) {
                    console.error('[ComposeModal] Manual save failed:', err);
                  }
                }
              }} style={outlineBtn}>
                💾 Save Draft
              </button>
              {lastSaved && (
                <span style={{ fontSize: 11, color: colors.textMuted }}>
                  Saved {lastSaved.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => fileRef.current?.click()} style={iconBtn}>📎</button>
              <button onClick={() => {
                if (!body && !subject) { onClose(); return; }
                if (window.confirm('Discard this draft?')) onClose();
              }} style={{ ...iconBtn, color: colors.danger }}>🗑 Discard</button>
            </div>
          </div>
        </>}
      </div>

      <input ref={fileRef} type="file" multiple onChange={handleAttach} style={{ display: 'none' }} />

      <style>{`
        @keyframes composeIn {
          from { transform: ${mode === 'normal' ? 'translate(-50%, calc(-50% + 20px))' : 'translateY(20px)'} scale(0.97); opacity: 0; }
          to   { transform: ${mode === 'normal' ? 'translate(-50%, -50%)' : 'translateY(0)'} scale(1); opacity: 1; }
        }
        @keyframes settingsSlide {
          from { height: 0; opacity: 0; }
          to   { height: 140px; opacity: 1; }
        }
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </>
  );
};

const headerBtn = {
  width: 28, height: 28, border: 'none', background: 'rgba(255,255,255,0.15)',
  color: 'white', borderRadius: 4, cursor: 'pointer', fontSize: 14,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const outlineBtn = {
  height: 40, border: `1px solid ${colors.border}`, borderRadius: 8,
  padding: '0 14px', background: colors.surface, color: colors.textSecondary,
  fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  fontFamily: 'DM Sans, sans-serif',
};

const iconBtn = {
  width: 36, height: 36, border: `1px solid ${colors.border}`, borderRadius: 8,
  background: colors.surface, color: colors.textSecondary, cursor: 'pointer',
  fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const selectStyle = {
  height: 26, fontSize: 12, border: `1px solid ${colors.border}`,
  borderRadius: 4, padding: '0 4px', background: colors.surface,
  color: colors.textSecondary, cursor: 'pointer', width: 110,
};

export default ComposeModal;
