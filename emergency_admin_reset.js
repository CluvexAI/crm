const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'server', 'data');
const TOKEN_FILE = path.join(DATA_DIR, 'reset_tokens.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const readJSON = (file, def) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; }
};
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const rawToken = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

const tokens = readJSON(TOKEN_FILE, []);
tokens.push({ 
  userId: "1", 
  userName: "Admin User",
  tokenHash, 
  expiresAt, 
  used: false, 
  createdAt: new Date().toISOString(), 
  email: "admin@zsm.com",
  status: "Emergency-Generated"
});
writeJSON(TOKEN_FILE, tokens);

console.log("\n==================================================");
console.log("EMERGENCY ADMIN PASSWORD RESET");
console.log("==================================================");
console.log("\nUse this link to reset the admin password immediately:");
console.log(`http://localhost:3000?resetToken=${rawToken}&uid=1`);
console.log("\n==================================================");
