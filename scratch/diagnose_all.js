const { ImapFlow } = require('imapflow');

const accounts = [
  { user: 'admin@zsmeservices.com', pass: 'Admin#2026@zsm' },
  { user: 'tanmoy.mondal@zsmeservices.com', pass: 'Tanmoy#2026@zsm' }
];

async function diagnoseAll() {
  for (const acc of accounts) {
    console.log(`\n--- Diagnosing ${acc.user} ---`);
    const client = new ImapFlow({
      host: 'mail.zsmeservices.com',
      port: 993,
      secure: true,
      auth: { user: acc.user, pass: acc.pass },
      tls: { rejectUnauthorized: false },
      logger: false
    });

    try {
      await client.connect();
      console.log(`✅ ${acc.user}: SUCCESS`);
      await client.logout();
    } catch (err) {
      console.log(`❌ ${acc.user}: FAILED - ${err.message}`);
      if (err.response) console.log(`   Server Response: ${err.response}`);
    }
  }
}

diagnoseAll();
