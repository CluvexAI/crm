const dotenv = require('dotenv');
const path = require('path');
const postmark = require('postmark');

dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.POSTMARK_API_TOKEN || '7f34db3b-5094-4a8f-a162-16888266d45b';
const targetEmail = 'tanmoy.mondal@zsmeservices.com';

console.log(`Connecting to Postmark API using token: ${token}`);
const client = new postmark.ServerClient(token);

console.log(`Searching for bounces associated with: ${targetEmail}...`);

client.getBounces({
  count: 50,
  offset: 0,
  emailFilter: targetEmail
}).then(async (result) => {
  console.log(`Found ${result.TotalCount} bounce record(s).`);
  
  if (result.TotalCount === 0) {
    console.log("No bounces found. If this email is suppressed, please check manual suppressions in the Postmark Console.");
    return;
  }

  for (const bounce of result.Bounces) {
    console.log(`\nBounce ID: ${bounce.ID}`);
    console.log(`Type: ${bounce.Type}`);
    console.log(`Details: ${bounce.Details}`);
    console.log(`Inactive: ${bounce.Inactive}`);
    console.log(`CanActivate: ${bounce.CanActivate}`);
    
    if (bounce.Inactive && bounce.CanActivate) {
      console.log(`Attempting to reactivate bounce ID: ${bounce.ID}...`);
      try {
        const activateResult = await client.activateBounce(bounce.ID);
        console.log(`SUCCESS: Inactive recipient has been reactivated! Message: ${activateResult.Message}`);
      } catch (err) {
        console.error(`FAILED to reactivate: ${err.message}`);
      }
    } else if (bounce.Inactive && !bounce.CanActivate) {
      console.log(`This bounce cannot be activated programmatically. It must be requested manually in the Postmark dashboard.`);
    } else {
      console.log(`This bounce is already active.`);
    }
  }
}).catch(error => {
  console.error("Error communicating with Postmark API:", error.message);
});
