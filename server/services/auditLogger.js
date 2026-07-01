const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger.js');


const DATA_DIR = path.join(__dirname, '..', 'data');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit.log');

/**
 * Appends an audit event to the central audit log file.
 * 
 * @param {string} userId - The admin/user ID performing the action
 * @param {string} action - The action type (e.g., 'SEND_MESSAGE', 'DELETE_MESSAGE', 'EDIT_MESSAGE')
 * @param {string} target - The target entity (e.g., chatId or JID)
 * @param {object} details - Additional metadata
 */
function logAudit(userId, action, target, details = {}) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [USER:${userId}] [ACTION:${action}] [TARGET:${target}] ${JSON.stringify(details)}\n`;
    
    fs.appendFileSync(AUDIT_LOG_FILE, logEntry, 'utf8');
  } catch (error) {
    logger.error('[AuditLogger] Failed to write audit log:', error);
  }
}

module.exports = {
  logAudit
};
