import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_API_KEY = 'ik_b3885d51d56e5cd4d58d5b21fefa58d7';

const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_API_KEY });
const db = insforge.database;

async function run() {
  console.log('=== DIAGNOSTIC: Phone +353877122594 ===\n');

  // 1. Check all leads with this phone (any format)
  const { data: leads, error: leadsErr } = await db.from('leads').select('*');
  if (leadsErr) { console.error('Error fetching leads:', leadsErr); return; }

  console.log(`Total leads in DB: ${leads.length}`);

  const targetDigits = '353877122594'.replace(/^0+/, '');  // strip leading zeros
  const matching = leads.filter(l => {
    if (!l.owner_phone) return false;
    const d = String(l.owner_phone).replace(/\D/g, '').replace(/^0+/, '');
    return d === targetDigits || d.includes(targetDigits) || targetDigits.includes(d);
  });

  console.log(`\nLeads matching +353877122594 in DB: ${matching.length}`);
  matching.forEach(l => {
    console.log({
      id: l.id,
      contact_name: l.contact_name,
      business_name: l.business_name,
      owner_phone: l.owner_phone,
      email: l.email,
      status: l.status,
      created_by: l.created_by,
      assigned_to: l.assigned_to,
      created_at: l.created_at,
      last_follow_up: l.last_follow_up,
    });
  });

  // 2. Check what leads the two specific agents have
  const agent1 = '2eab48d9-b005-4a6b-b1bb-bfb481de316b';
  const agent2 = '0f8d95b7-e071-4c1a-a1ea-74b5ad632639';

  console.log(`\n=== AGENT 1 leads (${agent1}) ===`);
  const a1leads = leads.filter(l => l.created_by === agent1 || l.assigned_to === agent1);
  console.log(`Count: ${a1leads.length}`);
  a1leads.forEach(l => console.log({ id: l.id, name: l.business_name || l.contact_name, phone: l.owner_phone, email: l.email, status: l.status, created_at: l.created_at }));

  console.log(`\n=== AGENT 2 leads (${agent2}) ===`);
  const a2leads = leads.filter(l => l.created_by === agent2 || l.assigned_to === agent2);
  console.log(`Count: ${a2leads.length}`);
  a2leads.forEach(l => console.log({ id: l.id, name: l.business_name || l.contact_name, phone: l.owner_phone, email: l.email, status: l.status, created_at: l.created_at }));

  // 3. Check the users table for those two agent IDs
  console.log('\n=== AGENT DETAILS ===');
  const { data: users, error: usersErr } = await db.from('users').select('*');
  if (usersErr) { console.error('Error fetching users:', usersErr); return; }
  const a1user = users.find(u => u.id === agent1);
  const a2user = users.find(u => u.id === agent2);
  console.log('Agent 1:', a1user ? { id: a1user.id, name: a1user.name, email: a1user.email, role: a1user.role } : 'NOT FOUND IN DB');
  console.log('Agent 2:', a2user ? { id: a2user.id, name: a2user.name, email: a2user.email, role: a2user.role } : 'NOT FOUND IN DB');

  // 4. Check LocalStorage-equivalent via trigger audit log
  console.log('\n=== DUPLICATE BLOCK AUDIT LOG (last 20) ===');
  const { data: blocks, error: blocksErr } = await db.from('lead_duplicate_blocks').select('*');
  if (blocksErr) { console.log('lead_duplicate_blocks table error (may not exist yet):', blocksErr.message); }
  else {
    console.log(`Total blocked attempts logged: ${blocks.length}`);
    blocks.slice(-20).forEach(b => console.log(b));
  }

  // 5. Run the duplicate check RPC directly for this phone
  console.log('\n=== RPC check_duplicate_lead for +353877122594 ===');
  const rpc1 = await db.rpc('check_duplicate_lead', {
    p_phone: '+353877122594', p_email: null, p_website: null, p_agent_id: agent1
  });
  console.log('As Agent 1 trying to create:', JSON.stringify(rpc1, null, 2));

  const rpc2 = await db.rpc('check_duplicate_lead', {
    p_phone: '+353877122594', p_email: null, p_website: null, p_agent_id: agent2
  });
  console.log('As Agent 2 trying to create:', JSON.stringify(rpc2, null, 2));
}

run().catch(console.error);
