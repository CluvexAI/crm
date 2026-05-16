import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getMeetingDuration, formatMeetingDuration } from '../services/meetingService';

const Header = ({ title, subtitle }) => {
  const { currentUser, sessionStart, setActivePage, unreadMessages, startMeeting, endMeeting, getActiveMeeting, getUnreadNotificationsCount, allNotifications, markNotificationRead, setActivePage: setPage } = useApp();
  const [now, setNow] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [meetingSeconds, setMeetingSeconds] = useState(0);

  const unreadNotifications = currentUser ? getUnreadNotificationsCount(currentUser.id) : 0;
  const myNotifications = currentUser ? allNotifications.filter(n => n.userId === currentUser.id).slice(0, 10) : [];

  // 🧪 DEBUG LOG (Requested in FIX 5)
  useEffect(() => {
    if (currentUser) {
      console.log("Meeting State Updated:", !!activeMeeting);
    }
  }, [activeMeeting, currentUser]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync with global meeting state
  const syncMeetingState = useCallback(() => {
    if (!currentUser) return;
    const active = getActiveMeeting();
    // Only update if state actually changed to prevent loops
    if (JSON.stringify(active) !== JSON.stringify(activeMeeting)) {
      setActiveMeeting(active);
    }
  }, [currentUser, getActiveMeeting, activeMeeting]);

  useEffect(() => {
    syncMeetingState();
    const interval = setInterval(syncMeetingState, 2000); // Periodic sync
    return () => clearInterval(interval);
  }, [syncMeetingState]);

  // Meeting timer
  useEffect(() => {
    if (activeMeeting && activeMeeting.startTime) {
      setMeetingSeconds(getMeetingDuration(activeMeeting.startTime));
      const interval = setInterval(() => {
        setMeetingSeconds(getMeetingDuration(activeMeeting.startTime));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setMeetingSeconds(0);
    }
  }, [activeMeeting]);

  const formatTime = (date) => date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const formatDate = (date) => date.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

  const getSessionDuration = () => {
    if (!sessionStart) return '0h 0m';
    const diff = Math.floor((now - sessionStart) / 60000);
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m`;
  };

  const getInitials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U';

  // 🧠 FIX 1: SEPARATE START AND END LOGIC (Requested)
  const handleStartMeeting = () => {
    if (activeMeeting) return; // Prevent double start
    console.log("Action: Starting Meeting");
    const meeting = startMeeting();
    setActiveMeeting(meeting);
  };

  const handleEndMeeting = () => {
    if (!activeMeeting) return; // Prevent double end
    console.log("Action: Ending Meeting");
    endMeeting();
    setActiveMeeting(null);
    setMeetingSeconds(0);
  };

  return (
    <header className="header">
      <div className="header-left">
        <div>
          <div className="page-title">{title}</div>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="header-right">
        <div className="header-clock">
          <div className="header-clock-item">
            <span style={{ fontSize: 16 }}>📅</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{formatDate(now)}</span>
          </div>
          <div className="header-clock-item">
            <span style={{ fontSize: 16 }}>🕐</span>
            <span className="header-clock-time">{formatTime(now)}</span>
          </div>
          <div className="session-badge">
            ⏱ Session: {getSessionDuration()}
          </div>

          {/* 🖥️ FIX 2: HEADER BUTTON LOGIC (Requested) */}
          {activeMeeting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                padding: '4px 12px',
                background: 'var(--danger-light)',
                border: '1px solid var(--danger)',
                borderRadius: 6,
                color: 'var(--danger)',
                fontWeight: 600,
                fontSize: 14,
                fontFamily: 'monospace',
              }}>
                📹 {formatMeetingDuration(meetingSeconds)}
              </div>
              <button
                className="btn btn-sm btn-danger"
                onClick={handleEndMeeting}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                End Meeting
              </button>
            </div>
          ) : (
            <button
              className="btn btn-sm btn-outline"
              onClick={handleStartMeeting}
              style={{ padding: '4px 12px', fontSize: 12 }}
            >
              📹 Start Meeting
            </button>
          )}
        </div>

        <button className="btn btn-icon btn-ghost" style={{ position: 'relative' }}
          onClick={() => setActivePage('chat')}>
          💬
          {unreadMessages > 0 && (
            <span className="notification-dot">{unreadMessages}</span>
          )}
        </button>

        <button className="btn btn-icon btn-ghost" style={{ position: 'relative' }}
          onClick={() => setShowNotifications(!showNotifications)}>
          🔔
          {unreadNotifications > 0 && (
            <span className="notification-dot" style={{ background: 'var(--danger)' }}>{unreadNotifications}</span>
          )}
        </button>

        {showNotifications && (
          <div style={{
            position: 'absolute',
            top: 50,
            right: 60,
            background: 'white',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            width: 320,
            maxHeight: 400,
            overflow: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}>
            <div style={{ padding: 12, borderBottom: '1px solid var(--border-light)', fontWeight: 600 }}>
              🔔 Notifications
            </div>
            {myNotifications.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                No notifications
              </div>
            ) : (
              myNotifications.map(n => (
                <div
                  key={n.id}
                  style={{
                    padding: 12,
                    borderBottom: '1px solid var(--border-light)',
                    background: n.isRead ? 'white' : '#f0f8ff',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    markNotificationRead(n.id);
                    if (n.type === 'project_assigned') {
                      setPage('projects');
                    }
                    setShowNotifications(false);
                  }}
                >
                  <div style={{ fontWeight: n.isRead ? 400 : 600, fontSize: 13 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="dropdown">
          <div className="avatar" onClick={() => setShowUserMenu(!showUserMenu)}>
            {getInitials(currentUser?.name)}
          </div>
          {showUserMenu && (
            <div className="dropdown-menu" style={{ minWidth: 200 }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{currentUser?.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{currentUser?.role}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{currentUser?.email}</div>
              </div>
              <div className="dropdown-item" onClick={() => { setActivePage('profile'); setShowUserMenu(false); }}>
                👤 My Profile
              </div>
              <div className="dropdown-item" onClick={() => { setActivePage('attendance'); setShowUserMenu(false); }}>
                📋 My Attendance
              </div>
              <div className="dropdown-divider" />
              <div className="dropdown-item danger" onClick={() => { /* logout handled outside */ setShowUserMenu(false); document.dispatchEvent(new Event('logout')); }}>
                🚪 Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
