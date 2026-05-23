const postmark = require("postmark");

// Send an email:
const client = new postmark.ServerClient("7f34db3b-5094-4a8f-a162-16888266d45b");

console.log("Sending test email via Postmark...");
client.sendEmail({
  "From": "tanmoy.mondal@zsmeservices.com",
  "To": "tanmoy.mondal@zsmeservices.com",
  "Subject": "Hello from Postmark",
  "HtmlBody": "<strong>Hello</strong> dear Postmark user.",
  "TextBody": "Hello from Postmark!",
  "MessageStream": "outbound"
}).then(response => {
  console.log("Email sent successfully!");
  console.log("Response:", response);
}).catch(error => {
  console.error("Failed to send email.");
  console.error("Error:", error);
});
