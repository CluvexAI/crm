import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getMeetingDuration, formatMeetingDuration } from '../services/meetingService';

const Header = ({ title, subtitle }) => {
  const { currentUser, sessionStart, setActivePage, unreadMessages, startMeeting, endMeeting, getActiveMeeting } = useApp();
  const [now, setNow] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [meetingSeconds, setMeetingSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (currentUser) {
      const active = getActiveMeeting();
      if (active) {
        setActiveMeeting(active);
      }
    } else {
      setActiveMeeting(null);
      setMeetingSeconds(0);
    }
  }, [currentUser, getActiveMeeting]);

  useEffect(() => {
    if (activeMeeting) {
      setMeetingSeconds(getMeetingDuration(activeMeeting.startTime));
      
      const interval = setInterval(() => {
        const currentMeeting = getActiveMeeting();
        if (currentMeeting) {
          const duration = getMeetingDuration(currentMeeting.startTime);
          setMeetingSeconds(duration);
        } else {
          setActiveMeeting(null);
          setMeetingSeconds(0);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setMeetingSeconds(0);
    }
  }, [activeMeeting, getActiveMeeting]);

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

  const handleMeetingToggle = () => {
    if (activeMeeting) {
      endMeeting();
      setActiveMeeting(null);
      setMeetingSeconds(0);
    } else {
      const meeting = startMeeting();
      setActiveMeeting(meeting);
    }
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
                onClick={handleMeetingToggle}
                style={{ padding: '4px 10px', fontSize: 12 }}
              >
                End Meeting
              </button>
            </div>
          ) : (
            <button
              className="btn btn-sm btn-outline"
              onClick={handleMeetingToggle}
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
