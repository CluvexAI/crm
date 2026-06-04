/**
 * MultiAssignTeamMember.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Dynamic auto-expanding multi-row team member assignment component.
 * Uses allUsers from AppContext directly — no extra fetch needed.
 * Only shows Backend and Graphics department users.
 *
 * Exact behavior:
 *   Row 1 always visible (empty trigger)
 *   Select a user → that row fills, Row 2 auto-appears
 *   Select again → Row 2 fills, Row 3 auto-appears
 *   Remove a row → list re-indexes cleanly, one empty row stays at bottom
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

// ─── Department Badge Colors ──────────────────────────────────────────────────
const deptColor = (dept) =>
  dept === 'Backend'
    ? { bg: '#E6F1FB', color: '#185FA5', border: '#b3d0ee' }
    : { bg: '#E1F5EE', color: '#0F6E56', border: '#9ddcc6' };

// ─── Avatar Initials ──────────────────────────────────────────────────────────
const getInitials = (name = '') =>
  name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

// ─── TeamMemberPopup ──────────────────────────────────────────────────────────
const TeamMemberPopup = ({
  searchRef,
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  filteredMembers,
  selectedUserIds,
  onSelect,
  onClose,
}) => (
  <div style={{
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    marginTop: 4,
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  }}>
    {/* Header */}
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid #f0f0f0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: '#fafafa',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
        👥 Select Team Member
      </span>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 16, color: '#999', padding: '0 4px', lineHeight: 1,
        }}
        aria-label="Close popup"
      >✕</button>
    </div>

    {/* Search */}
    <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0' }}>
      <input
        ref={searchRef}
        type="text"
        placeholder="Search by name or role..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: 13,
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          outline: 'none',
          boxSizing: 'border-box',
          background: '#fff',
          color: '#1a1a1a',
        }}
        aria-label="Search team members"
      />
    </div>

    {/* Department Tabs */}
    <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
      {['All', 'Backend', 'Graphics'].map(tab => (
        <button
          type="button"
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            flex: 1,
            padding: '9px 0',
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            background: activeTab === tab ? '#fff' : '#fafafa',
            cursor: 'pointer',
            color: activeTab === tab ? '#185FA5' : '#999',
            borderBottom: activeTab === tab ? '2px solid #185FA5' : '2px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          {tab}
          {tab !== 'All' && (
            <span style={{
              marginLeft: 5,
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 8,
              background: deptColor(tab).bg,
              color: deptColor(tab).color,
            }}>
              {tab === 'Backend' ? '⚙' : '🎨'}
            </span>
          )}
        </button>
      ))}
    </div>

    {/* Member List */}
    <div style={{ maxHeight: 240, overflowY: 'auto' }} role="listbox" aria-label="Team members">
      {filteredMembers.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#bbb', fontSize: 13 }}>
          No members found
        </div>
      ) : (
        filteredMembers.map(member => {
          const isAlreadySelected = selectedUserIds.includes(String(member.id || member.uuid));
          const colors = deptColor(member.department);
          return (
            <div
              key={member.id}
              onClick={() => !isAlreadySelected && onSelect(member)}
              role="option"
              aria-selected={isAlreadySelected}
              aria-disabled={isAlreadySelected}
              style={{
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: isAlreadySelected ? 'not-allowed' : 'pointer',
                opacity: isAlreadySelected ? 0.45 : 1,
                borderBottom: '1px solid #f8f8f8',
                transition: 'background 0.1s',
                userSelect: 'none',
              }}
              onMouseEnter={e => { if (!isAlreadySelected) e.currentTarget.style.background = '#f7f9fc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; }}
            >
              {/* Avatar */}
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: colors.bg,
                color: colors.color,
                border: `1.5px solid ${colors.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {getInitials(member.name || member.full_name)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {member.name || member.full_name}
                  {isAlreadySelected && (
                    <span style={{ fontSize: 10, color: '#aaa', marginLeft: 6, fontWeight: 400 }}>
                      (already added)
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{member.role || member.designation || member.department}</span>
                  <span style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                    background: colors.bg, color: colors.color,
                  }}>
                    {member.department}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
);

// ─── MultiAssignTeamMember ────────────────────────────────────────────────────
const MultiAssignTeamMember = ({ value = [], onChange }) => {
  const { allUsers } = useApp();

  // Filter: only Backend and Graphics departments, active users
  const assignableMembers = allUsers.filter(u =>
    (u.department === 'Backend' || u.department === 'Graphics') &&
    u.status !== 'Deleted' &&
    u.status !== 'Inactive' &&
    u.status !== 'deleted'
  );

  // Each row: { id: uniqueKey, selectedUser: null | userObject }
  const [rows, setRows] = useState(() => {
    // Initialize from value prop (pre-existing assignments)
    const filled = (value || []).map(userId => ({
      id: `row_${userId}_${Date.now()}`,
      selectedUser: allUsers.find(u => String(u.id) === String(userId) || String(u.uuid) === String(userId)) || null,
    })).filter(r => r.selectedUser !== null);

    return [...filled, { id: `row_empty_${Date.now()}`, selectedUser: null }];
  });

  const [popupOpen, setPopupOpen] = useState(null); // rowId | null
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const searchRef = useRef(null);
  const containerRef = useRef(null);

  // Focus search input when popup opens
  useEffect(() => {
    if (popupOpen !== null) {
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [popupOpen]);

  // Close popup on outside click
  useEffect(() => {
    if (!popupOpen) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setPopupOpen(null);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popupOpen]);

  // Notify parent when selections change
  useEffect(() => {
    const selectedIds = rows
      .filter(r => r.selectedUser)
      .map(r => r.selectedUser.id || r.selectedUser.uuid);
    onChange?.(selectedIds, rows.filter(r => r.selectedUser).map(r => r.selectedUser));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // All currently selected user IDs (to gray out in popup)
  const selectedUserIds = rows
    .filter(r => r.selectedUser)
    .map(r => String(r.selectedUser.id || r.selectedUser.uuid));

  // Filtered members for popup
  const filteredMembers = assignableMembers.filter(m => {
    const matchesTab = activeTab === 'All' || m.department === activeTab;
    const name = m.name || m.full_name || '';
    const role = m.role || m.designation || '';
    const matchesSearch =
      !searchQuery ||
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Handle user selection from popup
  const handleSelectUser = (rowId, user) => {
    setRows(prev => {
      const updated = prev.map(row =>
        row.id === rowId ? { ...row, selectedUser: user } : row
      );
      const filledIndex = updated.findIndex(r => r.id === rowId);
      const isLastRow = filledIndex === updated.length - 1;
      if (isLastRow) {
        return [...updated, { id: `row_${Date.now()}`, selectedUser: null }];
      }
      return updated;
    });
    setPopupOpen(null);
    setSearchQuery('');
    setActiveTab('All');
  };

  // Handle removing a selected user
  const handleRemoveUser = (rowId) => {
    setRows(prev => {
      const updated = prev.filter(r => r.id !== rowId);
      // Ensure there's always one empty row at the end
      const hasEmpty = updated.some(r => !r.selectedUser);
      if (!hasEmpty) {
        return [...updated, { id: `row_${Date.now()}`, selectedUser: null }];
      }
      // Trim any extra trailing empty rows (keep exactly one)
      const lastFilledIdx = updated.reduce((last, r, i) => r.selectedUser ? i : last, -1);
      return updated.slice(0, lastFilledIdx + 2);
    });
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {rows.map((row, index) => {
        const filledCount = rows.filter(r => r.selectedUser).length;
        const colors = row.selectedUser ? deptColor(row.selectedUser.department) : null;

        return (
          <div key={row.id} style={{ marginBottom: 8, position: 'relative' }}>
            {row.selectedUser ? (
              // ── Filled Row ─────────────────────────────────────────────
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                background: colors.bg,
                transition: 'all 0.2s ease',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#fff',
                  color: colors.color,
                  border: `1.5px solid ${colors.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>
                  {getInitials(row.selectedUser.name || row.selectedUser.full_name)}
                </div>

                {/* Name & Dept */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.selectedUser.name || row.selectedUser.full_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#666', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span>{row.selectedUser.role || row.selectedUser.designation}</span>
                    <span style={{
                      fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                      background: '#fff', color: colors.color,
                    }}>
                      {row.selectedUser.department}
                    </span>
                  </div>
                </div>

                {/* Row number badge */}
                {filledCount > 1 && (
                  <span style={{
                    fontSize: 10, color: colors.color, background: '#fff',
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10, padding: '1px 7px', fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    #{index + 1}
                  </span>
                )}

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveUser(row.id)}
                  aria-label={`Remove ${row.selectedUser.name || row.selectedUser.full_name}`}
                  title="Remove"
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: `1px solid ${colors.border}`,
                    background: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: colors.color, flexShrink: 0,
                    lineHeight: 1,
                  }}
                >×</button>
              </div>
            ) : (
              // ── Empty Row — Selector Trigger ────────────────────────────
              <button
                type="button"
                onClick={() => {
                  setPopupOpen(row.id);
                  setSearchQuery('');
                  setActiveTab('All');
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1.5px dashed #c8d6e5',
                  borderRadius: 10,
                  background: popupOpen === row.id ? '#f0f6ff' : '#fafcff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: '#185FA5',
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f0f6ff'; e.currentTarget.style.borderColor = '#185FA5'; }}
                onMouseLeave={e => { if (popupOpen !== row.id) { e.currentTarget.style.background = '#fafcff'; e.currentTarget.style.borderColor = '#c8d6e5'; } }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', background: '#e6f1fb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0, color: '#185FA5',
                }}>＋</span>
                <span>Assign To Team Member</span>
              </button>
            )}

            {/* Popup for this row */}
            {popupOpen === row.id && (
              <TeamMemberPopup
                searchRef={searchRef}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                filteredMembers={filteredMembers}
                selectedUserIds={selectedUserIds}
                onSelect={(user) => handleSelectUser(row.id, user)}
                onClose={() => { setPopupOpen(null); setSearchQuery(''); }}
              />
            )}
          </div>
        );
      })}

      {/* Summary */}
      {rows.filter(r => r.selectedUser).length > 1 && (
        <div style={{ fontSize: 12, color: '#888', marginTop: 4, paddingLeft: 2 }}>
          {rows.filter(r => r.selectedUser).length} team members selected
        </div>
      )}
    </div>
  );
};

export default MultiAssignTeamMember;
