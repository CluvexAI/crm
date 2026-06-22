import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const ActivityReportsCalendar = () => {
  const { currentUser } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reportsByDate, setReportsByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedReports, setSelectedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewMode, setViewMode] = useState(currentUser?.role === 'Admin' ? 'team' : 'personal');

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const userId = currentUser?.id;
  const isAdmin = currentUser?.role === 'Admin';

  useEffect(() => {
    if (userId) {
      fetchCalendarData();
    }
  }, [month, year, userId, viewMode]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      // Admin in team mode: fetch all reports (no userId filter)
      // Everyone else (or Admin in personal mode): filter by their userId
      const userIdParam = (isAdmin && viewMode === 'team') ? '' : `&userId=${userId}`;
      const res = await fetch(`/api/activity-reports/calendar?month=${month}&year=${year}${userIdParam}`);
      const json = await res.json();
      if (json.success) {
        setReportsByDate(json.data);
      }
    } catch (e) {
      console.error('[Calendar] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDateDetails = async (date) => {
    setDetailLoading(true);
    try {
      // Admin in team mode: fetch all reports for that date (no userId filter)
      const userIdParam = (isAdmin && viewMode === 'team') ? '' : `?userId=${userId}`;
      const res = await fetch(`/api/activity-reports/date/${date}${userIdParam}`);
      const json = await res.json();
      if (json.success) {
        setSelectedReports(json.data);
      }
    } catch (e) {
      console.error('[Calendar] Detail fetch error:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDateClick = (date) => {
    const dateStr = formatDateString(date);
    if (reportsByDate[dateStr] && reportsByDate[dateStr].length > 0) {
      setSelectedDate(dateStr);
      fetchDateDetails(dateStr);
    }
  };

  const closeModal = () => {
    setSelectedDate(null);
    setSelectedReports([]);
  };

  const formatDateString = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getMonthName = (m) => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ][m];

  const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month - 1, 1).getDay();

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    // Empty cells for days before the 1st
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = formatDateString(dateObj);
      const hasReports = reportsByDate[dateStr] && reportsByDate[dateStr].length > 0;
      const reportCount = hasReports ? reportsByDate[dateStr].length : 0;
      const isToday = dateStr === new Date().toLocaleDateString('en-CA');
      const isPast = dateObj < new Date(new Date().setHours(0, 0, 0, 0));

      days.push(
        <div
          key={day}
          className={`calendar-day ${hasReports ? 'has-reports' : ''} ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}`}
          onClick={() => hasReports && handleDateClick(dateObj)}
          style={{ cursor: hasReports ? 'pointer' : 'default' }}
        >
          <span className="day-number">{day}</span>
          {hasReports && (
            <div className="report-indicator">
              <span className="report-dot"></span>
              <span className="report-count">{reportCount}</span>
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="activity-calendar-container">
      <div className="calendar-header">
        <h3>📅 {isAdmin && viewMode === 'team' ? 'Team Activity Reports' : 'My Activity Reports'}</h3>
        <div className="calendar-nav">
          {isAdmin && (
            <div style={{ display: 'flex', gap: 4, marginRight: 12, background: 'var(--bg-secondary)', borderRadius: 6, padding: 2 }}>
              <button
                className={`btn btn-sm`}
                style={{ 
                  padding: '4px 10px', fontSize: 12, borderRadius: 4,
                  background: viewMode === 'team' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'team' ? '#fff' : 'var(--text-secondary)',
                  border: 'none'
                }}
                onClick={() => setViewMode('team')}
              >👥 Team</button>
              <button
                className={`btn btn-sm`}
                style={{ 
                  padding: '4px 10px', fontSize: 12, borderRadius: 4,
                  background: viewMode === 'personal' ? 'var(--primary)' : 'transparent',
                  color: viewMode === 'personal' ? '#fff' : 'var(--text-secondary)',
                  border: 'none'
                }}
                onClick={() => setViewMode('personal')}
              >👤 Mine</button>
            </div>
          )}
          <button className="btn btn-sm" onClick={prevMonth}>‹ Prev</button>
          <span className="current-month">{getMonthName(month - 1)} {year}</span>
          <button className="btn btn-sm" onClick={nextMonth}>Next ›</button>
        </div>
      </div>

      {loading ? (
        <div className="calendar-loading">Loading calendar data...</div>
      ) : (
        <>
          <div className="calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="weekday">{d}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {renderCalendar()}
          </div>
        </>
      )}

      {selectedDate && (
        <div className="calendar-modal-overlay" onClick={closeModal}>
          <div className="calendar-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Activity Reports for {selectedDate}</h4>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div className="loading">Loading report details...</div>
              ) : selectedReports.length === 0 ? (
                <div className="no-reports">No reports found for this date.</div>
              ) : (
                <div className="reports-list">
                  {selectedReports.map((report, index) => (
                    <div key={report.id || index} className="report-detail-card">
                      <div className="report-header">
                        <span className="reporter-name">{report.userName}</span>
                        <span className="report-time">{formatTime(report.createdAt)}</span>
                      </div>
                      <div className="report-dept">{report.department}</div>
                      <div className="report-text">{report.reportText}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .activity-calendar-container {
          background: var(--card-bg, #fff);
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .calendar-header h3 {
          margin: 0;
          color: var(--text-primary);
          font-size: 18px;
        }
        .calendar-nav {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .calendar-nav .btn {
          padding: 6px 12px;
          border-radius: 6px;
          background: var(--primary);
          color: #fff;
          border: none;
          cursor: pointer;
        }
        .current-month {
          font-weight: 600;
          color: var(--text-primary);
          min-width: 150px;
          text-align: center;
        }
        .calendar-loading, .loading, .no-reports {
          text-align: center;
          padding: 40px;
          color: var(--text-muted);
        }
        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
          margin-bottom: 8px;
        }
        .weekday {
          text-align: center;
          font-weight: 600;
          color: var(--text-secondary);
          font-size: 12px;
          padding: 8px 0;
        }
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .calendar-day {
          min-height: 70px;
          border: 1px solid var(--border-light);
          border-radius: 8px;
          padding: 8px;
          background: var(--bg-secondary);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .calendar-day.empty {
          background: transparent;
          border: none;
        }
        .calendar-day.has-reports {
          background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
          border-color: #4caf50;
        }
        .calendar-day.today {
          border: 2px solid #0E5491;
        }
        .calendar-day.past {
          opacity: 0.7;
        }
        .day-number {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 14px;
        }
        .report-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 6px;
        }
        .report-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #4caf50;
        }
        .report-count {
          font-size: 11px;
          color: #2e7d32;
          font-weight: 600;
        }
        .calendar-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .calendar-modal {
          background: #fff;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-light);
          background: #f8f9fa;
        }
        .modal-header h4 {
          margin: 0;
          color: var(--text-primary);
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-muted);
        }
        .modal-body {
          padding: 20px;
          overflow-y: auto;
        }
        .reports-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .report-detail-card {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 14px;
          border-left: 4px solid #0E5491;
        }
        .report-detail-card .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .report-detail-card .reporter-name {
          font-weight: 600;
          color: var(--text-primary);
        }
        .report-detail-card .report-time {
          font-size: 12px;
          color: var(--text-muted);
        }
        .report-detail-card .report-dept {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }
        .report-detail-card .report-text {
          color: var(--text-primary);
          font-size: 14px;
          line-height: 1.5;
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
};

export default ActivityReportsCalendar;