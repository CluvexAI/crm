import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY
});

async function test() {
  console.log("Creating a NEW lead to test the 30-day window...");
  const fakePhone = "+91" + Math.floor(Math.random() * 1000000000);
  const fakeEmail = `test${Math.random()}@example.com`;
  const uuid = crypto.randomUUID();
  
  const { data: newLeadData, error: newErr } = await insforge.database.from('leads').insert([{
    id: uuid,
    contact_name: "Test User",
    business_name: "Test Biz",
    owner_phone: fakePhone,
    email: fakeEmail,
    created_by: "2",
    status: "New Lead",
    created_at: new Date().toISOString(),
    last_follow_up: new Date().toISOString()
  }]).select('*').single();

  if (newErr) {
    console.error("Failed to insert test lead:", newErr);
    return;
  }
  
  const lead = newLeadData;
  console.log(`NEW LEAD created: Phone=${lead.owner_phone}, Email=${lead.email}, CreatedBy=${lead.created_by}, CreatedAt=${lead.created_at}`);
  
  // Test with same agent (should not block)
  console.log("\nTesting with SAME agent id...");
  let res = await insforge.database.rpc('check_duplicate_lead', {
    p_phone: lead.owner_phone,
    p_email: lead.email,
    p_website: null,
    p_agent_id: String(lead.created_by)
  });
  console.log("SAME AGENT RESULT:", res.data, res.error);

  // Test with different agent (should block)
  console.log("\nTesting with DIFFERENT agent id...");
  res = await insforge.database.rpc('check_duplicate_lead', {
    p_phone: lead.owner_phone,
    p_email: lead.email,
    p_website: null,
    p_agent_id: "9999"
  });
  console.log("DIFFERENT AGENT RESULT:", res.data, res.error);
}
test();
