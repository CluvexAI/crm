import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function run() {
  console.log('=== Testing if crm_leads table exists ===');
  
  // Try to select from crm_leads (will error if doesn't exist)
  const { data, error } = await db.from('crm_leads').select('*').limit(1);
  
  if (error) {
    console.log('crm_leads table does NOT exist yet. Error:', error.message);
    console.log('\n>>> You must run 20260529_create_crm_leads.sql in InsForge SQL Editor first <<<');
  } else {
    console.log('✅ crm_leads table EXISTS! Row count:', data?.length);
    
    // Test insert with UUID created_by
    const { data: ins, error: insErr } = await db.from('crm_leads').insert([{
      id: 'test-' + Date.now(),
      contact_name: 'UUID TEST',
      owner_phone: '+999000000001',
      status: 'New Lead',
      created_by: '2eab48d9-b005-4a6b-b1bb-bfb481de316b',
      assigned_to: '2eab48d9-b005-4a6b-b1bb-bfb481de316b',
      created_by_name: 'Test Agent'
    }]);
    
    if (insErr) {
      console.log('❌ Insert FAILED:', insErr.message);
    } else {
      console.log('✅ Insert with UUID SUCCEEDED!');
      // Clean up
      await db.from('crm_leads').delete().eq('owner_phone', '+999000000001');
      console.log('Test record cleaned up.');
    }
  }
}

run().catch(console.error);
