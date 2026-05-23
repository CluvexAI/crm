import React, { useEffect, useCallback } from 'react';

let toastId = 0;
let _addToast = null;

export const useToast = () => {
  const add = useCallback((message, type = 'success', duration = 4000) => {
    if (_addToast) _addToast({ id: ++toastId, message, type, duration });
  }, []);
  return {
    success: (msg, dur) => add(msg, 'success', dur),
    error: (msg, dur) => add(msg, 'error', dur),
    info: (msg, dur) => add(msg, 'info', dur),
  };
};

window.showToast = (message, type = 'success', duration = 4000) => {
  if (_addToast) _addToast({ id: ++toastId, message, type, duration });
};

const Toast = ({ toasts, onDismiss }) => (
  <div style={{
    position: 'fixed', top: 20, right: 20, zIndex: 99999,
    display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none'
  }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        background: t.type === 'error' ? '#fef2f2' : t.type === 'info' ? '#eff6ff' : '#f0fdf4',
        border: `1px solid ${t.type === 'error' ? '#fca5a5' : t.type === 'info' ? '#93c5fd' : '#86efac'}`,
        borderRadius: 8, padding: '10px 16px', fontSize: 13,
        color: t.type === 'error' ? '#dc2626' : t.type === 'info' ? '#2563eb' : '#16a34a',
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 10,
        minWidth: 260, maxWidth: 380, pointerEvents: 'auto',
        animation: 'toastIn 0.3s ease-out',
      }}>
        <span style={{ fontSize: 16 }}>
          {t.type === 'error' ? '❌' : t.type === 'info' ? 'ℹ️' : '✅'}
        </span>
        <span style={{ flex: 1 }}>{t.message}</span>
        <button
          onClick={() => onDismiss(t.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16, padding: 0, lineHeight: 1 }}
        >✕</button>
      </div>
    ))}
  </div>
);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = React.useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast) => {
    setToasts(prev => {
      const exists = prev.find(t => t.message === toast.message && t.type === toast.type);
      if (exists) return prev;
      return [...prev, toast];
    });
    if (toast.duration > 0) {
      setTimeout(() => dismiss(toast.id), toast.duration);
    }
  }, [dismiss]);

  useEffect(() => { _addToast = addToast; return () => { _addToast = null; }; }, [addToast]);

  return (
    <>
      {children}
      <Toast toasts={toasts} onDismiss={dismiss} />
      <style>{`@keyframes toastIn { from { transform: translateX(60px); opacity:0; } to { transform: translateX(0); opacity:1; } }`}</style>
    </>
  );
};