
import React, { useState, useRef, useEffect } from 'react';
import { colors, generateId } from './emailStyles';

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
  const autoSaveRef = useRef();

  // Prefill To if provided
  useEffect(() => {
    if (initialData?.to) setTo([initialData.to]);
  }, [initialData]);

  // Autosave every 10s
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (subject || body) {
        onSaveDraft && onSaveDraft({ to, cc, bcc, subject, body, attachments });
        setLastSaved(new Date());
      }
    }, 10000);
    return () => clearInterval(autoSaveRef.current);
  }, [to, cc, bcc, subject, body, attachments, onSaveDraft]);

  const execCmd = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  const handleSend = async () => {
    if (to.length === 0) { alert('Please add a recipient.'); return; }
    if (!subject)        { alert('Please add a subject.'); return; }
    setSending(true);
    try {
      await onSend({ to: to.join(', '), cc: cc.join(', '), bcc: bcc.join(', '), subject, body, attachments });
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
  const editorH = (mode === 'maximized' ? window.innerHeight : 680) - HEADER - FIELDS - TOOLBAR - FOOTER - ATTACH_BAR;

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
            <ToolbarBtn icon="✍" title="Insert Signature" onClick={() => {
              execCmd('insertHTML', '<br><hr style="margin:8px 0"><div style="color:#6b7280;font-size:13px;border-left:3px solid #e5e7eb;padding-left:12px">Signature</div>');
            }} />
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
              <button onClick={() => {
                onSaveDraft && onSaveDraft({ to, cc, bcc, subject, body, attachments });
                setLastSaved(new Date());
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
