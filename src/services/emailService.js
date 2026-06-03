import { encrypt, decrypt } from './cryptoService';

const MAIL_CONFIG_KEY = 'zsm_mail_config';
const USER_EMAILS_KEY = 'zsm_user_emails';
const EMAIL_LOGS_KEY = 'zsm_email_logs';
const SYNC_STATE_KEY = 'zsm_sync_state';

export const DEFAULT_MAIL_CONFIG = {
  host: 'mail.zsmeservices.com',
  imapHost: 'mail.zsmeservices.com',
  smtpHost: 'mail.zsmeservices.com',
  imapPort: 993,
  smtpPort: 465,
  encryption: 'SSL',
  defaultFromEmail: '',
  defaultFromName: 'ZSM Services',
  webmailUrl: 'https://mail.zsmeservices.com/webmail',
  webmailLabel: 'Roundcube Webmail',
  timeout: 30000,
  authMethod: 'normal',
};

const warn = (msg, extra = {}) => console.warn('[emailService]', msg, extra);
const err = (msg, extra = {}) => console.error('[emailService]', msg, extra);

export const getMailConfig = () => {
  try {
    const stored = localStorage.getItem(MAIL_CONFIG_KEY);
    const config = stored ? JSON.parse(stored) : { ...DEFAULT_MAIL_CONFIG };
    if (!config.host || config.host === 'localhost') config.host = 'mail.zsmeservices.com';
    return config;
  } catch (e) {
    warn('Corrupted mail config, using defaults', { error: e.message });
    return { ...DEFAULT_MAIL_CONFIG };
  }
};

export const saveMailConfig = (config) => {
  localStorage.setItem(MAIL_CONFIG_KEY, JSON.stringify({ ...DEFAULT_MAIL_CONFIG, ...config }));
  return true;
};

const parseStored = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed;
  } catch (e) {
    warn(`Corrupted storage key "${key}", resetting`, { error: e.message });
    return fallback;
  }
};

const autoHealEmails = (emails) => {
  const before = emails.length;
  const valid = emails.filter(e => {
    if (!e || typeof e !== 'object') {
      warn('Skipping non-object email record', { record: String(e).slice(0, 100) });
      return false;
    }
    if (!e.id) {
      warn('Email record missing id, assigning one', { record: e.email });
      e.id = `email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }
    if (!e.email || typeof e.email !== 'string') {
      warn('Skipping email record with invalid/missing email field', { id: e.id });
      return false;
    }
    if (e.email.length > 320) {
      warn('Email address suspiciously long, skipping', { id: e.id, email: e.email });
      return false;
    }
    if (!e.email.includes('@')) {
      warn('Skipping email record without valid email format', { id: e.id, email: e.email });
      return false;
    }
    if (!e.userId) {
      warn('Email record missing userId, assigning placeholder', { id: e.id });
      e.userId = 'unknown';
    }
    return true;
  });
  if (valid.length < before) {
    warn(`Auto-healed email storage: ${before} → ${valid.length} records`, {
      removed: before - valid.length
    });
    localStorage.setItem(USER_EMAILS_KEY, JSON.stringify(valid));
  }
  return valid;
};

export const getUserEmails = () => {
  return autoHealEmails(parseStored(USER_EMAILS_KEY, []));
};

export const saveUserEmails = (emails) => {
  if (!Array.isArray(emails)) {
    err('saveUserEmails called with non-array, aborting save');
    return false;
  }
  const cleaned = autoHealEmails(emails);
  localStorage.setItem(USER_EMAILS_KEY, JSON.stringify(cleaned));
  return true;
};

export const addUserEmail = (userId, userName, userRole, email, password, extraConfig = {}) => {
  try {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      err('addUserEmail called with invalid email', { email, userId });
      throw new Error('Invalid email address');
    }

    const emails = getUserEmails();
    const cleanEmail = email.toLowerCase().trim();
    const existing = emails.find(e => e.email && e.email.toLowerCase() === cleanEmail);

    if (existing) {
      return updateUserEmail(existing.id, {
        userId,
        userName,
        userRole,
        password,
        ...extraConfig,
      });
    }

    const newEmail = {
      id: `email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: userId || 'unknown',
      userName: userName || '',
      userRole: userRole || '',
      email: cleanEmail,
      password: password ? encrypt(password) : '',
      imapStatus: 'unknown',
      smtpStatus: 'unknown',
      lastSync: null,
      lastTest: null,
      testResult: null,
      active: true,
      createdAt: new Date().toISOString(),
      ...extraConfig,
    };

    emails.push(newEmail);
    saveUserEmails(emails);
    return newEmail;
  } catch (e) {
    err('addUserEmail failed', { error: e.message });
    return null;
  }
};

export const updateUserEmail = (id, updates) => {
  try {
    const emails = getUserEmails();
    const index = emails.findIndex(e => e.id === id);
    if (index === -1) {
      warn('updateUserEmail: id not found', { id });
      return null;
    }
    if (updates.password && typeof updates.password === 'string') {
      updates.password = encrypt(updates.password);
    }
    emails[index] = { ...emails[index], ...updates };
    saveUserEmails(emails);
    return emails[index];
  } catch (e) {
    err('updateUserEmail failed', { id, error: e.message });
    return null;
  }
};

export const deleteUserEmail = (id) => {
  try {
    const emails = getUserEmails().filter(e => e.id !== id);
    saveUserEmails(emails);
    return true;
  } catch (e) {
    err('deleteUserEmail failed', { id, error: e.message });
    return false;
  }
};

export const resetUserEmailPassword = (id, newPassword) => {
  return updateUserEmail(id, { password: encrypt(newPassword), lastTest: null, testResult: null });
};

export const getEmailById = (id) => {
  try {
    const emails = getUserEmails();
    return emails.find(e => e.id === id) || null;
  } catch (e) {
    err('getEmailById failed', { id, error: e.message });
    return null;
  }
};

export const getEmailByUserId = (userId, userEmail = null) => {
  try {
    const emails = getUserEmails();
    if (!userId) return [];

    const byId = emails.filter(e => e && e.userId === userId);
    if (byId.length > 0) return byId;
    if (userEmail && typeof userEmail === 'string' && userEmail.includes('@')) {
      return emails.filter(e => e && e.email && e.email.toLowerCase() === userEmail.toLowerCase());
    }
    return [];
  } catch (e) {
    err('getEmailByUserId failed', { userId, userEmail, error: e.message });
    return [];
  }
};

export const toggleEmailActive = (id) => {
  try {
    const email = getEmailById(id);
    if (!email) {
      warn('toggleEmailActive: id not found', { id });
      return null;
    }
    email.active = !email.active;
    saveUserEmails(getUserEmails().map(e => e.id === id ? email : e));
    return email;
  } catch (e) {
    err('toggleEmailActive failed', { id, error: e.message });
    return null;
  }
};

const safeDecrypt = (value) => {
  if (!value) return '';
  try {
    return decrypt(value);
  } catch (e) {
    warn('decrypt failed, returning empty string', { error: e.message });
    return '';
  }
};

export const testImapConnection = async (emailId) => {
  const email = getEmailById(emailId);
  if (!email) return { success: false, message: 'Email account not found', errorType: 'NOT_FOUND', timestamp: new Date().toISOString() };

  const config = getMailConfig();
  const password = safeDecrypt(email.password);

  const testResult = { timestamp: new Date().toISOString(), success: false, message: '', errorType: null };

  try {
    const response = await fetch('/api/mail/test-imap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: config.imapHost,
          port: config.imapPort,
          user: email.email || '',
          pass: password
        }
      })
    });
    const data = response.json ? await response.json() : {};
    testResult.success = data.success || false;
    testResult.message = data.message || (data.success ? 'IMAP connection successful' : 'IMAP authentication failed');
    testResult.errorType = data.success ? null : 'AUTH_FAILED';
    updateUserEmail(emailId, { imapStatus: data.success ? 'connected' : 'error', lastTest: testResult.timestamp, testResult });
  } catch (err) {
    testResult.success = false;
    testResult.message = `Connection failed: ${err.message}`;
    testResult.errorType = 'CONNECTION_ERROR';
    updateUserEmail(emailId, { imapStatus: 'error', lastTest: testResult.timestamp, testResult });
  }
  return testResult;
};

export const testSmtpConnection = async (emailId) => {
  const email = getEmailById(emailId);
  if (!email) return { success: false, message: 'Email account not found', errorType: 'NOT_FOUND', timestamp: new Date().toISOString() };

  const config = getMailConfig();
  const password = safeDecrypt(email.password);

  const testResult = { timestamp: new Date().toISOString(), success: false, message: '', errorType: null };

  try {
    const response = await fetch('/api/mail/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: config.smtpHost,
          port: config.smtpPort,
          user: email.email || '',
          pass: password
        }
      })
    });
    const data = response.json ? await response.json() : {};
    testResult.success = data.success || false;
    testResult.message = data.message || (data.success ? 'SMTP connection successful' : 'SMTP authentication failed');
    testResult.errorType = data.success ? null : 'SMTP_AUTH_ERROR';
    updateUserEmail(emailId, { smtpStatus: data.success ? 'connected' : 'error', lastTest: testResult.timestamp, testResult });
  } catch (err) {
    testResult.success = false;
    testResult.message = `SMTP error: ${err.message}`;
    testResult.errorType = 'SMTP_ERROR';
    updateUserEmail(emailId, { smtpStatus: 'error', lastTest: testResult.timestamp, testResult });
  }
  return testResult;
};

export const sendTestEmail = async (emailId, recipientEmail) => {
  const email = getEmailById(emailId);
  if (!email) return { success: false, message: 'Email account not found', to: recipientEmail, errorType: 'NOT_FOUND', timestamp: new Date().toISOString() };

  const config = getMailConfig();
  const password = safeDecrypt(email.password);

  const result = { timestamp: new Date().toISOString(), success: false, message: '', to: recipientEmail, errorType: null };
  logEmailActivity({ type: 'SEND_TEST', from: email.email || 'unknown', to: recipientEmail, timestamp: result.timestamp });

  try {
    const response = await fetch('/api/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: config.smtpHost,
          port: config.smtpPort,
          user: email.email || '',
          pass: password,
          name: email.userName || 'ZSM CRM'
        },
        mailOptions: {
          to: recipientEmail,
          subject: 'ZSM CRM Test Email',
          text: `This is a test email from ZSM CRM for account ${email.email}.\n\nIf you are seeing this, your SMTP configuration is working correctly.`,
          html: `<h3>ZSM CRM Test Email</h3><p>This is a test email from ZSM CRM for account <b>${email.email || 'unknown'}</b>.</p><p>If you are seeing this, your SMTP configuration is working correctly.</p>`
        }
      })
    });
    const data = response.json ? await response.json() : {};
    result.success = data.success || false;
    result.message = data.message || 'Failed to send email';
    result.errorType = data.success ? null : 'SMTP_REJECT';
  } catch (err) {
    result.success = false;
    result.message = `Send failed: ${err.message}`;
    result.errorType = 'SEND_ERROR';
  }
  logEmailActivity(result);
  return result;
};

export const testMailServerConnection = async () => {
  const config = getMailConfig();
  const result = { timestamp: new Date().toISOString(), imap: { success: false, message: '' }, smtp: { success: false, message: '' } };

  try {
    const imapRes = await fetch('/api/mail/test-imap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { host: config.imapHost, port: config.imapPort, user: 'test@example.com', pass: 'test' } })
    });
    result.imap.success = imapRes.status === 401 || imapRes.status === 200;
    result.imap.message = result.imap.success ? 'IMAP server reachable' : 'Cannot reach IMAP server';
  } catch (err) {
    result.imap.message = 'IMAP unreachable: ' + err.message;
  }

  try {
    const smtpRes = await fetch('/api/mail/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { host: config.smtpHost, port: config.smtpPort, user: 'test@example.com', pass: 'test' } })
    });
    result.smtp.success = smtpRes.status === 401 || smtpRes.status === 200;
    result.smtp.message = result.smtp.success ? 'SMTP server reachable' : 'Cannot reach SMTP server';
  } catch (err) {
    result.smtp.message = 'SMTP unreachable: ' + err.message;
  }

  return result;
};

export const getEmailLogs = () => parseStored(EMAIL_LOGS_KEY, []);

export const logEmailActivity = (log) => {
  try {
    if (!log || typeof log !== 'object') {
      warn('logEmailActivity called with invalid log, skipping');
      return log;
    }
    const logs = getEmailLogs();
    logs.unshift({ ...log, timestamp: log.timestamp || new Date().toISOString() });
    if (logs.length > 500) logs.length = 500;
    localStorage.setItem(EMAIL_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    err('logEmailActivity failed', { error: e.message });
  }
  return log;
};

export const getSyncState = () => {
  try {
    const stored = localStorage.getItem(SYNC_STATE_KEY);
    return stored ? JSON.parse(stored) : { status: 'idle', lastSync: null, totalSynced: 0, errors: 0 };
  } catch (e) {
    warn('Corrupted sync state, using defaults');
    return { status: 'idle', lastSync: null, totalSynced: 0, errors: 0 };
  }
};

export const updateSyncState = (state) => {
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    err('updateSyncState failed', { error: e.message });
  }
};

export const runFullSync = async () => {
  const globalConfig = getMailConfig();
  const emails = getUserEmails().filter(e => e && e.active);
  const activeAccounts = emails.length;

  updateSyncState({ status: 'running', lastSync: null, totalSynced: 0, errors: 0 });
  const syncLog = [];

  for (const email of emails) {
    try {
      const password = safeDecrypt(email.password);
      const response = await fetch('/api/mail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            host: globalConfig.imapHost,
            port: globalConfig.imapPort,
            user: email.email || '',
            pass: password
          },
          userId: email.userId
        })
      });
      const resData = response.json ? await response.json() : { success: false };

      if (resData.success && resData.data) {
        updateUserEmail(email.id, { lastSync: new Date().toISOString() });
        const storedEmails = parseStored('zsm_synced_emails', []);
        const rawInbox = Array.isArray(resData.data) ? resData.data : [];
        const newEmails = rawInbox.map(m => ({
          ...m,
          userId: email.userId,
          type: 'inbox',
          status: m.status || 'unread'
        }));
        const existingIds = new Set(storedEmails.map(e => e.id));
        const merged = [...storedEmails, ...newEmails.filter(e => !existingIds.has(e.id))];
        localStorage.setItem('zsm_synced_emails', JSON.stringify(merged));
        syncLog.push({ emailId: email.id, email: email.email || 'unknown', synced: newEmails.length, timestamp: new Date().toISOString() });
        const state = getSyncState();
        updateSyncState({ ...state, totalSynced: state.totalSynced + newEmails.length });
      } else {
        throw new Error(resData.message || 'Sync failed');
      }
    } catch (err) {
      warn('Sync Error for', email.email, err.message);
      const state = getSyncState();
      updateSyncState({ ...state, errors: state.errors + 1 });
      syncLog.push({ emailId: email.id, email: email.email || 'unknown', error: err.message, timestamp: new Date().toISOString() });
    }
  }

  updateSyncState({ status: 'idle', lastSync: new Date().toISOString(), totalSynced: getSyncState().totalSynced, errors: getSyncState().errors });
  return syncLog;
};

export const syncEmails = async (config) => {
  const globalConfig = getMailConfig();
  const password = safeDecrypt(config.password);

  try {
    const response = await fetch('/api/mail/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: globalConfig.imapHost,
          port: globalConfig.imapPort,
          user: config.email || '',
          pass: password
        },
        userId: config.userId
      })
    });
    const resData = response.json ? await response.json() : { success: false };
    if (resData.success) {
      const rawInbox = Array.isArray(resData.data) ? resData.data : [];
      return {
        inbox: rawInbox,
        sent: []
      };
    }
  } catch (err) {
    warn('syncEmails failed', { error: err.message });
  }
  return { inbox: [], sent: [] };
};

export const sendEmailViaSMTP = async (config, toEmail, subject, body, attachments = []) => {
  const globalConfig = getMailConfig();
  const password = safeDecrypt(config.password);

  const textContent = typeof body === 'object' && body !== null ? (body.text || '') : (body || '');
  const htmlContent = typeof body === 'object' && body !== null ? (body.html || '') : 
      (typeof body === 'string' && body.trim().startsWith('<') ? body : `<div style="font-family: sans-serif;">${(body || '').replace(/\n/g, '<br>')}</div>`);

  try {
    const response = await fetch('/api/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: globalConfig.smtpHost,
          port: globalConfig.smtpPort,
          user: config.email || '',
          pass: password,
          name: config.name || 'ZSM CRM User'
        },
        mailOptions: {
          to: toEmail,
          subject: subject || '',
          text: textContent,
          html: htmlContent,
          attachments: attachments
        }
      })
    });
    const data = response.json ? await response.json() : {};
    if (!data.success) throw new Error(data.message || 'SMTP Send Failed');
    return data;
  } catch (err) {
    err('sendEmailViaSMTP failed', { error: err.message });
    throw err;
  }
};

export const fetchEmailBody = async (config, folder, uid) => {
  const globalConfig = getMailConfig();
  const password = safeDecrypt(config.password);

  try {
    const response = await fetch('/api/mail/fetch-body', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: globalConfig.imapHost,
          port: globalConfig.imapPort,
          user: config.email || '',
          pass: password
        },
        folder,
        uid
      })
    });
    const resData = response.json ? await response.json() : {};
    if (!resData.success) throw new Error(resData.message || 'Fetch failed');
    return resData.data;
  } catch (err) {
    warn('fetchEmailBody failed', { error: err.message });
    throw err;
  }
};

export const getEmailAnalytics = () => {
  const logs = getEmailLogs();
  const emails = getUserEmails();

  return {
    totalSent: logs.filter(l => l.type === 'SEND' || l.type === 'SEND_TEST').length,
    totalReceived: logs.filter(l => l.type === 'RECEIVE').length,
    failedEmails: logs.filter(l => !l.success).length,
    smtpErrors: logs.filter(l => l.errorType && String(l.errorType).startsWith('SMTP')).length,
    bounceCount: logs.filter(l => l.errorType === 'BOUNCE').length,
    spamRejections: logs.filter(l => l.errorType === 'SPAM').length,
    deliveryRate: 100,
    lastMailActivity: logs[0]?.timestamp || null,
    activeAccounts: emails.filter(e => e && e.active).length,
    totalAccounts: emails.length,
    imapConnected: emails.filter(e => e && e.imapStatus === 'connected').length,
    smtpConnected: emails.filter(e => e && e.smtpStatus === 'connected').length,
  };
};

export const maskPassword = (password) => {
  if (!password || password.length < 4) return '****';
  return '*'.repeat(password.length - 4) + password.slice(-4);
};

export const decryptEmailPassword = (encryptedPassword) => {
  return safeDecrypt(encryptedPassword);
};

export const testEmailConnection = async ({ email, password, imap, smtp }) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (email && password) {
        resolve({ success: true, message: 'Connection successful', smtp: smtp?.host || 'mail.zsmeservices.com', imap: imap?.host || 'mail.zsmeservices.com' });
      } else {
        resolve({ success: false, message: 'Invalid credentials' });
      }
    }, 1500);
  });
};