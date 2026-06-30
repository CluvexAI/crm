import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { io } from 'socket.io-client';
import WhatsAppChatUI from '../components/WhatsAppChatUI';

const PROXY = process.env.REACT_APP_API_URL || '';

const WhatsAppPage = () => {
  const { currentUser } = useApp();
  
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeConnectionId, setActiveConnectionId] = useState(null);
  
  const [sessionState, setSessionState] = useState('disconnected'); // disconnected, generating, scanning, connecting, connected
  const [qrValue, setQrValue] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [newConnName, setNewConnName] = useState('');

  const fetchConnections = async () => {
    try {
      const res = await fetch(`${PROXY}/api/whatsapp/connections`);
      const data = await res.json();
      if (data.success) {
        setConnections(data.connections);
      }
    } catch (err) {
      console.error('Failed to fetch connections', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const initWhatsApp = async (connectionId) => {
    setSessionState('generating');
    try {
      await fetch(`${PROXY}/api/whatsapp/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId })
      });
    } catch (err) {
      console.error('Failed to init WhatsApp:', err);
      setSessionState('disconnected');
    }
  };

  // Socket logic for the currently active connection we are trying to link OR chat with
  useEffect(() => {
    if (!activeConnectionId) {
      if (socket) socket.disconnect();
      setSocket(null);
      return;
    }

    const backendUrl = window.location.hostname === 'localhost' ? 'http://localhost:5001' : PROXY;
    const newSocket = io(backendUrl, { transports: ['websocket', 'polling'] });

    newSocket.on('connect', () => {
      console.log(`Connected to WebSocket for ${activeConnectionId}`);
      // Only request a new QR code if we aren't already connected
      if (sessionState === 'disconnected' || sessionState === 'generating') {
        initWhatsApp(activeConnectionId);
      }
    });

    newSocket.on(`whatsapp:qr:${activeConnectionId}`, (qr) => {
      setQrValue(qr);
      setSessionState('scanning');
    });

    newSocket.on(`whatsapp:status:${activeConnectionId}`, async (data) => {
      if (data.status === 'connected') {
        setSessionState('connected');
        fetchConnections(); // Refresh list to show connected
      } else if (data.status === 'disconnected') {
        setSessionState('disconnected');
        setQrValue('');
        fetchConnections(); // Refresh list
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnectionId]);

  const handleCreateConnection = async () => {
    if (!newConnName.trim()) return;
    const newId = 'wa-conn-' + Date.now();
    
    // We add it to backend implicitly by initing it
    setActiveConnectionId(newId);
    setNewConnName('');
    // Removed manual initWhatsApp call to let socket.on('connect') handle it
  };

  const handleSelectConnection = (conn) => {
    setActiveConnectionId(conn.id);
    if (conn.status === 'connected') {
      setSessionState('connected');
    } else {
      setSessionState('disconnected');
      // Removed manual initWhatsApp call to let socket.on('connect') handle it
    }
  };

  const handleDeleteConnection = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to remove this connection?")) return;
    try {
      await fetch(`${PROXY}/api/whatsapp/connections/${id}`, { method: 'DELETE' });
      if (activeConnectionId === id) setActiveConnectionId(null);
      fetchConnections();
    } catch (err) {
      console.error('Failed to delete connection', err);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await fetch(`${PROXY}/api/whatsapp/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: activeConnectionId })
      });
      setSessionState('disconnected');
      fetchConnections();
    } catch (err) {
      console.error('Failed to logout WhatsApp session:', err);
    } finally {
      setLogoutLoading(false);
    }
  };

  if (!activeConnectionId) {
    return (
      <div className="page-container" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>WhatsApp Connections</h1>
        </div>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: 16 }}>Your Connected Numbers</h3>
          {loading ? <p>Loading...</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {connections.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No WhatsApp numbers connected yet.</p> : null}
              {connections.map(conn => (
                <div key={conn.id} onClick={() => handleSelectConnection(conn)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#fff', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <i className="fab fa-whatsapp" style={{ color: conn.status === 'connected' ? '#25D366' : '#999', fontSize: 24 }}></i>
                    <div>
                      <div style={{ fontWeight: 600 }}>{conn.name || conn.id}</div>
                      <div style={{ fontSize: 12, color: conn.status === 'connected' ? '#25D366' : '#999' }}>{conn.status === 'connected' ? 'Connected' : 'Disconnected'}</div>
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ color: 'red' }} onClick={(e) => handleDeleteConnection(conn.id, e)}>Remove</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-light)' }}>
            <h3 style={{ marginBottom: 16 }}>Add New Connection</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input 
                className="form-input" 
                placeholder="Enter connection name (e.g. Sales Team)" 
                value={newConnName} 
                onChange={e => setNewConnName(e.target.value)} 
                style={{ flex: 1, maxWidth: 300 }}
              />
              <button className="btn btn-primary" onClick={handleCreateConnection} disabled={!newConnName.trim()}>Generate QR Code</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Connection View
  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      
      <div style={{ alignSelf: 'flex-start', marginBottom: 20 }}>
        <button className="btn btn-ghost" onClick={() => setActiveConnectionId(null)}>← Back to Connections</button>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '16px',
        padding: '3rem',
        maxWidth: '800px',
        width: '100%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: '1px solid var(--border-light)'
      }}>
        
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24 }}>
              <i className="fab fa-whatsapp"></i>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>WhatsApp: {connections.find(c => c.id === activeConnectionId)?.name || activeConnectionId}</h1>
          </div>
        </div>

        {sessionState === 'connected' ? (
          <WhatsAppChatUI 
            connectionId={activeConnectionId} // WhatsAppChatUI will use connectionId as userId param now
            socket={socket} 
            onLogout={handleLogout} 
            logoutLoading={logoutLoading} 
          />
        ) : (
          <div style={{ display: 'flex', gap: '3rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            
            <div style={{ flex: 1, minWidth: 280 }}>
              <h3 style={{ fontSize: 18, marginBottom: 16 }}>To use WhatsApp on ZSM CRM:</h3>
              <ol style={{ paddingLeft: 20, color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14 }}>
                <li>Open WhatsApp on your phone</li>
                <li>Tap <strong>Menu</strong> or <strong>Settings</strong> and select <strong>Linked Devices</strong></li>
                <li>Tap on <strong>Link a device</strong></li>
                <li>Point your phone to this screen to capture the code</li>
              </ol>
            </div>

            <div style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '16px',
              position: 'relative',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}>
              {(sessionState === 'generating' || sessionState === 'connecting' || !qrValue) ? (
                <div style={{ width: 200, height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa', borderRadius: 8 }}>
                  <div className="spinner" style={{ borderTopColor: '#25D366', width: 32, height: 32, borderWidth: 3, marginBottom: 16 }} />
                  <div style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>
                    {sessionState === 'connecting' ? 'Connecting securely...' : 'Generating secure QR...'}
                  </div>
                </div>
              ) : (
                <div className="fade-in qr-container" style={{ position: 'relative' }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrValue)}`} alt="QR Code" style={{ width: 200, height: 200, display: 'block', borderRadius: 8 }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .qr-container:hover .qr-hint {
          opacity: 1 !important;
        }
        .fade-in {
          animation: fadeIn 0.4s ease forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};

export default WhatsAppPage;
