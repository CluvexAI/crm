import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function run() {
  console.log('Fetching all leads...');
  const { data: leads, error } = await db.from('crm_leads').select('id, contact_name, email, owner_phone, created_at, updated_at');
  
  if (error) {
    console.error('Error fetching crm_leads:', error);
    return;
  }
  
  console.log(`Found ${leads.length} leads in crm_leads table.`);
  
  // Find duplicates by email
  const byEmail = {};
  for (const lead of leads) {
    if (!lead.email) continue;
    if (!byEmail[lead.email]) byEmail[lead.email] = [];
    byEmail[lead.email].push(lead);
  }
  
  for (const email in byEmail) {
    if (byEmail[email].length > 1) {
      console.log(`\nDUPLICATE EMAIL: ${email}`);
      console.table(byEmail[email]);
    }
  }

  // Find duplicates by phone
  const byPhone = {};
  for (const lead of leads) {
    if (!lead.owner_phone) continue;
    if (!byPhone[lead.owner_phone]) byPhone[lead.owner_phone] = [];
    byPhone[lead.owner_phone].push(lead);
  }
  
  for (const phone in byPhone) {
    if (byPhone[phone].length > 1) {
      console.log(`\nDUPLICATE PHONE: ${phone}`);
      console.table(byPhone[phone]);
    }
  }
}

run();
