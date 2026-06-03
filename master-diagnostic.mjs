import { createClient } from '@insforge/sdk';

// NOTE: Using the hardcoded key from insforgeClient.js
const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';

const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function run() {
  console.log('=== MASTER DIAGNOSTIC ===\n');

  // 1. Row counts for all tables
  const tables = ['users', 'leads', 'sales', 'invoices'];
  for (const t of tables) {
    try {
      const { data, error } = await db.from(t).select('*');
      if (error) console.log(`${t}: ERROR — ${error.message}`);
      else console.log(`${t}: ${data.length} rows`);
    } catch(e) { console.log(`${t}: THROW — ${e.message}`); }
  }

  // 2. Show all 2 existing leads in full
  console.log('\n=== EXISTING LEADS (full detail) ===');
  const { data: leads } = await db.from('leads').select('*');
  leads?.forEach(l => console.log(JSON.stringify(l, null, 2)));

  // 3. Show all users in full
  console.log('\n=== ALL USERS ===');
  const { data: users } = await db.from('users').select('*');
  users?.forEach(u => console.log({ id: u.id, name: u.name, email: u.email, role: u.role }));

  // 4. Check if leads table has the columns we need
  console.log('\n=== LEADS TABLE COLUMNS ===');
  const { data: cols, error: colErr } = await db.from('leads').select('*').limit(1);
  if (cols && cols[0]) {
    console.log('Columns present:', Object.keys(cols[0]).join(', '));
  } else {
    console.log('colErr:', colErr?.message, '| cols:', cols);
  }

  // 5. Try inserting a test lead to see exact error
  console.log('\n=== TEST INSERT ===');
  const testPayload = {
    contact_name: 'DIAGNOSTIC TEST',
    business_name: 'TEST CO',
    owner_phone: '+353877122594',
    email: 'test@test.com',
    status: 'New Lead',
    created_by: '2eab48d9-b005-4a6b-b1bb-bfb481de316b',
    assigned_to: '2eab48d9-b005-4a6b-b1bb-bfb481de316b',
  };
  const { data: inserted, error: insertErr } = await db.from('leads').insert([testPayload]);
  if (insertErr) {
    console.log('INSERT FAILED:', JSON.stringify(insertErr, null, 2));
  } else {
    console.log('INSERT SUCCEEDED:', JSON.stringify(inserted, null, 2));
    // Clean up
    if (inserted?.[0]?.id) {
      await db.from('leads').delete().eq('id', inserted[0].id);
      console.log('Test lead cleaned up.');
    }
  }
}

run().catch(console.error);
