import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function run() {
  console.log('1. Deleting duplicates...');
  // Delete the newer duplicates
  await db.from('crm_leads').delete().eq('id', '1ea3231d-50fe-4fc9-9881-bcd0d69b2e1c');
  await db.from('crm_leads').delete().eq('id', 'cab3127f-34a6-44d0-9292-c84ecd2faf01');

  console.log('2. Triggering an UPDATE on the clean row...');
  const { data: updData, error: updErr } = await db.from('crm_leads').update({
    contact_name: 'Fatima Sheikh Clean Update'
  }).eq('id', '11b7567d-592c-44d2-8f41-89ea726fe41d');
  
  if (updErr) { console.error('Update failed:', updErr); return; }
  console.log('Update success.');

  console.log('\n3. Checking for duplicates...');
  const { data: dups, error: dupErr } = await db.from('crm_leads').select('*').eq('owner_phone', '+918123456789');
  console.log(`Found ${dups?.length} records for phone +918123456789:`);
  for (const d of dups || []) {
    console.log(`- ID: ${d.id}, Name: ${d.contact_name}, Created: ${d.created_at}, Updated: ${d.updated_at}`);
  }
}

run();
