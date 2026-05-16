
import React, { useState } from 'react';
import { colors, formatFullDate, getInitials, getAvatarColor } from './emailStyles';

let DOMPurify = null;
try { DOMPurify = require('dompurify'); } catch (e) {}

const sanitize = (html) => {
  if (!html) return '';
  if (DOMPurify && DOMPurify.sanitize) return DOMPurify.sanitize(html);
  // Fallback: strip script tags at minimum
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

const ActionBtn = ({ icon, title, onClick, danger }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      width: 32, height: 32, border: 'none', background: 'transparent',
      borderRadius: 6, cursor: 'pointer', fontSize: 15,
      color: danger ? colors.danger : colors.textMuted,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = danger ? colors.dangerBg : colors.bg}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
  >
    {icon}
  </button>
);

const EmailViewer = ({ email, onReply, onReplyAll, onForward, onDelete, onStar, onClose }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  if (!email) {
    return (
      <div style={{
        flex: 1, background: colors.surface, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: colors.textFaint,
      }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: colors.textMuted }}>
          Select an email to read
        </div>
        <div style={{ fontSize: 13 }}>Choose a message from the list on the left</div>
      </div>
    );
  }

  const senderName  = email.fromName || email.fromEmail || 'Unknown';
  const senderEmail = email.fromEmail || '';
  const bodyHtml    = sanitize(email.body || '');

  return (
    <div style={{
      flex: 1, background: colors.surface, display: 'flex',
      flexDirection: 'column', overflow: 'hidden',
      animation: 'slideInRight 0.15s ease-out',
    }}>
      {/* Viewer Header */}
      <div style={{
        height: 56, padding: '0 24px', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <div style={{
          flex: 1, fontSize: 16, fontWeight: 600, color: colors.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {email.subject || '(No Subject)'}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <ActionBtn icon="↩" title="Reply" onClick={() => onReply(email)} />
          <ActionBtn icon="↩↩" title="Reply All" onClick={() => onReplyAll(email)} />
          <ActionBtn icon="↪" title="Forward" onClick={() => onForward(email)} />
          <div style={{ width: 1, height: 20, background: colors.border, margin: '0 4px' }} />
          <ActionBtn icon="🗑" title="Delete" onClick={() => onDelete(email)} danger />
          <ActionBtn icon="🖨" title="Print" onClick={() => window.print()} />
          <div style={{ position: 'relative' }}>
            <ActionBtn icon="⋯" title="More" onClick={() => setMoreOpen(o => !o)} />
            {moreOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 36, background: colors.surface,
                border: `1px solid ${colors.border}`, borderRadius: 8, padding: '6px 0',
                zIndex: 999, minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              }}>
                {['Mark as Unread','Snooze','Block Sender','Report Spam'].map(opt => (
                  <div key={opt} onClick={() => setMoreOpen(false)} style={{
                    padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                    color: colors.textSecondary,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = colors.bg}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>
          {onClose && <ActionBtn icon="✕" title="Close" onClick={onClose} />}
        </div>
      </div>

      {/* Sender Info */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.borderLight}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: getAvatarColor(senderName),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 14, fontWeight: 700,
          }}>
            {getInitials(senderName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{senderName}</span>
              <span style={{ fontSize: 12, color: colors.textMuted }}>{formatFullDate(email.createdAt)}</span>
            </div>
            <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{senderEmail}</div>
            <div
              onClick={() => setShowDetails(d => !d)}
              style={{ fontSize: 12, color: colors.primary, cursor: 'pointer', marginTop: 4, display: 'inline-block' }}
            >
              {showDetails ? '▲ Hide details' : '▾ Show details'}
            </div>
            {showDetails && (
              <div style={{ marginTop: 8, fontSize: 12, color: colors.textMuted, lineHeight: 1.8 }}>
                <div><strong>To:</strong> {email.toEmail || 'Me'}</div>
                {email.cc && <div><strong>CC:</strong> {email.cc}</div>}
              </div>
            )}
          </div>
          <button
            onClick={() => onStar(email)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 18, color: email.isStarred ? '#fbbf24' : '#d1d5db', padding: 4,
            }}
          >
            {email.isStarred ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* Attachments */}
      {email.hasAttachments && (
        <div style={{
          padding: '12px 24px', borderBottom: `1px solid ${colors.borderLight}`,
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', color: colors.textMuted, fontWeight: 600, marginBottom: 10 }}>
            Attachments
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(email.attachments || [{ name: 'document.pdf', size: '245 KB' }]).map((att, i) => (
              <div key={i} style={{
                width: 180, border: `1px solid ${colors.border}`, borderRadius: 8,
                padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#93c5fd'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = colors.border; }}
              >
                <span style={{ fontSize: 22 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.name || 'attachment'}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>{att.size || ''}</div>
                </div>
                <span style={{ color: colors.primary, fontSize: 14 }}>⬇</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {email.isHtml || (email.body || '').includes('<') ? (
          <div
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            style={{
              fontSize: 14, lineHeight: 1.75, color: colors.text,
              wordBreak: 'break-word',
            }}
          />
        ) : (
          <div style={{ fontSize: 14, lineHeight: 1.75, color: colors.text, whiteSpace: 'pre-wrap' }}>
            {email.body}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div style={{
        height: 64, padding: '12px 24px', borderTop: `1px solid ${colors.border}`,
        display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0,
      }}>
        <button onClick={() => onReply(email)} style={primaryBtn}>↩ Reply</button>
        <button onClick={() => onReplyAll(email)} style={secondaryBtn}>↩↩ Reply All</button>
        <button onClick={() => onForward(email)} style={secondaryBtn}>↪ Forward</button>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(16px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const primaryBtn = {
  height: 40, background: colors.primary, color: 'white',
  border: 'none', borderRadius: 8, padding: '0 20px',
  fontWeight: 600, fontSize: 14, cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
};

const secondaryBtn = {
  height: 40, background: colors.surface, color: colors.textSecondary,
  border: `1px solid ${colors.border}`, borderRadius: 8, padding: '0 20px',
  fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
};

export default EmailViewer;
