const dotenv = require('dotenv');
const path = require('path');
const postmark = require('postmark');

dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.POSTMARK_API_TOKEN || '7f34db3b-5094-4a8f-a162-16888266d45b';
const targetEmail = 'tanmoy.mondal@zsmeservices.com';
const streamId = 'outbound';

console.log(`Connecting to Postmark API using token: ${token}`);
const client = new postmark.ServerClient(token);

console.log(`Attempting to delete suppression (reactivate) for ${targetEmail} on stream ${streamId}...`);

client.deleteSuppressions(streamId, {
  Suppressions: [
    { EmailAddress: targetEmail }
  ]
}).then(response => {
  console.log("SUCCESS! Suppressions delete request completed.");
  console.log("Response:", JSON.stringify(response, null, 2));
}).catch(error => {
  console.error("FAILED to delete suppressions.");
  console.error("Error Message:", error.message);
  console.error("Full Error:", error);
});
