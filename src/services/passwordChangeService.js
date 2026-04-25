import { validatePasswordStrength, verifyPassword, isNewPasswordDifferent, hashPassword } from './passwordService';

export const PASSWORD_CHANGE_STEPS = {
  SUBMIT: 'submit',
  VERIFYING: 'verifying',
  CHANGING: 'changing',
  SUCCESS: 'success',
  ERROR: 'error'
};

export const changePassword = async (currentPassword, newPassword, targetUser, allUsers, updateUser) => {
  const { uuid, password: currentHashedPassword, email } = targetUser;
  
  // Step 1: Validate input
  if (!currentPassword || !newPassword) {
    throw new Error('Current password and new password are required');
  }

  // Step 2: Verify current password
  const isCurrentPasswordValid = await verifyPassword(currentPassword, currentHashedPassword);
  if (!isCurrentPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  // Step 3: Validate new password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.isValid) {
    throw new Error(`New password is too weak: ${passwordValidation.errors.join(', ')}`);
  }

  // Step 4: Ensure new password is different from old password
  const isDifferent = await isNewPasswordDifferent(newPassword, currentHashedPassword);
  if (!isDifferent) {
    throw new Error('New password must be different from the current password');
  }

  // Step 5: Hash the new password
  const newHashedPassword = await hashPassword(newPassword);

  // Step 6: Update user in the database
  const updatedUser = {
    ...targetUser,
    password: newHashedPassword,
    updatedAt: new Date().toISOString(),
    passwordChangedAt: new Date().toISOString()
  };

  // Step 7: Update user in state
  updateUser(uuid, updatedUser);

  // Step 8: Log the password change
  console.log(`Password changed for user: ${email}`);

  return {
    success: true,
    message: 'Password changed successfully',
    user: updatedUser
  };
};

// Password change form validation
export const validatePasswordForm = (formData) => {
  const { currentPassword, newPassword, confirmPassword } = formData;
  const errors = {};

  // Validate current password
  if (!currentPassword) {
    errors.currentPassword = 'Current password is required';
  }

  // Validate new password
  if (!newPassword) {
    errors.newPassword = 'New password is required';
  } else {
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      errors.newPassword = passwordValidation.errors.join('; ');
    }
  }

  // Validate password confirmation
  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your new password';
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  // Check if new password is different from old password (if we have current password)
  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.newPassword = 'New password must be different from current password';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};