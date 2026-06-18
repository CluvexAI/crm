import { io } from 'socket.io-client';

const PROXY = process.env.REACT_APP_API_URL || '';
const CHAT_STORAGE_KEY = 'zsm_crm_chat';

// ─── In-Memory Cache ──────────────────────────────────────────────────────────
let cache = {
  conversations: {},
  messages: {},
  presence: {},
  typing: {},
};

// ─── Socket Singleton ─────────────────────────────────────────────────────────
let socket = null;
let currentUserId = null;
let reconnectAttempts = 0; // eslint-disable-line no-unused-vars
const MAX_RECONNECT_DELAY = 30000;

// ─── Event Subscribers ────────────────────────────────────────────────────────
// Listeners get notified instantly when chat data changes
const listeners = new Set();

const notifyListeners = (event, data) => {
  listeners.forEach(cb => {
    try { cb(event, data); } catch (e) { console.error('[ChatService] Listener error:', e); }
  });
};

/**
 * Subscribe to real-time chat updates.
 * Returns an unsubscribe function.
 * 
 * Events: 'message', 'presence', 'typing', 'read', 'conversation', 'sync', 'connection'
 */
export const subscribeToChatUpdates = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

// ─── LocalStorage Fallback (for offline resilience) ───────────────────────────
const saveToLocalStorage = () => {
  try {
    const toStore = {
      conversations: cache.conversations,
      messages: cache.messages,
      presence: cache.presence,
    };
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) { /* quota exceeded or private mode */ }
};

const loadFromLocalStorage = () => {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.conversations) cache.conversations = parsed.conversations;
      if (parsed.messages) cache.messages = parsed.messages;
      if (parsed.presence) cache.presence = parsed.presence;
    }
  } catch (e) { /* ignore */ }
};

// ─── Connection Management ────────────────────────────────────────────────────

export const getConnectionStatus = () => {
  if (!socket) return 'disconnected';
  if (socket.connected) return 'connected';
  return 'reconnecting';
};

/**
 * Initialize the WebSocket connection for chat.
 * Should be called once on user login.
 */
export const initializeChatConnection = async (userId, userName) => {
  if (!userId) return;
  currentUserId = String(userId);

  // Load local cache first (instant UI)
  loadFromLocalStorage();

  // Fetch full state from server
  try {
    const res = await fetch(`${PROXY}/api/chat/sync?userId=${encodeURIComponent(currentUserId)}`);
    if (res.ok) {
      const { data } = await res.json();
      if (data) {
        // Merge server data into cache (server is authoritative)
        cache.conversations = { ...cache.conversations, ...data.conversations };
        // For messages: server wins, but keep any pending local-only messages
        Object.keys(data.messages).forEach(chatId => {
          const serverMsgs = data.messages[chatId] || [];
          const localMsgs = cache.messages[chatId] || [];
          // Merge: use server messages + any local messages not on server
          const serverIds = new Set(serverMsgs.map(m => m.id));
          const uniqueLocal = localMsgs.filter(m => !serverIds.has(m.id));
          cache.messages[chatId] = [...serverMsgs, ...uniqueLocal];
        });
        // Also add conversations in cache that server doesn't have yet
        // (already handled by spread above)
        cache.presence = { ...cache.presence, ...data.presence };
        saveToLocalStorage();
        notifyListeners('sync', {});
      }
    }
  } catch (e) {
    console.warn('[ChatService] Server sync failed, using local cache:', e.message);
  }

  // Connect WebSocket
  if (socket && socket.connected) {
    socket.emit('chat:subscribe', { userId: currentUserId, userName });
    return;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(PROXY, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: MAX_RECONNECT_DELAY,
  });

  socket.on('connect', () => {
    reconnectAttempts = 0;
    console.log('[ChatService] Socket connected');
    socket.emit('chat:subscribe', { userId: currentUserId, userName });
    notifyListeners('connection', { status: 'connected' });
  });

  socket.on('disconnect', (reason) => {
    console.log('[ChatService] Socket disconnected:', reason);
    notifyListeners('connection', { status: 'disconnected', reason });
  });

  socket.on('reconnect_attempt', (attempt) => {
    reconnectAttempts = attempt;
    notifyListeners('connection', { status: 'reconnecting', attempt });
  });

  socket.on('reconnect', () => {
    console.log('[ChatService] Reconnected');
    socket.emit('chat:subscribe', { userId: currentUserId, userName });
    notifyListeners('connection', { status: 'connected' });
  });

  // ─── Inbound Events ──────────────────────────────────────────────────────

  socket.on('chat:message', ({ chatId, message }) => {
    if (!chatId || !message) return;
    if (!cache.messages[chatId]) cache.messages[chatId] = [];

    // Dedup
    const exists = cache.messages[chatId].some(m => m.id === message.id);
    if (exists) return;

    cache.messages[chatId].push(message);

    // Update conversation lastMessage
    if (cache.conversations[chatId]) {
      cache.conversations[chatId].lastMessage = {
        text: message.type === 'file' ? `📎 ${message.attachments?.[0]?.fileName || 'File'}` : message.text,
        senderId: message.senderId,
        senderName: message.senderName,
        timestamp: message.timestamp,
        type: message.type,
      };
    }

    saveToLocalStorage();
    notifyListeners('message', { chatId, message });
  });

  socket.on('chat:message_edited', ({ chatId, messageId, newText }) => {
    if (!cache.messages[chatId]) return;
    cache.messages[chatId] = cache.messages[chatId].map(m =>
      m.id === messageId ? { ...m, text: newText, edited: true } : m
    );
    saveToLocalStorage();
    notifyListeners('message', { chatId, messageId, edited: true });
  });

  socket.on('chat:message_deleted', ({ chatId, messageId }) => {
    if (!cache.messages[chatId]) return;
    cache.messages[chatId] = cache.messages[chatId].map(m =>
      m.id === messageId ? { ...m, deleted: true, text: 'This message was deleted', attachments: [] } : m
    );
    saveToLocalStorage();
    notifyListeners('message', { chatId, messageId, deleted: true });
  });

  socket.on('chat:messages_read', ({ chatId, userId: readByUserId }) => {
    if (!cache.messages[chatId]) return;
    cache.messages[chatId] = cache.messages[chatId].map(m => {
      const readByStrings = (m.readBy || []).map(String);
      if (!readByStrings.includes(String(readByUserId))) {
        return { ...m, readBy: [...(m.readBy || []), readByUserId] };
      }
      return m;
    });
    saveToLocalStorage();
    notifyListeners('read', { chatId, userId: readByUserId });
  });

  socket.on('chat:presence', ({ userId: uid, status, lastSeen }) => {
    if (!cache.presence[uid]) cache.presence[uid] = {};
    cache.presence[uid].status = status;
    cache.presence[uid].lastSeen = lastSeen;
    saveToLocalStorage();
    notifyListeners('presence', { userId: uid, status, lastSeen });
  });

  socket.on('chat:typing', ({ chatId, userId: uid, userName: uName, isTyping }) => {
    if (!cache.typing[chatId]) cache.typing[chatId] = {};
    if (isTyping) {
      cache.typing[chatId][uid] = { timestamp: Date.now(), userName: uName };
    } else {
      delete cache.typing[chatId][uid];
    }
    notifyListeners('typing', { chatId, userId: uid, userName: uName, isTyping });
  });

  socket.on('chat:conversation_updated', ({ conversation }) => {
    if (!conversation || !conversation.id) return;
    cache.conversations[conversation.id] = conversation;
    if (!cache.messages[conversation.id]) cache.messages[conversation.id] = [];
    saveToLocalStorage();
    notifyListeners('conversation', { conversation });
  });
};

/**
 * Disconnect the chat WebSocket.
 * Should be called on user logout.
 */
export const disconnectChat = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentUserId = null;
};

// ─── Public API (same signatures as before, but now WebSocket-backed) ─────────

export const initializeChatDatabase = (currentUser) => {
  // Legacy compat — just load from localStorage if no connection yet
  loadFromLocalStorage();
  if (currentUser) {
    registerUser(currentUser);
  }
  return cache;
};

export const registerUser = (user) => {
  const uid = String(user.id);
  if (!cache.presence[uid]) cache.presence[uid] = {};
  cache.presence[uid] = {
    ...cache.presence[uid],
    status: 'online',
    lastSeen: new Date().toISOString(),
    userName: user.name,
    department: user.department,
    role: user.role,
  };
  saveToLocalStorage();
};

export const updatePresence = (userId, status) => {
  const uid = String(userId);
  if (!cache.presence[uid]) cache.presence[uid] = {};
  cache.presence[uid].status = status;
  cache.presence[uid].lastSeen = new Date().toISOString();
  saveToLocalStorage();
};

export const getOrCreateDirectChat = (user1Id, user2Id, allUsers) => {
  const sorted = [user1Id, user2Id].map(id => String(id)).sort();
  const chatId = `direct_${sorted.join('_')}`;

  if (cache.conversations[chatId]) {
    return chatId;
  }

  const user2 = allUsers.find(u => String(u.id) === String(user2Id));

  const conversation = {
    id: chatId,
    type: 'direct',
    name: user2?.name || 'Unknown',
    participants: [String(user1Id), String(user2Id)],
    createdAt: new Date().toISOString(),
    lastMessage: null,
    pinned: false,
  };

  cache.conversations[chatId] = conversation;
  if (!cache.messages[chatId]) cache.messages[chatId] = [];
  saveToLocalStorage();

  // Tell server about this conversation
  if (socket && socket.connected) {
    socket.emit('chat:ensure_conversation', { chatId, conversation });
  }

  return chatId;
};

export const getDepartmentChatId = (department) => `dept_${department}`;

export const ensureDepartmentChat = (department, allUsers) => {
  const chatId = getDepartmentChatId(department);
  if (cache.conversations[chatId]) return chatId;

  const deptUsers = allUsers.filter(u => u.department === department);
  const conversation = {
    id: chatId,
    type: 'department',
    name: `${department} Department`,
    department,
    participants: deptUsers.map(u => u.id),
    createdAt: new Date().toISOString(),
    lastMessage: null,
    pinned: false,
  };

  cache.conversations[chatId] = conversation;
  if (!cache.messages[chatId]) cache.messages[chatId] = [];

  if (deptUsers.length > 0) {
    const systemMsg = {
      id: `sys_${Date.now()}`,
      chatId,
      senderId: 0,
      senderName: 'System',
      text: `${department} department chat created with ${deptUsers.length} members`,
      timestamp: new Date().toISOString(),
      type: 'system',
      readBy: [],
    };
    cache.messages[chatId].push(systemMsg);
    cache.conversations[chatId].lastMessage = {
      text: systemMsg.text,
      senderId: 0,
      senderName: 'System',
      timestamp: systemMsg.timestamp,
    };
  }

  saveToLocalStorage();

  // Tell server
  if (socket && socket.connected) {
    socket.emit('chat:ensure_conversation', { chatId, conversation: cache.conversations[chatId] });
  }

  return chatId;
};

export const refreshDepartmentChatMembers = (department, allUsers) => {
  const chatId = getDepartmentChatId(department);
  if (!cache.conversations[chatId]) return;

  const deptUsers = allUsers.filter(u => u.department === department);
  const currentParticipants = cache.conversations[chatId].participants || [];
  const newIds = deptUsers.map(u => u.id);
  const added = newIds.filter(id => !currentParticipants.includes(id));
  const removed = currentParticipants.filter(id => !newIds.includes(id));

  if (added.length > 0 || removed.length > 0) {
    cache.conversations[chatId].participants = newIds;
    if (!cache.messages[chatId]) cache.messages[chatId] = [];

    if (added.length > 0) {
      const addedNames = added.map(id => deptUsers.find(u => u.id === id)?.name).filter(Boolean);
      const sysMsg = {
        id: `sys_${Date.now()}`,
        chatId,
        senderId: 0,
        senderName: 'System',
        text: `${addedNames.join(', ')} joined`,
        timestamp: new Date().toISOString(),
        type: 'system',
        readBy: [],
      };
      cache.messages[chatId].push(sysMsg);

      // Notify server
      if (socket && socket.connected) {
        socket.emit('chat:send', { chatId, message: sysMsg });
      }
    }
    saveToLocalStorage();
  }
};

export const sendChatMessage = ({ chatId, senderId, senderName, text, type = 'text', replyTo = null, attachments = [] }) => {
  if (!cache.messages[chatId]) cache.messages[chatId] = [];

  const msg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    chatId,
    senderId,
    senderName,
    text,
    timestamp: new Date().toISOString(),
    type,
    replyTo,
    attachments,
    edited: false,
    deleted: false,
    readBy: [senderId],
    forwarded: false,
    status: 'sent',
  };

  // Optimistic: add to local cache immediately
  cache.messages[chatId].push(msg);

  if (cache.conversations[chatId]) {
    cache.conversations[chatId].lastMessage = {
      text: type === 'file' ? `📎 ${attachments[0]?.fileName || 'File'}` : text,
      senderId,
      senderName,
      timestamp: msg.timestamp,
      type,
    };
  }

  saveToLocalStorage();

  // Send via WebSocket (server will broadcast to all participants including sender for dedup)
  if (socket && socket.connected) {
    socket.emit('chat:send', { chatId, message: msg });
  }

  // Notify local listeners immediately (optimistic update)
  notifyListeners('message', { chatId, message: msg });

  return msg;
};

export const deleteChatMessage = (chatId, messageId) => {
  if (!cache.messages[chatId]) return false;
  cache.messages[chatId] = cache.messages[chatId].map(m =>
    m.id === messageId ? { ...m, deleted: true, text: 'This message was deleted', attachments: [] } : m
  );
  saveToLocalStorage();

  if (socket && socket.connected) {
    socket.emit('chat:delete', { chatId, messageId });
  }

  notifyListeners('message', { chatId, messageId, deleted: true });
  return true;
};

export const editChatMessage = (chatId, messageId, newText) => {
  if (!cache.messages[chatId]) return false;
  cache.messages[chatId] = cache.messages[chatId].map(m =>
    m.id === messageId ? { ...m, text: newText, edited: true } : m
  );
  saveToLocalStorage();

  if (socket && socket.connected) {
    socket.emit('chat:edit', { chatId, messageId, newText });
  }

  notifyListeners('message', { chatId, messageId, edited: true });
  return true;
};

export const markMessagesRead = (chatId, userId) => {
  if (!cache.messages[chatId]) return;
  let changed = false;
  cache.messages[chatId] = cache.messages[chatId].map(m => {
    const readByStrings = (m.readBy || []).map(String);
    if (!readByStrings.includes(String(userId))) {
      changed = true;
      return { ...m, readBy: [...(m.readBy || []), userId] };
    }
    return m;
  });
  if (changed) {
    saveToLocalStorage();
    if (socket && socket.connected) {
      socket.emit('chat:read', { chatId, userId });
    }
    notifyListeners('read', { chatId, userId });
  }
};

export const getUnreadCount = (chatId, userId) => {
  if (!cache.messages[chatId]) return 0;
  return cache.messages[chatId].filter(m =>
    String(m.senderId) !== String(userId) &&
    !m.deleted &&
    m.type !== 'system' &&
    !(m.readBy || []).map(String).includes(String(userId))
  ).length;
};

export const getTotalUnreadCount = (userId) => {
  if (!cache.conversations || !cache.messages) return 0;
  return Object.keys(cache.conversations).reduce((sum, chatId) => {
    const conv = cache.conversations[chatId];
    if (conv.participants?.map(String).includes(String(userId))) {
      return sum + getUnreadCount(chatId, userId);
    }
    return sum;
  }, 0);
};

export const setTyping = (chatId, userId, userName, isTyping) => {
  if (!cache.typing) cache.typing = {};
  if (!cache.typing[chatId]) cache.typing[chatId] = {};
  if (isTyping) {
    cache.typing[chatId][userId] = { timestamp: Date.now(), userName };
  } else {
    delete cache.typing[chatId][userId];
  }

  // Send via WebSocket
  if (socket && socket.connected) {
    socket.emit('chat:typing', { chatId, userId, userName, isTyping });
  }
};

export const getTypingUsers = (chatId, excludeUserId) => {
  if (!cache.typing || !cache.typing[chatId]) return [];
  const now = Date.now();
  return Object.entries(cache.typing[chatId])
    .filter(([id, data]) => String(id) !== String(excludeUserId) && (now - data.timestamp) < 5000)
    .map(([, data]) => data.userName);
};

export const getConversations = () => {
  return cache.conversations || {};
};

export const getMessages = (chatId) => {
  return cache.messages?.[chatId] || [];
};

export const getPresence = () => {
  return cache.presence || {};
};

export const searchMessages = (query) => {
  if (!cache.messages) return [];
  const results = [];
  Object.keys(cache.messages).forEach(chatId => {
    (cache.messages[chatId] || []).forEach(msg => {
      if (!msg.deleted && msg.text && msg.text.toLowerCase().includes(query.toLowerCase())) {
        results.push({ ...msg, chatId });
      }
    });
  });
  return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export const getAllChatUsers = (allUsers) => {
  const presence = cache.presence || {};
  return allUsers.map(u => ({
    ...u,
    online: presence[String(u.id)]?.status === 'online',
    lastSeen: presence[String(u.id)]?.lastSeen || null,
  }));
};

export const getChatById = (chatId) => {
  return cache.conversations?.[chatId] || null;
};

export const syncChatUsers = (allUsers) => {
  if (!allUsers || !Array.isArray(allUsers)) return;
  let changed = false;
  const now = new Date().toISOString();

  allUsers.forEach(user => {
    if (!user || !user.id) return;
    const uid = String(user.id);
    if (!cache.presence[uid]) {
      cache.presence[uid] = {
        status: 'offline',
        lastSeen: now,
        userName: user.name || '',
        department: user.department || '',
        role: user.role || '',
      };
      changed = true;
    } else {
      if (cache.presence[uid].userName !== user.name) {
        cache.presence[uid].userName = user.name;
        changed = true;
      }
      if (cache.presence[uid].department !== user.department) {
        cache.presence[uid].department = user.department;
        changed = true;
      }
    }
  });

  if (changed) saveToLocalStorage();
};
