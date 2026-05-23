const dotenv = require('dotenv');
const path = require('path');
const postmark = require('postmark');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.POSTMARK_API_TOKEN || '7f34db3b-5094-4a8f-a162-16888266d45b';
const fromEmail = process.env.POSTMARK_FROM_EMAIL || 'tanmoy.mondal@zsmeservices.com';
const toEmail = 'tanmoy.mondal@zsmeservices.com';

console.log("Simulating OTP Send via Postmark Integrated SDK...");
console.log(`Using Token: ${token}`);
console.log(`Using Verified From Address: ${fromEmail}`);
console.log(`Sending to: ${toEmail}`);

const postmarkClient = new postmark.ServerClient(token);

const otp = '987654';
const htmlBody = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #0E5491 0%, #1a6fb5 100%); padding: 28px; text-align: center;">
      <h1 style="margin: 0; color: #fff; font-size: 22px; letter-spacing: 1px;">ZSM CRM (Test)</h1>
      <p style="margin: 6px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">Password Reset Verification</p>
    </div>
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 15px;">Hi <strong>Test User</strong>,</p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">Use the following one-time password to reset your account credentials. This code is valid for <strong>1 hour</strong>.</p>
      <div style="text-align: center; margin: 28px 0;">
        <div style="display: inline-block; background: #f0f9ff; border: 2px dashed #0E5491; border-radius: 10px; padding: 18px 36px; letter-spacing: 12px; font-size: 32px; font-weight: 700; color: #0E5491; font-family: 'Courier New', monospace;">${otp}</div>
      </div>
    </div>
  </div>
`;

postmarkClient.sendEmail({
  "From": fromEmail,
  "To": toEmail,
  "Subject": `${otp} is your ZSM CRM verification code`,
  "HtmlBody": htmlBody,
  "TextBody": `Your ZSM CRM verification code is: ${otp}. It expires in 1 hour.`,
  "MessageStream": "outbound"
}).then(response => {
  console.log("Success! OTP test email sent through Postmark.");
  console.log("Response:", response);
}).catch(error => {
  console.error("Failed to send OTP test email.");
  console.error("Error:", error);
});
