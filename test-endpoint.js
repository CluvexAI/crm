const fetch = require('node-fetch') || global.fetch;

async function test() {
  const url = 'https://7xxqu53k.ap-southeast.insforge.app/api/auth/email/send-reset-password';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com' })
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Body: ${text.substring(0, 100)}`);
  } catch (e) {
    console.error(e);
  }
}

test();
