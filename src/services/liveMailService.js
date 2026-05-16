import { decrypt } from './cryptoService';
import { getMailConfig } from './emailService';
import { io } from 'socket.io-client';

const PROXY = 'http://localhost:5001';

// ─── Socket connection ────────────────────────────────────────────────────────
let socket = null;
const subscribers = {};

export const connectSocket = (userId, onNew, onSent, onRead) => {
  if (socket && socket.connected) {
    socket.emit('subscribe', { userId });
    return socket;
  }
  socket = io(PROXY, { transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    console.log('[LiveMail] Socket connected');
    socket.emit('subscribe', { userId });
  });
  socket.on('mail:new', ({ email }) => onNew && onNew(email));
  socket.on('mail:sent', ({ email }) => onSent && onSent(email));
  socket.on('mail:read', ({ id }) => onRead && onRead(id));
  socket.on('disconnect', () => console.log('[LiveMail] Socket disconnected'));
  subscribers[userId] = { onNew, onSent, onRead };
  return socket;
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};

// ─── Build config from user emailConfig ───────────────────────────────────────
const buildSmtpConfig = (emailConfig) => {
  const global = getMailConfig();
  return {
    host: global.smtpHost || 'mail.zsmeservices.com',
    port: global.smtpPort || 587,
    user: emailConfig.email,
    pass: decrypt(emailConfig.password),
    name: emailConfig.displayName || emailConfig.email,
  };
};

const buildImapConfig = (emailConfig) => {
  const global = getMailConfig();
  return {
    host: global.imapHost || 'mail.zsmeservices.com',
    port: global.imapPort || 993,
    user: emailConfig.email,
    pass: decrypt(emailConfig.password),
    secure: true,
  };
};

// ─── Health check ─────────────────────────────────────────────────────────────
export const checkProxyHealth = async () => {
  try {
    const res = await fetch(`${PROXY}/health`);
    return await res.json();
  } catch (e) {
    return { status: 'error', message: e.message };
  }
};

// ─── Fetch inbox from server store ───────────────────────────────────────────
export const fetchInbox = async (userId) => {
  const res = await fetch(`${PROXY}/api/mail/inbox?userId=${encodeURIComponent(userId)}`);
  const data = await res.json();
  return data.success ? data.data : [];
};

export const fetchSent = async (userId) => {
  const res = await fetch(`${PROXY}/api/mail/sent?userId=${encodeURIComponent(userId)}`);
  const data = await res.json();
  return data.success ? data.data : [];
};

export const fetchDrafts = async (userId) => {
  const res = await fetch(`${PROXY}/api/mail/drafts?userId=${encodeURIComponent(userId)}`);
  const data = await res.json();
  return data.success ? data.data : [];
};

// ─── Sync IMAP into server store ─────────────────────────────────────────────
export const syncImapInbox = async (emailConfig, userId) => {
  try {
    const res = await fetch(`${PROXY}/api/mail/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: buildImapConfig(emailConfig),
        userId,
        folders: ['INBOX'],
        limit: 50,
      }),
    });
    const data = await res.json();
    return data.success ? data.data.inbox : [];
  } catch (e) {
    console.error('[LiveMail] IMAP sync failed:', e.message);
    return [];
  }
};

// ─── Send email via SMTP ──────────────────────────────────────────────────────
export const sendLiveMail = async (emailConfig, userId, mailOptions) => {
  const res = await fetch(`${PROXY}/api/mail/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: buildSmtpConfig(emailConfig),
      mailOptions,
      userId,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Send failed');
  return data;
};

// ─── Save draft ───────────────────────────────────────────────────────────────
export const saveDraftToServer = async (userId, draft) => {
  const res = await fetch(`${PROXY}/api/mail/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, draft }),
  });
  const data = await res.json();
  return data.success ? data.data : null;
};

// ─── Delete mail ──────────────────────────────────────────────────────────────
export const deleteMail = async (userId, id) => {
  const res = await fetch(`${PROXY}/api/mail/${id}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  return await res.json();
};

// ─── Mark as read ─────────────────────────────────────────────────────────────
export const markAsRead = async (userId, id) => {
  const res = await fetch(`${PROXY}/api/mail/read/${id}?userId=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
  });
  return await res.json();
};

// ─── Star toggle ──────────────────────────────────────────────────────────────
export const toggleStar = async (userId, id) => {
  const res = await fetch(`${PROXY}/api/mail/star/${id}?userId=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
  });
  return await res.json();
};

// ─── Fetch full email body (IMAP) ─────────────────────────────────────────────
export const fetchEmailBody = async (emailConfig, folder, uid) => {
  const res = await fetch(`${PROXY}/api/mail/fetch-body`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: buildImapConfig(emailConfig),
      folder: folder || 'INBOX',
      uid,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Fetch failed');
  return data.data;
};

// ─── Fetch thread ─────────────────────────────────────────────────────────────
export const fetchThread = async (userId, id) => {
  const res = await fetch(`${PROXY}/api/mail/thread/${id}?userId=${encodeURIComponent(userId)}`);
  const data = await res.json();
  return data.success ? data.data : [];
};

// ─── Test connections ─────────────────────────────────────────────────────────
export const testImapLive = async (emailConfig) => {
  const res = await fetch(`${PROXY}/api/mail/test-imap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: buildImapConfig(emailConfig) }),
  });
  return await res.json();
};

export const testSmtpLive = async (emailConfig) => {
  const res = await fetch(`${PROXY}/api/mail/test-smtp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: buildSmtpConfig(emailConfig) }),
  });
  return await res.json();
};
