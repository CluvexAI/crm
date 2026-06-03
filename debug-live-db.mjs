import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY
});

async function run() {
  console.log("Fetching all leads...");
  const { data: leads, error } = await insforge.database
    .from('leads')
    .select('*');
    
  if (error) {
    console.error("Error querying leads:", error);
    return;
  }
  
  const matched = leads.filter(l => 
    (l.owner_phone && l.owner_phone.includes('877122594')) || 
    (l.alt_phone && l.alt_phone.includes('877122594'))
  );
  
  console.log(`Found ${matched.length} matched leads out of ${leads.length} total:`);
  for (const l of matched) {
    console.log(`- ID: ${l.id}`);
    console.log(`  Contact: ${l.contact_name}, Biz: ${l.business_name}`);
    console.log(`  Phone: ${l.owner_phone}, Alt Phone: ${l.alt_phone}`);
    console.log(`  Created By: ${l.created_by}`);
    console.log(`  Created At: ${l.created_at}`);
    console.log(`  Last FollowUp: ${l.last_follow_up}`);
    console.log(`  Status: ${l.status}`);
    console.log('---');
  }
}

run();
