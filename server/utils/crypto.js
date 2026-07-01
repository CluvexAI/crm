const crypto = require('crypto');
const logger = require('./logger.js');


const ALGORITHM = 'aes-256-gcm';
// ENCRYPTION_KEY must be 32 bytes
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
  } catch (error) {
    logger.error('Encryption error:', error);
    return null;
  }
}

function decrypt(text) {
  if (!text) return text;
  if (!text.includes(':')) return text; // Not encrypted or old format
  try {
    const parts = text.split(':');
    if (parts.length !== 3) return text;
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
  } catch (error) {
    logger.error('Decryption error:', error);
    return null;
  }
}

module.exports = {
  encrypt,
  decrypt
};
