import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  getOrCreateDirectChat,
  ensureDepartmentChat,
  sendChatMessage,
  deleteChatMessage,
  editChatMessage,
  markMessagesRead,
  getUnreadCount,
  setTyping,
  getTypingUsers,
  getConversations,
  getMessages,
  getPresence,
  searchMessages,
  getAllChatUsers,
  syncChatUsers,
} from '../services/chatService';

const EMOJIS = ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','👍','👎','👊','✊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✌️','🤟','🤘','👌','💪','❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💖','💗','💘','💝','🎉','🎊','🎈','🔥','⭐','✨','💡','📌','📍','✅','❌','❓','❗','💯','🔔'];

const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (_) {}
};

const ChatPage = () => {
  const { currentUser, allUsers } = useApp();
  const [chatList, setChatList] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [text, setText] = useState('');
  const [convSearch, setConvSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [typingUsers, setTypingUsers] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [showFilePreview, setShowFilePreview] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeptPanel, setShowDeptPanel] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedDirectUserId, setSelectedDirectUserId] = useState(null);
  const msgEndRef = useRef(null);
  const textRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const prevMsgCountRef = useRef(0);
  const userListRef = useRef(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const userItemHeight = 68;

  const chatUsers = getAllChatUsers(allUsers);

  useEffect(() => {
    syncChatUsers(allUsers);
  }, [allUsers]);

  useEffect(() => {
    const update = () => {
      const conversations = getConversations();
      const list = Object.values(conversations).sort((a, b) => {
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp);
      });
      setChatList(list);
    };
    update();
    const iv = setInterval(update, 2000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      if (!selectedChatId) return;
      const msgs = getMessages(selectedChatId);
      if (msgs.length !== prevMsgCountRef.current) {
        if (msgs.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
          const newMsgs = msgs.slice(prevMsgCountRef.current);
          const hasNewFromOther = newMsgs.some(m => m.senderId !== currentUser.id && m.type !== 'system');
          if (hasNewFromOther) {
            playNotificationSound();
            try {
              if (Notification.permission === 'granted') {
                const lastMsg = newMsgs.filter(m => m.senderId !== currentUser.id).pop();
                if (lastMsg) {
                  new Notification(`New message from ${lastMsg.senderName}`, {
                    body: lastMsg.type === 'file' ? 'Sent a file' : lastMsg.text,
                    icon: '/logo192.png',
                  });
                }
              }
            } catch (_) {}
          }
        }
        prevMsgCountRef.current = msgs.length;
      }
      setMessages([...msgs]);
      const typing = getTypingUsers(selectedChatId, currentUser.id);
      setTypingUsers(typing);
      markMessagesRead(selectedChatId, currentUser.id);
    }, 1000);
    return () => clearInterval(iv);
  }, [selectedChatId, currentUser.id]);

  useEffect(() => {
    if (selectedChatId) {
      const msgs = getMessages(selectedChatId);
      prevMsgCountRef.current = msgs.length;
      setMessages([...msgs]);
    }
  }, [selectedChatId]);

  useEffect(() => {
    if (msgEndRef.current) {
      msgEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (textRef.current) textRef.current.focus();
  }, [selectedChatId]);

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getChatName = useCallback((chat) => {
    if (chat.type === 'department') return chat.name;
    const otherId = chat.participants?.find(p => String(p) !== String(currentUser?.id));
    const other = chatUsers.find(u => String(u.id) === String(otherId));
    return other?.name || 'Unknown';
  }, [chatUsers, currentUser?.id]);

  const getChatAvatar = useCallback((chat) => {
    if (chat.type === 'department') return chat.name?.charAt(0)?.toUpperCase() || 'D';
    const otherId = chat.participants?.find(p => String(p) !== String(currentUser?.id));
    const other = chatUsers.find(u => String(u.id) === String(otherId));
    return other ? other.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  }, [chatUsers, currentUser?.id]);

  const isUserOnline = useCallback((userId) => {
    const presence = getPresence();
    return presence[userId]?.status === 'online';
  }, []);

  const formatTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const formatDateSeparator = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleSelectChat = (chat) => {
    setSelectedChatId(chat.id);
    setSelectedChat(chat);
    setText('');
    setReplyTo(null);
    setEditingMsg(null);
    setShowEmoji(false);
    setShowSearch(false);
    setMobileChatOpen(true);
    markMessagesRead(chat.id, currentUser.id);
  };

  const handleSelectUser = (user) => {
    const chatId = getOrCreateDirectChat(currentUser.id, user.id, allUsers);
    const conversations = getConversations();
    handleSelectChat(conversations[chatId]);
  };

  const handleSelectDepartment = (department) => {
    const chatId = ensureDepartmentChat(department, allUsers);
    const conversations = getConversations();
    handleSelectChat(conversations[chatId]);
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!selectedChatId) return;
    if (editingMsg) {
      if (!text.trim()) return;
      editChatMessage(selectedChatId, editingMsg.id, text);
      setEditingMsg(null);
      setText('');
      return;
    }
    if (!text.trim()) return;
    sendChatMessage({
      chatId: selectedChatId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: text.trim(),
      type: 'text',
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderName: replyTo.senderName } : null,
    });
    setText('');
    setReplyTo(null);
    setShowEmoji(false);
    setTyping(selectedChatId, currentUser.id, currentUser.name, false);
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    if (!selectedChatId) return;
    setTyping(selectedChatId, currentUser.id, currentUser.name, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(selectedChatId, currentUser.id, currentUser.name, false);
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (files) => {
    if (!files?.length || !selectedChatId) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        sendChatMessage({
          chatId: selectedChatId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          text: '',
          type: 'file',
          attachments: [{
            id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            dataUrl: e.target.result,
          }],
        });
      };
      if (file.size > 5 * 1024 * 1024) {
        const blobUrl = URL.createObjectURL(file);
        sendChatMessage({
          chatId: selectedChatId,
          senderId: currentUser.id,
          senderName: currentUser.name,
          text: '',
          type: 'file',
          attachments: [{
            id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            dataUrl: blobUrl,
            _blob: true,
          }],
        });
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDelete = (msgId) => {
    if (!selectedChatId) return;
    if (window.confirm('Delete this message?')) {
      deleteChatMessage(selectedChatId, msgId);
    }
  };

  const handleEdit = (msg) => {
    setEditingMsg(msg);
    setText(msg.text);
    setReplyTo(null);
    if (textRef.current) textRef.current.focus();
  };

  const handleReply = (msg) => {
    setReplyTo({ id: msg.id, text: msg.text, senderName: msg.senderName });
    setEditingMsg(null);
    if (textRef.current) textRef.current.focus();
  };

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchResults(searchMessages(q));
  };

  const isImage = (type) => type?.startsWith('image/');
  const isAudio = (type) => type?.startsWith('audio/');
  const isVideo = (type) => type?.startsWith('video/');
  const isPDF = (type) => type === 'application/pdf';
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getUnread = (chatId) => getUnreadCount(chatId, currentUser.id);

  const filteredChats = chatList.filter(chat => {
    if (tab === 'direct' && chat.type !== 'direct') return false;
    if (tab === 'departments' && chat.type !== 'department') return false;
    const name = getChatName(chat).toLowerCase();
    return !convSearch || name.includes(convSearch.toLowerCase());
  });

  const otherUsers = chatUsers.filter(u => String(u.id) !== String(currentUser?.id) && u.status !== 'deactivated');
  const departments = [...new Set(chatUsers.filter(u => String(u.id) !== String(currentUser?.id) && u.department).map(u => u.department))];

  const filteredOtherUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return otherUsers;
    return otherUsers.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  }, [otherUsers, userSearch]);

  const visibleUsers = filteredOtherUsers.slice(visibleRange.start, visibleRange.end);
  const hasMoreUsers = visibleRange.end < filteredOtherUsers.length;

  const handleUserScroll = (e) => {
    const el = e.target;
    const scrollTop = el.scrollTop;
    const viewHeight = el.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / userItemHeight) - 5);
    const end = Math.min(filteredOtherUsers.length, Math.ceil((scrollTop + viewHeight) / userItemHeight) + 5);
    setVisibleRange({ start, end });
  };

  const renderMessage = (msg, idx) => {
    if (msg.deleted) {
      return (
        <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', opacity: 0.4, padding: '4px 0' }}>
          <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>This message was deleted</span>
        </div>
      );
    }
    if (msg.type === 'system') {
      return (
        <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 12, maxWidth: '80%', textAlign: 'center' }}>{msg.text}</span>
        </div>
      );
    }

    const isMe = String(msg.senderId) === String(currentUser?.id);
    const showDateSep = idx === 0 || new Date(msg.timestamp).toDateString() !== new Date(messages[idx - 1]?.timestamp).toDateString();
    const fileAttach = msg.attachments?.[0];
    const isReply = msg.replyTo;

    return (
      <div key={msg.id}>
        {showDateSep && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 8px' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 12 }}>{formatDateSeparator(msg.timestamp)}</span>
          </div>
        )}
        <div className={`chat-msg ${isMe ? 'chat-msg-me' : 'chat-msg-other'}`}>
          <div className="chat-bubble" style={{
            maxWidth: '75%',
            background: isMe ? 'linear-gradient(135deg, var(--primary), var(--primary-light))' : 'var(--bg-secondary)',
            color: isMe ? 'white' : 'var(--text-primary)',
            borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          }}>
            {!isMe && <div className="chat-bubble-name">{msg.senderName}</div>}
            {isReply && (
              <div style={{ padding: '6px 8px', marginBottom: 4, borderLeft: '3px solid var(--primary)', background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--bg-tertiary)', borderRadius: 6, fontSize: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 11 }}>{isReply.senderName}</div>
                <div style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isReply.text}</div>
              </div>
            )}
            {fileAttach && (
              <div className="chat-file-attachment">
                {isImage(fileAttach.fileType) ? (
                  <img src={fileAttach.dataUrl} alt={fileAttach.fileName} style={{ maxWidth: 260, maxHeight: 200, borderRadius: 8, cursor: 'pointer' }} onClick={() => setShowFilePreview(fileAttach)} />
                ) : isVideo(fileAttach.fileType) ? (
                  <video src={fileAttach.dataUrl} controls style={{ maxWidth: 260, maxHeight: 200, borderRadius: 8 }} />
                ) : isAudio(fileAttach.fileType) ? (
                  <audio src={fileAttach.dataUrl} controls style={{ width: 260 }} />
                ) : isPDF(fileAttach.fileType) ? (
                  <div className="chat-file-card" onClick={() => setShowFilePreview(fileAttach)}>
                    <span style={{ fontSize: 24 }}>📄</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileAttach.fileName}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{formatFileSize(fileAttach.fileSize)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="chat-file-card">
                    <span style={{ fontSize: 24 }}>📎</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileAttach.fileName}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{formatFileSize(fileAttach.fileSize)}</div>
                    </div>
                    <a href={fileAttach.dataUrl} download={fileAttach.fileName} style={{ color: 'var(--primary)', fontSize: 20, textDecoration: 'none' }}>⬇</a>
                  </div>
                )}
              </div>
            )}
            {msg.text && <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}{msg.edited && <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>(edited)</span>}</div>}
            <div className="chat-msg-meta" style={{ fontSize: 10, marginTop: 4, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <span>{formatTime(msg.timestamp)}</span>
              {isMe && <span>{msg.readBy?.length > 1 ? '✓✓' : '✓'}</span>}
            </div>
          </div>
          <div className="chat-msg-actions">
            <button className="chat-action-btn" title="Reply" onClick={() => handleReply(msg)}>↩</button>
            {isMe && (
              <>
                <button className="chat-action-btn" title="Edit" onClick={() => handleEdit(msg)}>✎</button>
                <button className="chat-action-btn" title="Delete" onClick={() => handleDelete(msg)}>✕</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', height: 'calc(100vh - 130px)' }}>
      <div className="chat-container">
        <div className={`chat-sidebar ${mobileChatOpen && selectedChat ? 'chat-sidebar-hidden' : ''}`}>
          <div className="chat-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {window.innerWidth <= 768 && (
                <button className="chat-icon-btn" onClick={() => setMobileChatOpen(false)} style={{ fontSize: 16 }}>✕</button>
              )}
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Chats</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={`chat-icon-btn ${showDeptPanel ? 'active' : ''}`} onClick={() => setShowDeptPanel(!showDeptPanel)} title="Direct Messages">👥</button>
            </div>
          </div>
          <div className="chat-tabs">
            <button className={`chat-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>All</button>
            <button className={`chat-tab ${tab === 'direct' ? 'active' : ''}`} onClick={() => setTab('direct')}>Direct</button>
            <button className={`chat-tab ${tab === 'departments' ? 'active' : ''}`} onClick={() => setTab('departments')}>Departments</button>
          </div>
          <div className="chat-sidebar-search">
            <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Search conversations..." />
          </div>
          <div className="chat-sidebar-list">
            {showDeptPanel ? (
              <>
                <div className="user-list-search-wrap">
                  <div className="user-list-search-icon">🔍</div>
                  <input
                    className="user-list-search-input"
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setVisibleRange({ start: 0, end: 50 }); }}
                    placeholder="Search by name, department, email..."
                  />
                  {userSearch && (
                    <button className="user-list-search-clear" onClick={() => { setUserSearch(''); setVisibleRange({ start: 0, end: 50 }); }}>✕</button>
                  )}
                </div>
                {filteredOtherUsers.length === 0 ? (
                  <div className="chat-empty-state" style={{ padding: '32px 16px', margin: 0 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {userSearch ? `No users match "${userSearch}"` : 'No users available for internal chat.'}
                    </div>
                  </div>
                ) : (
                  <div className="user-list-container" ref={userListRef} onScroll={handleUserScroll}>
                    <div style={{ height: visibleRange.start * userItemHeight }} />
                    {visibleUsers.map(user => (
                      <div
                        key={user.id}
                        className={`user-list-item ${selectedDirectUserId === user.id ? 'active' : ''} ${selectedChat?.participants?.includes(user.id) && selectedChat?.type === 'direct' ? 'has-conversation' : ''}`}
                        onClick={() => { handleSelectUser(user); setSelectedDirectUserId(user.id); }}
                      >
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div className="user-list-avatar">{user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                          <div className={`user-list-status ${isUserOnline(user.id) ? 'online' : 'offline'}`} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="user-list-name">{user.name}</div>
                          <div className="user-list-meta">
                            <span className="user-list-dept">{user.department || user.role}</span>
                            <span className="user-list-sep">·</span>
                            <span className={`user-list-online-badge ${isUserOnline(user.id) ? 'online' : 'offline'}`}>
                              {isUserOnline(user.id) ? '🟢 Online' : '⚫ Offline'}
                            </span>
                          </div>
                        </div>
                        {selectedChat?.participants?.includes(user.id) && selectedChat?.type === 'direct' && (
                          <div className="user-list-chat-dot" title="Active conversation">💬</div>
                        )}
                      </div>
                    ))}
                    <div style={{ height: Math.max(0, (filteredOtherUsers.length - visibleRange.end) * userItemHeight) }} />
                    {hasMoreUsers && (
                      <div style={{ textAlign: 'center', padding: '8px', fontSize: 11, color: 'var(--text-muted)' }}>
                        Showing {visibleRange.end} of {filteredOtherUsers.length} users
                      </div>
                    )}
                  </div>
                )}
                <div style={{ padding: '8px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 }}>
                  Departments
                </div>
                {departments.map(dept => (
                  <div key={dept} className="chat-conv-item" onClick={() => handleSelectDepartment(dept)}>
                    <div className="avatar" style={{ width: 36, height: 36, fontSize: 12, background: 'var(--primary)' }}>{dept.charAt(0)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{dept} Department</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{otherUsers.filter(u => u.department === dept).length} members</div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              filteredChats.map(chat => {
                const unread = getUnread(chat.id);
                return (
                  <div key={chat.id} className={`chat-conv-item ${selectedChatId === chat.id ? 'active' : ''}`} onClick={() => handleSelectChat(chat)}>
                    <div style={{ position: 'relative' }}>
                      <div className="avatar" style={{ width: 36, height: 36, fontSize: 12, background: chat.type === 'department' ? 'var(--primary)' : undefined }}>{getChatAvatar(chat)}</div>
                      {chat.type === 'direct' && (
                        <div style={{
                          position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%',
                          border: '2px solid white',
                          background: (() => { const oid = chat.participants?.find(p => String(p) !== String(currentUser?.id)); return isUserOnline(oid) ? 'var(--success)' : 'var(--border)'; })(),
                        }} />
                      )}
                      {chat.type === 'department' && <div style={{ position: 'absolute', top: -4, right: -4, fontSize: 10 }}>🏢</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: chat.lastMessage ? 600 : 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getChatName(chat)}</span>
                        {chat.lastMessage && <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 4 }}>{formatTime(chat.lastMessage.timestamp)}</span>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 1 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          {chat.lastMessage ? (chat.lastMessage.type === 'file' ? '📎 Photo' : chat.lastMessage.text) : chat.type === 'department' ? 'Group chat' : 'Start a conversation'}
                        </span>
                        {unread > 0 && <span className="chat-unread-badge">{unread}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={`chat-main ${mobileChatOpen && selectedChat ? '' : 'chat-main-empty'}`}>
          {selectedChat && selectedChatId ? (
            <>
              <div className="chat-main-header">
                <button className="chat-back-btn" onClick={() => setMobileChatOpen(false)}>←</button>
                <div className="avatar" style={{ width: 34, height: 34, fontSize: 11, background: selectedChat.type === 'department' ? 'var(--primary)' : undefined }}>
                  {getChatAvatar(selectedChat)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{getChatName(selectedChat)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {selectedChat.type === 'department' ? (
                      <>{selectedChat.participants?.length || 0} members</>
                    ) : (
                      <>{(() => { const oid = selectedChat.participants?.find(p => String(p) !== String(currentUser?.id)); const user = chatUsers.find(u => String(u.id) === String(oid)); return user ? `${user.role} · ${isUserOnline(oid) ? 'Online' : 'Offline'}` : ''; })()}</>
                    )}
                  </div>
                </div>
                <button className="chat-icon-btn" onClick={() => setShowSearch(!showSearch)} title="Search messages">🔍</button>
              </div>
              {showSearch && (
                <div className="chat-search-panel">
                  <input value={searchQuery} onChange={e => handleSearch(e.target.value)} placeholder="Search messages..." autoFocus />
                  <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                    {searchResults.slice(0, 20).map(r => (
                      <div key={r.id} style={{ padding: '6px 12px', cursor: 'pointer', borderRadius: 6, fontSize: 12 }} onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
                        <span style={{ fontWeight: 600 }}>{r.senderName}:</span> {r.text}
                      </div>
                    ))}
                    {searchQuery.length >= 2 && searchResults.length === 0 && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No messages found</div>}
                  </div>
                </div>
              )}
              {messages.length === 0 && !typingUsers.length ? (
                <div className="chat-empty-state">
                  <div style={{ fontSize: 48, marginBottom: 8 }}>💬</div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>Start a conversation</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Send a message to start chatting</div>
                </div>
              ) : (
                <div className="chat-msg-list">
                  {messages.map((msg, idx) => renderMessage(msg, idx))}
                  {typingUsers.length > 0 && (
                    <div className="chat-typing">
                      <div className="chat-typing-dots"><span>.</span><span>.</span><span>.</span></div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{typingUsers.join(', ')} typing...</span>
                    </div>
                  )}
                  <div ref={msgEndRef} />
                </div>
              )}
              <div className={`chat-input-area ${dragOver ? 'chat-drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {replyTo && (
                  <div className="chat-reply-preview">
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>Replying to {replyTo.senderName}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{replyTo.text}</span>
                    <button className="chat-action-btn" onClick={() => setReplyTo(null)}>✕</button>
                  </div>
                )}
                {editingMsg && (
                  <div className="chat-reply-preview" style={{ borderLeftColor: 'var(--warning)' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)' }}>Editing message</span>
                    <button className="chat-action-btn" onClick={() => { setEditingMsg(null); setText(''); }}>✕</button>
                  </div>
                )}
                {dragOver && <div className="chat-drag-overlay">📁 Drop files here</div>}
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                  <button className="chat-input-btn" onClick={() => setShowEmoji(!showEmoji)} title="Emoji">😊</button>
                  <button className="chat-input-btn" onClick={() => fileRef.current?.click()} title="Attach file">📎</button>
                  <input ref={fileRef} type="file" hidden multiple onChange={e => { handleFileUpload(e.target.files); e.target.value = ''; }} />
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input ref={textRef} className="chat-text-input" value={text} onChange={handleTyping} onKeyDown={handleKeyDown} placeholder={editingMsg ? 'Edit message...' : replyTo ? 'Reply...' : 'Type a message...'} />
                    {showEmoji && (
                      <div className="chat-emoji-picker">
                        {EMOJIS.map(emoji => (
                          <button key={emoji} className="chat-emoji-btn" onClick={() => { setText(prev => prev + emoji); setShowEmoji(false); if (textRef.current) textRef.current.focus(); }}>{emoji}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="chat-send-btn" onClick={handleSend} disabled={!text.trim() && !editingMsg}>
                    {editingMsg ? 'Save' : '➤'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="chat-empty-state" style={{ margin: 'auto' }}>
              <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>Internal Chat</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, maxWidth: 320, textAlign: 'center' }}>
                Select a conversation or start a new one with a colleague
              </div>
              <div style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                {otherUsers.slice(0, 6).map(user => (
                  <div key={user.id} className="chat-quick-user" onClick={() => handleSelectUser(user)}>
                    <div className="avatar" style={{ width: 40, height: 40, fontSize: 13 }}>{user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4, textAlign: 'center' }}>{user.name.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showFilePreview && (
        <div className="chat-modal-overlay" onClick={() => setShowFilePreview(null)}>
          <div className="chat-modal" onClick={e => e.stopPropagation()}>
            <div className="chat-modal-header">
              <span style={{ fontWeight: 600, fontSize: 14 }}>{showFilePreview.fileName}</span>
              <button className="chat-action-btn" onClick={() => setShowFilePreview(null)}>✕</button>
            </div>
            <div className="chat-modal-body">
              {isImage(showFilePreview.fileType) ? (
                <img src={showFilePreview.dataUrl} alt={showFilePreview.fileName} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
              ) : isPDF(showFilePreview.fileType) ? (
                <object data={showFilePreview.dataUrl} type="application/pdf" width="100%" height="500px">
                  <p>PDF cannot be displayed. <a href={showFilePreview.dataUrl} download={showFilePreview.fileName}>Download</a></p>
                </object>
              ) : isVideo(showFilePreview.fileType) ? (
                <video src={showFilePreview.dataUrl} controls style={{ maxWidth: '100%', maxHeight: '60vh' }} />
              ) : isAudio(showFilePreview.fileType) ? (
                <audio src={showFilePreview.dataUrl} controls style={{ width: '100%' }} />
              ) : (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>📎</div>
                  <div style={{ fontWeight: 600 }}>{showFilePreview.fileName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatFileSize(showFilePreview.fileSize)}</div>
                  <a href={showFilePreview.dataUrl} download={showFilePreview.fileName} className="btn btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>Download</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
