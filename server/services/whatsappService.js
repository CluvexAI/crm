const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const sessions = new Map();
const qrCallbacks = new Map();

// Helper to read/write JSON safely
function readJSON(file, def) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : def; } catch { return def; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Data store paths for a specific user
function getPaths(userId) {
  const base = path.join(__dirname, '..', 'data');
  return {
    chats: path.join(base, `whatsapp-chats-${userId}.json`),
    messages: path.join(base, `whatsapp-messages-${userId}.json`),
    contacts: path.join(base, `whatsapp-contacts-${userId}.json`)
  };
}

/**
 * Start a WhatsApp session for a given userId.
 * Emits 'whatsapp:qr' and 'whatsapp:status' via the provided socket.io instance.
 */
async function startSession(userId, io) {
  const existingSock = sessions.get(userId);
  if (existingSock) {
    try {
      existingSock.ev.removeAllListeners();
      existingSock.logout().catch(e => console.log(`[WhatsApp] Logout error for ${userId}:`, e.message));
    } catch (e) {
      console.log(`[WhatsApp] Error cleaning up old socket for ${userId}`, e);
    }
    sessions.delete(userId);
  }

  const sessionDir = path.join(__dirname, '..', 'data', `whatsapp-auth-${userId}`);
  
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[WhatsApp] Using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const logger = pino({ level: 'debug' }); // Temporary debug logging for pairing issues

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: Browsers ? Browsers.macOS('Desktop') : ['Mac OS', 'Chrome', '10.15.7'],
    syncFullHistory: true, // Request full chat history on connect
  });

  sessions.set(userId, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`[WhatsApp] New QR for user ${userId}`);
      io.emit(`whatsapp:qr:${userId}`, qr);
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      console.log(`[WhatsApp] Connection closed for user ${userId}. Reconnect: ${!loggedOut}, statusCode: ${statusCode}`);
      
      if (loggedOut) {
        console.log(`[WhatsApp] User ${userId} logged out. Clearing session.`);
        io.emit(`whatsapp:status:${userId}`, { status: 'disconnected', reason: 'logged_out' });
        fs.rmSync(sessionDir, { recursive: true, force: true });
        sessions.delete(userId);
        updateUserSessionStatus(userId, 'disconnected');
      } else {
        io.emit(`whatsapp:status:${userId}`, { status: 'connecting', reason: 'reconnecting' });
        // Prevent immediate aggressive reconnects that can race and corrupt auth state
        setTimeout(() => {
          startSession(userId, io);
        }, 2000);
      }
    } else if (connection === 'open') {
      console.log(`[WhatsApp] Connection opened for user ${userId}`);
      io.emit(`whatsapp:status:${userId}`, { status: 'connected' });
      
      // Update users.json
      updateUserSessionStatus(userId, 'connected');
    }
  });

  const paths = getPaths(userId);

  // Initial Sync (Historical Data)
  sock.ev.on('messaging-history.set', ({ chats, contacts, messages, isLatest }) => {
    try {
      console.log(`[WhatsApp] History Set: ${chats.length} chats, ${messages.length} messages, ${contacts.length} contacts`);
      
      const storeChats = readJSON(paths.chats, []);
      const storeMessages = readJSON(paths.messages, {});
      const storeContacts = readJSON(paths.contacts, {});

      // Merge contacts
      contacts.forEach(c => { 
        if (!c.id) return;
        const existing = storeContacts[c.id] || {};
        storeContacts[c.id] = {
          ...existing,
          name: c.name || existing.name,
          notify: c.notify || existing.notify,
          lid: c.lid || existing.lid
        }; 
      });
      writeJSON(paths.contacts, storeContacts);

      // Merge chats
      chats.forEach(c => {
        if (!c.id) return;
        const existing = storeChats.find(sc => sc.id === c.id);
        if (!existing) storeChats.push(c);
        else Object.assign(existing, c);
      });
      // Sort chats by last message timestamp
      storeChats.sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0));
      writeJSON(paths.chats, storeChats);

      // Merge messages
      messages.forEach(m => {
        if (!m.key || !m.key.remoteJid) return;
        const jid = m.key.remoteJid;
        if (!storeMessages[jid]) storeMessages[jid] = [];
        if (!storeMessages[jid].find(x => x.key.id === m.key.id)) {
          storeMessages[jid].push(m);
        }
      });
      // Sort messages in each chat
      for (const jid in storeMessages) {
        storeMessages[jid].sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0));
      }
      writeJSON(paths.messages, storeMessages);

      io.emit(`whatsapp:sync_complete:${userId}`);
    } catch (err) {
      console.error('[WhatsApp] Error in messaging-history.set:', err);
    }
  });

  // Contacts upsert
  sock.ev.on('contacts.upsert', (contacts) => {
    try {
      const storeContacts = readJSON(paths.contacts, {});
      contacts.forEach(c => {
        if (!c.id) return;
        const existing = storeContacts[c.id] || {};
        storeContacts[c.id] = {
          ...existing,
          name: c.name || existing.name,
          notify: c.notify || existing.notify,
          lid: c.lid || existing.lid
        };
      });
      writeJSON(paths.contacts, storeContacts);
    } catch (err) {
      console.error('[WhatsApp] Error in contacts.upsert:', err);
    }
  });

  // Contacts update
  sock.ev.on('contacts.update', (updates) => {
    try {
      const storeContacts = readJSON(paths.contacts, {});
      updates.forEach(update => {
        if (!update.id) return;
        const existing = storeContacts[update.id] || {};
        storeContacts[update.id] = {
          ...existing,
          name: update.name || existing.name,
          notify: update.notify || existing.notify,
          lid: update.lid || existing.lid
        };
      });
      writeJSON(paths.contacts, storeContacts);
    } catch (err) {
      console.error('[WhatsApp] Error in contacts.update:', err);
    }
  });

  // Contacts update
  sock.ev.on('contacts.update', (updates) => {
    const storeContacts = readJSON(paths.contacts, {});
    updates.forEach(update => {
      if (update.id && (update.name || update.notify)) {
        storeContacts[update.id] = update.name || update.notify || storeContacts[update.id];
      }
    });
    writeJSON(paths.contacts, storeContacts);
  });

  // Chats upsert/update
  sock.ev.on('chats.upsert', (newChats) => {
    try {
      const storeChats = readJSON(paths.chats, []);
      newChats.forEach(c => {
        if (!c.id) return;
        const existing = storeChats.find(sc => sc.id === c.id);
        if (!existing) storeChats.push(c);
        else Object.assign(existing, c);
      });
      storeChats.sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0));
      writeJSON(paths.chats, storeChats);
      io.emit(`whatsapp:chats_update:${userId}`);
    } catch (err) {
      console.error('[WhatsApp] Error in chats.upsert:', err);
    }
  });

  sock.ev.on('chats.update', (updates) => {
    try {
      const storeChats = readJSON(paths.chats, []);
      let changed = false;
      updates.forEach(update => {
        if (!update.id) return;
        const existing = storeChats.find(c => c.id === update.id);
        if (existing) {
          Object.assign(existing, update);
          changed = true;
        }
      });
      if (changed) {
        storeChats.sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0));
        writeJSON(paths.chats, storeChats);
        io.emit(`whatsapp:chats_update:${userId}`);
      }
    } catch (err) {
      console.error('[WhatsApp] Error in chats.update:', err);
    }
  });

  // Messages upsert
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    try {
      if (type !== 'notify') return; // only process new incoming/outgoing
      const storeMessages = readJSON(paths.messages, {});
      const storeChats = readJSON(paths.chats, []);
      let chatsChanged = false;

      messages.forEach(m => {
        if (!m.key || !m.key.remoteJid) return;
        const jid = m.key.remoteJid;
        if (!storeMessages[jid]) storeMessages[jid] = [];
        if (!storeMessages[jid].find(x => x.key.id === m.key.id)) {
          storeMessages[jid].push(m);
          // Update chat timestamp to bubble up
          let chat = storeChats.find(c => c.id === jid);
          if (!chat) {
            chat = { id: jid, conversationTimestamp: m.messageTimestamp };
            storeChats.push(chat);
          } else {
            chat.conversationTimestamp = m.messageTimestamp;
          }
          chatsChanged = true;
          io.emit(`whatsapp:message_new:${userId}`, { jid, message: m });
        }
      });

      writeJSON(paths.messages, storeMessages);
      
      if (chatsChanged) {
        storeChats.sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0));
        writeJSON(paths.chats, storeChats);
        io.emit(`whatsapp:chats_update:${userId}`);
      }
    } catch (err) {
      console.error('[WhatsApp] Error in messages.upsert:', err);
    }
  });

  // Message status updates (sent, delivered, read)
  sock.ev.on('messages.update', (updates) => {
    try {
      const storeMessages = readJSON(paths.messages, {});
      let changed = false;

      updates.forEach(update => {
        const { key, update: msgUpdate } = update;
        if (!key || !key.remoteJid) return;
        
        const jid = key.remoteJid;
        if (storeMessages[jid]) {
          const msg = storeMessages[jid].find(m => m.key.id === key.id);
          if (msg && msgUpdate.status) {
            msg.status = msgUpdate.status;
            changed = true;
            io.emit(`whatsapp:message_update:${userId}`, { jid, message: msg });
          }
        }
      });

      if (changed) {
        writeJSON(paths.messages, storeMessages);
      }
    } catch (err) {
      console.error('[WhatsApp] Error in messages.update:', err);
    }
  });
}

/**
 * Helper to securely proxy outgoing messages through the active Baileys socket
 */
async function sendMessage(userId, chatId, content, options = {}) {
  const sock = sessions.get(userId);
  if (!sock) {
    throw new Error('WhatsApp session is not connected.');
  }

  const paths = getPaths(userId);
  let baileysOptions = {};

  // Handle Replies
  if (options.replyToMessageId) {
    const storeMessages = readJSON(paths.messages, {});
    const chatMessages = storeMessages[chatId] || [];
    const quotedMsg = chatMessages.find(m => m.key.id === options.replyToMessageId);
    if (quotedMsg) {
      baileysOptions.quoted = quotedMsg;
    }
  }

  // Handle Forwards
  if (options.forwardMessageId && content.forward === true) {
    const storeMessages = readJSON(paths.messages, {});
    // Forwards can come from other chats, but for simplicity we assume the same chat or we pass the original message
    const allMessages = Object.values(storeMessages).flat();
    const originalMsg = allMessages.find(m => m.key.id === options.forwardMessageId);
    if (originalMsg) {
      content = { forward: originalMsg };
    }
  }
  
  // Send the message using Baileys
  let result;
  let isFailed = false;
  try {
    result = await sock.sendMessage(chatId, content, baileysOptions);
  } catch (err) {
    console.error('[WhatsApp] Send failed, creating dummy message:', err);
    isFailed = true;
    result = {
      key: {
        remoteJid: chatId,
        fromMe: true,
        id: 'FAILED_' + Date.now() + Math.random().toString(36).substr(2, 5)
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: {},
      status: -1, // Custom status for failed messages
      payload: content // Stash the payload so the frontend can retry with the same text/media
    };

    if (content.text) result.message.conversation = content.text;
    else if (content.image) result.message.imageMessage = { caption: content.caption };
    else if (content.video) result.message.videoMessage = { caption: content.caption };
    else if (content.audio) result.message.audioMessage = { ptt: content.ptt };
    else if (content.document) result.message.documentMessage = { fileName: content.fileName };
  }
  
  // Optimistically store the outgoing message
  try {
    const storeMessages = readJSON(paths.messages, {});
    const storeChats = readJSON(paths.chats, []);

    if (!storeMessages[chatId]) storeMessages[chatId] = [];
    storeMessages[chatId].push(result);
    
    // Update chat timestamp to bubble up
    let chat = storeChats.find(c => c.id === chatId);
    if (!chat) {
      chat = { id: chatId, conversationTimestamp: result.messageTimestamp || Math.floor(Date.now() / 1000) };
      storeChats.push(chat);
    } else {
      chat.conversationTimestamp = result.messageTimestamp || Math.floor(Date.now() / 1000);
    }
    
    storeChats.sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0));
    writeJSON(paths.messages, storeMessages);
    writeJSON(paths.chats, storeChats);
  } catch (err) {
    console.error('[WhatsApp] Error optimistically saving message:', err);
  }
  
  if (isFailed) {
    throw new Error(JSON.stringify(result)); // Throw so the API knows it failed, but pass the dummy result
  }
  
  return result;
}

async function editMessage(userId, chatId, messageId, newText) {
  const sock = sessions.get(userId);
  if (!sock) throw new Error('WhatsApp session is not connected.');

  const paths = getPaths(userId);
  const storeMessages = readJSON(paths.messages, {});
  const chatMessages = storeMessages[chatId] || [];
  const originalMsg = chatMessages.find(m => m.key.id === messageId);
  
  if (!originalMsg) throw new Error('Message not found');

  const result = await sock.sendMessage(chatId, { text: newText, edit: originalMsg.key });
  return result;
}

async function deleteMessage(userId, chatId, messageId) {
  const sock = sessions.get(userId);
  if (!sock) throw new Error('WhatsApp session is not connected.');

  const paths = getPaths(userId);
  const storeMessages = readJSON(paths.messages, {});
  const chatMessages = storeMessages[chatId] || [];
  const originalMsg = chatMessages.find(m => m.key.id === messageId);
  
  if (!originalMsg) throw new Error('Message not found');

  const result = await sock.sendMessage(chatId, { delete: originalMsg.key });
  return result;
}

async function sendPresenceUpdate(userId, chatId, presence) {
  const sock = sessions.get(userId);
  if (!sock) return;
  await sock.sendPresenceUpdate(presence, chatId);
}

function logoutSession(userId) {
  const sock = sessions.get(userId);
  if (sock) {
    sock.logout().catch(e => console.log(`[WhatsApp] Logout error for ${userId}:`, e.message));
    sessions.delete(userId);
  }
  
  const sessionDir = path.join(__dirname, '..', 'data', `whatsapp-auth-${userId}`);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
  
  updateUserSessionStatus(userId, 'disconnected');
}

function updateUserSessionStatus(userId, status) {
  try {
    const usersFile = path.join(__dirname, '..', 'data', 'users.json');
    if (!fs.existsSync(usersFile)) return;
    
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const userIndex = users.findIndex(u => u.uuid === userId || u.id === userId);
    
    if (userIndex !== -1) {
      if (status === 'connected') {
        users[userIndex].whatsappSession = {
          status: 'connected',
          connectedAt: new Date().toISOString(),
          deviceId: `device-${userId}`,
        };
      } else {
        users[userIndex].whatsappSession = null;
      }
      fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    }
  } catch (error) {
    console.error(`[WhatsApp] Failed to update user session status:`, error);
  }
}

// Automatically reconnect any existing sessions on startup
function initializeExistingSessions(io) {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) return;
  
  const files = fs.readdirSync(dataDir);
  const sessionDirs = files.filter(f => f.startsWith('whatsapp-auth-'));
  
  sessionDirs.forEach(dir => {
    const userId = dir.replace('whatsapp-auth-', '');
    console.log(`[WhatsApp] Auto-starting session for ${userId}`);
    startSession(userId, io);
  });
}

module.exports = {
  startSession,
  logoutSession,
  initializeExistingSessions,
  sendMessage,
  editMessage,
  deleteMessage,
  sendPresenceUpdate,
};
