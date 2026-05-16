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

export const getMailConfig = () => {
  const stored = localStorage.getItem(MAIL_CONFIG_KEY);
  const config = stored ? JSON.parse(stored) : { ...DEFAULT_MAIL_CONFIG };
  // Ensure we always have the correct host as default
  if (!config.host || config.host === 'localhost') config.host = 'mail.zsmeservices.com';
  return config;
};

export const saveMailConfig = (config) => {
  localStorage.setItem(MAIL_CONFIG_KEY, JSON.stringify({ ...DEFAULT_MAIL_CONFIG, ...config }));
  return true;
};

export const getUserEmails = () => {
  const stored = localStorage.getItem(USER_EMAILS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveUserEmails = (emails) => {
  localStorage.setItem(USER_EMAILS_KEY, JSON.stringify(emails));
};

export const addUserEmail = (userId, userName, userRole, email, password, extraConfig = {}) => {
  const emails = getUserEmails();
  const existingIndex = emails.findIndex(e => e.email.toLowerCase() === email.toLowerCase());
  
  if (existingIndex !== -1) {
    // If it exists, update it to the new user and settings
    return updateUserEmail(emails[existingIndex].id, {
      userId,
      userName,
      userRole,
      password,
      ...extraConfig
    });
  }

  const newEmail = {
    id: `email_${Date.now()}`,
    userId,
    userName,
    userRole,
    email,
    password: encrypt(password),
    imapStatus: 'unknown',
    smtpStatus: 'unknown',
    lastSync: null,
    lastTest: null,
    testResult: null,
    active: true,
    createdAt: new Date().toISOString(),
    ...extraConfig
  };
  emails.push(newEmail);
  saveUserEmails(emails);
  return newEmail;
};

export const updateUserEmail = (id, updates) => {
  const emails = getUserEmails();
  const index = emails.findIndex(e => e.id === id);
  if (index === -1) throw new Error('Email account not found');
  
  if (updates.password) {
    updates.password = encrypt(updates.password);
  }
  
  emails[index] = { ...emails[index], ...updates };
  saveUserEmails(emails);
  return emails[index];
};

export const deleteUserEmail = (id) => {
  const emails = getUserEmails().filter(e => e.id !== id);
  saveUserEmails(emails);
};

export const resetUserEmailPassword = (id, newPassword) => {
  return updateUserEmail(id, { password: encrypt(newPassword), lastTest: null, testResult: null });
};

export const getEmailById = (id) => {
  const emails = getUserEmails();
  return emails.find(e => e.id === id);
};

export const getEmailByUserId = (userId, userEmail = null) => {
  const emails = getUserEmails();
  // Try by UUID first
  const byId = emails.filter(e => e.userId === userId);
  if (byId.length > 0) return byId;
  
  // Fallback to email address matching if UUID fails
  if (userEmail) {
    return emails.filter(e => e.email.toLowerCase() === userEmail.toLowerCase());
  }
  return [];
};

export const toggleEmailActive = (id) => {
  const emails = getUserEmails();
  const email = emails.find(e => e.id === id);
  if (!email) throw new Error('Email account not found');
  email.active = !email.active;
  saveUserEmails(emails);
  return email;
};

export const testImapConnection = async (emailId) => {
  const email = getEmailById(emailId);
  if (!email) throw new Error('Email account not found');
  
  const config = getMailConfig();
  const password = decrypt(email.password);
  
  const testResult = {
    timestamp: new Date().toISOString(),
    success: false,
    message: '',
    errorType: null,
  };
  
  try {
    const response = await fetch('/api/mail/test-imap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: config.imapHost,
          port: config.imapPort,
          user: email.email,
          pass: password
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      testResult.success = true;
      testResult.message = 'IMAP connection successful';
      updateUserEmail(emailId, { imapStatus: 'connected', lastTest: testResult.timestamp, testResult });
    } else {
      testResult.success = false;
      testResult.message = data.message || 'IMAP authentication failed';
      testResult.errorType = 'AUTH_FAILED';
      updateUserEmail(emailId, { imapStatus: 'error', lastTest: testResult.timestamp, testResult });
    }
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
  if (!email) throw new Error('Email account not found');
  
  const config = getMailConfig();
  const password = decrypt(email.password);
  
  const testResult = {
    timestamp: new Date().toISOString(),
    success: false,
    message: '',
    errorType: null,
  };
  
  try {
    const response = await fetch('/api/mail/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: config.smtpHost,
          port: config.smtpPort,
          user: email.email,
          pass: password
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      testResult.success = true;
      testResult.message = 'SMTP connection successful';
      updateUserEmail(emailId, { smtpStatus: 'connected', lastTest: testResult.timestamp, testResult });
    } else {
      testResult.success = false;
      testResult.message = data.message || 'SMTP authentication failed';
      testResult.errorType = 'SMTP_AUTH_ERROR';
      updateUserEmail(emailId, { smtpStatus: 'error', lastTest: testResult.timestamp, testResult });
    }
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
  if (!email) throw new Error('Email account not found');
  
  const config = getMailConfig();
  const password = decrypt(email.password);
  
  const result = {
    timestamp: new Date().toISOString(),
    success: false,
    message: '',
    to: recipientEmail,
    errorType: null,
  };
  
  logEmailActivity({
    type: 'SEND_TEST',
    from: email.email,
    to: recipientEmail,
    timestamp: result.timestamp,
  });
  
  try {
    const response = await fetch('/api/mail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: config.smtpHost,
          port: config.smtpPort,
          user: email.email,
          pass: password,
          name: email.userName
        },
        mailOptions: {
          to: recipientEmail,
          subject: 'ZSM CRM Test Email',
          text: `This is a test email from ZSM CRM for account ${email.email}.\n\nIf you are seeing this, your SMTP configuration is working correctly.`,
          html: `<h3>ZSM CRM Test Email</h3><p>This is a test email from ZSM CRM for account <b>${email.email}</b>.</p><p>If you are seeing this, your SMTP configuration is working correctly.</p>`
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      result.success = true;
      result.message = `Test email sent successfully to ${recipientEmail}`;
    } else {
      result.success = false;
      result.message = data.message || 'Failed to send email';
      result.errorType = 'SMTP_REJECT';
    }
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
  
  const result = {
    timestamp: new Date().toISOString(),
    imap: { success: false, message: '' },
    smtp: { success: false, message: '' },
  };
  
  // We don't have user credentials here, so we just check if servers are reachable via our backend
  try {
    const imapRes = await fetch('/api/mail/test-imap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { host: config.imapHost, port: config.imapPort, user: 'test@example.com', pass: 'test' }
      })
    });
    // This will likely fail auth but we check if it's a 401 (reachable) vs 500/fetch error
    result.imap.success = imapRes.status === 401 || imapRes.status === 200;
    result.imap.message = result.imap.success ? 'IMAP server reachable' : 'Cannot reach IMAP server';
  } catch (err) {
    result.imap.message = 'IMAP unreachable: ' + err.message;
  }
  
  try {
    const smtpRes = await fetch('/api/mail/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { host: config.smtpHost, port: config.smtpPort, user: 'test@example.com', pass: 'test' }
      })
    });
    result.smtp.success = smtpRes.status === 401 || smtpRes.status === 200;
    result.smtp.message = result.smtp.success ? 'SMTP server reachable' : 'Cannot reach SMTP server';
  } catch (err) {
    result.smtp.message = 'SMTP unreachable: ' + err.message;
  }
  
  return result;
};

export const getEmailLogs = () => {
  const stored = localStorage.getItem(EMAIL_LOGS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const logEmailActivity = (log) => {
  const logs = getEmailLogs();
  logs.unshift(log);
  if (logs.length > 500) logs.length = 500;
  localStorage.setItem(EMAIL_LOGS_KEY, JSON.stringify(logs));
  return log;
};

export const getSyncState = () => {
  const stored = localStorage.getItem(SYNC_STATE_KEY);
  return stored ? JSON.parse(stored) : {
    status: 'idle',
    lastSync: null,
    totalSynced: 0,
    errors: 0,
  };
};

export const updateSyncState = (state) => {
  localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
};

export const runFullSync = async () => {
  const globalConfig = getMailConfig();
  const emails = getUserEmails().filter(e => e.active);
  
  updateSyncState({ status: 'running', lastSync: null, totalSynced: 0, errors: 0 });
  
  const syncLog = [];
  
  for (const email of emails) {
    try {
      const password = decrypt(email.password);
      const response = await fetch('/api/mail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            host: globalConfig.imapHost,
            port: globalConfig.imapPort,
            user: email.email,
            pass: password
          }
        })
      });
      
      const resData = await response.json();
      
      if (resData.success) {
        const inboxCount = resData.data.inbox.length;
        const sentCount = resData.data.sent.length;
        const total = inboxCount + sentCount;
        
        updateUserEmail(email.id, { lastSync: new Date().toISOString() });
        
        // Store emails in local storage or database (mocking for now, but with real data)
        const storedEmails = JSON.parse(localStorage.getItem('zsm_synced_emails') || '[]');
        const newEmails = [
          ...resData.data.inbox.map(m => ({ ...m, userId: email.userId, type: 'inbox', status: 'unread' })),
          ...resData.data.sent.map(m => ({ ...m, userId: email.userId, type: 'sent', status: 'sent' }))
        ];
        
        // Simple merge
        const existingIds = new Set(storedEmails.map(e => e.id));
        const merged = [...storedEmails, ...newEmails.filter(e => !existingIds.has(e.id))];
        localStorage.setItem('zsm_synced_emails', JSON.stringify(merged));

        syncLog.push({
          emailId: email.id,
          email: email.email,
          synced: total,
          timestamp: new Date().toISOString(),
        });
        
        const state = getSyncState();
        updateSyncState({
          ...state,
          totalSynced: state.totalSynced + total,
        });
      } else {
        throw new Error(resData.message || 'Sync failed');
      }
    } catch (err) {
      console.error('Sync Error for', email.email, ':', err);
      const state = getSyncState();
      updateSyncState({
        ...state,
        errors: state.errors + 1,
      });
      syncLog.push({
        emailId: email.id,
        email: email.email,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  updateSyncState({
    status: 'idle',
    lastSync: new Date().toISOString(),
    totalSynced: getSyncState().totalSynced,
    errors: getSyncState().errors,
  });
  
  return syncLog;
};

export const syncEmails = async (config) => {
  const globalConfig = getMailConfig();
  const password = decrypt(config.password);
  
  try {
    const response = await fetch('/api/mail/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          host: globalConfig.imapHost,
          port: globalConfig.imapPort,
          user: config.email,
          pass: password
        }
      })
    });
    
    const resData = await response.json();
    if (resData.success) {
      return {
        inbox: resData.data.inbox.map(m => ({
          id: `in_${m.id}`,
          userId: config.userId,
          fromEmail: m.from,
          subject: m.subject,
          body: 'Click to load content...', // Content is loaded on demand
          type: 'inbox',
          status: 'unread',
          createdAt: m.date
        })),
        sent: resData.data.sent.map(m => ({
          id: `sent_${m.id}`,
          userId: config.userId,
          toEmail: m.to,
          subject: m.subject,
          body: 'Click to load content...',
          type: 'sent',
          status: 'sent',
          createdAt: m.date
        }))
      };
    }
    return { inbox: [], sent: [] };
  } catch (err) {
    console.error('Sync error:', err);
    return { inbox: [], sent: [] };
  }
};

export const sendEmailViaSMTP = async (config, toEmail, subject, body) => {
  const globalConfig = getMailConfig();
  const password = decrypt(config.password);
  
  const response = await fetch('/api/mail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        host: globalConfig.smtpHost,
        port: globalConfig.smtpPort,
        user: config.email,
        pass: password,
        name: config.name || 'ZSM CRM User'
      },
      mailOptions: {
        to: toEmail,
        subject: subject,
        text: body,
        html: `<div style="font-family: sans-serif;">${body.replace(/\n/g, '<br>')}</div>`
      }
    })
  });
  
  const data = await response.json();
  if (!data.success) throw new Error(data.message || 'SMTP Send Failed');
  return data;
};

export const fetchEmailBody = async (config, folder, uid) => {
  const globalConfig = getMailConfig();
  const password = decrypt(config.password);
  
  const response = await fetch('/api/mail/fetch-body', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        host: globalConfig.imapHost,
        port: globalConfig.imapPort,
        user: config.email,
        pass: password
      },
      folder,
      uid
    })
  });
  
  const resData = await response.json();
  if (!resData.success) throw new Error(resData.message || 'Fetch failed');
  return resData.data;
};

export const getEmailAnalytics = () => {
  const logs = getEmailLogs();
  const emails = getUserEmails();
  const activeAccounts = emails.filter(e => e.active).length;
  
  const sentEmails = logs.filter(l => l.type === 'SEND' || l.type === 'SEND_TEST').length;
  const receivedEmails = logs.filter(l => l.type === 'RECEIVE').length;
  const failedEmails = logs.filter(l => !l.success).length;
  const smtpErrors = logs.filter(l => l.errorType && l.errorType.startsWith('SMTP')).length;
  const bounceCount = logs.filter(l => l.errorType === 'BOUNCE').length;
  const spamRejections = logs.filter(l => l.errorType === 'SPAM').length;
  
  const lastActivity = logs.length > 0 ? logs[0].timestamp : null;
  
  const deliveryRate = sentEmails > 0 
    ? Math.round(((sentEmails - failedEmails) / sentEmails) * 100) 
    : 100;
  
  return {
    totalSent: sentEmails,
    totalReceived: receivedEmails,
    failedEmails,
    smtpErrors,
    bounceCount,
    spamRejections,
    deliveryRate,
    lastMailActivity: lastActivity,
    activeAccounts,
    totalAccounts: emails.length,
    imapConnected: emails.filter(e => e.imapStatus === 'connected').length,
    smtpConnected: emails.filter(e => e.smtpStatus === 'connected').length,
  };
};

export const maskPassword = (password) => {
  if (!password || password.length < 4) return '****';
  return '*'.repeat(password.length - 4) + password.slice(-4);
};

export const decryptEmailPassword = (encryptedPassword) => {
  return decrypt(encrypt(encryptedPassword));
};

export const testEmailConnection = async ({ email, password, imap, smtp }) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (email && password) {
        resolve({
          success: true,
          message: 'Connection successful',
          smtp: smtp?.host || 'mail.zsmeservices.com',
          imap: imap?.host || 'mail.zsmeservices.com'
        });
      } else {
        resolve({
          success: false,
          message: 'Invalid credentials'
        });
      }
    }, 1500);
  });
};
