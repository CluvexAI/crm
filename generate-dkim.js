const crypto = require('crypto');

// Generate RSA key pair for DKIM
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

// Generate selector (e.g., mail, default, etc.)
const selector = 'mail';
const domain = 'zsmeservices.com';

// Convert public key to DKIM format (single line, remove headers)
const publicKeyLines = publicKey
  .replace('-----BEGIN RSA PUBLIC KEY-----', '')
  .replace('-----END RSA PUBLIC KEY-----', '')
  .replace(/\s+/g, '');

// Create DKIM TXT record value
const dkimRecord = `v=DKIM1; k=rsa; p=${publicKeyLines}`;

console.log('=== DKIM SELECTOR ===');
console.log('Selector:', selector);
console.log('');

console.log('=== PUBLIC KEY (DNS TXT Record) ===');
console.log('Name:', `${selector}._domainkey.${domain}`);
console.log('TXT Value:', dkimRecord);
console.log('');

console.log('=== PRIVATE KEY (For Nodemailer) ===');
console.log(privateKey);
console.log('');

console.log('=== Full DKIM DNS Record ===');
console.log(`${selector}._domainkey.${domain} IN TXT "${dkimRecord}"`);
console.log('');

console.log('=== Nodemailer DKIM Config ===');
console.log(JSON.stringify({
  domainName: domain,
  selector: selector,
  privateKey: privateKey
}, null, 2));