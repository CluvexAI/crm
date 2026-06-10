import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function checkUsers() {
  const emails = [
    'sumana.ghosh@zsmeservices.com',
    'gourab.das@zsmeservices.com',
    'shazia.parveen@zsmeservices.com'
  ];

  for (const email of emails) {
    const { data: user, error } = await db.from('users').select('*').eq('email', email).single();
    if (error) {
      console.log(`Error fetching ${email}:`, error);
    } else {
      console.log(`User: ${email}`);
      console.log(user);
      console.log('-------------------------');
    }
  }
}

checkUsers().catch(console.error);
