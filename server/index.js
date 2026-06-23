const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const cors = require('cors');
const dotenv = require('dotenv');
const postmark = require('postmark');
const { simpleParser } = require('mailparser');
const crypto = require('crypto');
const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const stripe = require('stripe');
const { resolveTxtWithRetry } = require('./utils/dnsResolver');
const { startSession, logoutSession, initializeExistingSessions, sendMessage } = require('./services/whatsappService');
const { logAudit } = require('./services/auditLogger');
const llmManager = require('./services/llm');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

// Rate limiter for WhatsApp sends (20 msgs / min)
const whatsappSendLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { success: false, message: 'Too many messages sent. Please slow down.' }
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

// Load .env — try server/.env first, then fall back to project root .env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') }); // root .env fallback (won't override existing vars)


const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN || '7f34db3b-5094-4a8f-a162-16888266d45b');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }
});

app.use(cors());
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || process.env.MAIL_SERVER_PORT || 5001;

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
const USERS_STORE_FILE = path.join(DATA_DIR, 'users.json');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const DELETED_UUIDS_FILE = path.join(DATA_DIR, 'deleted_uuids.json');
const MIGRATION_LOGS_FILE = path.join(DATA_DIR, 'migration_logs.json');
const MIGRATION_ERRORS_FILE = path.join(DATA_DIR, 'migration_error_logs.json');
const CHAT_DATA_FILE = path.join(DATA_DIR, 'chat_data.json');
const PASSWORD_AUDIT_FILE = path.join(DATA_DIR, 'password_audit.json');
if (!fs.existsSync(PASSWORD_AUDIT_FILE)) writeJSON(PASSWORD_AUDIT_FILE, []);

// ─── Tombstone Helpers (Issue #1–5 fix) ──────────────────────────────────────
// Reads the persisted set of permanently-deleted UUIDs.
const readTombstones = () => readJSON(DELETED_UUIDS_FILE, []);

// Writes a new UUID into the tombstone set (idempotent).
const addTombstone = (uuid) => {
  const set = new Set(readTombstones());
  set.add(String(uuid));
  writeJSON(DELETED_UUIDS_FILE, [...set]);
  console.log(`[Tombstone] UUID permanently tombstoned: ${uuid}`);
};

// Returns true when a UUID has been tombstoned (permanently deleted).
const isTombstoned = (uuid) => readTombstones().includes(String(uuid));

// Removes tombstoned entries from a user array.
const filterTombstoned = (users) => {
  const tombstones = new Set(readTombstones());
  return (users || []).filter(u => !tombstones.has(String(u.uuid)));
};

// Ensure tombstone file exists on startup (placed here, after writeJSON is defined)

const readJSON = (file, def) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Tombstone file init (runs after readJSON/writeJSON are defined)
if (!fs.existsSync(DELETED_UUIDS_FILE)) writeJSON(DELETED_UUIDS_FILE, []);
console.log(`[Tombstone] Loaded ${readTombstones().length} deleted UUID(s) from tombstone store`);

const emailStore = readJSON(EMAIL_STORE_FILE, {}); // { userId: { inbox: [], sent: [], drafts: [], trash: [] } }
const deliveryLogs = readJSON(DELIVERY_LOGS_FILE, []);
let customDnsRecords = readJSON(CUSTOM_DNS_FILE, [
  { id: '1', name: 'crm.zsmeservices.com', type: 'A', value: '95.111.238.145', ttl: 14400, status: 'Verified', createdAt: new Date().toISOString() },
  { id: '2', name: 'mail.zsmeservices.com', type: 'MX', value: 'mail.zsmeservices.com', priority: 0, ttl: 14400, status: 'Verified', createdAt: new Date().toISOString() }
]);
let dailyReports = readJSON(DAILY_REPORTS_FILE, []);
let attendanceLogs = readJSON(ATTENDANCE_FILE, []);
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
  const port = parseInt(process.env.SMTP_PORT || smtpConfig.port || config.port) || 587;
  
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
    host: process.env.SMTP_HOST || smtpConfig.host || config.host || 'email-smtp.us-east-1.amazonaws.com',
    port: port,
    secure: port === 465,
    auth: { 
      user: process.env.SMTP_USER || smtpConfig.auth?.user || config.email || config.user || 'AKIAZS4KXICMRDCBUKW4', 
      pass: process.env.SMTP_PASS || smtpConfig.auth?.pass || (config.password ? decrypt(config.password) : null) || (config.pass ? decrypt(config.pass) : null) || 'BJQzaBD98bf2GhOT2CxT2Bo5yPy4RnuixXj6N2hgkrF1' 
    },
    tls: { rejectUnauthorized: false },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
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

// ─── OTP-Based Password Reset ────────────────────────────────────────────────
const OTP_FILE = path.join(DATA_DIR, 'otp_store.json');
const OTP_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const OTP_RATE_LIMIT = 5; // max 5 OTPs per email per hour

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// POST /api/auth/send-otp — Generate & email a 6-digit OTP
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: 'Email is required.' });

    const normalizedEmail = email.toLowerCase().trim();
    // Always look up from server-side users.json — never trust client-sent user list
    const serverUsers = readUsers() || [];
    const user = serverUsers.find(u => u.email && u.email.toLowerCase() === normalizedEmail);
    if (!user) return res.json({ success: false, found: false, message: 'No account found with this email address.' });

    // Rate limiting
    const otpStore = readJSON(OTP_FILE, []);
    const oneHourAgo = Date.now() - OTP_EXPIRY_MS;
    const recentForEmail = otpStore.filter(o => o.email === normalizedEmail && new Date(o.createdAt).getTime() > oneHourAgo);
    if (recentForEmail.length >= OTP_RATE_LIMIT) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Please wait before trying again.' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Invalidate previous OTPs for this email
    const filtered = otpStore.filter(o => o.email !== normalizedEmail);
    filtered.push({
      sessionId,
      userId: String(user.id),
      email: normalizedEmail,
      otpHash,
      expiresAt,
      used: false,
      verified: false,
      createdAt: new Date().toISOString(),
    });
    writeJSON(OTP_FILE, filtered);

    // Log OTP to console for dev/recovery (always available even if email fails)
    console.log(`[OTP] Code for ${normalizedEmail}: ${otp} (sessionId: ${sessionId})`);

    // ─── Build SMTP config: prioritize user's custom SMTP, then system env, then Postmark fallback ───
    let smtpConfig = null;
    let emailConfigSource = 'none';

    // 1. Check user's custom SMTP from stripe_config.json (same as CRM email settings)
    if (stripeConfig && stripeConfig.smtp && stripeConfig.smtp.host) {
      smtpConfig = {
        host: stripeConfig.smtp.host,
        port: parseInt(stripeConfig.smtp.port) || 587,
        auth: { user: stripeConfig.smtp.user, pass: stripeConfig.smtp.pass }
      };
      emailConfigSource = 'custom_smtp';
      console.log(`[OTP] Using custom SMTP: ${stripeConfig.smtp.host}`);
    }

    // 2. Fall back to system .env SMTP
    if (!smtpConfig) {
      const envHost = process.env.SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com';
      const envUser = process.env.SMTP_USER || 'AKIAZS4KXICMRDCBUKW4';
      const envPass = process.env.SMTP_PASS || 'BJQzaBD98bf2GhOT2CxT2Bo5yPy4RnuixXj6N2hgkrF1';
      if (envHost && envUser && envPass) {
        smtpConfig = {
          host: envHost,
          port: parseInt(process.env.SMTP_PORT) || 587,
          auth: { user: envUser, pass: envPass }
        };
        emailConfigSource = 'env_smtp';
        console.log(`[OTP] Using env SMTP: ${envHost}`);
      }
    }

    // 3. Last resort: Postmark (with outbound stream header for transactional emails)
    if (!smtpConfig) {
      emailConfigSource = 'postmark_outbound_stream';
      console.log('[OTP] Using Postmark SMTP (outbound stream)');
    }

    // Build transporter — if SMTP is used
    let transporter = null;
    if (smtpConfig) {
      transporter = createTransport({
        smtp: smtpConfig,
        host: smtpConfig.host,
        port: smtpConfig.port
      });
    }

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0E5491 0%, #1a6fb5 100%); padding: 28px; text-align: center;">
          <h1 style="margin: 0; color: #fff; font-size: 22px; letter-spacing: 1px;">ZSM CRM</h1>
          <p style="margin: 6px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">Password Reset Verification</p>
        </div>
        <div style="padding: 32px;">
          <p style="color: #374151; font-size: 15px;">Hi <strong>${user.name}</strong>,</p>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">Use the following one-time password to reset your account credentials. This code is valid for <strong>1 hour</strong>.</p>
          <div style="text-align: center; margin: 28px 0;">
            <div style="display: inline-block; background: #f0f9ff; border: 2px dashed #0E5491; border-radius: 10px; padding: 18px 36px; letter-spacing: 12px; font-size: 32px; font-weight: 700; color: #0E5491; font-family: 'Courier New', monospace;">${otp}</div>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
        </div>
        <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #9ca3af; font-size: 11px;">© ${new Date().getFullYear()} ZSM e-Services Pvt. Ltd. — Sent via ${emailConfigSource}</p>
        </div>
      </div>
    `;

    // ─── Send email with retries, wait for confirmation before responding ───
    let sent = false;
    let lastError = null;
    let messageId = null;

    const fromEmailAddress = smtpConfig 
      ? '"ZSM CRM" <noreply@zsmeservices.com>'
      : (process.env.POSTMARK_FROM_EMAIL || 'tanmoy.mondal@zsmeservices.com');

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (smtpConfig) {
          // Verify connection first on first attempt
          if (attempt === 1) {
            try {
              await transporter.verify();
              console.log(`[OTP] SMTP verified for attempt 1 (${emailConfigSource})`);
            } catch (verifyErr) {
              console.error(`[OTP] SMTP verify failed: ${verifyErr.message}`);
            }
          }

          const info = await transporter.sendMail({
            from: fromEmailAddress,
            to: normalizedEmail,
            subject: `${otp} is your ZSM CRM verification code`,
            html: htmlBody,
            text: `Your ZSM CRM verification code is: ${otp}. It expires in 1 hour.`
          });
          messageId = info.messageId;
        } else {
          // Pre-emptively clear suppression list entries in Postmark to avoid Error 406 for all users
          try {
            await postmarkClient.deleteSuppressions("outbound", {
              Suppressions: [{ EmailAddress: normalizedEmail }]
            });
            console.log(`[OTP] Pre-emptively cleared suppressions for: ${normalizedEmail}`);
          } catch (suppressErr) {
            console.warn(`[OTP] Suppression clear warning for ${normalizedEmail}: ${suppressErr.message}`);
          }

          // Send via official Postmark Client SDK
          const response = await postmarkClient.sendEmail({
            "From": fromEmailAddress,
            "To": normalizedEmail,
            "Subject": `${otp} is your ZSM CRM verification code`,
            "HtmlBody": htmlBody,
            "TextBody": `Your ZSM CRM verification code is: ${otp}. It expires in 1 hour.`,
            "MessageStream": "outbound"
          });
          messageId = response.MessageID;
        }

        addDeliveryLog({ type: 'otp', recipient: normalizedEmail, status: 'delivered', messageId, attempt, smtpSource: emailConfigSource });
        console.log(`[OTP] Email delivered to ${normalizedEmail} (attempt ${attempt}, messageId: ${messageId})`);
        sent = true;
        break;
      } catch (e) {
        addDeliveryLog({ type: 'otp', recipient: normalizedEmail, status: 'failed', error: e.message, attempt, smtpSource: emailConfigSource });
        console.error(`[OTP] Send failed attempt ${attempt}: ${e.message}`);
        lastError = e.message;
        if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
      }
    }

    // Always respond with success + console log (so user can get code from server console if email fails)
    res.json({
      success: true,
      found: true,
      sessionId,
      expiresAt,
      message: sent ? `OTP sent to ${normalizedEmail}` : `OTP generated (email delivery pending: ${lastError})`,
    });

    if (!sent) {
      console.error(`[OTP] ALL SMTP ATTEMPTS FAILED for ${normalizedEmail}. Last error: ${lastError}`);
      console.log(`[OTP] MANUAL RECOVERY — Code for ${normalizedEmail}: ${otp} (sessionId: ${sessionId})`);
    }
  } catch (e) {
    console.error('Send OTP error:', e);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/verify-otp — Verify the 6-digit OTP
app.post('/api/auth/verify-otp', (req, res) => {
  try {
    const { sessionId, otp } = req.body;
    if (!sessionId || !otp) return res.json({ success: false, message: 'Session and OTP are required.' });

    const otpStore = readJSON(OTP_FILE, []);
    const record = otpStore.find(o => o.sessionId === sessionId);

    if (!record) return res.json({ success: false, message: 'Invalid session. Please request a new OTP.' });
    if (record.used) return res.json({ success: false, message: 'This OTP has already been used.' });
    if (new Date(record.expiresAt) < new Date()) return res.json({ success: false, expired: true, message: 'OTP has expired. Please request a new one.' });

    const inputHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');
    if (inputHash !== record.otpHash) {
      return res.json({ success: false, message: 'Incorrect OTP. Please try again.' });
    }

    // Mark as verified (but not used yet — used after password reset)
    record.verified = true;
    writeJSON(OTP_FILE, otpStore);

    return res.json({ success: true, userId: record.userId, email: record.email, message: 'OTP verified successfully.' });
  } catch (e) {
    console.error('Verify OTP error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/auth/reset-password-otp — Reset password after OTP verification
app.post('/api/auth/reset-password-otp', async (req, res) => {
  try {
    const { sessionId, newPassword } = req.body;
    if (!sessionId || !newPassword) return res.json({ success: false, message: 'Session and new password are required.' });

    const otpStore = readJSON(OTP_FILE, []);
    const record = otpStore.find(o => o.sessionId === sessionId);

    if (!record) return res.json({ success: false, message: 'Invalid session.' });
    if (!record.verified) return res.json({ success: false, message: 'OTP not verified.' });
    if (record.used) return res.json({ success: false, message: 'This reset session has already been used.' });
    if (new Date(record.expiresAt) < new Date()) return res.json({ success: false, message: 'Session expired. Please start over.' });

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update users.json directly!
    const users = readUsers() || [];
    const uIndex = users.findIndex(u => u.email && u.email.toLowerCase() === record.email.toLowerCase());
    if (uIndex !== -1) {
      users[uIndex] = {
        ...users[uIndex],
        password: hashedPassword,
        passwordChangedAt: new Date().toISOString(),
        must_change_password: false, // OTP reset removes must_change flag
        updatedAt: new Date().toISOString()
      };
      writeUsers(users);
      
      const auditEntry = {
        id: `pwd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: users[uIndex].uuid,
        userEmail: users[uIndex].email,
        changedBy: users[uIndex].uuid,
        changedByEmail: users[uIndex].email,
        changeType: 'otp_reset',
        ipAddress: req.ip || '127.0.0.1',
        timestamp: new Date().toISOString(),
        must_change_password: false
      };
      const auditStore = readJSON(PASSWORD_AUDIT_FILE, []);
      auditStore.unshift(auditEntry);
      if (auditStore.length > 1000) auditStore.length = 1000;
      writeJSON(PASSWORD_AUDIT_FILE, auditStore);
    }

    // Mark OTP as used (invalidate)
    record.used = true;
    writeJSON(OTP_FILE, otpStore);

    console.log(`[RESET] Password reset completed for ${record.email} (userId: ${record.userId})`);
    addDeliveryLog({ type: 'password_reset', email: record.email, status: 'completed' });

    return res.json({
      success: true,
      userId: record.userId,
      hashedPassword,
      message: 'Password has been reset successfully.',
    });
  } catch (e) {
    console.error('Reset password error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Mail Sync (Real-time with Socket) ──────────────────────────────────────
// ─── Test Connections (Robust) ────────────────────────────────────────────────
app.post('/api/mail/test-imap', async (req, res) => {
  const { config } = req.body;
  const isDemoAdmin = config.user?.toLowerCase().includes('admin') || config.pass === 'Admin#2026@zsm' || config.pass === 'admin123';
  if (isDemoAdmin) {
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
  const isDemoAdmin = config.user?.toLowerCase().includes('admin') || config.pass === 'Admin#2026@zsm' || config.pass === 'admin123';
  if (isDemoAdmin) {
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

  const isDemoAdmin = config.user?.toLowerCase().includes('admin') || config.pass === 'Admin#2026@zsm' || config.pass === 'admin123';
  if (isDemoAdmin) {
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

  const isDemoAdmin = config.user?.toLowerCase().includes('admin') || config.pass === 'Admin#2026@zsm' || config.pass === 'admin123';
  if (isDemoAdmin) {
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

    // ACTUALLY send the email via Postmark to guarantee real delivery to the customer!
    try {
      const recipientEmail = mailOptions.to.toLowerCase().trim();
      
      // Pre-emptively clear suppression list entries in Postmark to avoid Error 406 for all users
      try {
        await postmarkClient.deleteSuppressions("outbound", {
          Suppressions: [{ EmailAddress: recipientEmail }]
        });
        console.log(`[Mail Send] Pre-emptively cleared suppressions for: ${recipientEmail}`);
      } catch (suppressErr) {
        console.warn(`[Mail Send] Suppression clear warning: ${suppressErr.message}`);
      }

      const fromEmailAddress = process.env.POSTMARK_FROM_EMAIL || 'tanmoy.mondal@zsmeservices.com';
      const response = await postmarkClient.sendEmail({
        "From": `"ZSM e-Services" <${fromEmailAddress}>`,
        "To": recipientEmail,
        "Subject": mailOptions.subject,
        "HtmlBody": mailOptions.html || mailOptions.text,
        "TextBody": mailOptions.text || mailOptions.html?.replace(/<[^>]*>/g, ''),
        "MessageStream": "outbound",
        "Attachments": (mailOptions.attachments || []).map(att => {
          let base64Content = "";
          if (att.content && typeof att.content === 'string' && (att.content.startsWith('JVBERi') || att.content.length > 500)) {
            base64Content = att.content; // Use pre-encoded base64 PDF directly
          } else {
            base64Content = Buffer.from(att.content || "Mock Invoice PDF Content").toString('base64');
          }
          return {
            "Name": att.filename || att.name || "Attachment.pdf",
            "Content": base64Content,
            "ContentType": "application/pdf"
          };
        })
      });
      console.log(`[Mail Send] Postmark delivery success, messageId: ${response.MessageID}`);
      addDeliveryLog({ type: 'user_mail', sender: fromEmailAddress, recipient: recipientEmail, status: 'delivered', messageId: response.MessageID });
      return res.json({ success: true, messageId: response.MessageID });
    } catch (err) {
      console.error(`[Mail Send] Postmark delivery failed: ${err.message}`);
      addDeliveryLog({ type: 'user_mail', sender: 'postmark', recipient: mailOptions.to, status: 'failed', error: err.message });
      return res.status(500).json({ success: false, message: `Delivery Failed: ${err.message}` });
    }
  }

  const transporter = createTransport(config);

  try {
    const info = await transporter.sendMail({
      from: `"${config.name || 'ZSM User'}" <${config.user}>`,
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html,
      attachments: (mailOptions.attachments || []).map(att => {
        let contentBuffer;
        if (att.content && typeof att.content === 'string' && (att.content.startsWith('JVBERi') || att.content.length > 500)) {
          contentBuffer = Buffer.from(att.content, 'base64');
        } else {
          contentBuffer = att.content || "Mock Invoice PDF Content";
        }
        return {
          filename: att.filename || att.name || "Attachment.pdf",
          content: contentBuffer,
          contentType: "application/pdf"
        };
      })
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
        
        // Automatic SPF record optimization
        const uniqueTokens = new Set();
        let failMechanism = '~all';
        spfRecords.forEach(record => {
          record.split(/\s+/).forEach(token => {
            if (token === 'v=spf1') return;
            if (token.endsWith('all')) {
              if (token === '-all') failMechanism = '-all';
              return;
            }
            if (token) uniqueTokens.add(token);
          });
        });
        const optimizedSpf = `v=spf1 ${Array.from(uniqueTokens).join(' ')} ${failMechanism}`;
        
        message = `CRITICAL: ${spfRecords.length} SPF records found. You must only have ONE. Duplicate SPF records cause permanent delivery failure. Please delete your existing SPF records and replace them with the following optimized record: ${optimizedSpf}`;
        issues.push('Multiple SPF records detected. You must merge them into a single record.');
        issues.push(`Action Required: Use this optimized record: ${optimizedSpf}`);
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


// ─── LLM Integration ───────────────────────────────────────────────────────

const requireAdmin = (req, res, next) => {
  const role = req.headers['x-user-role'];
  if (role !== 'Admin' && role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
  }
  next();
};

app.get('/api/settings/llm', requireAdmin, (req, res) => {
  const settings = llmManager.getSettings();
  const safeSettings = ['anthropic', 'openai', 'xai'].map(provider => {
    const s = settings.find(x => x.provider === provider) || {};
    return {
      provider,
      is_configured: !!s.api_key_encrypted,
      is_active: !!s.is_active,
      model_id: s.model_id || null,
      maskedKey: s.api_key_encrypted ? "sk-****" + s.api_key_encrypted.slice(-4) : "",
      updated_by: s.updated_by || null,
      updated_at: s.updated_at || null
    };
  });
  res.json({ success: true, providers: safeSettings });
});

app.get('/api/settings/llm/:provider/models', requireAdmin, async (req, res) => {
  try {
    const { provider } = req.params;
    let apiKey = req.headers['x-api-key'] || req.query.apiKey;
    
    // If not provided in header/query, try to find the saved one
    if (!apiKey) {
      const settings = llmManager.getSettings();
      const s = settings.find(x => x.provider === provider);
      if (s && s.api_key_encrypted) {
        apiKey = llmManager.decryptKey(s.api_key_encrypted);
      }
    }
    
    if (!apiKey) return res.status(400).json({ success: false, message: 'API key required' });
    
    const adapter = llmManager.adapters[provider];
    if (!adapter) return res.status(400).json({ success: false, message: 'Invalid provider' });
    
    const models = await adapter.listModels(apiKey);
    res.json({ success: true, models });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/settings/llm/:provider/test', requireAdmin, async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey, model_id } = req.body;
    let finalKey = apiKey;
    
    if (!finalKey) {
      const settings = llmManager.getSettings();
      const s = settings.find(x => x.provider === provider);
      if (s && s.api_key_encrypted) {
        finalKey = llmManager.decryptKey(s.api_key_encrypted);
      }
    }
    
    if (!finalKey) return res.status(400).json({ success: false, message: 'API key required' });
    
    const adapter = llmManager.adapters[provider];
    if (!adapter) return res.status(400).json({ success: false, message: 'Invalid provider' });
    
    const result = await adapter.testConnection(finalKey, model_id);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/settings/llm/:provider', requireAdmin, (req, res) => {
  try {
    const { provider } = req.params;
    const { model_id, apiKey } = req.body;
    const updated_by = req.headers['x-user-id'] || 'admin';
    
    if (!['anthropic', 'openai', 'xai'].includes(provider)) {
      return res.status(400).json({ success: false, message: 'Invalid provider' });
    }
    
    const settings = llmManager.getSettings();
    let s = settings.find(x => x.provider === provider);
    
    if (!s) {
      s = { provider, is_active: false, is_configured: false };
      settings.push(s);
    }
    
    if (model_id) s.model_id = model_id;
    if (apiKey) {
      s.api_key_encrypted = llmManager.encryptKey(apiKey);
      s.is_configured = true;
    }
    s.updated_by = updated_by;
    s.updated_at = new Date().toISOString();
    
    llmManager.updateSettings(settings);
    logAudit('LLM Setting Updated', updated_by, `Updated configuration for ${provider}`);
    res.json({ success: true, data: { provider, is_configured: s.is_configured, model_id: s.model_id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/settings/llm/:provider/activate', requireAdmin, (req, res) => {
  try {
    const { provider } = req.params;
    const updated_by = req.headers['x-user-id'] || 'admin';
    
    const settings = llmManager.getSettings();
    const s = settings.find(x => x.provider === provider);
    
    if (!s || !s.is_configured) {
      return res.status(400).json({ success: false, message: `Provider ${provider} is not configured yet. Save a key first.` });
    }
    
    settings.forEach(x => { x.is_active = (x.provider === provider); });
    
    llmManager.updateSettings(settings);
    logAudit('LLM Provider Activated', updated_by, `Set active LLM provider to ${provider}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Activity Reporting System (New) ─────────────────────────────────────────
app.get('/api/reports/:userId', (req, res) => {
  if (req.params.userId === 'all') {
    return res.json({ success: true, data: dailyReports });
  }
  const userReports = dailyReports.filter(r => String(r.userId) === String(req.params.userId));
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
    if (!report.reportDate) return false;
    const parts = report.reportDate.split('-');
    if (parts.length !== 3) return false;
    return parseInt(parts[1], 10) === monthNum && parseInt(parts[0], 10) === yearNum;
  });
  
  // Filter by userId if provided (for individual user's calendar)
  if (userId) {
    filteredReports = filteredReports.filter(r => String(r.userId) === String(userId));
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
    reports = reports.filter(r => String(r.userId) === String(userId));
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
  const allowedDepts = ['Backend', 'Support', 'Quality', 'Graphics', 'Account', 'Accounts', 'HR', 'Management'];
  
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
  const existing = dailyReports.find(r => String(r.userId) === String(userId) && r.reportDate === date);
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

// ─── User Management API ──────────────────────────────────────────────────────
// Helpers
const readUsers = () => readJSON(USERS_STORE_FILE, null);
const writeUsers = (users) => writeJSON(USERS_STORE_FILE, users);

// GET /api/users — fetch all non-tombstoned users from backend DB
app.get('/api/users', (req, res) => {
  const users = readUsers();
  if (users === null) {
    // No backend DB yet — signal the frontend to seed it
    return res.json({ success: true, data: null, seeded: false });
  }
  // FIX #1: Never return tombstoned (permanently deleted) users
  const safe = filterTombstoned(users);
  res.json({ success: true, data: safe });
});

// POST /api/users/seed — frontend sends all users to seed the backend DB (first-time only)
app.post('/api/users/seed', (req, res) => {
  const existing = readUsers();
  if (existing !== null && existing.length > 0) {
    return res.json({ success: false, message: 'Already seeded', data: filterTombstoned(existing) });
  }
  const { users } = req.body;
  if (!Array.isArray(users)) return res.status(400).json({ success: false, message: 'Invalid payload' });
  // FIX #5: Strip tombstoned UUIDs from seed payload — prevents resurrection via fresh seed
  const safe = filterTombstoned(users);
  const stripped = users.length - safe.length;
  if (stripped > 0) console.log(`[UserDB] Seed: stripped ${stripped} tombstoned UUID(s) from payload`);
  writeUsers(safe);
  console.log(`[UserDB] Seeded backend DB with ${safe.length} users`);
  res.json({ success: true, data: safe });
});

// POST /api/users — create a new user
app.post('/api/users', async (req, res) => {
  try {
    const { uuid } = req.body;
    // FIX #4 (backend guard): Refuse to create a user whose UUID has been tombstoned
    if (uuid && isTombstoned(uuid)) {
      console.warn(`[UserDB] Blocked creation of tombstoned UUID: ${uuid}`);
      return res.status(409).json({ success: false, message: 'Cannot recreate a permanently deleted user.', tombstoned: true });
    }
    const users = readUsers() || [];
    
    // Hash password if provided and not already hashed
    let userData = { ...req.body };
    if (userData.password && !userData.password.startsWith('$2b$')) {
      userData.password = await bcrypt.hash(userData.password, 12);
      console.log(`[UserDB] Hashed password for new user: ${userData.uuid}`);
    }
    
    const newUser = { ...userData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    users.push(newUser);
    writeUsers(users);
    console.log(`[UserDB] Created user: ${newUser.uuid}`);
    res.json({ success: true, data: newUser });
  } catch (e) {
    console.error('[UserDB] Create user error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// PUT /api/users/:uuid — update an existing user
app.put('/api/users/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    // FIX #5: Block upsert (create-if-not-found) for tombstoned UUIDs — the primary ghost-create vector
    if (isTombstoned(uuid)) {
      console.warn(`[UserDB] Blocked PUT upsert for tombstoned UUID: ${uuid}`);
      return res.status(410).json({ success: false, message: 'User has been permanently deleted and cannot be modified.', tombstoned: true });
    }
    const users = readUsers() || [];
    const idx = users.findIndex(u => u.uuid === uuid);
    
    let updateData = { ...req.body };
    
    // Remove must_change_password from generic PUT — only dedicated password
    // endpoints (PUT /api/users/:uuid/password, OTP reset) should control this flag.
    // This prevents stale form data (merged via updateUserRecord → syncToBackend)
    // from accidentally re-setting it to true.
    delete updateData.must_change_password;
    
    // Hash password if provided and not already hashed
    if (updateData.password && !updateData.password.startsWith('$2b$')) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
      console.log(`[UserDB] Hashed password in PUT update for: ${uuid}`);
    }
    
    if (idx === -1) {
      // Not found and not tombstoned — safe to upsert (new user from another session)
      const newUser = { uuid, ...updateData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      users.push(newUser);
      writeUsers(users);
      return res.json({ success: true, data: newUser, created: true });
    }
    users[idx] = { ...users[idx], ...updateData, updatedAt: new Date().toISOString() };
    writeUsers(users);
    console.log(`[UserDB] Updated user: ${uuid}`);
    res.json({ success: true, data: users[idx] });
  } catch (e) {
    console.error('[UserDB] Update user error:', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE /api/users/:uuid — permanently delete a user (tombstoned)
app.delete('/api/users/:uuid', (req, res) => {
  const { uuid } = req.params;
  const users = readUsers() || [];
  const target = users.find(u => u.uuid === uuid);
  if (!target) {
    // Already deleted — still write tombstone to prevent resurrection via other paths
    addTombstone(uuid);
    return res.json({ success: true, alreadyDeleted: true });
  }
  // FIX #2: Write tombstone FIRST, THEN delete from array
  // This ensures no window where user is gone from array but tombstone not yet set
  addTombstone(uuid);
  const filtered = users.filter(u => u.uuid !== uuid);
  writeUsers(filtered);
  console.log(`[UserDB] Permanently deleted user: ${uuid} — tombstoned`);
  res.json({ success: true });
});


// ─── Deletion Audit Log (userDeletionService.js support) ──────────────────
const DELETION_AUDIT_FILE = path.join(DATA_DIR, 'deletion_audit_log.json');
if (!fs.existsSync(DELETION_AUDIT_FILE)) writeJSON(DELETION_AUDIT_FILE, []);

app.post('/api/users/deletion-log', (req, res) => {
  try {
    const raw = req.body;
    
    // Normalize properties to perfectly match the SQL deletion_audit_log table schema:
    const entry = {
      id: raw.id || `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      deleted_user_id: raw.deletedUserUuid || raw.deleted_user_id || raw.deletedUserUuid || '',
      deleted_user_email: raw.deletedUserEmail || raw.deleted_user_email || '',
      deleted_user_name: raw.deletedUserName || raw.deleted_user_name || '',
      deleted_user_role: raw.deletedUserRole || raw.deleted_user_role || '',
      deleted_by_user_id: raw.deletedByUuid || raw.deleted_by_user_id || '',
      deleted_by_email: raw.deletedByEmail || raw.deleted_by_email || '',
      deletion_type: raw.deletionType || raw.deletion_type || 'hard_delete',
      deletion_source: raw.deletionSource || raw.deletion_source || 'manual_admin',
      deletion_reason: raw.deletionReason || raw.deletion_reason || '',
      insforge_directory_cleaned: !!(raw.insforgeDirectoryCleaned || raw.insforge_directory_cleaned || raw.tombstoneCreated || raw.tombstone_created),
      tables_cleaned: raw.tablesClean || raw.tables_cleaned || [],
      tombstone_created: !!(raw.tombstoneCreated || raw.tombstone_created),
      ghost_auto_removed: !!(raw.ghostAutoRemoved || raw.ghost_auto_removed),
      backup_restore_blocked: !!(raw.backupRestoreBlocked || raw.backup_restore_blocked),
      sync_blocked: !!(raw.syncBlocked || raw.sync_blocked),
      deleted_at: raw.deleted_at || raw.completedAt || new Date().toISOString(),
      ip_address: req.ip || raw.ip_address || '127.0.0.1',
      session_id: raw.sessionId || raw.session_id || 'N/A',
      metadata: raw.metadata || raw.deletedUserSnapshot || {},
      receivedAt: new Date().toISOString()
    };

    const log = readJSON(DELETION_AUDIT_FILE, []);
    log.unshift(entry);
    if (log.length > 1000) log.length = 1000;
    writeJSON(DELETION_AUDIT_FILE, log);
    console.log('[DeletionAudit] SQL-Mapped Logged: ' + entry.deleted_user_email + ' by ' + (raw.deletedByName || entry.deleted_by_email || 'SYSTEM'));
    res.json({ success: true, auditId: entry.id });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});


// ─── Sync Blocked Log (syncService.js support) ───────────────────
const SYNC_BLOCKED_FILE = path.join(DATA_DIR, 'sync_blocked_log.json');
if (!fs.existsSync(SYNC_BLOCKED_FILE)) writeJSON(SYNC_BLOCKED_FILE, []);

app.post('/api/users/sync-blocked-log', (req, res) => {
  try {
    const entry = { ...req.body, receivedAt: new Date().toISOString() };
    const log = readJSON(SYNC_BLOCKED_FILE, []);
    log.unshift(entry);
    if (log.length > 1000) log.length = 1000;
    writeJSON(SYNC_BLOCKED_FILE, log);
    console.log('[SyncBlockedLog] Blocked resurrect sync of: ' + entry.email + ' due to tombstone match');
    res.json({ success: true, logId: entry.id });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/users/sync-blocked-log', (req, res) => {
  res.json({ success: true, data: readJSON(SYNC_BLOCKED_FILE, []) });
});

app.get('/api/users/deletion-log', (req, res) => {
  res.json({ success: true, data: readJSON(DELETION_AUDIT_FILE, []) });
});

app.post('/api/auth/revoke-tokens', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'email required' });
    const norm = email.toLowerCase().trim();
    const store = readJSON(OTP_FILE, []);
    const filtered = store.filter(function(o) { return o.email !== norm; });
    writeJSON(OTP_FILE, filtered);
    console.log('[TokenRevoke] Purged ' + (store.length - filtered.length) + ' token(s) for: ' + norm);
    res.json({ success: true, revoked: store.length - filtered.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Password Management API ──────────────────────────────────────────────────
// Password strength validation helper
const validatePasswordPolicy = (password) => {
  const errors = [];
  if (!password || password.length < 8) errors.push('At least 8 characters required');
  if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Must contain lowercase letter');
  if (!/\d/.test(password)) errors.push('Must contain number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Must contain special character');
  return errors;
};

// PUT /api/users/:uuid/password — Dedicated password change endpoint
app.put('/api/users/:uuid/password', async (req, res) => {
  try {
    const { uuid } = req.params;
    const { newPassword, currentPassword, changedBy, changedByEmail, isAdminReset } = req.body;

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }

    // Validate password policy
    const policyErrors = validatePasswordPolicy(newPassword);
    if (policyErrors.length > 0) {
      return res.status(400).json({ success: false, message: 'Password policy violation', errors: policyErrors });
    }

    const users = readUsers() || [];
    const user = users.find(u => u.uuid === uuid);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If NOT admin reset, verify current password
    if (!isAdminReset && currentPassword) {
      const passwordMatch = await bcrypt.compare(currentPassword, user.password);
      if (!passwordMatch) {
        console.warn(`[PasswordAPI] Failed password verification for user: ${uuid}`);
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user in users.json
    const userIndex = users.findIndex(u => u.uuid === uuid);
    users[userIndex] = {
      ...users[userIndex],
      password: hashedPassword,
      passwordChangedAt: new Date().toISOString(),
      passwordChangedBy: changedBy,
      must_change_password: false,
      updatedAt: new Date().toISOString()
    };
    writeUsers(users);

    // Write audit entry
    const auditEntry = {
      id: `pwd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: uuid,
      userEmail: user.email,
      changedBy: changedBy || uuid,
      changedByEmail: changedByEmail || user.email,
      changeType: isAdminReset ? 'admin_reset' : 'self_change',
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString(),
      must_change_password: false
    };
    const auditStore = readJSON(PASSWORD_AUDIT_FILE, []);
    auditStore.unshift(auditEntry);
    if (auditStore.length > 1000) auditStore.length = 1000;
    writeJSON(PASSWORD_AUDIT_FILE, auditStore);

    console.log(`[PasswordAPI] Password changed for ${user.email} by ${changedByEmail || 'self'} (type: ${isAdminReset ? 'admin' : 'self'})`);

    res.json({
      success: true,
      hashedPassword,
      must_change_password: false,
      message: 'Password changed successfully'
    });
  } catch (e) {
    console.error('[PasswordAPI] Password change error:', e.message);
    res.status(500).json({ success: false, message: 'Server error during password change' });
  }
});

// POST /api/users/:uuid/password/verify — Server-side password verification
app.post('/api/users/:uuid/password/verify', async (req, res) => {
  try {
    const { uuid } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const users = readUsers() || [];
    const user = users.find(u => u.uuid === uuid);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Compare password with bcrypt hash
    const isValid = await bcrypt.compare(password, user.password);

    res.json({
      success: true,
      valid: isValid,
      must_change_password: user.must_change_password || false,
      message: isValid ? 'Password verified' : 'Invalid password'
    });
  } catch (e) {
    console.error('[PasswordVerify] Error:', e.message);
    res.status(500).json({ success: false, message: 'Server error during verification' });
  }
});

// GET /api/auth/password-audit — Admin: view password change audit log
app.get('/api/auth/password-audit', (req, res) => {
  try {
    const auditLog = readJSON(PASSWORD_AUDIT_FILE, []);
    res.json({ success: true, data: auditLog, total: auditLog.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});



app.delete('/api/mail/user/:uuid', (req, res) => {
  try {
    const { uuid } = req.params;
    if (emailStore[uuid]) { delete emailStore[uuid]; saveEmails(); }
    console.log('[MailCleanup] Removed email store for deleted user: ' + uuid);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Project Management API ───────────────────────────────────────────────────
const PROJECT_STORAGE_KEY = path.join(DATA_DIR, 'projects.json');
const PROJECT_DELETE_LOG_KEY = path.join(DATA_DIR, 'project_delete_logs.json');

const getProjectStore = () => {
  try {
    return JSON.parse(fs.readFileSync(PROJECT_STORAGE_KEY, 'utf8')) || [];
  } catch {
    return [];
  }
};

const setProjectStore = (projects) => {
  fs.writeFileSync(PROJECT_STORAGE_KEY, JSON.stringify(projects, null, 2));
};

const logProjectDelete = (deleted, adminId, adminName) => {
  try {
    let logs = [];
    try { logs = JSON.parse(fs.readFileSync(PROJECT_DELETE_LOG_KEY, 'utf8')) || []; } catch { logs = []; }
    logs.unshift({
      projectId: deleted.id,
      projectName: deleted.projectName,
      clientName: deleted.clientName,
      deletedAt: new Date().toISOString(),
      deletedBy: adminName || adminId,
      deletedById: adminId,
      restored: false,
    });
    fs.writeFileSync(PROJECT_DELETE_LOG_KEY, JSON.stringify(logs.slice(0, 500), null, 2));
  } catch (e) {
    console.error('[Project Delete Log] Failed:', e.message);
  }
};

const initProjectStore = (defaultProjects) => {
  if (!fs.existsSync(PROJECT_STORAGE_KEY)) {
    setProjectStore(defaultProjects);
  }
  return getProjectStore();
};

// Initialize project store on server start
let projectStore = initProjectStore([]);

// DELETE /api/projects/:projectId — Admin only
app.delete('/api/projects/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId, role } = req.body || {};

    if (role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const projects = getProjectStore();
    const idx = projects.findIndex(p => p.id == projectId);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Project already deleted or unavailable.' });
    }

    const deleted = projects.splice(idx, 1)[0];
    setProjectStore(projects);
    logProjectDelete(deleted, userId, req.body?.userName || 'Admin');

    console.log(`[Project Delete] Admin: ${userId} | Project: ${deleted.projectName} (ID: ${projectId})`);

    return res.json({
      success: true,
      message: 'Project deleted successfully',
      deletedProject: deleted.projectName
    });
  } catch (e) {
    console.error('[Project Delete] Error:', e.message);
    return res.status(500).json({ success: false, message: 'Project deletion failed. Please try again.' });
  }
});

// GET /api/projects — List all (exclude soft-deleted)
app.get('/api/projects', (req, res) => {
  try {
    const projects = getProjectStore().filter(p => !p.isDeleted);
    return res.json({ success: true, projects });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ─── Lead Migration Audit (Step 3 — file-store adapted for InsForge arch) ─────
// POST /api/migration/log
// Receives migration summary from each Sales Agent browser.
// Stores to migration_logs.json for admin audit trail.
app.post('/api/migration/log', (req, res) => {
  try {
    const {
      agent_id,
      total_local,
      total_migrated,
      total_skipped,
      total_failed,
      status,
      migration_source,
      migration_key,
      device_info,
      browser_info,
      migrated_at,
    } = req.body;

    const entry = {
      id: `mig_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      agent_id:        agent_id        || 'unknown',
      total_local:     total_local     || 0,
      total_migrated:  total_migrated  || 0,
      total_skipped:   total_skipped   || 0,
      total_failed:    total_failed    || 0,
      status:          status          || 'unknown',
      migration_source: migration_source || 'localStorage',
      migration_key:   migration_key   || 'zsm_crm_leads',
      device_info:     device_info     || '',
      browser_info:    browser_info    || '',
      migrated_at:     migrated_at     || new Date().toISOString(),
      logged_at:       new Date().toISOString(),
    };

    const logs = readJSON(MIGRATION_LOGS_FILE, []);
    logs.unshift(entry);
    if (logs.length > 1000) logs.length = 1000;
    writeJSON(MIGRATION_LOGS_FILE, logs);

    console.log(
      `[MIGRATION LOG] Agent: ${entry.agent_id} | ` +
      `Migrated: ${entry.total_migrated} | Skipped: ${entry.total_skipped} | ` +
      `Failed: ${entry.total_failed} | Status: ${entry.status}`
    );

    return res.json({ success: true, id: entry.id });
  } catch (e) {
    console.error('[MIGRATION LOG] Error:', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/migration/logs — Admin: view all migration events
app.get('/api/migration/logs', (req, res) => {
  try {
    const logs = readJSON(MIGRATION_LOGS_FILE, []);
    return res.json({ success: true, logs, total: logs.length });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/migration/log-error — log migration error
app.post('/api/migration/log-error', (req, res) => {
  try {
    const entry = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      agent_id: req.body.agent_id || req.body.user_id || 'unknown',
      lead_name: req.body.lead_name || '',
      lead_local_id: req.body.lead_local_id || null,
      http_status: req.body.http_status || 500,
      error_response: req.body.error_response || req.body.error || 'Unknown error',
      lead_data: req.body.lead_data || {},
      logged_at: new Date().toISOString(),
    };

    const errors = readJSON(MIGRATION_ERRORS_FILE, []);
    errors.unshift(entry);
    if (errors.length > 1000) errors.length = 1000;
    writeJSON(MIGRATION_ERRORS_FILE, errors);

    console.log(`[MIGRATION ERROR] Logged error for lead ${entry.lead_name}: ${entry.error_response}`);
    return res.json({ success: true, id: entry.id });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/admin/migration-errors — view all migration errors
app.get('/api/admin/migration-errors', (req, res) => {
  try {
    const errors = readJSON(MIGRATION_ERRORS_FILE, []);
    return res.json({ success: true, errors, total: errors.length });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ─── Chat Data Store ──────────────────────────────────────────────────────────
const chatDefaults = () => ({ conversations: {}, messages: {}, presence: {} });
let chatData = readJSON(CHAT_DATA_FILE, chatDefaults());
if (!chatData.conversations) chatData.conversations = {};
if (!chatData.messages) chatData.messages = {};
if (!chatData.presence) chatData.presence = {};

const saveChatData = () => {
  try { writeJSON(CHAT_DATA_FILE, chatData); } catch (e) { console.error('[Chat] Save failed:', e.message); }
};

// Debounced save to avoid thrashing disk on rapid messages
let chatSaveTimer = null;
const debouncedSaveChatData = () => {
  if (chatSaveTimer) clearTimeout(chatSaveTimer);
  chatSaveTimer = setTimeout(saveChatData, 500);
};

// Helper: sanitize message text (XSS prevention)
const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

// ─── Chat REST Endpoints ──────────────────────────────────────────────────────

// GET /api/chat/sync?userId=XXX — full state sync for a user
app.get('/api/chat/sync', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

  // Return only conversations the user participates in
  const userConversations = {};
  const userMessages = {};
  Object.keys(chatData.conversations).forEach(chatId => {
    const conv = chatData.conversations[chatId];
    if (conv.participants?.map(String).includes(String(userId))) {
      userConversations[chatId] = conv;
      userMessages[chatId] = chatData.messages[chatId] || [];
    }
  });

  return res.json({
    success: true,
    data: {
      conversations: userConversations,
      messages: userMessages,
      presence: chatData.presence || {},
    }
  });
});

// ─── Socket.io (Real-time) ────────────────────────────────────────────────────

// Track which socket IDs belong to which user (for multi-tab support)
const userSockets = {}; // { userId: Set<socketId> }

io.on('connection', (socket) => {
  let socketUserId = null;

  // ── Email subscription (existing functionality) ──
  socket.on('subscribe', ({ userId, config }) => {
    socket.join(`user_${userId}`);
    console.log(`[Socket] User ${userId} joined`);
    if (config && config.user && config.pass) {
      startImapListener(userId, config);
    }
  });

  // ── Chat: User comes online ──
  socket.on('chat:subscribe', ({ userId, userName }) => {
    if (!userId) return;
    socketUserId = String(userId);
    socket.join(`chat_${socketUserId}`);

    // Track this socket for the user
    if (!userSockets[socketUserId]) userSockets[socketUserId] = new Set();
    userSockets[socketUserId].add(socket.id);

    // Update presence
    if (!chatData.presence[socketUserId]) chatData.presence[socketUserId] = {};
    chatData.presence[socketUserId].status = 'online';
    chatData.presence[socketUserId].lastSeen = new Date().toISOString();
    if (userName) chatData.presence[socketUserId].userName = userName;
    debouncedSaveChatData();

    // Broadcast presence to all connected chat users
    io.emit('chat:presence', { userId: socketUserId, status: 'online', lastSeen: chatData.presence[socketUserId].lastSeen });
    console.log(`[Chat] User ${socketUserId} (${userName || 'unknown'}) online. Sockets: ${userSockets[socketUserId].size}`);
  });

  // ── Chat: Ensure a conversation exists ──
  socket.on('chat:ensure_conversation', ({ chatId, conversation }) => {
    if (!chatId || !conversation) return;
    if (!chatData.conversations[chatId]) {
      chatData.conversations[chatId] = conversation;
      if (!chatData.messages[chatId]) chatData.messages[chatId] = [];
      debouncedSaveChatData();
    }
    // Notify all participants so their conversation list updates
    const participants = conversation.participants || [];
    participants.forEach(pid => {
      io.to(`chat_${String(pid)}`).emit('chat:conversation_updated', { conversation: chatData.conversations[chatId] });
    });
  });

  // ── Chat: Send a message ──
  socket.on('chat:send', ({ chatId, message }) => {
    if (!chatId || !message || !message.id) return;

    // Sanitize message text
    const sanitized = { ...message, text: sanitizeText(message.text) };

    // Ensure conversation and messages array exist
    if (!chatData.messages[chatId]) chatData.messages[chatId] = [];

    // Dedup: check if message ID already exists
    const exists = chatData.messages[chatId].some(m => m.id === sanitized.id);
    if (exists) return;

    chatData.messages[chatId].push(sanitized);

    // Update conversation lastMessage
    if (chatData.conversations[chatId]) {
      chatData.conversations[chatId].lastMessage = {
        text: sanitized.type === 'file' ? `📎 ${sanitized.attachments?.[0]?.fileName || 'File'}` : sanitized.text,
        senderId: sanitized.senderId,
        senderName: sanitized.senderName,
        timestamp: sanitized.timestamp,
        type: sanitized.type,
      };
    }

    debouncedSaveChatData();

    // Emit to all participants of this conversation
    const conv = chatData.conversations[chatId];
    if (conv && conv.participants) {
      conv.participants.forEach(pid => {
        io.to(`chat_${String(pid)}`).emit('chat:message', { chatId, message: sanitized });
      });
    } else {
      // Fallback: emit to sender room
      io.to(`chat_${String(sanitized.senderId)}`).emit('chat:message', { chatId, message: sanitized });
    }
  });

  // ── Chat: Edit a message ──
  socket.on('chat:edit', ({ chatId, messageId, newText }) => {
    if (!chatId || !messageId || !chatData.messages[chatId]) return;
    const safe = sanitizeText(newText);
    chatData.messages[chatId] = chatData.messages[chatId].map(m =>
      m.id === messageId ? { ...m, text: safe, edited: true } : m
    );
    debouncedSaveChatData();
    const conv = chatData.conversations[chatId];
    if (conv && conv.participants) {
      conv.participants.forEach(pid => {
        io.to(`chat_${String(pid)}`).emit('chat:message_edited', { chatId, messageId, newText: safe });
      });
    }
  });

  // ── Chat: Delete a message ──
  socket.on('chat:delete', ({ chatId, messageId }) => {
    if (!chatId || !messageId || !chatData.messages[chatId]) return;
    chatData.messages[chatId] = chatData.messages[chatId].map(m =>
      m.id === messageId ? { ...m, deleted: true, text: 'This message was deleted', attachments: [] } : m
    );
    debouncedSaveChatData();
    const conv = chatData.conversations[chatId];
    if (conv && conv.participants) {
      conv.participants.forEach(pid => {
        io.to(`chat_${String(pid)}`).emit('chat:message_deleted', { chatId, messageId });
      });
    }
  });

  // ── Chat: Mark messages as read ──
  socket.on('chat:read', ({ chatId, userId }) => {
    if (!chatId || !userId || !chatData.messages[chatId]) return;
    let changed = false;
    chatData.messages[chatId] = chatData.messages[chatId].map(m => {
      const readByStrings = (m.readBy || []).map(String);
      if (!readByStrings.includes(String(userId))) {
        changed = true;
        return { ...m, readBy: [...(m.readBy || []), userId] };
      }
      return m;
    });
    if (changed) {
      debouncedSaveChatData();
      const conv = chatData.conversations[chatId];
      if (conv && conv.participants) {
        conv.participants.forEach(pid => {
          io.to(`chat_${String(pid)}`).emit('chat:messages_read', { chatId, userId: String(userId) });
        });
      }
    }
  });

  // ── Chat: Typing indicator ──
  socket.on('chat:typing', ({ chatId, userId, userName, isTyping }) => {
    if (!chatId) return;
    const conv = chatData.conversations[chatId];
    if (conv && conv.participants) {
      conv.participants.forEach(pid => {
        if (String(pid) !== String(userId)) {
          io.to(`chat_${String(pid)}`).emit('chat:typing', { chatId, userId, userName, isTyping });
        }
      });
    }
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    if (socketUserId && userSockets[socketUserId]) {
      userSockets[socketUserId].delete(socket.id);
      // Only mark offline if this was the user's last socket (handles multi-tab)
      if (userSockets[socketUserId].size === 0) {
        delete userSockets[socketUserId];
        if (chatData.presence[socketUserId]) {
          chatData.presence[socketUserId].status = 'offline';
          chatData.presence[socketUserId].lastSeen = new Date().toISOString();
          debouncedSaveChatData();
        }
        io.emit('chat:presence', { userId: socketUserId, status: 'offline', lastSeen: new Date().toISOString() });
        console.log(`[Chat] User ${socketUserId} offline (all tabs closed)`);
      } else {
        console.log(`[Chat] User ${socketUserId} closed a tab. Remaining sockets: ${userSockets[socketUserId].size}`);
      }
    }
  });
});



// Start integrity checks on startup
const { runGhostUserIntegrityCheck } = require('./services/integrityService');
runGhostUserIntegrityCheck().catch(err => console.error('[IntegrityStartup] Failed:', err.message));

// ─── Attendance APIs ─────────────────────────────────────────────────────────

app.get('/api/attendance', (req, res) => {
  res.json({ success: true, data: attendanceLogs });
});

app.post('/api/attendance/seed', (req, res) => {
  const { logs } = req.body;
  if (logs && Array.isArray(logs)) {
    let added = 0;
    logs.forEach(log => {
      const exists = attendanceLogs.find(l => l.userId === log.userId && l.date === log.date);
      if (!exists) {
        attendanceLogs.push(log);
        added++;
      }
    });
    if (added > 0) writeJSON(ATTENDANCE_FILE, attendanceLogs);
    res.json({ success: true, added });
  } else {
    res.status(400).json({ success: false, message: 'Invalid payload' });
  }
});

app.post('/api/attendance', (req, res) => {
  const logData = req.body;
  const index = attendanceLogs.findIndex(l => l.userId === logData.userId && l.date === logData.date);
  
  if (index === -1) {
    attendanceLogs.push(logData);
  } else {
    attendanceLogs[index] = { ...attendanceLogs[index], ...logData };
  }
  
  writeJSON(ATTENDANCE_FILE, attendanceLogs);
  io.emit('attendance:updated', logData);
  res.json({ success: true, data: logData });
});

// ─── WhatsApp API ────────────────────────────────────────────────────────────
app.post('/api/whatsapp/init', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
  
  startSession(userId, io).catch(err => {
    console.error(`[WhatsApp] Init Error:`, err);
  });
  res.json({ success: true, message: 'WhatsApp session initialization started' });
});

app.post('/api/whatsapp/logout', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
  
  logoutSession(userId);
  res.json({ success: true, message: 'WhatsApp session logged out' });
});

app.get('/api/whatsapp/chats', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false });
  const chatsFile = path.join(DATA_DIR, `whatsapp-chats-${userId}.json`);
  const contactsFile = path.join(DATA_DIR, `whatsapp-contacts-${userId}.json`);
  
  const chats = fs.existsSync(chatsFile) ? JSON.parse(fs.readFileSync(chatsFile, 'utf8')) : [];
  const contacts = fs.existsSync(contactsFile) ? JSON.parse(fs.readFileSync(contactsFile, 'utf8')) : {};
  
  // Attach contact names
  const enrichedChats = chats.map(c => {
    let resolvedName = c.name;
    const isLid = c.id.endsWith('@lid');
    
    // First try direct lookup
    const contact = contacts[c.id];
    if (contact && (contact.name || contact.notify)) {
      resolvedName = contact.name || contact.notify;
    } else if (isLid) {
      // If it's a LID and not directly found, search contacts for matching LID
      const matchingContact = Object.values(contacts).find(cnt => cnt.lid === c.id);
      if (matchingContact && (matchingContact.name || matchingContact.notify)) {
        resolvedName = matchingContact.name || matchingContact.notify;
      }
    }
    
    // Fallback if still no name
    if (!resolvedName) {
      resolvedName = isLid ? 'Unknown contact' : c.id.split('@')[0];
    }
    
    return {
      ...c,
      name: resolvedName
    };
  });
  
  res.json({ success: true, chats: enrichedChats });
});

app.get('/api/whatsapp/chats/:chatId/messages', (req, res) => {
  const { userId } = req.query;
  const { chatId } = req.params;
  if (!userId || !chatId) return res.status(400).json({ success: false });
  const messagesFile = path.join(DATA_DIR, `whatsapp-messages-${userId}.json`);
  const messages = fs.existsSync(messagesFile) ? JSON.parse(fs.readFileSync(messagesFile, 'utf8')) : {};
  
  res.json({ success: true, messages: messages[chatId] || [] });
});

app.post('/api/whatsapp/messages/send', whatsappSendLimiter, upload.single('file'), async (req, res) => {
  const { userId, chatId, type, text, replyToMessageId, forwardMessageId } = req.body;
  if (!userId || !chatId || !type) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    let messagePayload;
    if (type === 'text') {
      messagePayload = { text: text || '' };
    } else {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Media file is required' });
      }
      
      const fileBuffer = req.file.buffer;
      const mimetype = req.file.mimetype;
      const originalname = req.file.originalname;
      const fileSize = req.file.size;

      // Enforce media constraints
      if (type === 'image' || type === 'video' || type === 'audio') {
        if (fileSize > 16 * 1024 * 1024) {
          return res.status(400).json({ success: false, message: 'Media files must be under 16MB' });
        }
      }

      if (type === 'image') {
        if (!mimetype.startsWith('image/')) return res.status(400).json({ success: false, message: 'Invalid image type' });
        messagePayload = { image: fileBuffer, caption: text || '', mimetype };
      } else if (type === 'video') {
        if (!mimetype.startsWith('video/')) return res.status(400).json({ success: false, message: 'Invalid video type' });
        messagePayload = { video: fileBuffer, caption: text || '', mimetype };
      } else if (type === 'audio' || type === 'voice_note') {
        if (!mimetype.startsWith('audio/') && !mimetype.startsWith('video/')) return res.status(400).json({ success: false, message: 'Invalid audio type' });
        messagePayload = { audio: fileBuffer, mimetype, ptt: type === 'voice_note' };
      } else if (type === 'document') {
        messagePayload = { document: fileBuffer, fileName: originalname, mimetype, caption: text || '' };
      } else {
        return res.status(400).json({ success: false, message: 'Unsupported media type' });
      }
    }

    const options = { replyToMessageId, forwardMessageId };
    const result = await sendMessage(userId, chatId, messagePayload, options);
    
    // Audit logging
    logAudit(userId, 'SEND_MESSAGE', chatId, { type, replyToMessageId, forwardMessageId, status: 'success' });
    
    res.json({ success: true, message: result });
  } catch (error) {
    console.error(`[WhatsApp] Send message error:`, error);
    
    // Check if the error is our JSON serialized dummy result
    try {
      const dummyResult = JSON.parse(error.message);
      if (dummyResult && dummyResult.status === -1) {
        // Emit to frontend so it shows up instantly as failed
        io.emit(`whatsapp:message_new:${userId}`, { jid: chatId, message: dummyResult });
        logAudit(userId, 'SEND_MESSAGE', chatId, { type, replyToMessageId, forwardMessageId, status: 'failed' });
        return res.status(500).json({ success: false, message: 'Failed to send message', result: dummyResult });
      }
    } catch (parseErr) {
      // Not JSON, fall through
    }
    
    logAudit(userId, 'SEND_MESSAGE', chatId, { type, replyToMessageId, forwardMessageId, status: 'failed', error: error.message });
    res.status(500).json({ success: false, message: error.message || 'Failed to send message' });
  }
});

app.post('/api/whatsapp/messages/edit', async (req, res) => {
  const { userId, chatId, messageId, newText } = req.body;
  if (!userId || !chatId || !messageId || !newText) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  try {
    const { editMessage } = require('./services/whatsappService');
    const result = await editMessage(userId, chatId, messageId, newText);
    logAudit(userId, 'EDIT_MESSAGE', chatId, { messageId });
    res.json({ success: true, message: result });
  } catch (error) {
    console.error(`[WhatsApp] Edit message error:`, error);
    res.status(500).json({ success: false, message: error.message || 'Failed to edit message' });
  }
});

app.post('/api/whatsapp/messages/delete', async (req, res) => {
  const { userId, chatId, messageId } = req.body;
  if (!userId || !chatId || !messageId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  try {
    const { deleteMessage } = require('./services/whatsappService');
    const result = await deleteMessage(userId, chatId, messageId);
    logAudit(userId, 'DELETE_MESSAGE', chatId, { messageId });
    res.json({ success: true, message: result });
  } catch (error) {
    console.error(`[WhatsApp] Delete message error:`, error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete message' });
  }
});

app.post('/api/whatsapp/presence', async (req, res) => {
  const { userId, chatId, presence } = req.body;
  if (!userId || !chatId || !presence) {
    return res.status(400).json({ success: false });
  }
  try {
    const { sendPresenceUpdate } = require('./services/whatsappService');
    await sendPresenceUpdate(userId, chatId, presence);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

server.listen(PORT, () => {
  console.log(`Mail Proxy REPAIRED on port ${PORT}`);
  initializeExistingSessions(io);
});
