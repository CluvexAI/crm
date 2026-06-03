import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function runTest() {
  console.log('--- TESTING DUPLICATE RPC ---');

  // Agent 1: Arshee Khatoon (UUID: 2eab48d9-b005-4a6b-b1bb-bfb481de316b)
  // Agent 2: MD. Ayan (UUID: 0f8d95b7-e071-4c1a-a1ea-74b5ad632639)

  const agent1 = '2eab48d9-b005-4a6b-b1bb-bfb481de316b';
  const agent2 = '0f8d95b7-e071-4c1a-a1ea-74b5ad632639';
  const phone1 = '+3530879631443';
  const phone2 = '+353879631443';

  // 1. Clean up any previous test lead
  await db.from('leads').delete().eq('owner_phone', phone1);
  await db.from('leads').delete().eq('owner_phone', phone2);

  // 2. Insert test lead as Agent 1
  console.log(`\nInserting lead with phone: ${phone1} (Agent 1)`);
  const { data: leadData, error: leadErr } = await db.from('leads').insert({
    contact_name: 'Test Dup Lead',
    business_name: 'Test Biz',
    owner_phone: phone1,
    email: 'testdup@example.com',
    created_by: agent1,
    status: 'New Lead'
  }).select().single();

  if (leadErr) {
    console.error('Failed to insert test lead:', leadErr);
    return;
  }
  console.log('Test lead inserted successfully. ID:', leadData.id);

  // 3. Call the RPC as Agent 2 with phone2
  console.log(`\nAgent 2 calling RPC check_duplicate_lead with phone: ${phone2}`);
  const { data: rpcData, error: rpcErr } = await db.rpc('check_duplicate_lead', {
    p_phone: phone2,
    p_email: '',
    p_website: '',
    p_agent_id: agent2
  });

  if (rpcErr) {
    console.error('RPC Error:', rpcErr);
  } else {
    console.log('\nRPC Result:', JSON.stringify(rpcData, null, 2));
  }

  // 4. Test exact match just to make sure
  console.log(`\nAgent 2 calling RPC check_duplicate_lead with EXACT phone: ${phone1}`);
  const { data: rpcDataExact, error: rpcErrExact } = await db.rpc('check_duplicate_lead', {
    p_phone: phone1,
    p_email: '',
    p_website: '',
    p_agent_id: agent2
  });

  if (rpcErrExact) {
    console.error('RPC Error (Exact):', rpcErrExact);
  } else {
    console.log('\nRPC Result (Exact):', JSON.stringify(rpcDataExact, null, 2));
  }

  // Cleanup
  await db.from('leads').delete().eq('id', leadData.id);
  console.log('\nTest lead cleaned up.');
}

runTest().catch(console.error);
