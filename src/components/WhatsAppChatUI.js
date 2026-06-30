import React, { useState, useEffect, useRef } from 'react';
import Picker from 'emoji-picker-react';
import { Smile, Paperclip, Send, X, File, Image as ImageIcon, Check, CheckCheck, Mic, Square, CornerDownLeft, Edit2, Trash2, Forward, Search, MoreVertical, AlertTriangle, RefreshCw, ArrowLeft, Users, UserPlus, Megaphone, Phone, Video } from 'lucide-react';

const PROXY = process.env.REACT_APP_API_URL || '';

const WhatsAppChatUI = ({ connectionId, socket, onLogout, logoutLoading }) => {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Search and New Chat Pane
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showNewChatPane, setShowNewChatPane] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  
  // New Contact Form
  const [showNewContactPane, setShowNewContactPane] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', countryCode: '+91', phone: '', syncToPhone: false });

  // New Group Form
  const [showNewGroupPane, setShowNewGroupPane] = useState(false);
  const [newGroupSearch, setNewGroupSearch] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  // Composer State
  const [messageText, setMessageText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState(null); 
  const [sending, setSending] = useState(false);
  
  // Context Actions
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [editMsg, setEditMsg] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  
  // Voice Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const [isNarrow, setIsNarrow] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchChats();
    
    if (socket) {
      socket.on(`whatsapp:chats_update:${connectionId}`, () => fetchChats());
      socket.on(`whatsapp:message_new:${connectionId}`, (data) => {
        if (data.jid === activeChatId) {
          setMessages(prev => {
            if (!prev.find(m => m.key.id === data.message.key.id)) {
              return [...prev, data.message];
            }
            return prev;
          });
        }
      });
      socket.on(`whatsapp:message_update:${connectionId}`, (data) => {
        if (data.jid === activeChatId) {
          setMessages(prev => prev.map(m => m.key.id === data.message.key.id ? data.message : m));
        }
      });
      socket.on(`whatsapp:sync_complete:${connectionId}`, () => fetchChats());
    }

    return () => {
      if (socket) {
        socket.off(`whatsapp:chats_update:${connectionId}`);
        socket.off(`whatsapp:message_new:${connectionId}`);
        socket.off(`whatsapp:message_update:${connectionId}`);
        socket.off(`whatsapp:sync_complete:${connectionId}`);
      }
    };
  }, [connectionId, socket, activeChatId]);

  useEffect(() => {
    if (activeChatId) {
      fetchMessages(activeChatId);
      setAttachment(null);
      setMessageText('');
      setShowEmojiPicker(false);
      setReplyToMsg(null);
      setEditMsg(null);
      setSearchQuery('');
    } else {
      setMessages([]);
    }
  }, [activeChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, searchQuery]);

  // Click outside emoji picker to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchChats = async () => {
    try {
      const res = await fetch(`${PROXY}/api/whatsapp/chats?connectionId=${connectionId}`);
      const data = await res.json();
      if (data.success) setChats(data.chats);
    } catch (err) {
      console.error('Failed to fetch chats', err);
    } finally {
      setLoadingChats(false);
    }
  };

  const fetchMessages = async (chatId) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`${PROXY}/api/whatsapp/chats/${encodeURIComponent(chatId)}/messages?connectionId=${connectionId}`);
      const data = await res.json();
      if (data.success) setMessages(data.messages);
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Typing Indicator Logic
  const handleTyping = () => {
    if (!activeChatId) return;
    
    // Clear existing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    else {
      // Not typing currently, send composing
      fetch(`${PROXY}/api/whatsapp/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, chatId: activeChatId, presence: 'composing' })
      });
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      fetch(`${PROXY}/api/whatsapp/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, chatId: activeChatId, presence: 'paused' })
      });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], 'voice_note.webm', { type: 'audio/webm' });
        setAttachment({ file, type: 'voice_note', previewUrl: null });
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      setTimeout(() => setAttachment(null), 100); // Discard
    }
  };

  const handleSendMessage = async () => {
    if ((!messageText.trim() && !attachment) || sending || !activeChatId) return;
    
    setSending(true);
    try {
      if (editMsg) {
        // Edit flow
        await fetch(`${PROXY}/api/whatsapp/messages/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId, chatId: activeChatId, messageId: editMsg.key.id, newText: messageText })
        });
        setEditMsg(null);
        setMessageText('');
      } else {
        // Send / Reply flow
        const formData = new FormData();
        formData.append('connectionId', connectionId);
        formData.append('chatId', activeChatId);
        formData.append('text', messageText);

        if (replyToMsg) formData.append('replyToMessageId', replyToMsg.key.id);

        if (attachment) {
          formData.append('type', attachment.type);
          formData.append('file', attachment.file);
        } else {
          formData.append('type', 'text');
        }

        const res = await fetch(`${PROXY}/api/whatsapp/messages/send`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          setMessageText('');
          setAttachment(null);
          setReplyToMsg(null);
        } else {
          // If status is 429, handle rate limit alert specifically
          if (res.status === 429) {
            alert('Rate limit exceeded: You are sending messages too quickly. Please slow down to prevent account restrictions.');
          } else {
            alert(`Failed to send: ${data.message}`);
          }
        }
      }
    } catch (err) {
      console.error('Send error:', err);
    } finally {
      setSending(false);
      setShowEmojiPicker(false);
    }
  };

  const onEmojiClick = (emojiObject) => {
    setMessageText(prev => prev + emojiObject.emoji);
  };

  const handleRetryMessage = async (msg) => {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    if (!text) return; // For MVP, only text retries are fully supported
    
    // Optionally delete the failed dummy message from UI immediately
    setMessages(prev => prev.filter(m => m.key.id !== msg.key.id));
    
    // Resend
    const formData = new FormData();
    formData.append('connectionId', connectionId);
    formData.append('chatId', activeChatId);
    formData.append('text', text);
    formData.append('type', 'text');
    
    try {
      await fetch(`${PROXY}/api/whatsapp/messages/send`, {
        method: 'POST',
        body: formData,
      });
    } catch (e) {
      console.error('Retry failed', e);
    }
  };

  const handleForwardMessage = async (targetChatId) => {
    if (!forwardMsg || !targetChatId) return;
    try {
      await fetch(`${PROXY}/api/whatsapp/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, chatId: targetChatId, type: 'text', forwardMessageId: forwardMsg.key.id })
      });
      setShowForwardModal(false);
      setForwardMsg(null);
      alert('Message forwarded!');
    } catch (e) {
      console.error('Forward failed', e);
    }
  };

  const handleDeleteMessage = async (msg) => {
    if (window.confirm("Delete this message for everyone?")) {
      try {
        await fetch(`${PROXY}/api/whatsapp/messages/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId, chatId: activeChatId, messageId: msg.key.id })
        });
      } catch (e) {
        console.error('Delete failed', e);
      }
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    let type = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    const previewUrl = type === 'image' || type === 'video' ? URL.createObjectURL(file) : null;
    setAttachment({ file, type, previewUrl });
    e.target.value = '';
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      let type = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      const previewUrl = type === 'image' || type === 'video' ? URL.createObjectURL(file) : null;
      setAttachment({ file, type, previewUrl });
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);

  // Filter messages based on search
  const displayedMessages = messages.filter(m => {
    if (!searchQuery) return true;
    const text = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div 
      style={{ 
        display: isNarrow ? 'flex' : 'grid', 
        gridTemplateColumns: isNarrow ? 'none' : '266px 1fr',
        height: '1100px', 
        width: '1000px', 
        maxWidth: '100%',
        border: '1px solid var(--border-light)', 
        borderRadius: '12px', 
        overflow: 'hidden', 
        background: '#fff' 
      }}
    >
      
      {/* Left Pane - Chat List / New Chat Pane / New Contact Pane / New Group Pane */}
      {(!isNarrow || !activeChatId) && (
        <div style={{ width: isNarrow ? '100%' : '100%', borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', background: '#fff', minHeight: 0, position: 'relative' }}>
          
          {showNewGroupPane ? (
            <>
              {/* New Group Header */}
              <div style={{ padding: '16px', background: '#008069', color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => setShowNewGroupPane(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Add group members</h3>
                  <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{selectedGroupMembers.length} selected</div>
                </div>
              </div>

              {/* Selected Members area (only show if any selected) */}
              {selectedGroupMembers.length > 0 && (
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedGroupMembers.map(member => (
                    <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#e9edef', padding: '4px 8px 4px 4px', borderRadius: 16 }}>
                      <img src={`${PROXY}/api/whatsapp/profile-pic/${connectionId}/${member.id}`} onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${member.name || member.id}`; }} alt="avatar" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontSize: 13, color: '#111b21' }}>{member.name || `+${member.id.split('@')[0]}`}</span>
                      <X size={14} color="#8696a0" style={{ cursor: 'pointer' }} onClick={() => setSelectedGroupMembers(selectedGroupMembers.filter(m => m.id !== member.id))} />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Search Box */}
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ borderBottom: '2px solid #008069', display: 'flex', alignItems: 'center', padding: '6px 0' }}>
                  <input 
                    type="text" 
                    placeholder="Search name or number" 
                    value={newGroupSearch}
                    onChange={(e) => setNewGroupSearch(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 15, color: '#3b4a54' }}
                  />
                </div>
              </div>

              {/* Contacts List for Group */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {chats.filter(c => !newGroupSearch || (c.name || c.id).toLowerCase().includes(newGroupSearch.toLowerCase())).map(chat => {
                  const isSelected = selectedGroupMembers.some(m => m.id === chat.id);
                  return (
                    <div 
                      key={`group-add-${chat.id}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedGroupMembers(selectedGroupMembers.filter(m => m.id !== chat.id));
                        } else {
                          setSelectedGroupMembers([...selectedGroupMembers, chat]);
                        }
                      }}
                      style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                      className="hover-bg-gray"
                    >
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dfe5e7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', overflow: 'hidden' }}>
                          <img src={`${PROXY}/api/whatsapp/profile-pic/${connectionId}/${chat.id}`} onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${chat.name || chat.id}`; }} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        {isSelected && (
                          <div style={{ position: 'absolute', bottom: -2, right: -2, background: '#008069', borderRadius: '50%', padding: 2, display: 'flex' }}>
                            <Check size={12} color="#fff" />
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 16, color: '#111b21', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {chat.name || `+${chat.id.split('@')[0]}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Floating Next Button */}
              {selectedGroupMembers.length > 0 && (
                <div style={{ position: 'absolute', bottom: 24, right: 24, width: 48, height: 48, borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} onClick={() => alert('Proceed to group naming (not implemented yet)')}>
                  <ArrowLeft size={24} color="#fff" style={{ transform: 'rotate(180deg)' }} />
                </div>
              )}
            </>
          ) : showNewContactPane ? (
            <>
              {/* New Contact Header */}
              <div style={{ padding: '16px', background: '#008069', color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => setShowNewContactPane(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <ArrowLeft size={20} />
                </button>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>New contact</h3>
              </div>
              <div style={{ padding: '24px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ paddingTop: 8 }}><UserPlus size={20} color="#8696a0" /></div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <input type="text" placeholder="First name" value={newContact.firstName} onChange={e => setNewContact({...newContact, firstName: e.target.value})} style={{ border: 'none', borderBottom: '1px solid #8696a0', outline: 'none', padding: '4px 0', fontSize: 16 }} />
                    <input type="text" placeholder="Last name" value={newContact.lastName} onChange={e => setNewContact({...newContact, lastName: e.target.value})} style={{ border: 'none', borderBottom: '1px solid #8696a0', outline: 'none', padding: '4px 0', fontSize: 16 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ paddingTop: 8 }}><Phone size={20} color="#8696a0" /></div>
                  <div style={{ flex: 1, display: 'flex', gap: 12 }}>
                    <input type="text" placeholder="Country" value={newContact.countryCode} onChange={e => setNewContact({...newContact, countryCode: e.target.value})} style={{ width: 80, border: 'none', borderBottom: '1px solid #8696a0', outline: 'none', padding: '4px 0', fontSize: 16 }} />
                    <input type="text" placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} style={{ flex: 1, border: 'none', borderBottom: '1px solid #8696a0', outline: 'none', padding: '4px 0', fontSize: 16 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  <div style={{ paddingTop: 8 }}><RefreshCw size={20} color="#8696a0" /></div>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 16, color: '#111b21' }}>Sync contact to phone</div>
                      <div style={{ fontSize: 13, color: '#8696a0', marginTop: 4 }}>This contact will be added to your phone's address book.</div>
                    </div>
                    <input type="checkbox" checked={newContact.syncToPhone} onChange={e => setNewContact({...newContact, syncToPhone: e.target.checked})} style={{ width: 40, height: 20 }} />
                  </div>
                </div>
                <button 
                  onClick={() => { alert('New Contact added!'); setShowNewContactPane(false); }} 
                  style={{ marginTop: 20, background: '#008069', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 24, fontSize: 16, cursor: 'pointer', alignSelf: 'center' }}
                >
                  Save
                </button>
              </div>
            </>
          ) : showNewChatPane ? (
            <>
              {/* New Chat Header */}
              <div style={{ padding: '16px', background: '#008069', color: '#fff', display: 'flex', alignItems: 'center', gap: 16 }}>
                <button onClick={() => setShowNewChatPane(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <ArrowLeft size={20} />
                </button>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>New chat</h3>
              </div>
              
              {/* New Chat Search */}
              <div style={{ padding: '8px 12px', background: '#fff', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ background: '#f0f2f5', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '6px 12px' }}>
                  <Search size={16} color="#54656f" style={{ marginRight: 12 }} />
                  <input 
                    type="text" 
                    placeholder="Search name or number" 
                    value={newChatSearch}
                    onChange={(e) => setNewChatSearch(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 14, color: '#3b4a54' }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div onClick={() => setShowNewGroupPane(true)} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'background 0.2s' }} className="hover-bg-gray">
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <Users size={20} />
                  </div>
                  <span style={{ fontSize: 16, color: '#111b21' }}>New group</span>
                </div>
                <div onClick={() => setShowNewContactPane(true)} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'background 0.2s' }} className="hover-bg-gray">
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <UserPlus size={20} />
                  </div>
                  <span style={{ fontSize: 16, color: '#111b21' }}>New contact</span>
                </div>
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s' }} className="hover-bg-gray">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <Megaphone size={20} />
                    </div>
                    <span style={{ fontSize: 16, color: '#111b21' }}>New business broadcast</span>
                  </div>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00a884' }}></div>
                </div>
              </div>

              {/* Contacts List */}
              <div style={{ padding: '16px 20px 8px 20px', fontSize: 14, color: '#008069', letterSpacing: 1 }}>
                CONTACTS ON WHATSAPP
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {chats.filter(c => !newChatSearch || (c.name || c.id).toLowerCase().includes(newChatSearch.toLowerCase())).map(chat => (
                  <div 
                    key={`newchat-${chat.id}`}
                    onClick={() => {
                      setActiveChatId(chat.id);
                      setShowNewChatPane(false);
                    }}
                    style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                    className="hover-bg-gray"
                  >
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dfe5e7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', overflow: 'hidden' }}>
                      <img src={`${PROXY}/api/whatsapp/profile-pic/${connectionId}/${chat.id}`} onError={(e) => { e.target.onerror = null; e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${chat.name || chat.id}`; }} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 16, color: '#111b21', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {chat.name || `+${chat.id.split('@')[0]}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Default Chat List Header */}
              <div style={{ padding: '16px', background: '#f5f7fa', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Chats</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setShowNewChatPane(true)} style={{ background: 'transparent', border: 'none', color: '#54656f', cursor: 'pointer', padding: 4 }} title="New chat">
                    <UserPlus size={20} />
                  </button>
                  <button onClick={onLogout} disabled={logoutLoading} style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: 14 }}>
                    {logoutLoading ? '...' : 'Disconnect'}
                  </button>
                </div>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {loadingChats ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading chats...</div>
                ) : chats.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>No chats found.</div>
                ) : (
                  chats.map(chat => (
                    <div 
                      key={chat.id} 
                      onClick={() => setActiveChatId(chat.id)}
                      style={{ 
                        padding: '16px 20px', 
                        borderBottom: '1px solid #f0f0f0', 
                        cursor: 'pointer',
                        background: activeChatId === chat.id ? '#f0f9ff' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {chat.name || `+${chat.id.split('@')[0]}`}
                        </span>
                        <span style={{ fontSize: 13, color: '#888' }}>{formatTime(chat.conversationTimestamp)}</span>
                      </div>
                      {chat.name && (
                        <div style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          +{chat.id.split('@')[0]}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Right Pane - Messages & Composer */}
      {(!isNarrow || activeChatId) && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#efeae2', position: 'relative', width: '100%', minWidth: 0, minHeight: 0 }} onDragOver={handleDragOver} onDrop={handleDrop}>
          {activeChatId ? (
            <>
              <div style={{ padding: '16px', background: '#f5f7fa', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {isNarrow && (
                    <button onClick={() => setActiveChatId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '12px', color: '#54656f', padding: '4px' }}>
                      <ArrowLeft size={20} />
                    </button>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{activeChat?.name || (activeChat ? `+${activeChat.id.split('@')[0]}` : '')}</div>
                    {activeChat?.name && <div style={{ fontSize: 8.5, color: '#666' }}>+{activeChat.id.split('@')[0]}</div>}
                  </div>
                </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isSearchActive && (
                  <input 
                    type="text" placeholder="Search in chat..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd', outline: 'none' }}
                  />
                )}
                <button onClick={() => alert('Video calls are not supported yet.')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f' }}>
                  <Video size={18} />
                </button>
                <button onClick={() => alert('Voice calls are not supported yet.')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f' }}>
                  <Phone size={18} />
                </button>
                <button onClick={() => { setIsSearchActive(!isSearchActive); setSearchQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#54656f' }}>
                  <Search size={18} />
                </button>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {loadingMessages ? (
                <div style={{ textAlign: 'center', color: '#888', padding: 20 }}>Loading messages...</div>
              ) : displayedMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888', padding: 20 }}>No messages found.</div>
              ) : (
                displayedMessages.map((m, idx) => {
                  const isMe = m.key.fromMe;
                  const text = m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || '';
                  const hasMedia = m.message?.imageMessage || m.message?.videoMessage || m.message?.documentMessage || m.message?.audioMessage;
                  
                  if (!text && !hasMedia) return null; 

                  const isVoiceNote = m.message?.audioMessage?.ptt;
                  
                  return (
                    <div key={m.key.id || idx} style={{
                      padding: '12px 16px', borderRadius: '8px', maxWidth: '75%',
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      background: isMe ? '#d9fdd3' : '#fff',
                      color: '#111', fontSize: '15px', lineHeight: '21px',
                      boxShadow: '0 1px 1px rgba(0,0,0,0.1)', position: 'relative',
                      display: 'flex', flexDirection: 'column',
                      group: 'message-bubble'
                    }}>
                      
                      {/* Message Actions Menu (Hover) */}
                      <div className="message-actions" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.2s', background: 'rgba(255,255,255,0.8)', borderRadius: 4, padding: 2 }}>
                        <button onClick={() => setReplyToMsg(m)} title="Reply"><CornerDownLeft size={14} /></button>
                        <button onClick={() => { setForwardMsg(m); setShowForwardModal(true); }} title="Forward"><Forward size={14} /></button>
                        {isMe && text && !hasMedia && <button onClick={() => { setEditMsg(m); setMessageText(text); }} title="Edit"><Edit2 size={14} /></button>}
                        {isMe && <button onClick={() => handleDeleteMessage(m)} title="Delete"><Trash2 size={14} color="red" /></button>}
                      </div>

                      {/* Quoted Message Preview */}
                      {m.message?.extendedTextMessage?.contextInfo?.quotedMessage && (
                        <div style={{ background: 'rgba(0,0,0,0.05)', padding: '6px', borderRadius: '4px', marginBottom: '4px', fontSize: 12, borderLeft: '3px solid #00a884' }}>
                          <div style={{ fontWeight: 600, color: '#00a884' }}>Replied Message</div>
                          <div style={{ color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.message.extendedTextMessage.contextInfo.quotedMessage.conversation || 'Media message'}
                          </div>
                        </div>
                      )}

                      {hasMedia && (
                        <div style={{ marginBottom: text ? 8 : 0, color: '#666', fontSize: 13, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isVoiceNote ? <><Mic size={14} /> Voice Note</> : <><Paperclip size={14} /> Attachment</>}
                        </div>
                      )}
                      
                      {text && (
                        <div style={{ fontSize: 14, color: '#111', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{text}</div>
                      )}
                      
                      <div style={{ fontSize: 11, color: '#666', textAlign: 'right', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        {formatTime(m.messageTimestamp)}
                        {isMe && (
                          <span style={{ display: 'flex' }}>
                            {m.status === -1 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={14} color="red" />
                                <button onClick={() => handleRetryMessage(m)} title="Retry" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                  <RefreshCw size={14} color="red" />
                                </button>
                              </div>
                            ) :
                             m.status === 4 ? <CheckCheck size={14} color="#53bdeb" /> : 
                             m.status === 3 ? <CheckCheck size={14} color="#888" /> :    
                             m.status === 2 ? <Check size={14} color="#888" /> :         
                             <Check size={14} color="#bbb" />}                           
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer Area */}
            <div style={{ background: '#f0f2f5', padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
              
              {/* Context Previews (Reply / Edit) */}
              {(replyToMsg || editMsg) && (
                <div style={{ background: '#e2e8f0', padding: 8, borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #00a884' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 'bold', color: '#00a884' }}>{editMsg ? 'Editing Message' : 'Replying to...'}</div>
                    <div style={{ fontSize: 13, color: '#555' }}>
                      {(editMsg || replyToMsg).message?.conversation || (editMsg || replyToMsg).message?.extendedTextMessage?.text || 'Media Message'}
                    </div>
                  </div>
                  <button onClick={() => { setReplyToMsg(null); setEditMsg(null); setMessageText(''); }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={16} /></button>
                </div>
              )}

              {/* Attachment Preview */}
              {attachment && attachment.type !== 'voice_note' && (
                <div style={{ background: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 16, border: '1px solid #ddd', position: 'relative' }}>
                  <button onClick={() => setAttachment(null)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
                  {attachment.previewUrl ? <img src={attachment.previewUrl} alt="preview" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }} /> : <File size={32} color="#888" />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{attachment.file.name}</div>
                    <input type="text" placeholder="Add a caption..." value={messageText} onChange={e => setMessageText(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 4, outline: 'none', marginTop: 8 }} />
                  </div>
                </div>
              )}
              
              {/* Voice Note Recording UI */}
              {isRecording && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', padding: '8px 16px', borderRadius: 20, flex: 1, marginBottom: 8 }}>
                  <div style={{ color: 'red', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}><div className="recording-dot" /> {formatDuration(recordingTime)}</div>
                  <div style={{ flex: 1 }}>Recording...</div>
                  <button onClick={cancelRecording} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}><Trash2 size={20} /></button>
                  <button onClick={stopRecording} style={{ background: '#00a884', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', cursor: 'pointer' }}><Check size={20} /></button>
                </div>
              )}
              
              {/* Voice Note Ready UI */}
              {attachment?.type === 'voice_note' && !isRecording && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#fff', padding: '8px 16px', borderRadius: 20, flex: 1, marginBottom: 8 }}>
                  <Mic size={20} color="#00a884" />
                  <div style={{ flex: 1 }}>Voice Note ({formatDuration(recordingTime)})</div>
                  <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}><Trash2 size={20} /></button>
                </div>
              )}

              {/* Input Bar */}
              {!isRecording && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                  <div ref={emojiPickerRef} style={{ position: 'relative' }}>
                    <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', color: '#54656f', cursor: 'pointer', padding: '8px' }}><Smile size={24} /></button>
                    {showEmojiPicker && <div style={{ position: 'absolute', bottom: '50px', left: 0, zIndex: 100 }}><Picker onEmojiClick={onEmojiClick} /></div>}
                  </div>

                  <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: '#54656f', cursor: 'pointer', padding: '8px' }}><Paperclip size={24} /></button>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} accept="image/*,video/*,audio/*,application/*,.pdf,.doc,.docx,.xls,.xlsx" />

                  {attachment?.type !== 'voice_note' && (
                    <textarea
                      value={messageText} onChange={e => { setMessageText(e.target.value); handleTyping(); }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      placeholder="Type a message" rows={1}
                      style={{ flex: 1, padding: '16px', borderRadius: '8px', border: 'none', outline: 'none', resize: 'none', minHeight: '30px', maxHeight: '150px', fontFamily: 'inherit', fontSize: '15px' }}
                    />
                  )}
                  
                  {/* Send Button or Mic Button */}
                  {messageText.trim() || attachment ? (
                    <button onClick={handleSendMessage} disabled={sending} style={{ background: '#00a884', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', padding: '8px' }}>
                      {sending ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Send size={20} />}
                    </button>
                  ) : (
                    <button onClick={startRecording} style={{ background: 'none', border: 'none', color: '#54656f', cursor: 'pointer', padding: '8px' }}>
                      <Mic size={24} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', background: '#f0f2f5' }}>
            Select a chat to view messages
          </div>
        )}
      </div>
      )}

      {/* Forward Modal */}
      {showForwardModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: 400, maxWidth: '90%' }}>
            <h3 style={{ marginTop: 0 }}>Forward Message To...</h3>
            <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
              {chats.map(chat => (
                <div key={chat.id} onClick={() => handleForwardMessage(chat.id)} style={{ padding: 12, borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                  {chat.name}
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'right' }}>
              <button onClick={() => { setShowForwardModal(false); setForwardMsg(null); }} style={{ padding: '8px 16px', background: '#eee', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Basic Styles for CSS Hover & Recording animation */}
      <style>{`
        .message-actions button { background: none; border: none; cursor: pointer; color: #54656f; padding: 4px; border-radius: 4px; }
        .message-actions button:hover { background: #f0f2f5; }
        div[group="message-bubble"]:hover .message-actions { opacity: 1 !important; }
        .recording-dot { width: 10px; height: 10px; background: red; border-radius: 50%; animation: pulse 1s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default WhatsAppChatUI;
