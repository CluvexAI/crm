import React from 'react';

const ChangePassword = ({ onCancel }) => {
  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal modal-sm" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-primary)' }}>
          Password Update Required
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
          For security reasons, your password must be updated. 
          Password management is now securely handled by Insforge.
          <br /><br />
          Please log out and use the <strong>Forgot Password</strong> link on the login screen to securely reset your password.
        </p>
        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '12px', fontSize: '15px' }}
          onClick={onCancel}
        >
          Log Out
        </button>
      </div>
    </div>
  );
};

export default ChangePassword;
