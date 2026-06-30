const API_BASE = (process.env.REACT_APP_API_URL || '') + '/api/users';

/**
 * Changes a user's password on the backend synchronously.
 * 
 * @param {string} uuid The UUID of the user
 * @param {string} newPassword The new password in plaintext
 * @param {string} changedBy The UUID of the person making the change
 * @param {string} changedByEmail The email of the person making the change
 * @param {boolean} isAdminReset Whether this is an admin reset
 * @param {string} [currentPassword] The user's current password in plaintext (required if not admin reset)
 * @returns {Promise<Object>} { success, hashedPassword, must_change_password }
 */
export async function changePasswordOnServer(uuid, newPassword, changedBy, changedByEmail, isAdminReset, currentPassword) {
  try {
    const res = await fetch(`${API_BASE}/${uuid}/auth-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newPassword,
        currentPassword,
        changedBy,
        changedByEmail,
        isAdminReset
      })
    });
    
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to change password');
    }
    return data;
  } catch (error) {
    console.error('[PasswordSync] Failed to change password:', error.message);
    throw error;
  }
}

/**
 * Verifies a password against the backend source of truth.
 * 
 * @param {string} uuid The UUID of the user
 * @param {string} password The password in plaintext
 * @returns {Promise<Object>} { success, valid, must_change_password }
 */
export async function verifyPasswordOnServer(uuid, password) {
  try {
    const res = await fetch(`${API_BASE}/${uuid}/auth-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to verify password');
    }
    return data;
  } catch (error) {
    console.error('[PasswordSync] Failed to verify password:', error.message);
    throw error;
  }
}
