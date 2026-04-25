import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const ChatPage = () => {
  const { currentUser, allUsers, allMessages, sendMessage } = useApp();
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef(null);

  const otherUsers = allUsers.filter(u => u.id !== currentUser.id);
  const filteredUsers = otherUsers.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase())
  );

  const getConversation = (userId) => allMessages.filter(m =>
    (m.fromId === currentUser.id && m.toId === userId) ||
    (m.fromId === userId && m.toId === currentUser.id)
  ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const getUnreadCount = (userId) =>
    allMessages.filter(m => m.fromId === userId && m.toId === currentUser.id && !m.read).length;

  const getLastMessage = (userId) => {
    const msgs = getConversation(userId);
    return msgs[msgs.length - 1];
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedUser) return;
    sendMessage(selectedUser.id, selectedUser.name, messageText);
    setMessageText('');
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedUser, allMessages]);

  const conversation = selectedUser ? getConversation(selectedUser.id) : [];

  const usersList = [...filteredUsers].sort((a, b) => {
    const aLast = getLastMessage(a.id);
    const bLast = getLastMessage(b.id);
    if (!aLast && !bLast) return 0;
    if (!aLast) return 1;
    if (!bLast) return -1;
    return new Date(bLast.timestamp) - new Date(aLast.timestamp);
  });

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0, height: 'calc(100vh - 130px)',
        background: 'white', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow)', overflow: 'hidden',
      }}>
        {/* Users List */}
        <div style={{ borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>💬 Messages</div>
            <div className="search-bar" style={{ minWidth: 'unset' }}>
              🔍 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {usersList.map(user => {
              const lastMsg = getLastMessage(user.id);
              const unread = getUnreadCount(user.id);
              const isSelected = selectedUser?.id === user.id;
              return (
                <div key={user.id}
                  onClick={() => setSelectedUser(user)}
                  style={{
                    display: 'flex', gap: 12, padding: '14px 16px', cursor: 'pointer',
                    background: isSelected ? 'rgba(14,84,145,0.06)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                    transition: 'var(--transition)',
                  }}
                  onMouseEnter={e => !isSelected && (e.currentTarget.style.background = 'var(--bg-secondary)')}
                  onMouseLeave={e => !isSelected && (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="avatar" style={{ width: 40, height: 40, fontSize: 13, flexShrink: 0 }}>
                    {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{user.name}</span>
                      {lastMsg && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {new Date(lastMsg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        {lastMsg ? lastMsg.message : user.role}
                      </span>
                      {unread > 0 && (
                        <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Window */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {selectedUser ? (
            <>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar" style={{ width: 38, height: 38, fontSize: 13 }}>
                  {selectedUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedUser.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedUser.role} · {selectedUser.department}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <a href={`tel:${selectedUser.phone}`} className="btn btn-sm btn-outline">📞 Call</a>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {conversation.length === 0 && (
                  <div className="empty-state" style={{ margin: 'auto' }}>
                    <div className="empty-state-icon">💬</div>
                    <div className="empty-state-title">Start a conversation</div>
                    <div className="empty-state-text">Send a message to {selectedUser.name}</div>
                  </div>
                )}
                {conversation.map(msg => {
                  const isMe = msg.fromId === currentUser.id;
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      {!isMe && (
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 10, marginRight: 8, flexShrink: 0, alignSelf: 'flex-end' }}>
                          {selectedUser.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div style={{
                        maxWidth: '70%', padding: '10px 14px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: isMe ? 'linear-gradient(135deg, var(--primary), var(--primary-light))' : 'var(--bg-secondary)',
                        color: isMe ? 'white' : 'var(--text-primary)',
                        boxShadow: 'var(--shadow-sm)',
                      }}>
                        <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{msg.message}</div>
                        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7, textAlign: 'right' }}>
                          {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {isMe && <span style={{ marginLeft: 4 }}>✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} style={{ padding: '16px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: 10 }}>
                <input
                  className="form-control"
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder={`Message ${selectedUser.name}...`}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={!messageText.trim()}>
                  Send ➤
                </button>
              </form>
            </>
          ) : (
            <div className="empty-state" style={{ margin: 'auto' }}>
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-title">Select a conversation</div>
              <div className="empty-state-text">Choose a colleague from the left to start chatting</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
