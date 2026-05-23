const dotenv = require('dotenv');
const path = require('path');
const postmark = require('postmark');

dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.POSTMARK_API_TOKEN || '7f34db3b-5094-4a8f-a162-16888266d45b';
const fromEmail = process.env.POSTMARK_FROM_EMAIL || 'tanmoy.mondal@zsmeservices.com';
const toEmail = 'tanmoy.mondal@zsmeservices.com';

const client = new postmark.ServerClient(token);

async function runTest() {
  console.log("Checking suppressions on the Postmark Server...");
  try {
    const suppressions = await client.getSuppressions('outbound');
    console.log("Current Suppressions:", JSON.stringify(suppressions, null, 2));
  } catch (err) {
    console.error("Failed to fetch suppressions:", err.message);
  }

  console.log("\nAttempting to clear suppression...");
  try {
    const clearRes = await client.deleteSuppressions("outbound", {
      Suppressions: [{ EmailAddress: toEmail }]
    });
    console.log("Clear Suppression Response:", JSON.stringify(clearRes, null, 2));
  } catch (err) {
    console.error("Clear Suppression API Error:", err.message);
  }

  console.log("\nSending test email...");
  try {
    const response = await client.sendEmail({
      "From": fromEmail,
      "To": toEmail,
      "Subject": "Self-Healing Verification Code",
      "HtmlBody": "<strong>Hello</strong> this is a self-healing OTP verification test.",
      "TextBody": "Hello from Postmark self-healing OTP!",
      "MessageStream": "outbound"
    });
    console.log("SUCCESS! Response:", response);
  } catch (err) {
    console.error("FAILED to send:", err.message);
  }
}

runTest();
