import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

// ─── Read users from the CRM's localStorage backup file ──────────────────
import { readFileSync } from 'fs';
import { join } from 'path';

async function run() {
  console.log('=== FULL USER MIGRATION TO INSFORGE ===\n');

  // Read the app's localStorage snapshot from a Node-accessible backup
  // We'll check all known localStorage key patterns the CRM uses for users
  const possibleUserFiles = [
    'h:/zsmeservices-crm/crm/src/data/mockData.js',
    'h:/zsmeservices-crm/crm/src/data/initialData.js',
    'h:/zsmeservices-crm/crm/src/data/users.js',
  ];

  // Also check AppContext for initialUsers array
  let sourceCode = '';
  try {
    sourceCode = readFileSync('h:/zsmeservices-crm/crm/src/context/AppContext.js', 'utf8');
  } catch (e) {
    console.log('Could not read AppContext.js:', e.message);
  }

  // Extract initialUsers array from AppContext
  const initialUsersMatch = sourceCode.match(/const initialUsers\s*=\s*(\[[\s\S]*?\]);/);
  if (initialUsersMatch) {
    console.log('Found initialUsers array in AppContext.js');
    try {
      // Safely evaluate the array (strip function calls, just get the plain object data)
      const arrayStr = initialUsersMatch[1]
        .replace(/await\s+hashPassword\([^)]+\)/g, '"[HASHED]"')
        .replace(/hashPassword\([^)]+\)/g, '"[HASHED]"');
      console.log('initialUsers preview (first 500 chars):', arrayStr.substring(0, 500));
    } catch(e) {
      console.log('Parse error:', e.message);
    }
  } else {
    console.log('initialUsers array not found in AppContext.js — searching mockData...');
  }

  // Fetch cloud users
  const { data: cloudUsers } = await db.from('users').select('*');
  console.log('\nCurrent cloud users:', cloudUsers.map(u => u.email).join(', '));
  console.log('Cloud user IDs:', cloudUsers.map(u => u.id).join(', '));

  // Check the crm_leads table for any stored user names that aren't in cloud
  const { data: leads } = await db.from('crm_leads').select('created_by,created_by_name,assigned_to');
  const uniqueAgents = [];
  (leads || []).forEach(l => {
    if (l.created_by && !uniqueAgents.some(a => a.id === l.created_by)) {
      uniqueAgents.push({ id: l.created_by, name: l.created_by_name || '' });
    }
  });
  console.log('\nAgents found in crm_leads:', uniqueAgents);
}

run().catch(console.error);
