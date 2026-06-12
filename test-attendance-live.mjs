/**
 * Live end-to-end attendance write test
 * Simulates exactly what the CRM does when a user marks attendance
 */
import { createClient } from '@insforge/sdk';

const INSFORGE_URL      = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const db = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY }).database;

const today = new Date().toISOString().split('T')[0];
const now   = new Date().toISOString();

async function run() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  LIVE END-TO-END ATTENDANCE WRITE TEST');
  console.log('══════════════════════════════════════════════════\n');

  // ── Simulate exactly what markAttendance() sends ──────────────────────────
  const testRecord = {
    user_id:    '9999999999999',          // Mimics Date.now() style userId
    user_name:  'Test User (Live Check)',
    date:       today,
    login_time: now,
    logout_time: null,
    breaks:     [],
    meetings:   [],
    status:     'Present',
  };

  console.log(`  Simulating: Mark Login for user "Test User" on ${today}`);
  console.log(`  Payload:`, JSON.stringify(testRecord, null, 4));
  console.log('');

  // ── UPSERT (same call as api.attendance.upsert) ───────────────────────────
  console.log('  ▶ Step 1: UPSERT (login)');
  const { data: d1, error: e1 } = await db
    .from('attendance')
    .upsert([testRecord], { onConflict: 'user_id,date' });

  if (e1) {
    console.log(`  ❌ UPSERT failed: ${e1.message}`);
    console.log('     Full error:', JSON.stringify(e1, null, 4));
    process.exit(1);
  }
  console.log(`  ✅ Login upsert OK`);

  // ── Simulate logout ───────────────────────────────────────────────────────
  console.log('\n  ▶ Step 2: UPSERT (logout)');
  const logoutRecord = { ...testRecord, logout_time: new Date().toISOString() };
  const { data: d2, error: e2 } = await db
    .from('attendance')
    .upsert([logoutRecord], { onConflict: 'user_id,date' });

  if (e2) {
    console.log(`  ❌ Logout upsert failed: ${e2.message}`);
  } else {
    console.log(`  ✅ Logout upsert OK`);
  }

  // ── Read back what was written ────────────────────────────────────────────
  console.log('\n  ▶ Step 3: READ BACK (verify persisted)');
  const { data: readBack, error: e3 } = await db
    .from('attendance')
    .select('*')
    .eq('user_id', testRecord.user_id)
    .eq('date', today);

  if (e3 || !readBack?.length) {
    console.log(`  ❌ Read-back failed: ${e3?.message || 'no rows returned'}`);
  } else {
    const r = readBack[0];
    console.log('  ✅ Record confirmed in Insforge:');
    console.log(`     id:           ${r.id}`);
    console.log(`     user_id:      ${r.user_id}`);
    console.log(`     user_name:    ${r.user_name}`);
    console.log(`     date:         ${r.date}`);
    console.log(`     login_time:   ${r.login_time}`);
    console.log(`     logout_time:  ${r.logout_time}`);
    console.log(`     status:       ${r.status}`);
    console.log(`     created_at:   ${r.created_at}`);
  }

  // ── Get total record count ────────────────────────────────────────────────
  console.log('\n  ▶ Step 4: TOTAL COUNT check');
  const { data: all } = await db.from('attendance').select('*');
  console.log(`  ℹ️  Total records now in attendance table: ${all?.length ?? 0}`);

  // ── Cleanup test record ───────────────────────────────────────────────────
  console.log('\n  ▶ Step 5: CLEANUP test record');
  const { error: e4 } = await db.from('attendance')
    .delete()
    .eq('user_id', testRecord.user_id)
    .eq('date', today);
  console.log(e4 ? `  ⚠️  Cleanup failed: ${e4.message}` : '  ✅ Test record deleted');

  // ── Final verdict ─────────────────────────────────────────────────────────
  console.log('');
  console.log('══════════════════════════════════════════════════');
  if (!e1 && !e3 && readBack?.length > 0) {
    console.log('  🎉 RESULT: FULLY WORKING');
    console.log('  The attendance table accepts reads and writes.');
    console.log('  When users mark attendance in the CRM, records');
    console.log('  will now be saved to Insforge and visible to Admin.');
  } else {
    console.log('  ❌ RESULT: STILL FAILING — check errors above');
  }
  console.log('══════════════════════════════════════════════════\n');
}

run().catch(console.error);
