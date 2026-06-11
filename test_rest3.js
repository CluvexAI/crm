const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';

async function test() {
  try {
    const res = await fetch(`${INSFORGE_URL}/rest/v1/users?select=*&limit=1`, {
      headers: {
        'apikey': INSFORGE_ANON_KEY,
        'Authorization': `Bearer ${INSFORGE_ANON_KEY}`
      }
    });
    if (!res.ok) {
        console.error('Error:', await res.text());
        return;
    }
    const data = await res.json();
    console.log('User keys:', Object.keys(data[0] || {}));
  } catch (e) {
    console.error(e.message);
  }
}
test();
