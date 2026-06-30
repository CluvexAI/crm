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
function getPaths(connectionId) {
  const base = path.join(__dirname, '..', 'data');
  return {
    chats: path.join(base, `whatsapp-chats-${connectionId}.json`),
    messages: path.join(base, `whatsapp-messages-${connectionId}.json`),
    contacts: path.join(base, `whatsapp-contacts-${connectionId}.json`)
  };
}

/**
 * Start a WhatsApp session for a given connectionId.
 * Emits 'whatsapp:qr' and 'whatsapp:status' via the provided socket.io instance.
 */
async function startSession(connectionId, io) {
  const existingSock = sessions.get(connectionId);
  if (existingSock) {
    try {
      existingSock.ev.removeAllListeners();
      existingSock.logout().catch(e => console.log(`[WhatsApp] Logout error for ${connectionId}:`, e.message));
    } catch (e) {
      console.log(`[WhatsApp] Error cleaning up old socket for ${connectionId}`, e);
    }
    sessions.delete(connectionId);
  }

  const sessionDir = path.join(__dirname, '..', 'data', `whatsapp-auth-${connectionId}`);
  
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
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    syncFullHistory: true, // Request full chat history on connect
  });

  sessions.set(connectionId, sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`[WhatsApp] New QR for user ${connectionId}`);
      io.emit(`whatsapp:qr:${connectionId}`, qr);
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      console.log(`[WhatsApp] Connection closed for user ${connectionId}. Reconnect: ${!loggedOut}, statusCode: ${statusCode}`);
      
      if (loggedOut) {
        console.log(`[WhatsApp] User ${connectionId} logged out. Clearing session.`);
        io.emit(`whatsapp:status:${connectionId}`, { status: 'disconnected', reason: 'logged_out' });
        // Defer deletion slightly on Windows to allow file handles to release, and wrap in try-catch to prevent crashes
        setTimeout(() => {
          try {
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
              console.log(`[WhatsApp] Successfully cleared session directory: ${sessionDir}`);
            }
          } catch (err) {
            console.warn(`[WhatsApp] Warning: could not clear session directory ${sessionDir} (locked or already removed):`, err.message);
          }
        }, 1000);
        sessions.delete(connectionId);
        updateConnectionStatus(connectionId, 'disconnected');
      } else {
        io.emit(`whatsapp:status:${connectionId}`, { status: 'connecting', reason: 'reconnecting' });
        // Prevent immediate aggressive reconnects that can race and corrupt auth state
        setTimeout(() => {
          startSession(connectionId, io);
        }, 2000);
      }
    } else if (connection === 'open') {
      console.log(`[WhatsApp] Connection opened for user ${connectionId}`);
      io.emit(`whatsapp:status:${connectionId}`, { status: 'connected' });
      
      // Update users.json
      updateConnectionStatus(connectionId, 'connected');
    }
  });

  const paths = getPaths(connectionId);

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

      io.emit(`whatsapp:sync_complete:${connectionId}`);
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
      io.emit(`whatsapp:chats_update:${connectionId}`);
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
        io.emit(`whatsapp:chats_update:${connectionId}`);
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
          io.emit(`whatsapp:message_new:${connectionId}`, { jid, message: m });
        }
      });

      writeJSON(paths.messages, storeMessages);
      
      if (chatsChanged) {
        storeChats.sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0));
        writeJSON(paths.chats, storeChats);
        io.emit(`whatsapp:chats_update:${connectionId}`);
      }
    } catch (err) {
      console.error('[WhatsApp] Error in messages.upsert:', err);
    }
  });
  // Handle incoming calls (reject and log)
  sock.ev.on('call', async (calls) => {
    try {
      const storeMessages = readJSON(paths.messages, {});
      const storeChats = readJSON(paths.chats, []);
      let chatsChanged = false;

      for (const call of calls) {
        if (call.status === 'offer') {
          console.log(`[WhatsApp] Incoming call from ${call.from}, rejecting...`);
          
          // Reject the call
          try {
            await sock.rejectCall(call.id, call.from);
            await sock.sendMessage(call.from, { 
              text: "We cannot accept WhatsApp calls. Please send a text message instead." 
            });
          } catch (e) {
            console.error('[WhatsApp] Failed to reject call/send message:', e);
          }

          // Create a synthetic call log message
          const jid = call.from;
          const syntheticMessage = {
            key: {
              remoteJid: jid,
              fromMe: false,
              id: call.id
            },
            messageTimestamp: Math.floor(Date.now() / 1000),
            message: {
              conversation: `[Missed Call / Rejected]`
            },
            isCallLog: true
          };

          if (!storeMessages[jid]) storeMessages[jid] = [];
          storeMessages[jid].push(syntheticMessage);
          
          let chat = storeChats.find(c => c.id === jid);
          if (!chat) {
            chat = { id: jid, conversationTimestamp: syntheticMessage.messageTimestamp };
            storeChats.push(chat);
          } else {
            chat.conversationTimestamp = syntheticMessage.messageTimestamp;
          }
          chatsChanged = true;
          io.emit(`whatsapp:message_new:${connectionId}`, { jid, message: syntheticMessage });
        }
      }

      writeJSON(paths.messages, storeMessages);
      
      if (chatsChanged) {
        storeChats.sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0));
        writeJSON(paths.chats, storeChats);
        io.emit(`whatsapp:chats_update:${connectionId}`);
      }
    } catch (err) {
      console.error('[WhatsApp] Error handling call event:', err);
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
            io.emit(`whatsapp:message_update:${connectionId}`, { jid, message: msg });
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
async function sendMessage(connectionId, chatId, content, options = {}) {
  const sock = sessions.get(connectionId);
  if (!sock) {
    throw new Error('WhatsApp session is not connected.');
  }

  const paths = getPaths(connectionId);
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

async function editMessage(connectionId, chatId, messageId, newText) {
  const sock = sessions.get(connectionId);
  if (!sock) throw new Error('WhatsApp session is not connected.');

  const paths = getPaths(connectionId);
  const storeMessages = readJSON(paths.messages, {});
  const chatMessages = storeMessages[chatId] || [];
  const originalMsg = chatMessages.find(m => m.key.id === messageId);
  
  if (!originalMsg) throw new Error('Message not found');

  const result = await sock.sendMessage(chatId, { text: newText, edit: originalMsg.key });
  return result;
}

async function deleteMessage(connectionId, chatId, messageId) {
  const sock = sessions.get(connectionId);
  if (!sock) throw new Error('WhatsApp session is not connected.');

  const paths = getPaths(connectionId);
  const storeMessages = readJSON(paths.messages, {});
  const chatMessages = storeMessages[chatId] || [];
  const originalMsg = chatMessages.find(m => m.key.id === messageId);
  
  if (!originalMsg) throw new Error('Message not found');

  const result = await sock.sendMessage(chatId, { delete: originalMsg.key });
  return result;
}

async function sendPresenceUpdate(connectionId, chatId, presence) {
  const sock = sessions.get(connectionId);
  if (!sock) return;
  await sock.sendPresenceUpdate(presence, chatId);
}

function logoutSession(connectionId) {
  const sock = sessions.get(connectionId);
  if (sock) {
    sock.logout().catch(e => console.log(`[WhatsApp] Logout error for ${connectionId}:`, e.message));
    sessions.delete(connectionId);
  }
  
  const sessionDir = path.join(__dirname, '..', 'data', `whatsapp-auth-${connectionId}`);
  // Defer deletion slightly on Windows to allow file handles to release, and wrap in try-catch to prevent crashes
  setTimeout(() => {
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`[WhatsApp] Successfully cleared session directory on logout: ${sessionDir}`);
      }
    } catch (err) {
      console.warn(`[WhatsApp] Warning: could not clear session directory ${sessionDir} on logout:`, err.message);
    }
  }, 1000);
  
  updateConnectionStatus(connectionId, 'disconnected');
}

function updateConnectionStatus(connectionId, status) {
  try {
    const connFile = path.join(__dirname, '..', 'data', 'whatsapp-connections.json');
    if (!fs.existsSync(connFile)) {
      fs.writeFileSync(connFile, JSON.stringify([]));
    }
    
    const connections = JSON.parse(fs.readFileSync(connFile, 'utf8'));
    const connIndex = connections.findIndex(c => c.id === connectionId);
    
    if (connIndex !== -1) {
      if (status === 'connected') {
        connections[connIndex].status = 'connected';
        connections[connIndex].connectedAt = new Date().toISOString();
      } else {
        connections[connIndex].status = 'disconnected';
      }
      fs.writeFileSync(connFile, JSON.stringify(connections, null, 2));
    } else if (status === 'connected') {
      connections.push({
        id: connectionId,
        name: connectionId,
        status: 'connected',
        connectedAt: new Date().toISOString()
      });
      fs.writeFileSync(connFile, JSON.stringify(connections, null, 2));
    }
  } catch (error) {
    console.error(`[WhatsApp] Failed to update connection status:`, error);
  }
}

// Automatically reconnect any existing sessions on startup
function initializeExistingSessions(io) {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) return;
  
  const files = fs.readdirSync(dataDir);
  const sessionDirs = files.filter(f => f.startsWith('whatsapp-auth-'));
  
  sessionDirs.forEach(dir => {
    const connectionId = dir.replace('whatsapp-auth-', '');
    console.log(`[WhatsApp] Auto-starting session for ${connectionId}`);
    startSession(connectionId, io);
  });
}


async function getProfilePicUrl(connectionId, jid) {
  try {
    const sock = sessions.get(connectionId);
    if (sock) {
      const url = await sock.profilePictureUrl(jid, 'image');
      return url;
    }
  } catch (err) {
    // Ignore errors (e.g. no profile picture)
  }
  return null;
}

module.exports = {
  getProfilePicUrl,
  startSession,
  logoutSession,
  initializeExistingSessions,
  sendMessage,
  editMessage,
  deleteMessage,
  sendPresenceUpdate,
};
