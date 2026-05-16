
// Shared style tokens for the Outlook-style email interface
export const colors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#eff6ff',
  primaryBg: '#dbeafe',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  bg: '#f3f4f6',
  surface: '#ffffff',
  surfaceHover: '#f9fafb',
  text: '#1f2937',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  danger: '#ef4444',
  dangerBg: '#fee2e2',
  unread: '#fafbff',
  headerBg: '#1e3a5f',
};

export const folder_icons = {
  inbox: '📥', focused: '🎯', other: '⊙', drafts: '📄', sent: '📤',
  scheduled: '🕐', archive: '🗂', spam: '🛡', trash: '🗑',
  templates: '📋', attachments: '📎', important: '🔖', flagged: '🚩',
};

export const label_colors = {
  Clients: '#10b981', Leads: '#f59e0b', Sales: '#3b82f6',
  'Backend Team': '#8b5cf6', Internal: '#6b7280',
};

export const formatEmailDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatFullDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long',
    day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const getInitials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export const getAvatarColor = (name = '') => {
  const palette = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % palette.length;
  return palette[h];
};

export const generateId = () =>
  `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Permission helpers matching existing roles
export const getRolePermissions = (role = '') => {
  const r = role.toLowerCase();
  return {
    canViewAllInboxes: r === 'admin',
    canDeleteOthers: r === 'admin',
    canReassign: r === 'admin' || r === 'manager',
    canComposeExternal: r !== 'agent',
    canAccessArchive: r === 'admin' || r === 'manager' || r === 'sales',
    isAdmin: r === 'admin',
  };
};
