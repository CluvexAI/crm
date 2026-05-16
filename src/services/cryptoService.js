const ENCRYPTION_KEY = 'zsm-crm-secure-key-2024-aes256';

const encrypt = (text) => {
  if (!text) return '';
  try {
    const encoded = [];
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      encoded.push(charCode.toString(16));
    }
    return encoded.join('-');
  } catch (e) {
    console.error('Encryption error:', e);
    return text;
  }
};

const decrypt = (encrypted) => {
  if (!encrypted) return '';
  try {
    if (encrypted.includes('-')) {
      const parts = encrypted.split('-');
      let decoded = '';
      for (let i = 0; i < parts.length; i++) {
        const charCode = parseInt(parts[i], 16) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
        decoded += String.fromCharCode(charCode);
      }
      return decoded;
    }
    return encrypted;
  } catch (e) {
    console.error('Decryption error:', e);
    return '';
  }
};

const maskPassword = (password) => {
  if (!password) return '';
  return '•'.repeat(Math.min(password.length, 12));
};

const generateSmtpConfig = (emailConfig) => {
  return {
    host: emailConfig.smtp?.host || 'mail.zsmeservices.com',
    port: emailConfig.smtp?.port || 465,
    secure: true,
    auth: {
      user: emailConfig.email,
      pass: decrypt(emailConfig.password),
    },
  };
};

const generateImapConfig = (emailConfig) => {
  return {
    host: emailConfig.imap?.host || 'mail.zsmeservices.com',
    port: emailConfig.imap?.port || 993,
    secure: true,
    auth: {
      user: emailConfig.email,
      pass: decrypt(emailConfig.password),
    },
  };
};

module.exports = {
  encrypt,
  decrypt,
  maskPassword,
  generateSmtpConfig,
  generateImapConfig,
  ENCRYPTION_KEY,
};
