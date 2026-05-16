const CHAT_STORAGE_KEY = 'zsm_crm_chat';

const getStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || null;
  } catch (e) {
    return null;
  }
};

const setStorage = (data) => {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
};

const defaults = () => ({
  conversations: {},
  messages: {},
  typing: {},
  presence: {},
});

export const initializeChatDatabase = (currentUser) => {
  let store = getStorage();
  if (!store) {
    store = defaults();
    setStorage(store);
  }
  if (currentUser) {
    registerUser(currentUser);
  }
  return store;
};

export const registerUser = (user) => {
  const store = getStorage() || defaults();
  if (!store.presence) store.presence = {};
  store.presence[user.id] = {
    status: 'online',
    lastSeen: new Date().toISOString(),
    userName: user.name,
    department: user.department,
    role: user.role,
  };
  setStorage(store);
  return store;
};

export const updatePresence = (userId, status) => {
  const store = getStorage() || defaults();
  if (!store.presence) store.presence = {};
  if (store.presence[userId]) {
    store.presence[userId].status = status;
    store.presence[userId].lastSeen = new Date().toISOString();
  }
  setStorage(store);
};

const generateChatId = (participantIds, type) => {
  if (type === 'direct') {
    const sorted = [...participantIds].sort((a, b) => a - b);
    return `direct_${sorted.join('_')}`;
  }
  return `group_${participantIds.sort((a, b) => a - b).join('_')}_${Date.now()}`;
};

export const getOrCreateDirectChat = (user1Id, user2Id, allUsers) => {
  const store = getStorage() || defaults();
  if (!store.conversations) store.conversations = {};

  const sorted = [user1Id, user2Id].sort((a, b) => a - b);
  const chatId = `direct_${sorted.join('_')}`;

  if (store.conversations[chatId]) {
    return chatId;
  }

  const user1 = allUsers.find(u => u.id === user1Id);
  const user2 = allUsers.find(u => u.id === user2Id);

  store.conversations[chatId] = {
    id: chatId,
    type: 'direct',
    name: user2?.name || 'Unknown',
    participants: [user1Id, user2Id],
    createdAt: new Date().toISOString(),
    lastMessage: null,
    pinned: false,
  };
  if (!store.messages) store.messages = {};
  if (!store.messages[chatId]) store.messages[chatId] = [];
  setStorage(store);
  return chatId;
};

export const getDepartmentChatId = (department) => `dept_${department}`;

export const ensureDepartmentChat = (department, allUsers) => {
  const store = getStorage() || defaults();
  if (!store.conversations) store.conversations = {};

  const chatId = getDepartmentChatId(department);
  if (store.conversations[chatId]) return chatId;

  const deptUsers = allUsers.filter(u => u.department === department);
  store.conversations[chatId] = {
    id: chatId,
    type: 'department',
    name: `${department} Department`,
    department,
    participants: deptUsers.map(u => u.id),
    createdAt: new Date().toISOString(),
    lastMessage: null,
    pinned: false,
  };
  if (!store.messages) store.messages = {};
  if (!store.messages[chatId]) store.messages[chatId] = [];
  setStorage(store);

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
    store.messages[chatId].push(systemMsg);
    store.conversations[chatId].lastMessage = {
      text: systemMsg.text,
      senderId: 0,
      senderName: 'System',
      timestamp: systemMsg.timestamp,
    };
    setStorage(store);
  }

  return chatId;
};

export const refreshDepartmentChatMembers = (department, allUsers) => {
  const store = getStorage() || defaults();
  const chatId = getDepartmentChatId(department);
  if (!store.conversations[chatId]) return;

  const deptUsers = allUsers.filter(u => u.department === department);
  const currentParticipants = store.conversations[chatId].participants || [];
  const newIds = deptUsers.map(u => u.id);
  const added = newIds.filter(id => !currentParticipants.includes(id));
  const removed = currentParticipants.filter(id => !newIds.includes(id));

  if (added.length > 0 || removed.length > 0) {
    store.conversations[chatId].participants = newIds;
    if (!store.messages[chatId]) store.messages[chatId] = [];

    if (added.length > 0) {
      const addedNames = added.map(id => deptUsers.find(u => u.id === id)?.name).filter(Boolean);
      store.messages[chatId].push({
        id: `sys_${Date.now()}`,
        chatId,
        senderId: 0,
        senderName: 'System',
        text: `${addedNames.join(', ')} joined`,
        timestamp: new Date().toISOString(),
        type: 'system',
        readBy: [],
      });
    }
    setStorage(store);
  }
};

export const sendChatMessage = ({ chatId, senderId, senderName, text, type = 'text', replyTo = null, attachments = [] }) => {
  const store = getStorage() || defaults();
  if (!store.messages) store.messages = {};
  if (!store.messages[chatId]) store.messages[chatId] = [];

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
  };

  store.messages[chatId].push(msg);

  if (store.conversations[chatId]) {
    store.conversations[chatId].lastMessage = {
      text: type === 'file' ? `📎 ${attachments[0]?.fileName || 'File'}` : text,
      senderId,
      senderName,
      timestamp: msg.timestamp,
      type,
    };
  }

  setStorage(store);
  return msg;
};

export const deleteChatMessage = (chatId, messageId) => {
  const store = getStorage() || defaults();
  if (!store.messages[chatId]) return false;
  store.messages[chatId] = store.messages[chatId].map(m =>
    m.id === messageId ? { ...m, deleted: true, text: 'This message was deleted', attachments: [] } : m
  );
  setStorage(store);
  return true;
};

export const editChatMessage = (chatId, messageId, newText) => {
  const store = getStorage() || defaults();
  if (!store.messages[chatId]) return false;
  store.messages[chatId] = store.messages[chatId].map(m =>
    m.id === messageId ? { ...m, text: newText, edited: true } : m
  );
  setStorage(store);
  return true;
};

export const markMessagesRead = (chatId, userId) => {
  const store = getStorage() || defaults();
  if (!store.messages[chatId]) return;
  let changed = false;
  store.messages[chatId] = store.messages[chatId].map(m => {
    if (!m.readBy?.includes(userId)) {
      changed = true;
      return { ...m, readBy: [...(m.readBy || []), userId] };
    }
    return m;
  });
  if (changed) setStorage(store);
};

export const getUnreadCount = (chatId, userId) => {
  const store = getStorage() || defaults();
  if (!store.messages[chatId]) return 0;
  return store.messages[chatId].filter(m => m.senderId !== userId && !m.readBy?.includes(userId)).length;
};

export const getTotalUnreadCount = (userId) => {
  const store = getStorage() || defaults();
  if (!store.conversations || !store.messages) return 0;
  return Object.keys(store.conversations).reduce((sum, chatId) => {
    return sum + getUnreadCount(chatId, userId);
  }, 0);
};

export const setTyping = (chatId, userId, userName, isTyping) => {
  const store = getStorage() || defaults();
  if (!store.typing) store.typing = {};
  if (!store.typing[chatId]) store.typing[chatId] = {};
  if (isTyping) {
    store.typing[chatId][userId] = { timestamp: Date.now(), userName };
  } else {
    delete store.typing[chatId][userId];
  }
  setStorage(store);
};

export const getTypingUsers = (chatId, excludeUserId) => {
  const store = getStorage() || defaults();
  if (!store.typing || !store.typing[chatId]) return [];
  const now = Date.now();
  return Object.entries(store.typing[chatId])
    .filter(([id, data]) => Number(id) !== excludeUserId && (now - data.timestamp) < 3000)
    .map(([id, data]) => data.userName);
};

export const getConversations = () => {
  const store = getStorage() || defaults();
  return store.conversations || {};
};

export const getMessages = (chatId) => {
  const store = getStorage() || defaults();
  return store.messages?.[chatId] || [];
};

export const getPresence = () => {
  const store = getStorage() || defaults();
  return store.presence || {};
};

export const searchMessages = (query) => {
  const store = getStorage() || defaults();
  if (!store.messages) return [];
  const results = [];
  Object.keys(store.messages).forEach(chatId => {
    store.messages[chatId].forEach(msg => {
      if (!msg.deleted && msg.text.toLowerCase().includes(query.toLowerCase())) {
        results.push({ ...msg, chatId });
      }
    });
  });
  return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export const getAllChatUsers = (allUsers) => {
  const store = getStorage() || defaults();
  const presence = store.presence || {};
  return allUsers.map(u => ({
    ...u,
    online: presence[u.id]?.status === 'online',
    lastSeen: presence[u.id]?.lastSeen || null,
  }));
};

export const getChatById = (chatId) => {
  const store = getStorage() || defaults();
  return store.conversations?.[chatId] || null;
};
