
import React, { useState, useCallback } from 'react';
import { colors, formatEmailDate, getInitials, getAvatarColor } from './emailStyles';

const EmailListItem = ({ email, isSelected, onSelect, onCheck, isChecked }) => {
  const [hovered, setHovered] = useState(false);
  const isUnread = email.status === 'unread';

  let bg = colors.surface;
  if (isSelected) bg = colors.primaryLight;
  else if (isUnread) bg = colors.unread;
  else if (hovered) bg = colors.surfaceHover;

  return (
    <div
      onClick={() => onSelect(email)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 78, padding: '0 14px', display: 'flex', alignItems: 'center',
        gap: 10, borderBottom: `1px solid ${colors.borderLight}`,
        cursor: 'pointer', position: 'relative', background: bg,
        borderLeft: isSelected ? `3px solid ${colors.primary}` : '3px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Left: checkbox + star */}
      <div style={{ width: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={e => { e.stopPropagation(); onCheck(email.id); }}
          onClick={e => e.stopPropagation()}
          style={{ cursor: 'pointer', accentColor: colors.primary }}
        />
        <span
          onClick={e => { e.stopPropagation(); onSelect({ ...email, toggleStar: true }); }}
          style={{ fontSize: 12, color: email.isStarred ? '#fbbf24' : '#d1d5db', cursor: 'pointer' }}
        >
          {email.isStarred ? '★' : '☆'}
        </span>
      </div>

      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: getAvatarColor(email.fromName || ''),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: 13, fontWeight: 600,
      }}>
        {getInitials(email.fromName || email.fromEmail || '?')}
      </div>

      {/* Center content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
          <span style={{
            fontSize: 14, fontWeight: isUnread ? 700 : 500, color: colors.text,
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {email.type === 'sent' ? (email.toEmail || 'Unknown') : (email.fromName || email.fromEmail || 'Unknown')}
          </span>
          {email.hasAttachments && <span style={{ fontSize: 11, color: colors.textMuted, marginRight: 4 }}>📎</span>}
        </div>
        <div style={{
          fontSize: 13, color: colors.textSecondary, marginBottom: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: isUnread ? 600 : 400,
        }}>
          {email.subject || '(No Subject)'}
        </div>
        <div style={{
          fontSize: 12, color: colors.textFaint,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {email.preview || (email.body || '').substring(0, 80)}
        </div>
      </div>

      {/* Right: time + unread dot */}
      <div style={{ width: 60, textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 6 }}>
          {formatEmailDate(email.createdAt)}
        </div>
        {isUnread && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: colors.primary,
            marginLeft: 'auto',
          }} />
        )}
      </div>
    </div>
  );
};

const EmailList = ({
  emails = [], selectedId, onSelect, activeFolder,
  onDelete, onArchive, onMarkUnread, searchQuery, onSearchChange,
}) => {
  const [checked, setChecked] = useState(new Set());
  const [sortBy, setSortBy] = useState('date');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const toggleCheck = useCallback((id) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allChecked = emails.length > 0 && checked.size === emails.length;
  const someChecked = checked.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked || someChecked) setChecked(new Set());
    else setChecked(new Set(emails.map(e => e.id)));
  };

  const sorted = [...emails].sort((a, b) => {
    if (sortBy === 'sender') return (a.fromName || '').localeCompare(b.fromName || '');
    if (sortBy === 'subject') return (a.subject || '').localeCompare(b.subject || '');
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const total = sorted.length;
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const folderLabel = activeFolder.charAt(0).toUpperCase() + activeFolder.slice(1);

  return (
    <div style={{
      width: 420, flexShrink: 0, background: colors.surface,
      borderRight: `1px solid ${colors.border}`, display: 'flex',
      flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Folder title */}
      <div style={{
        padding: '12px 14px 8px', borderBottom: `1px solid ${colors.borderLight}`,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
          {folderLabel}
        </div>
        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.textMuted, fontSize: 14 }}>🔍</span>
          <input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search in this folder..."
            style={{
              width: '100%', height: 34, paddingLeft: 32, paddingRight: 12,
              border: `1px solid ${colors.border}`, borderRadius: 6, fontSize: 13,
              background: colors.bg, outline: 'none', boxSizing: 'border-box',
              fontFamily: 'DM Sans, sans-serif',
            }}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        height: 44, padding: '0 12px', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <input
          type="checkbox"
          checked={allChecked}
          ref={el => { if (el) el.indeterminate = someChecked; }}
          onChange={toggleAll}
          style={{ cursor: 'pointer', accentColor: colors.primary }}
        />
        <div style={{ width: 1, height: 20, background: colors.border }} />
        {checked.size > 0 && <>
          <button onClick={() => onDelete([...checked])} title="Delete" style={toolBtn}>🗑</button>
          <button onClick={() => onArchive([...checked])} title="Archive" style={toolBtn}>🗂</button>
          <button onClick={() => onMarkUnread([...checked])} title="Mark Unread" style={toolBtn}>✉️</button>
          <button title="Flag" style={toolBtn}>🚩</button>
        </>}
        <div style={{ flex: 1 }} />
        <select
          value={sortBy}
          onChange={e => { setSortBy(e.target.value); setPage(1); }}
          style={{
            fontSize: 12, border: `1px solid ${colors.border}`, borderRadius: 4,
            padding: '2px 6px', cursor: 'pointer', background: colors.surface,
            color: colors.textSecondary,
          }}
        >
          <option value="date">Date ▾</option>
          <option value="sender">Sender</option>
          <option value="subject">Subject</option>
        </select>
        <span style={{ fontSize: 11, color: colors.textMuted, whiteSpace: 'nowrap' }}>
          {total === 0 ? 'No mail' : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
        </span>
        {totalPages > 1 && <>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}>‹</button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn}>›</button>
        </>}
      </div>

      {/* Email List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {paginated.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '60%', color: colors.textMuted,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14 }}>No emails in {folderLabel}</div>
          </div>
        ) : paginated.map(email => (
          <EmailListItem
            key={email.id}
            email={email}
            isSelected={email.id === selectedId}
            isChecked={checked.has(email.id)}
            onSelect={onSelect}
            onCheck={toggleCheck}
          />
        ))}
      </div>
    </div>
  );
};

const toolBtn = {
  width: 28, height: 28, border: 'none', background: 'transparent',
  cursor: 'pointer', borderRadius: 4, fontSize: 14, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
};

const pageBtn = {
  width: 24, height: 24, border: `1px solid ${colors.border}`,
  background: colors.surface, cursor: 'pointer', borderRadius: 4,
  fontSize: 13, color: colors.textSecondary,
};

export default EmailList;
