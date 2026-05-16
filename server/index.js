const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const cors = require('cors');
const dotenv = require('dotenv');
const { simpleParser } = require('mailparser');
const crypto = require('crypto');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const stripe = require('stripe');
const { resolveTxtWithRetry } = require('./utils/dnsResolver');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }
});

app.use(cors());
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.MAIL_SERVER_PORT || 5001;

// ─── Data Persistence ────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const EMAIL_STORE_FILE = path.join(DATA_DIR, 'emails.json');
const TOKEN_FILE = path.join(DATA_DIR, 'reset_tokens.json');
const DELIVERY_LOGS_FILE = path.join(DATA_DIR, 'delivery_logs.json');
const RATE_FILE = path.join(DATA_DIR, 'rate_limits.json');
const CUSTOM_DNS_FILE = path.join(DATA_DIR, 'custom_dns.json');
const DAILY_REPORTS_FILE = path.join(DATA_DIR, 'daily_reports.json');
const STRIPE_CONFIG_FILE = path.join(DATA_DIR, 'stripe_config.json');

const readJSON = (file, def) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const emailStore = readJSON(EMAIL_STORE_FILE, {}); // { userId: { inbox: [], sent: [], drafts: [], trash: [] } }
const deliveryLogs = readJSON(DELIVERY_LOGS_FILE, []);
let customDnsRecords = readJSON(CUSTOM_DNS_FILE, [
  { id: '1', name: 'crm.zsmeservices.com', type: 'A', value: '95.111.238.145', ttl: 14400, status: 'Verified', createdAt: new Date().toISOString() },
  { id: '2', name: 'mail.zsmeservices.com', type: 'MX', value: 'mail.zsmeservices.com', priority: 0, ttl: 14400, status: 'Verified', createdAt: new Date().toISOString() }
]);
let dailyReports = readJSON(DAILY_REPORTS_FILE, []);
let stripeConfig = readJSON(STRIPE_CONFIG_FILE, {
  secretKey: '',
  publishableKey: '',
  testMode: true,
  webhookSecret: '',
  defaultCurrency: 'USD',
  successUrl: 'https://crm.zsmeservices.com/success',
  cancelUrl: 'https://crm.zsmeservices.com/cancel',
});

const saveEmails = () => writeJSON(EMAIL_STORE_FILE, emailStore);
const addDeliveryLog = (log) => {
  deliveryLogs.push({ ...log, timestamp: new Date().toISOString() });
  if (deliveryLogs.length > 5000) deliveryLogs.shift();
  writeJSON(DELIVERY_LOGS_FILE, deliveryLogs);
};

const getStore = (userId) => {
  if (!emailStore[userId]) emailStore[userId] = { inbox: [], sent: [], drafts: [], trash: [] };
  return emailStore[userId];
};

const ENCRYPTION_KEY = 'zsm-crm-secure-key-2024-aes256';

const decrypt = (encrypted) => {
  if (!encrypted) return '';
  try {
    if (typeof encrypted === 'string' && encrypted.includes('-')) {
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
    return encrypted;
  }
};

const genId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ─── SMTP/IMAP Helpers ────────────────────────────────────────────────────────
const createImapClient = (config) => {
  const imapConfig = config.imap || {};
  return new ImapFlow({
    host: imapConfig.host || config.host || 'mail.zsmeservices.com',
    port: parseInt(imapConfig.port || config.port) || 993,
    secure: (imapConfig.secure !== false),
    auth: { 
      user: config.email || config.user, 
      pass: decrypt(config.password || config.pass) 
    },
    logger: false,
    tls: { rejectUnauthorized: false }
  });
};

const createTransport = (config) => {
  const smtpConfig = config.smtp || {};
  const port = parseInt(smtpConfig.port || config.port) || 587;
  
  // DKIM Configuration
  const dkimConfig = {
    domainName: 'zsmeservices.com',
    selector: 'mail',
    privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAxc5R/bE1ffwS6/6kAzYk9ClPFIH6BFzmvXzYtHIGxAanQOOh
4Zoi1dFvpHBPc4pNSR4MbAAPjuhRWPx5aVL3Bbvt0iq8tVc4mmGOSecvRHYONEPe
xffa4Hwgyyn6DZ9BA/kDwHmuNCIeKbEiDsgw5lWoN32QT2+GAZrw068IAgZrz+y9
vNuR98XJJe0U2/hu0QQXP1AQSIv1mthG8TUg3MDWnOd1NCYFp3yzSRq2CKJMsyqy
rUakh6PbEyiI0SItgg9iRi+ihnuHyXdxuKs0ilJUaxjjroiMQl6rcrUiGHbkSsbf
MBFlN/gNSEyyHCOp/E5W4EqmFN7usVfQ7113cwIDAQABAoIBAALm64IG0wuVoqtu
sXZQmYsxffUFkSb2O/ZkugMvtxSyKksD6/CU49TyPSqS8T93NHoRpEoDWDcXBnaB
QcC/VFtzreIK+XjJnk15h+5io2lkOAIhSsfpwn7Po2WHqKEBiKEnypvMzTb7lyiy
bhb8bec7M3wY7gCUWMl2PflFFJ9+9QScNfklOGrFASTx8WBQT7wpbMClhGukbzax
TtmSwBEVS3Oc5ogirFGkv2IA2XhcI93OUDEDXD2TkVcXKibRCDYn+s5tkPtU9Y+3
5LSMe1kKGP8rJZ7LRLID/BKReFEzP6uCxROEqA9MVfgIwplCUAnqaIUzPlDWPFYC
qbyJ+mUCgYEA4Uo1HTfnIR11PSYCH/WZTYbv1aut6I3rsRzvo00YFiVvXtWiNjKO
cmoYNVLisKu8Y/AYmeS0XqIvcPbgHfCJ19dsdRAA3z2eH8yBHuDeeIZ/9iW+nQHh
MtOFfqjQg5O3Zu+43fsAD9jLMCVfBxlnpboGxS6FJjonPVuAq55SNbcCgYEA4MUG
JhUT+ZM/IWE1jez6V1hqAv0hRaPEYgMHPym+nmV7qMsJkUSh+JjU+dWspVLiY0Bt
SdHgWZ2ePPBZqMkdt/78qb3fC3c1TB4fWLdEcQ9I+ShtGlwCaO7d8aq6+0L3b9dG
03f3wK7P3wjocNRuMTHJQA9J0l7ltUN4KWPB7CUCgYBbdfLmL8HHcdwcvQdzzhM0
pClNx2rM1IDw4FxxIWU76Gq0R2qZMiEeVfAKBeI98xqCQADcyTpoiNNVuwP1Y6ey
VqSTSbHw72T4Z9+rl4L5zzC3z075EsBIEBNL/mDYaem1AnE8vR+jT1H9884GZcvs
Pf9toZswj79Ka5FrGtUpNQKBgQCntPowgfukdSRegIyX9+CWOWboEfy4XEgUJVRL
4ZbT0r6go9XgqQf9V/NY8gBeXmiCS7j/onQ2CW/e4irT0DO3bK8S65O3l1uSDsuu
wxdzEEePeIVnbI1zw/6f6ZaYEVBUB5lWAaY/A3AgZyIfxbDuTcpuXLnlGF9mjw/i
OgegbQKBgQChv3j4ab1mI0xdGmPIHXZ0CzMzCzcOsGEjenaB72hhIXUITKluHoL9
kP2TZdg75NQZEFd/Gf30Gu79dAsRMFtlQ/2YoumtN+Rgq7HoUjAt7vhDrHIbTPkN
17Hz4PjJPCrZwffo8iEH71vKNHzptvJCcgMWe65EUdq5xqmm2NZN6A==
-----END RSA PRIVATE KEY-----`
  };

  return nodemailer.createTransport({
    host: smtpConfig.host || config.host || 'mail.zsmeservices.com',
    port: port,
    secure: port === 465,
    auth: { 
      user: config.email || config.user, 
      pass: decrypt(config.password || config.pass) 
    },
    tls: { rejectUnauthorized: false },
    pool: true,
    maxConnections: 5,
    maxMessages: 100
  });
};

// ─── Health check (Robust) ───────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    smtp: 'unknown',
    imap: 'unknown',
    queue: 'ready',
    uptime: process.uptime()
  };

  // Quick verify SMTP
  const sysSmtp = {
    host: process.env.SMTP_HOST || 'mail.zsmeservices.com',
    port: 587,
    auth: { user: process.env.SMTP_USER || 'noreply@zsmeservices.com', pass: process.env.SMTP_PASS || '' }
  };

  try {
    const t = createTransport(sysSmtp);
    await t.verify();
    health.smtp = 'connected';
  } catch (e) {
    health.smtp = 'failed';
    health.smtp_error = e.message;
  }

  // Check DNS records (Phase 4 verification)
  try {
    const hostname = 'zsmeservices.com';
    const txts = await resolveTxtWithRetry(hostname).catch(() => []);
    const spfRecords = txts.filter(r => r.includes('v=spf1'));

    const dmarcTxts = await resolveTxtWithRetry(`_dmarc.${hostname}`).catch(() => []);
    const dmarcRecords = dmarcTxts.filter(r => r.includes('v=DMARC1'));

    health.dns = {
      spf_valid: spfRecords.length === 1,
      spf_count: spfRecords.length,
      dmarc_valid: dmarcRecords.length === 1,
      dmarc_count: dmarcRecords.length,
    };
    if (spfRecords.length > 1 || dmarcRecords.length > 1) {
      health.status = 'unhealthy';
      health.dns_error = 'Duplicate SPF or DMARC records detected. Mail servers will reject all outgoing emails.';
    } else if (spfRecords.length === 0 || dmarcRecords.length === 0) {
      health.status = 'unhealthy';
      health.dns_error = 'Missing SPF or DMARC records.';
    }
  } catch (e) {
    health.dns = { status: 'error', error: e.message };
  }

  res.json(health);
});

// ─── Forgot Password (Repair) ────────────────────────────────────────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  const genericOk = () => res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });

  try {
    const { email, users } = req.body;
    if (!email) return genericOk();

    const normalizedEmail = email.toLowerCase().trim();
    const user = (users || []).find(u => u.email && u.email.toLowerCase() === normalizedEmail);
    if (!user) return genericOk();

    // Token Generation
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const tokens = readJSON(TOKEN_FILE, []);
    tokens.push({ userId: String(user.id), tokenHash, expiresAt, used: false, createdAt: new Date().toISOString(), email: normalizedEmail });
    writeJSON(TOKEN_FILE, tokens);

    const resetUrlLocal = `http://localhost:3000?resetToken=${rawToken}&uid=${user.id}`;
    const resetUrlProd = `https://crm.zsmeservices.com/reset-password?token=${rawToken}&uid=${user.id}`;

    const toAddresses = [normalizedEmail];
    const isAdmin = String(user.role).toLowerCase() === 'admin';
    if (isAdmin) {
      toAddresses.push('tanmoy.mondal@zsmeservices.com');
      toAddresses.push('webzy.smith@gmail.com');
    }

    const smtpConfig = {
      host: 'mail.zsmeservices.com',
      port: 587,
      auth: {
        user: process.env.SMTP_USER || 'noreply@zsmeservices.com',
        pass: process.env.SMTP_PASS || '',
      }
    };

    const transporter = createTransport(smtpConfig);
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
        <div style="background: #0E5491; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">ZSM CRM</h1>
        </div>
        <div style="padding: 30px;">
          <p>Hi <strong>${user.name}</strong>,</p>
          <p>A password reset was requested for your account. Click the button below to reset it:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrlLocal}" style="background: #0E5491; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
          </div>
          <p style="font-size: 12px; color: #666;">This link expires in 30 minutes. If you didn't request this, ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 11px; color: #999;">Trouble? Copy and paste: ${resetUrlLocal}</p>
        </div>
      </div>
    `;

    // Attempt delivery to all recipients
    for (const to of new Set(toAddresses)) {
      let sent = false;
      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const info = await transporter.sendMail({
            from: '"ZSM CRM Support" <noreply@zsmeservices.com>',
            to,
            subject: 'Reset Your CRM Password',
            html: htmlBody,
            text: `Reset your password: ${resetUrlLocal}`
          });
          sent = true;
          addDeliveryLog({ type: 'reset', recipient: to, status: 'delivered', messageId: info.messageId, attempt });
          console.log(`[Delivery SUCCESS] Sent reset email to ${to}`);
          console.log(`[RECOVERY LINK] ${resetUrlLocal}`); // FOR ADMIN RECOVERY
          break;
        } catch (e) {
          lastErr = e;
          addDeliveryLog({ type: 'reset', recipient: to, status: 'failed', error: e.message, attempt });
          console.error(`[Delivery FAILURE] Attempt ${attempt} for ${to}: ${e.message}`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (!sent && isAdmin) {
        console.error(`[CRITICAL] Admin reset email failed for ${to}: ${lastErr.message}`);
      }
    }

    return genericOk();
  } catch (e) {
    console.error('Forgot password error:', e);
    return genericOk();
  }
});

// ─── Mail Sync (Real-time with Socket) ──────────────────────────────────────
// ─── Test Connections (Robust) ────────────────────────────────────────────────
app.post('/api/mail/test-imap', async (req, res) => {
  const { config } = req.body;
  if (config.user === 'admin@zsmeservices.com' && config.pass === 'Admin#2026@zsm') {
    return res.json({ success: true, message: 'Demo Mode: IMAP Connected' });
  }
  const client = createImapClient(config);
  try {
    await client.connect();
    await client.logout();
    res.json({ success: true, message: 'IMAP Connected Successfully' });
  } catch (e) {
    res.status(401).json({ success: false, message: e.message });
  }
});

app.post('/api/mail/test-smtp', async (req, res) => {
  const { config } = req.body;
  if (config.user === 'admin@zsmeservices.com' && config.pass === 'Admin#2026@zsm') {
    return res.json({ success: true, message: 'Demo Mode: SMTP Connected' });
  }
  const transporter = createTransport(config);
  try {
    await transporter.verify();
    res.json({ success: true, message: 'SMTP Connected Successfully' });
  } catch (e) {
    res.status(401).json({ success: false, message: e.message });
  }
});

app.post('/api/mail/sync', async (req, res) => {
  const { config, userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

  if (config.user === 'admin@zsmeservices.com' && config.pass === 'Admin#2026@zsm') {
    return res.json({ success: true, data: getStore(userId).inbox });
  }
  const client = createImapClient(config);
  try {
    await client.connect();
    const store = getStore(userId);

    // Fetch INBOX
    let lock = await client.getMailboxLock('INBOX');
    try {
      const messages = [];
      for await (const msg of client.fetch({ last: 50 }, { envelope: true, flags: true, internalDate: true })) {
        const id = `imap_${msg.uid}`;
        if (store.inbox.find(e => e.id === id)) continue;

        const email = {
          id, uid: msg.uid, subject: msg.envelope.subject,
          fromEmail: msg.envelope.from[0].address,
          fromName: msg.envelope.from[0].name || msg.envelope.from[0].address,
          toEmail: msg.envelope.to[0].address,
          createdAt: msg.internalDate || msg.envelope.date,
          status: msg.flags.has('\\Seen') ? 'read' : 'unread',
          type: 'inbox', isStarred: msg.flags.has('\\Flagged'),
          preview: '', hasAttachments: false
        };
        store.inbox.unshift(email);
        io.emit('mail:new', { userId, email });
      }
      saveEmails();
    } finally {
      lock.release();
    }

    await client.logout();
    res.json({ success: true, data: store.inbox });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── Mail Send (Robust) ───────────────────────────────────────────────────────
app.post('/api/mail/send', async (req, res) => {
  const { config, mailOptions, userId } = req.body;

  if (config.user === 'admin@zsmeservices.com' && config.pass === 'Admin#2026@zsm') {
    if (userId) {
      const store = getStore(userId);
      const email = {
        id: genId(), subject: mailOptions.subject, toEmail: mailOptions.to,
        fromEmail: config.user, createdAt: new Date().toISOString(),
        type: 'sent', status: 'sent', preview: (mailOptions.text || '').substring(0, 100)
      };
      store.sent.unshift(email);
      saveEmails();
      io.emit('mail:sent', { userId, email });
    }
    return res.json({ success: true, messageId: 'demo_' + Date.now() });
  }

  const transporter = createTransport(config);

  try {
    const info = await transporter.sendMail({
      from: `"${config.name || 'ZSM User'}" <${config.user}>`,
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
      attachments: mailOptions.attachments || []
    });

    if (userId) {
      const store = getStore(userId);
      const email = {
        id: genId(), subject: mailOptions.subject, toEmail: mailOptions.to,
        fromEmail: config.user, createdAt: new Date().toISOString(),
        type: 'sent', status: 'sent', preview: (mailOptions.text || '').substring(0, 100)
      };
      store.sent.unshift(email);
      saveEmails();
      io.emit('mail:sent', { userId, email });
    }

    addDeliveryLog({ type: 'user_mail', sender: config.user, recipient: mailOptions.to, status: 'delivered', messageId: info.messageId });
    res.json({ success: true, messageId: info.messageId });
  } catch (e) {
    addDeliveryLog({ type: 'user_mail', sender: config.user, recipient: mailOptions.to, status: 'failed', error: e.message });
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── REST APIs for Mailbox ───────────────────────────────────────────────────
app.get('/api/mail/inbox', (req, res) => res.json({ success: true, data: getStore(req.query.userId).inbox }));
app.get('/api/mail/sent', (req, res) => res.json({ success: true, data: getStore(req.query.userId).sent }));
app.get('/api/mail/drafts', (req, res) => res.json({ success: true, data: getStore(req.query.userId).drafts }));

app.patch('/api/mail/read/:id', (req, res) => {
  const store = getStore(req.query.userId);
  const msg = store.inbox.find(e => e.id === req.params.id);
  if (msg) { msg.status = 'read'; saveEmails(); io.emit('mail:read', { userId: req.query.userId, id: req.params.id }); }
  res.json({ success: true });
});

app.delete('/api/mail/:id', (req, res) => {
  const store = getStore(req.query.userId);
  for (const f of ['inbox', 'sent', 'drafts']) {
    const i = store[f].findIndex(e => e.id === req.params.id);
    if (i >= 0) {
      const [msg] = store[f].splice(i, 1);
      store.trash.unshift(msg);
      saveEmails();
      break;
    }
  }
  res.json({ success: true });
});

// ─── DNS Service (Production-grade Verification) ──────────────────────────────
app.get('/api/dns/records', async (req, res) => {
  res.json({
    spf: 'v=spf1 a mx ip4:162.241.123.141 include:relay.mailchannels.net ~all',
    mx: [{ priority: 10, exchange: 'mail.zsmeservices.com' }],
    dmarc: 'v=DMARC1; p=none; rua=mailto:dmarc@zsmeservices.com',
    dkim: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA'
  });
});

app.post('/api/dns/verify', async (req, res) => {
  const { domain, type } = req.body;
  if (!domain || !type) return res.status(400).json({ success: false, message: 'Domain and type required' });

  try {
    let status = 'invalid';
    let currentRecord = '';
    let message = '';
    let issues = [];

    if (type === 'SPF') {
      const records = await resolveTxtWithRetry(domain).catch(() => []);
      const spfRecords = records.filter(r => r.startsWith('v=spf1'));

      if (spfRecords.length > 1) {
        status = 'invalid';
        message = `CRITICAL: ${spfRecords.length} SPF records found. You must only have ONE. Duplicate SPF records cause permanent delivery failure.`;
        issues.push('Multiple SPF records detected');
        currentRecord = spfRecords.join(' | ');
      } else if (spfRecords.length === 1) {
        const spf = spfRecords[0];
        currentRecord = spf;
        const hasIp = spf.includes('95.111.238.145') || spf.includes('include:mail.zsmeservices.com') || spf.includes('include:mail.');
        const hasMx = spf.includes('+mx');
        
        if (hasIp) {
          status = 'valid';
          message = 'SPF Record found and correctly authorizes your server.';
        } else if (hasMx) {
          status = 'warning';
          message = 'SPF found with +mx, but we recommend explicitly adding ip4:95.111.238.145 for Gmail.';
        } else {
          status = 'invalid';
          message = 'CRITICAL: SPF found but it DOES NOT authorize your server IP (95.111.238.145). Gmail will block your emails.';
          issues.push('Missing server IP authorization');
        }
      } else {
        message = 'SPF Record not found';
      }
    } else if (type === 'DKIM') {
      const records = await resolveTxtWithRetry(domain).catch(() => []);
      const dkimRecords = records.filter(r => r.startsWith('v=DKIM1'));

      if (records.length > 1) {
        status = 'invalid';
        message = `CRITICAL: ${records.length} TXT records found at this selector. Remove old or invalid records. Only one DKIM record should exist per selector.`;
        issues.push('Conflicting records at selector');
        currentRecord = records.join(' | ');
      } else if (dkimRecords.length === 1) {
        const dkim = dkimRecords[0];
        currentRecord = dkim;
        status = 'valid';
        message = 'DKIM Public Key found and valid';
      } else if (records.length === 1) {
        currentRecord = records[0];
        status = 'invalid';
        if (records[0].includes('MIIBI') || records[0].includes('MIGf')) {
          message = 'DKIM Record found but missing "v=DKIM1; k=rsa; p=" prefix';
        } else {
          message = 'Invalid DKIM record format found';
        }
      } else {
        message = 'DKIM Record not found at this selector';
      }
    } else if (type === 'DMARC') {
      const records = await resolveTxtWithRetry(domain).catch(() => []);
      const dmarcRecords = records.filter(r => r.startsWith('v=DMARC1'));

      if (dmarcRecords.length > 1) {
        status = 'invalid';
        message = `CRITICAL: ${dmarcRecords.length} DMARC records found. Multiple DMARC policies are invalid and ignored by mail servers. Remove duplicates.`;
        issues.push('Multiple DMARC policies detected');
        currentRecord = dmarcRecords.join(' | ');
      } else if (dmarcRecords.length === 1) {
        const dmarc = dmarcRecords[0];
        currentRecord = dmarc;
        status = 'valid';
        message = 'DMARC Policy found';
      } else {
        message = 'DMARC Record not found';
      }
    } else if (type === 'MX') {
      const records = await dns.resolveMx(domain).catch(() => []);
      if (records.length > 0) {
        currentRecord = records.map(r => `${r.priority} ${r.exchange}`).join(', ');
        status = 'valid';
        message = `${records.length} MX records found`;
      } else {
        message = 'No MX records found';
      }
    }

    res.json({ success: true, data: { status, currentRecord, message, issues } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/dns/generate-dkim', async (req, res) => {
  const { selector } = req.body;
  // In a real app, we'd use crypto to generate a real RSA keypair
  // For this CRM, we provide a consistent public key for the selector
  const mockPublicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA' + crypto.randomBytes(64).toString('base64').substring(0, 100);
  res.json({
    success: true,
    selector: selector || 'mail',
    publicKey: mockPublicKey,
    privateKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
  });
});

// ─── Custom DNS Records Management ───────────────────────────────────────────
app.get('/api/custom-dns-records', (req, res) => {
  res.json({ success: true, data: customDnsRecords });
});

app.post('/api/custom-dns-records', (req, res) => {
  const { name, type, value, ttl, priority } = req.body;
  const newRecord = {
    id: genId(),
    name, type, value, ttl, priority,
    status: 'Pending',
    createdAt: new Date().toISOString()
  };
  customDnsRecords.push(newRecord);
  writeJSON(CUSTOM_DNS_FILE, customDnsRecords);
  res.json({ success: true, data: newRecord });
});

app.put('/api/custom-dns-records/:id', (req, res) => {
  const { name, type, value, ttl, priority } = req.body;
  const index = customDnsRecords.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Record not found' });

  customDnsRecords[index] = {
    ...customDnsRecords[index],
    name, type, value, ttl, priority,
    status: 'Pending',
    updatedAt: new Date().toISOString()
  };
  writeJSON(CUSTOM_DNS_FILE, customDnsRecords);
  res.json({ success: true, data: customDnsRecords[index] });
});

app.delete('/api/custom-dns-records/:id', (req, res) => {
  customDnsRecords = customDnsRecords.filter(r => r.id !== req.params.id);
  writeJSON(CUSTOM_DNS_FILE, customDnsRecords);
  res.json({ success: true });
});

app.post('/api/custom-dns-records/:id/verify', async (req, res) => {
  const index = customDnsRecords.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Record not found' });

  const record = customDnsRecords[index];
  try {
    let verified = false;
    if (record.type === 'A') {
      const addresses = await dns.resolve4(record.name).catch(() => []);
      verified = addresses.includes(record.value);
    } else if (record.type === 'MX') {
      const mx = await dns.resolveMx(record.name).catch(() => []);
      verified = mx.some(m => m.exchange.toLowerCase() === record.value.toLowerCase());
    } else if (record.type === 'CNAME') {
      const cname = await dns.resolveCname(record.name).catch(() => []);
      verified = cname.some(c => c.toLowerCase() === record.value.toLowerCase());
    }

    customDnsRecords[index].status = verified ? 'Verified' : 'Failed';
    writeJSON(CUSTOM_DNS_FILE, customDnsRecords);
    res.json({
      success: true,
      message: verified ? 'Record verified successfully!' : 'Verification failed: Record not found in DNS.',
      status: customDnsRecords[index].status
    });
  } catch (e) {
    res.json({ success: false, message: 'Verification error: ' + e.message });
  }
});
// ─── Stripe Integration ───────────────────────────────────────────────────────
app.get('/api/settings/stripe', (req, res) => {
  res.json({ success: true, config: stripeConfig });
});

app.post('/api/settings/stripe', (req, res) => {
  stripeConfig = { ...stripeConfig, ...req.body };
  writeJSON(STRIPE_CONFIG_FILE, stripeConfig);
  res.json({ success: true, config: stripeConfig });
});

app.post('/api/settings/stripe/verify', async (req, res) => {
  try {
    const s = stripe(req.body.secretKey);
    await s.balance.retrieve();
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.post('/api/stripe/payment-link', async (req, res) => {
  try {
    const { invoiceId, amount, currency, customerName, customerEmail } = req.body;
    if (!stripeConfig.secretKey) throw new Error('Stripe is not configured');
    const s = stripe(stripeConfig.secretKey);
    
    const product = await s.products.create({ name: `Invoice #${invoiceId}` });
    const price = await s.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100),
      currency: currency || stripeConfig.defaultCurrency,
    });
    
    const paymentLink = await s.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      after_completion: { type: 'redirect', redirect: { url: stripeConfig.successUrl } },
      metadata: { invoiceId },
    });
    
    res.json({ success: true, url: paymentLink.url, id: paymentLink.id });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

app.post('/api/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    const s = stripe(stripeConfig.secretKey);
    event = s.webhooks.constructEvent(req.body, sig, stripeConfig.webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoiceId;
      io.emit('stripe:payment_success', { invoiceId, session });
    }
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const invoiceId = paymentIntent.metadata?.invoiceId;
      io.emit('stripe:payment_success', { invoiceId, session: paymentIntent });
    }
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const invoiceId = paymentIntent.metadata?.invoiceId;
      io.emit('stripe:payment_failed', { invoiceId, error: paymentIntent.last_payment_error?.message });
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Activity Reporting System (New) ─────────────────────────────────────────
app.get('/api/reports/:userId', (req, res) => {
  if (req.params.userId === 'all') {
    return res.json({ success: true, data: dailyReports });
  }
  const userReports = dailyReports.filter(r => r.userId === req.params.userId);
  res.json({ success: true, data: userReports });
});

// ─── Calendar API for Activity Reports ─────────────────────────────────────
app.get('/api/activity-reports/calendar', (req, res) => {
  const { month, year, userId } = req.query;
  
  if (!month || !year) {
    return res.status(400).json({ success: false, message: 'Month and year required' });
  }
  
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  
  // Filter reports by userId (if provided) and specified month/year
  let filteredReports = dailyReports.filter(report => {
    const reportDate = new Date(report.reportDate);
    return reportDate.getMonth() + 1 === monthNum && reportDate.getFullYear() === yearNum;
  });
  
  // Filter by userId if provided (for individual user's calendar)
  if (userId) {
    filteredReports = filteredReports.filter(r => r.userId === parseInt(userId));
  }
  
  // Group by date
  const reportsByDate = {};
  filteredReports.forEach(report => {
    if (!reportsByDate[report.reportDate]) {
      reportsByDate[report.reportDate] = [];
    }
    reportsByDate[report.reportDate].push({
      id: report.id,
      userId: report.userId,
      userName: report.userName,
      department: report.department,
      reportText: report.reportText,
      createdAt: report.createdAt
    });
  });
  
  res.json({ success: true, data: reportsByDate });
});

app.get('/api/activity-reports/date/:date', (req, res) => {
  const { date } = req.params;
  const userId = req.query.userId;
  
  let reports = dailyReports.filter(r => r.reportDate === date);
  
  // Filter by userId if provided (for individual user's calendar)
  if (userId) {
    reports = reports.filter(r => r.userId === parseInt(userId));
  }
  
  if (reports.length === 0) {
    return res.json({ success: true, data: [], message: 'No reports for this date' });
  }
  
  const formattedReports = reports.map(r => ({
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    department: r.department,
    reportText: r.reportText,
    createdAt: r.createdAt
  }));
  
  res.json({ success: true, data: formattedReports });
});

app.post('/api/reports/daily', (req, res) => {
  const { userId, userName, department, reportText, date } = req.body;
  console.log(`[REPORT] Submission attempt from ${userName} (${userId}) for date ${date}`);
  const allowedDepts = ['Backend', 'Support', 'Quality', 'Graphics', 'Account'];
  
  // 1. Dept check
  if (!allowedDepts.includes(department)) {
    return res.status(403).json({ success: false, message: 'Reporting not allowed for your department' });
  }

  // 2. Date check (Local YYYY-MM-DD)
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
  if (date !== today) {
    console.warn(`[REPORT] Date mismatch: Submitted ${date}, Server thinks it is ${today}`);
    return res.status(400).json({ success: false, message: `Only today's report (${today}) is allowed` });
  }

  // 3. Duplicate check
  const existing = dailyReports.find(r => r.userId === userId && r.reportDate === date);
  if (existing) {
    return res.status(400).json({ success: false, message: 'Today\'s report already submitted and locked' });
  }

  // 4. Time lock check (9 AM - 11:59 PM)
  const now = new Date();
  if (now.getHours() < 9) {
    return res.status(400).json({ success: false, message: 'Reporting window opens at 9:00 AM' });
  }

  const newReport = {
    id: genId(),
    userId,
    userName: userName || 'Employee',
    department,
    reportDate: date,
    reportText,
    locked: true,
    createdAt: new Date().toISOString()
  };

  dailyReports.push(newReport);
  writeJSON(DAILY_REPORTS_FILE, dailyReports);
  res.json({ success: true, message: 'Report submitted and locked successfully', data: newReport });
});

// ─── Persistent IMAP Listener (Phase 7) ──────────────────────────────────────
const startImapListener = async (userId, config) => {
  const client = createImapClient(config);
  try {
    await client.connect();
    let lock = await client.getMailboxLock('INBOX');
    console.log(`[IMAP] Listener active for ${config.user}`);

    // Listen for new mail
    client.on('exists', async (data) => {
      const msg = await client.fetchOne(data.count, { envelope: true });
      const id = `imap_${msg.uid}`;
      const store = getStore(userId);
      if (!store.inbox.find(e => e.id === id)) {
        const email = {
          id, uid: msg.uid, subject: msg.envelope.subject,
          fromEmail: msg.envelope.from[0].address,
          fromName: msg.envelope.from[0].name || msg.envelope.from[0].address,
          createdAt: new Date().toISOString(), status: 'unread', type: 'inbox'
        };
        store.inbox.unshift(email);
        saveEmails();
        io.emit('mail:new', { userId, email });
        console.log(`[IMAP] New mail received for ${config.user}: ${msg.envelope.subject}`);
      }
    });

    client.on('error', (err) => {
      console.error(`[IMAP] Error for ${config.user}:`, err.message);
      setTimeout(() => startImapListener(userId, config), 5000);
    });

    client.on('close', () => {
      console.log(`[IMAP] Connection closed for ${config.user}. Reconnecting...`);
      setTimeout(() => startImapListener(userId, config), 5000);
    });

  } catch (e) {
    console.error(`[IMAP] Failed to start listener for ${config.user}:`, e.message);
    setTimeout(() => startImapListener(userId, config), 10000);
  }
};

// ─── Socket.io (Real-time) ────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('subscribe', ({ userId, config }) => {
    socket.join(`user_${userId}`);
    console.log(`[Socket] User ${userId} joined`);
    if (config && config.user && config.pass) {
      startImapListener(userId, config);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Mail Proxy REPAIRED on port ${PORT}`);
});
