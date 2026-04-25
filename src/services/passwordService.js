import bcrypt from 'bcryptjs';

// Password strength validation
export const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Hash password with bcrypt
export const hashPassword = async (password) => {
  const saltRounds = 12; // Industry standard: 10-12 rounds
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
};

// Verify password against hash
export const verifyPassword = async (plainPassword, hashedPassword) => {
  try {
    const isValid = await bcrypt.compare(plainPassword, hashedPassword);
    return isValid;
  } catch (error) {
    console.error('Error verifying password:', error);
    throw new Error('Failed to verify password');
  }
};

// Check if new password is different from old password
export const isNewPasswordDifferent = async (newPassword, oldHashedPassword) => {
  try {
    const isSame = await bcrypt.compare(newPassword, oldHashedPassword);
    return !isSame; // Return true if different
  } catch (error) {
    console.error('Error comparing passwords:', error);
    throw new Error('Failed to compare passwords');
  }
};

// Check if password is already hashed
export const isPasswordHashed = (password) => {
  return password?.startsWith('$2a$') || password?.startsWith('$2b$');
};