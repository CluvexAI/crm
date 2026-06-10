import fs from 'fs';

const BASE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const API_KEY = 'ik_b3885d51d56e5cd4d58d5b21fefa58d7';

async function syncPasswords() {
  const users = JSON.parse(fs.readFileSync('./server/data/users.json', 'utf8'));
  console.log(`Loaded ${users.length} users from local JSON.`);

  for (const user of users) {
    if (!user.uuid) continue;

    console.log(`Syncing password for ${user.email}...`);
    try {
      const res = await fetch(`${BASE_URL}/api/database/records/users?email=eq.${user.email}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ password: user.password })
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`Failed to sync ${user.email}: ${err}`);
      } else {
        console.log(`Successfully synced ${user.email}`);
      }
    } catch (e) {
      console.error(`Error for ${user.email}:`, e.message);
    }
  }
}

syncPasswords();
