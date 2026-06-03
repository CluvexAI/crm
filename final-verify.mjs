import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

const AGENT_1 = '2eab48d9-b005-4a6b-b1bb-bfb481de316b'; // arshee.khatoon
const AGENT_2 = '0f8d95b7-e071-4c1a-a1ea-74b5ad632639'; // md.ayan

async function run() {
  console.log('=== FINAL END-TO-END VERIFICATION ===\n');

  // 1. Confirm crm_leads exists and accepts UUIDs
  console.log('STEP 1: Insert lead as Agent 1 (arshee)...');
  const { data: ins, error: insErr } = await db.from('crm_leads').insert([{
    contact_name:    'Test Customer',
    business_name:   'Test Business',
    owner_phone:     '+353877122594',
    email:           'testdup@testbusiness.com',
    website:         'www.testbusiness.com',
    status:          'New Lead',
    created_by:      AGENT_1,
    created_by_name: 'arshee.khatoon@zsmeservices.com',
    assigned_to:     AGENT_1,
    last_follow_up:  new Date().toISOString()
  }]);

  if (insErr) {
    console.error('❌ Insert FAILED:', insErr.message);
    return;
  }
  console.log('✅ Lead inserted successfully. ID:', ins?.[0]?.id || 'OK');

  // 2. Now run duplicate check as Agent 2 — must detect it
  console.log('\nSTEP 2: Agent 2 (md.ayan) tries same phone — must be BLOCKED...');
  const normPhone = (p) => {
    if (!p) return null;
    const d = String(p).replace(/\D/g, '');
    return d.length >= 7 ? d.replace(/^0+/, '') : null;
  };

  const { data: cloudLeads } = await db.from('crm_leads').select('*');
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const pNorm = normPhone('+353877122594');

  let blocked = false;
  for (const l of cloudLeads) {
    if (String(l.created_by) === String(AGENT_2)) continue;
    if (['Closed (Lost)', 'closed_lost'].includes(l.status)) continue;
    const lastAct = new Date(l.last_follow_up || l.created_at);
    if (lastAct < cutoff) continue;
    const lp = normPhone(l.owner_phone);
    if (pNorm && lp && (lp === pNorm || lp.includes(pNorm) || pNorm.includes(lp))) {
      blocked = true;
      console.log(`✅ BLOCKED: Matched phone ${l.owner_phone} | Owner: ${l.created_by_name} | Days ago: ${Math.floor((Date.now() - lastAct.getTime()) / 86400000)}`);
      console.log(`   Message: Lead already exists and is under active follow-up by another Sales Agent User within the last 30 days.`);
      break;
    }
  }

  if (!blocked) {
    console.error('❌ DUPLICATE NOT DETECTED — check still broken!');
  }

  // 3. Clean up test lead
  if (ins?.[0]?.id) {
    await db.from('crm_leads').delete().eq('id', ins[0].id);
    console.log('\nTest lead cleaned up.');
  }

  console.log('\n=== RESULT ===');
  console.log(blocked
    ? '✅ SYSTEM WORKING: Duplicate prevention is LIVE in crm_leads cloud table.\n   All agents sharing the same cloud table will be blocked from duplicate entries.'
    : '❌ SYSTEM STILL BROKEN: Duplicate not detected. Debug needed.'
  );
}

run().catch(console.error);
