import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function run() {
  // Test 1: Can we insert with a UUID created_by now?
  console.log('=== TEST 1: UUID insert test ===');
  const { data: t1, error: e1 } = await db.from('leads').insert([{
    contact_name: 'SCHEMA_TEST', business_name: 'Test', owner_phone: '00000000099',
    status: 'New Lead',
    created_by: '2eab48d9-b005-4a6b-b1bb-bfb481de316b',
    assigned_to: '2eab48d9-b005-4a6b-b1bb-bfb481de316b'
  }]);
  if (e1) {
    console.log('STILL FAILING — Schema not fixed yet. Error:', e1.message, '| Code:', e1.code);
  } else {
    console.log('SUCCESS — Schema is fixed! Insert worked:', t1?.[0]?.id);
    // clean up
    if (t1?.[0]?.id) await db.from('leads').delete().eq('id', t1[0].id);
  }

  // Test 2: Count leads now
  const { data: leads } = await db.from('leads').select('*');
  console.log('\n=== TEST 2: Total leads in DB:', leads?.length);
  leads?.forEach(l => console.log(' -', l.id, '|', l.contact_name, '|', l.owner_phone, '| created_by:', l.created_by));

  // Test 3: Check created_by column type
  console.log('\n=== TEST 3: Column types ===');
  const { data: rpc } = await db.rpc('check_duplicate_lead', {
    p_phone: '+353864067893', p_email: null, p_website: null,
    p_agent_id: '0f8d95b7-e071-4c1a-a1ea-74b5ad632639'
  });
  console.log('Duplicate check for +353864067893:', JSON.stringify(rpc));
}

run().catch(e => console.error('Fatal:', e.message));
