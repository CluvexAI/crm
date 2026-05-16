const config = {
  user: 'admin@zsmeservices.com',
  pass: 'Admin#2026@zsm'
};

async function testSync() {
  try {
    console.log('Testing IMAP Sync for', config.user);
    const res = await fetch('http://localhost:5001/api/mail/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'admin',
        config: {
          host: 'mail.zsmeservices.com',
          port: 993,
          user: config.user,
          pass: config.pass
        }
      })
    });
    const data = await res.json();
    console.log('Sync Result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Sync Error:', err.message);
  }
}

testSync();
