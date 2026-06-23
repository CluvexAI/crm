// server/services/llm/index.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const anthropic = require('./anthropic');
const openai = require('./openai');
const xai = require('./xai');

const adapters = { anthropic, openai, xai };

// Minimal decryption function to read the key at runtime
function decryptKey(encryptedHex) {
  const secret = process.env.LLM_SETTINGS_SECRET;
  if (!secret) throw new Error("LLM_SETTINGS_SECRET not configured");
  if (!encryptedHex) return null;
  
  const buffer = Buffer.from(encryptedHex, 'hex');
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, null, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptKey(plainText) {
  const secret = process.env.LLM_SETTINGS_SECRET;
  if (!secret) throw new Error("LLM_SETTINGS_SECRET not configured");
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(secret, 'hex'), iv);
  
  let encrypted = cipher.update(plainText, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const authTag = cipher.getAuthTag();
  
  return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'llm_settings.json');

function getSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function updateSettings(newSettings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf8');
}

async function runResearch(messages, opts = {}) {
  const settings = getSettings();
  const active = settings.find(s => s.is_active);
  if (!active) {
    throw new Error("No active LLM provider configured");
  }
  
  const adapter = adapters[active.provider];
  if (!adapter) {
    throw new Error(`Adapter for provider ${active.provider} not found`);
  }
  
  const apiKey = decryptKey(active.api_key_encrypted);
  if (!apiKey) {
    throw new Error(`Active provider ${active.provider} is missing API key`);
  }
  if (!active.model_id) {
    throw new Error(`Active provider ${active.provider} is missing model selection`);
  }

  return await adapter.complete(apiKey, active.model_id, messages, opts);
}

module.exports = {
  adapters,
  runResearch,
  encryptKey,
  decryptKey,
  getSettings,
  updateSettings
};
