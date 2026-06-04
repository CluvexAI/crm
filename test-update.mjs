import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function run() {
  console.log('1. Fetching first lead from crm_leads...');
  const { data: leads, error } = await db.from('crm_leads').select('*').limit(1);
  if (error) { console.error(error); return; }
  
  const lead = leads[0];
  console.log('Got lead:', lead.id, lead.contact_name);

  console.log('\n2. Triggering an UPDATE...');
  const { data: updData, error: updErr } = await db.from('crm_leads').update({
    contact_name: lead.contact_name + ' Updated'
  }).eq('id', lead.id);
  
  if (updErr) { console.error('Update failed:', updErr); return; }
  console.log('Update success.');

  console.log('\n3. Checking for duplicates...');
  const { data: dups, error: dupErr } = await db.from('crm_leads').select('*').eq('owner_phone', lead.owner_phone);
  console.log(`Found ${dups?.length} records for phone ${lead.owner_phone}:`);
  for (const d of dups || []) {
    console.log(`- ID: ${d.id}, Name: ${d.contact_name}, Created: ${d.created_at}, Updated: ${d.updated_at}`);
  }
}

run();
