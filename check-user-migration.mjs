import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function run() {
  console.log('=== USER MIGRATION STATUS CHECK ===\n');

  // 1. Fetch all users currently in InsForge cloud DB
  const { data: cloudUsers, error: usersErr } = await db.from('users').select('*');
  if (usersErr) {
    console.error('❌ Failed to fetch cloud users:', usersErr.message);
    return;
  }

  console.log(`Cloud DB Users Table: ${cloudUsers.length} users found`);
  console.log('─'.repeat(70));
  cloudUsers.forEach((u, i) => {
    console.log(`${i+1}. ID: ${u.id}`);
    console.log(`   Name:   ${u.name}`);
    console.log(`   Email:  ${u.email}`);
    console.log(`   Role:   ${u.role}`);
    console.log(`   Status: ${u.status || 'N/A'}`);
    console.log('');
  });

  // 2. Check crm_leads table for agent IDs not in cloud users
  console.log('\n=== AGENT IDs FOUND IN crm_leads ===');
  const { data: leads, error: leadsErr } = await db.from('crm_leads').select('created_by,created_by_name,assigned_to');
  if (leadsErr) {
    console.log('crm_leads error:', leadsErr.message);
  } else {
    const agentIds = [...new Set([
      ...leads.map(l => l.created_by).filter(Boolean),
      ...leads.map(l => l.assigned_to).filter(Boolean)
    ])];
    console.log(`Unique agent IDs referenced in crm_leads: ${agentIds.length}`);
    agentIds.forEach(id => {
      const inCloud = cloudUsers.some(u => String(u.id) === String(id));
      const name = leads.find(l => l.created_by === id)?.created_by_name || 'Unknown';
      console.log(`  ${inCloud ? '✅' : '❌ NOT IN CLOUD'} | ${id} | ${name}`);
    });
  }

  // 3. Known real agent UUIDs from localStorage
  const KNOWN_LOCAL_AGENTS = [
    { id: '2eab48d9-b005-4a6b-b1bb-bfb481de316b', name: 'arshee.khatoon@zsmeservices.com', role: 'Sales Agent' },
    { id: '0f8d95b7-e071-4c1a-a1ea-74b5ad632639', name: 'md.ayan@zsmeservices.com',         role: 'Sales Agent' },
  ];

  console.log('\n=== KNOWN LOCAL AGENTS vs CLOUD STATUS ===');
  for (const agent of KNOWN_LOCAL_AGENTS) {
    const inCloud = cloudUsers.some(u => String(u.id) === agent.id || u.email?.toLowerCase() === agent.name.toLowerCase());
    console.log(`${inCloud ? '✅ In Cloud' : '❌ NOT in Cloud'} | ${agent.name} | UUID: ${agent.id}`);
  }

  // 4. Summary
  console.log('\n=== SUMMARY ===');
  const cloudIds   = cloudUsers.map(u => String(u.id));
  const localOnly  = KNOWN_LOCAL_AGENTS.filter(a => !cloudIds.includes(a.id));

  if (localOnly.length === 0) {
    console.log('✅ All known agents are present in the cloud DB.');
  } else {
    console.log(`❌ ${localOnly.length} agent(s) are ONLY in localStorage — NOT yet in InsForge cloud:`);
    localOnly.forEach(a => console.log(`   - ${a.name} (${a.id})`));
    console.log('\nThese agents need to be added to the InsForge users table.');
    console.log('Run the INSERT SQL below in InsForge SQL Editor:\n');
    localOnly.forEach(a => {
      console.log(`INSERT INTO users (id, name, email, role, status) VALUES ('${a.id}', '${a.name.split('@')[0]}', '${a.name}', '${a.role}', 'active') ON CONFLICT (id) DO NOTHING;`);
    });
  }
}

run().catch(console.error);
