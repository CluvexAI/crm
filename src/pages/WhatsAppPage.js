import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { io } from 'socket.io-client';
import WhatsAppChatUI from '../components/WhatsAppChatUI';

const PROXY = process.env.REACT_APP_API_URL || '';

const WhatsAppPage = () => {
  const { currentUser, updateUser } = useApp();
  
  const [sessionState, setSessionState] = useState('disconnected'); // disconnected, generating, scanning, connecting, connected
  const [qrValue, setQrValue] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [socket, setSocket] = useState(null);

  // Initialize socket and listeners
  useEffect(() => {
    const userId = currentUser?.id || currentUser?.uuid;
    if (!userId) return;

    const backendUrl = window.location.hostname === 'localhost' ? 'http://localhost:5001' : PROXY;
    const newSocket = io(backendUrl, {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket for WhatsApp');
    });

    newSocket.on(`whatsapp:qr:${userId}`, (qr) => {
      setQrValue(qr);
      setSessionState('scanning');
    });

    newSocket.on(`whatsapp:status:${userId}`, async (data) => {
      if (data.status === 'connected') {
        setSessionState('connected');
        // Optionally fetch updated user to sync state
        const sessionData = {
          status: 'connected',
          connectedAt: new Date().toISOString(),
          deviceId: `device-${userId}`,
        };
        await updateUser(userId, { whatsappSession: sessionData });
      } else if (data.status === 'disconnected') {
        setSessionState('disconnected');
        setQrValue('');
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser?.id, currentUser?.uuid, updateUser]);

  // Initialize state based on currentUser
  useEffect(() => {
    if (currentUser?.whatsappSession?.status === 'connected') {
      setSessionState('connected');
    } else {
      setSessionState('disconnected');
    }
  }, [currentUser]);

  const initWhatsApp = async () => {
    const userId = currentUser?.id || currentUser?.uuid;
    if (!userId) return;
    
    setSessionState('generating');
    try {
      await fetch(`${PROXY}/api/whatsapp/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
    } catch (err) {
      console.error('Failed to init WhatsApp:', err);
      setSessionState('disconnected');
    }
  };

  // Auto-start QR generation when disconnected
  useEffect(() => {
    if (sessionState === 'disconnected') {
      initWhatsApp();
    }
  }, [sessionState]);

  const handleLogout = async () => {
    setLogoutLoading(true);
    const userId = currentUser?.id || currentUser?.uuid;
    try {
      await fetch(`${PROXY}/api/whatsapp/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      await updateUser(userId, { whatsappSession: null });
      setSessionState('disconnected');
    } catch (err) {
      console.error('Failed to logout WhatsApp session:', err);
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
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
              <i className="fab fa-whatsapp">📱</i>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>WhatsApp Web Link</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', maxWidth: 500, margin: '0 auto', fontSize: 14, lineHeight: 1.5 }}>
            {sessionState === 'connected' 
              ? "Your WhatsApp session is currently active and securely linked to your CRM account."
              : "Link your WhatsApp account to automatically sync messages, templates, and contact interactions directly within the CRM."}
          </p>
        </div>

        {sessionState === 'connected' ? (
          <WhatsAppChatUI 
            userId={currentUser?.id || currentUser?.uuid} 
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
                <div 
                  className="fade-in qr-container" 
                  style={{ position: 'relative' }}
                >
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
