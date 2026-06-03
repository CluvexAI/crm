import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function checkSchema() {
  // Query information_schema to check the users table definition
  const query = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users';
  `;
  
  // Since we can't run raw SQL easily via the JS client, let's just insert a test row to see if it works, or fetch an existing user to inspect types
  const { data: users, error } = await db.from('users').select('*').limit(1);
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Users table columns and types (from first row):');
    if (users.length > 0) {
      const user = users[0];
      for (const [key, value] of Object.entries(user)) {
        console.log(`- ${key}: ${typeof value} (Value: ${value})`);
      }
    } else {
      console.log('No users found.');
    }
  }

  // Find max ID if it's an integer
  const { data: allUsers } = await db.from('users').select('id');
  if (allUsers) {
    const isIntegerId = allUsers.every(u => typeof u.id === 'number');
    console.log(`\nIs users.id an integer? ${isIntegerId}`);
    if (isIntegerId) {
      const maxId = Math.max(...allUsers.map(u => u.id));
      console.log(`Max user ID: ${maxId}`);
    }
  }
}

checkSchema().catch(console.error);
