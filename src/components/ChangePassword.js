import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { validatePasswordStrength } from '../services/passwordService';
import { changePasswordOnServer } from '../services/passwordSyncService';

const ChangePassword = ({ onCancel, onSuccess }) => {
  const { currentUser, allUsers, updateUser } = useApp();
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = async () => {
    const newErrors = {};
    const { currentPassword, newPassword, confirmPassword } = formData;

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else {
      const validation = validatePasswordStrength(newPassword);
      if (!validation.isValid) {
        newErrors.newPassword = validation.errors.join('; ');
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (currentPassword && newPassword && currentPassword === newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const isValid = await validateForm();
      if (!isValid) {
        setIsLoading(false);
        return;
      }

      const response = await changePasswordOnServer(
        currentUser.uuid, 
        formData.newPassword, 
        currentUser.uuid, 
        currentUser.email, 
        false, 
        formData.currentPassword
      );

      // DO NOT STORE HASHED PASSWORD - it's now updated on backend only
      // Password is verified against backend hash on next login
      // No need to update local user object with password field

      setSuccessMessage('Password changed successfully! You can now log in with your new password.');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 2000);

    } catch (error) {
      if (error.message.toLowerCase().includes('current password')) {
        setErrors({ currentPassword: error.message });
      } else {
        setErrors({ submit: 'Failed to change password: ' + error.message });
      }
      console.error('Password change error:', error);
    }

    setIsLoading(false);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Change Password</h2>
        
        {successMessage && (
          <div style={styles.success}>{successMessage}</div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Current Password</label>
            <input
              type="password"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={handleChange}
              style={styles.input}
              disabled={isLoading}
            />
            {errors.currentPassword && <span style={styles.error}>{errors.currentPassword}</span>}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>New Password</label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              style={styles.input}
              disabled={isLoading}
            />
            {errors.newPassword && <span style={styles.error}>{errors.newPassword}</span>}
            <div style={styles.hint}>
              Min 8 chars with uppercase, lowercase, number, and special character
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Confirm New Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              style={styles.input}
              disabled={isLoading}
            />
            {errors.confirmPassword && <span style={styles.error}>{errors.confirmPassword}</span>}
          </div>

          {errors.submit && <div style={styles.error}>{errors.submit}</div>}

          <div style={styles.buttons}>
            <button type="button" onClick={onCancel} style={styles.cancelBtn} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={isLoading}>
              {isLoading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    width: '400px',
    maxWidth: '90%',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  },
  title: {
    margin: '0 0 20px 0',
    color: '#333',
    fontSize: '20px',
    fontWeight: '600',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#555',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    outline: 'none',
  },
  hint: {
    fontSize: '12px',
    color: '#888',
    marginTop: '4px',
  },
  error: {
    color: '#e53935',
    fontSize: '12px',
    marginTop: '4px',
  },
  success: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    padding: '12px',
    borderRadius: '4px',
    fontSize: '14px',
    marginBottom: '16px',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    backgroundColor: '#f5f5f5',
    color: '#555',
    cursor: 'pointer',
    fontSize: '14px',
  },
  submitBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#1976d2',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

export default ChangePassword;
