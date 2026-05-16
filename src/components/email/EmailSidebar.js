
import React, { useState } from 'react';
import { colors, folder_icons, label_colors } from './emailStyles';

const folders = [
  { id: 'inbox',       label: 'Inbox',       countKey: 'inbox' },
  { id: 'focused',     label: 'Focused',     countKey: null },
  { id: 'drafts',      label: 'Drafts',      countKey: 'drafts' },
  { id: 'sent',        label: 'Sent Items',  countKey: null },
  { id: 'scheduled',   label: 'Scheduled',   countKey: null },
  { id: 'archive',     label: 'Archive',     countKey: null },
  { id: 'spam',        label: 'Spam',        countKey: null },
  { id: 'trash',       label: 'Trash',       countKey: null },
  { id: 'templates',   label: 'Templates',   countKey: 'templates' },
  { id: 'attachments', label: 'Attachments', countKey: null },
  { id: 'important',   label: 'Important',   countKey: null },
  { id: 'flagged',     label: 'Flagged',     countKey: null },
];

const labels = ['Clients', 'Leads', 'Sales', 'Backend Team', 'Internal'];

const EmailSidebar = ({ activeFolder, onFolderSelect, onCompose, counts = {}, collapsed }) => {
  const [labelsOpen, setLabelsOpen] = useState(true);

  if (collapsed) return null;

  return (
    <div style={{
      width: 250, flexShrink: 0, height: '100%', background: colors.surface,
      borderRight: `1px solid ${colors.border}`, display: 'flex',
      flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* Compose Button */}
      <div style={{ margin: '16px 16px 12px' }}>
        <button
          onClick={onCompose}
          style={{
            width: '100%', height: 48, background: colors.primary, color: 'white',
            border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, transition: 'background 0.15s',
            fontFamily: 'DM Sans, sans-serif',
          }}
          onMouseEnter={e => e.currentTarget.style.background = colors.primaryDark}
          onMouseLeave={e => e.currentTarget.style.background = colors.primary}
        >
          ✏️ New Message
        </button>
      </div>

      {/* Folder List */}
      <nav style={{ flex: 1 }}>
        {folders.map(f => {
          const isActive = activeFolder === f.id;
          const badge = f.countKey ? counts[f.countKey] : null;
          return (
            <div
              key={f.id}
              onClick={() => onFolderSelect(f.id)}
              style={{
                height: 40, padding: '0 16px', display: 'flex', alignItems: 'center',
                gap: 10, cursor: 'pointer', fontSize: 14, transition: 'all 0.1s',
                background: isActive ? colors.primaryLight : 'transparent',
                color: isActive ? colors.primary : colors.textSecondary,
                fontWeight: isActive ? 600 : 400,
                borderRight: isActive ? `3px solid ${colors.primary}` : '3px solid transparent',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = colors.surfaceHover; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>
                {folder_icons[f.id] || '📁'}
              </span>
              <span style={{ flex: 1 }}>{f.label}</span>
              {badge > 0 && (
                <span style={{
                  background: colors.primary, color: 'white', fontSize: 11,
                  borderRadius: 20, minWidth: 20, padding: '1px 6px', textAlign: 'center',
                }}>
                  {badge}
                </span>
              )}
            </div>
          );
        })}

        {/* Labels Section */}
        <div style={{ marginTop: 8 }}>
          <div
            onClick={() => setLabelsOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', padding: '8px 16px',
              cursor: 'pointer', fontSize: 12, textTransform: 'uppercase',
              color: colors.textMuted, fontWeight: 600, letterSpacing: '0.05em',
              userSelect: 'none',
            }}
          >
            <span style={{ flex: 1 }}>Labels</span>
            <span style={{ transition: 'transform 0.2s', transform: labelsOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
          </div>

          {labelsOpen && labels.map(label => (
            <div
              key={label}
              style={{
                height: 36, padding: '0 16px 0 20px', display: 'flex', alignItems: 'center',
                gap: 10, cursor: 'pointer', fontSize: 13, color: colors.textSecondary,
              }}
              onMouseEnter={e => e.currentTarget.style.background = colors.surfaceHover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: label_colors[label] || '#6b7280', flexShrink: 0,
              }} />
              <span style={{ flex: 1 }}>{label}</span>
            </div>
          ))}

          <div style={{
            padding: '6px 16px 16px 20px', fontSize: 12,
            color: colors.primary, cursor: 'pointer',
          }}>
            + Add label
          </div>
        </div>
      </nav>
    </div>
  );
};

export default EmailSidebar;
