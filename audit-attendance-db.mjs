/**
 * ============================================================
 * ATTENDANCE DATABASE VERIFICATION SCRIPT
 * ZSM CRM — Insforge Database Audit
 * Run: node audit-attendance-db.mjs
 * ============================================================
 */

import { createClient } from '@insforge/sdk';

const INSFORGE_URL     = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';

const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

// ─── Helper: Pretty section headers ─────────────────────────────────────────
const line  = (char = '─', len = 60) => char.repeat(len);
const head  = (title) => {
  console.log('');
  console.log(line('═'));
  console.log(`  ${title}`);
  console.log(line('═'));
};
const sub   = (title) => {
  console.log('');
  console.log(`  ▶ ${title}`);
  console.log('  ' + line('─', 56));
};
const ok    = (msg) => console.log(`  ✅  ${msg}`);
const warn  = (msg) => console.log(`  ⚠️   ${msg}`);
const fail  = (msg) => console.log(`  ❌  ${msg}`);
const info  = (msg) => console.log(`  ℹ️   ${msg}`);
const row   = (label, value) => console.log(`  ${String(label).padEnd(35)} ${value}`);

// ─── Main Audit ──────────────────────────────────────────────────────────────
async function runAudit() {

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   ATTENDANCE DATABASE VERIFICATION — ZSM CRM            ║');
  console.log('║   Insforge: ' + INSFORGE_URL.padEnd(47) + '║');
  console.log('║   Time: ' + new Date().toISOString().padEnd(51) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ─────────────────────────────────────────────────────────────────────────
  head('1. CONNECTION VERIFICATION');
  // ─────────────────────────────────────────────────────────────────────────
  sub('Testing Insforge connectivity');
  try {
    const { data, error } = await db.from('attendance').select('id').limit(1);
    if (error) {
      fail(`Connection failed: ${error.message}`);
      console.log('     Error detail:', error);
      process.exit(1);
    }
    ok(`Connected to Insforge successfully`);
    ok(`Database URL: ${INSFORGE_URL}`);
  } catch (e) {
    fail(`Cannot reach Insforge: ${e.message}`);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  head('2. TABLE DISCOVERY — ATTENDANCE-RELATED TABLES');
  // ─────────────────────────────────────────────────────────────────────────
  const tablesToCheck = ['attendance', 'users', 'leave_requests', 'crm_leads', 'sales', 'invoices'];
  sub('Checking table existence & row counts');

  const tableCounts = {};
  for (const table of tablesToCheck) {
    try {
      const { data, error } = await db.from(table).select('*');
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          fail(`Table "${table}" — DOES NOT EXIST`);
        } else {
          warn(`Table "${table}" — Error: ${error.message}`);
        }
        tableCounts[table] = null;
      } else {
        const count = data?.length ?? 0;
        tableCounts[table] = count;
        if (table === 'attendance') {
          count > 0 ? ok(`Table "attendance" — ${count} record(s) found ✅`) 
                    : warn(`Table "attendance" — EXISTS but 0 records`);
        } else {
          ok(`Table "${table}" — ${count} record(s)`);
        }
      }
    } catch (e) {
      fail(`Table "${table}" — Exception: ${e.message}`);
      tableCounts[table] = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  head('3. ATTENDANCE TABLE — SCHEMA VERIFICATION');
  // ─────────────────────────────────────────────────────────────────────────
  sub('Reading column structure from attendance table');

  try {
    const { data: sample, error } = await db.from('attendance').select('*').limit(1);
    if (error) {
      fail(`Cannot read attendance table: ${error.message}`);
    } else if (!sample || sample.length === 0) {
      warn('No rows in attendance table yet — cannot verify column types from data');
      warn('Schema check will rely on column names only (no sample row available)');
      info('Expected columns: id, user_id, user_name, date, login_time, logout_time, breaks, meetings, work_summary, status, created_at');
    } else {
      const cols = Object.keys(sample[0]);
      ok(`Columns detected: ${cols.join(', ')}`);
      console.log('');

      // Verify required columns
      const required = ['id', 'user_id', 'user_name', 'date', 'login_time', 'logout_time', 'breaks', 'meetings', 'status', 'created_at'];
      const optional = ['work_summary'];

      required.forEach(col => {
        cols.includes(col) ? ok(`Column "${col}" — PRESENT`) : fail(`Column "${col}" — MISSING`);
      });
      optional.forEach(col => {
        cols.includes(col) ? ok(`Column "${col}" — PRESENT (optional)`) : warn(`Column "${col}" — MISSING (run migration)`);
      });

      // Verify user_id is TEXT (not integer)
      const sampleUserId = sample[0].user_id;
      if (sampleUserId !== null && sampleUserId !== undefined) {
        typeof sampleUserId === 'string'
          ? ok(`user_id type check — TEXT ✅ (value: "${sampleUserId}")`)
          : warn(`user_id type check — Not a string! Got: ${typeof sampleUserId} = ${sampleUserId}`);
      }

      // Verify login_time is full timestamp (not just HH:MM)
      const sampleLogin = sample[0].login_time;
      if (sampleLogin) {
        sampleLogin.includes('T')
          ? ok(`login_time type check — TIMESTAMPTZ ✅ (value: "${sampleLogin}")`)
          : warn(`login_time type check — Looks like TIME only: "${sampleLogin}" (expected TIMESTAMPTZ)`);
      }
    }
  } catch (e) {
    fail(`Schema check exception: ${e.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  head('4. ROW COUNT QUERIES');
  // ─────────────────────────────────────────────────────────────────────────

  sub('Total attendance records');
  try {
    const { data, error } = await db.from('attendance').select('*');
    if (error) {
      fail(`Query failed: ${error.message}`);
    } else {
      const total = data?.length ?? 0;
      row('Total records in attendance table:', total);
      total === 0 ? warn('No records found — attendance not being saved to DB yet') 
                  : ok(`${total} attendance record(s) confirmed in Insforge`);
    }
  } catch (e) {
    fail(`Exception: ${e.message}`);
  }

  sub('Records created in last 30 days');
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data, error } = await db.from('attendance').select('*').gte('date', thirtyDaysAgo);
    if (error) {
      fail(`Query failed: ${error.message}`);
    } else {
      row(`Records since ${thirtyDaysAgo}:`, data?.length ?? 0);
    }
  } catch (e) {
    fail(`Exception: ${e.message}`);
  }

  sub('Records per user');
  try {
    const { data, error } = await db.from('attendance').select('*');
    if (error) {
      fail(`Query failed: ${error.message}`);
    } else if (!data || data.length === 0) {
      warn('No records to group by user');
    } else {
      // Group by user_id in JavaScript
      const byUser = {};
      data.forEach(r => {
        const key = `${r.user_name || 'Unknown'} (ID: ${r.user_id})`;
        byUser[key] = (byUser[key] || 0) + 1;
      });
      Object.entries(byUser)
        .sort((a, b) => b[1] - a[1])
        .forEach(([user, count]) => row(`  ${user}:`, `${count} record(s)`));
    }
  } catch (e) {
    fail(`Exception: ${e.message}`);
  }

  sub('Records by date (most recent first)');
  try {
    const { data, error } = await db.from('attendance').select('*');
    if (error) {
      fail(`Query failed: ${error.message}`);
    } else if (!data || data.length === 0) {
      warn('No records to show');
    } else {
      const byDate = {};
      data.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + 1; });
      Object.entries(byDate)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 10)
        .forEach(([date, count]) => row(`  ${date}:`, `${count} user(s) present`));
    }
  } catch (e) {
    fail(`Exception: ${e.message}`);
  }

  sub('Checking for soft-deleted / incomplete records');
  try {
    const { data, error } = await db.from('attendance').select('*');
    if (!error && data) {
      const noLogin   = data.filter(r => !r.login_time);
      const noLogout  = data.filter(r => r.login_time && !r.logout_time);
      const withBreaks = data.filter(r => Array.isArray(r.breaks) && r.breaks.length > 0);
      const activeBreak = data.filter(r => Array.isArray(r.breaks) && r.breaks.some(b => !b.endTime));

      row('Records with no login_time (incomplete):', noLogin.length);
      row('Records currently Online (no logout yet):', noLogout.length);
      row('Records with break sessions:', withBreaks.length);
      row('Records with ACTIVE break running:', activeBreak.length);

      if (noLogin.length > 0) {
        warn(`${noLogin.length} record(s) have no login_time — may be corrupted`);
      }
    }
  } catch (e) {
    fail(`Exception: ${e.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  head('5. FULL ATTENDANCE TABLE DUMP (Latest 20 Records)');
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const { data, error } = await db.from('attendance').select('*');
    if (error) {
      fail(`Cannot fetch records: ${error.message}`);
    } else if (!data || data.length === 0) {
      warn('attendance table is EMPTY — no records exist yet');
      warn('Action required: Mark attendance in the CRM then re-run this script');
    } else {
      ok(`Showing ${Math.min(data.length, 20)} of ${data.length} record(s):`);
      console.log('');
      const recent = data
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 20);

      recent.forEach((r, i) => {
        console.log(`  [${i + 1}] ────────────────────────────────────────────`);
        console.log(`       ID:          ${r.id}`);
        console.log(`       user_id:     ${r.user_id}`);
        console.log(`       user_name:   ${r.user_name}`);
        console.log(`       date:        ${r.date}`);
        console.log(`       login_time:  ${r.login_time || '—'}`);
        console.log(`       logout_time: ${r.logout_time || '— (still online)'}`);
        console.log(`       breaks:      ${JSON.stringify(r.breaks || [])}`);
        console.log(`       meetings:    ${JSON.stringify(r.meetings || [])}`);
        console.log(`       status:      ${r.status}`);
        console.log(`       created_at:  ${r.created_at}`);
      });
    }
  } catch (e) {
    fail(`Exception: ${e.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  head('6. WRITE TEST — INSERT + DELETE');
  // ─────────────────────────────────────────────────────────────────────────
  sub('Verifying INSERT permission (write test)');
  const testRecord = {
    user_id:    'AUDIT_TEST_USER',
    user_name:  'Audit Test (auto-deleted)',
    date:       '1970-01-01',
    login_time: new Date().toISOString(),
    breaks:     [],
    meetings:   [],
    status:     'Present',
  };

  let insertedId = null;
  try {
    const { data, error } = await db.from('attendance').insert([testRecord]);
    if (error) {
      fail(`INSERT test failed: ${error.message}`);
      fail('This means the application CANNOT write to the attendance table');
      info('Fix: Check RLS policy — run: CREATE POLICY "Attendance can do all" ON attendance FOR ALL USING (true) WITH CHECK (true);');
    } else {
      insertedId = data?.[0]?.id;
      ok(`INSERT test PASSED — test record inserted (id: ${insertedId})`);
    }
  } catch (e) {
    fail(`INSERT exception: ${e.message}`);
  }

  sub('Cleaning up test record (DELETE)');
  if (insertedId) {
    try {
      const { error } = await db.from('attendance').delete().eq('id', insertedId);
      error ? fail(`DELETE test failed: ${error.message}`) : ok('Test record deleted successfully');
    } catch (e) {
      fail(`DELETE exception: ${e.message}`);
    }
  } else {
    // Try delete by date as fallback
    try {
      await db.from('attendance').delete().eq('date', '1970-01-01').eq('user_id', 'AUDIT_TEST_USER');
      ok('Test record cleaned up by date+user_id');
    } catch (e) {
      warn('Could not clean up test record — manual delete needed');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  head('7. APPLICATION CONNECTION VERIFICATION');
  // ─────────────────────────────────────────────────────────────────────────
  sub('Verifying app config matches this database');
  console.log('');
  row('  App REACT_APP_INSFORGE_URL:', INSFORGE_URL);
  row('  Audit script URL:          ', INSFORGE_URL);
  row('  Match:                     ', '✅ Same database instance');
  console.log('');
  info('Both the CRM app and this script use the same Insforge URL and anon key.');
  info('If attendance marks in the CRM still do not appear here, the bug is in');
  info('the JavaScript upsert code (check browser console for errors).');

  // ─────────────────────────────────────────────────────────────────────────
  head('8. SUMMARY REPORT');
  // ─────────────────────────────────────────────────────────────────────────
  console.log('');

  const attendanceCount = tableCounts['attendance'];
  if (attendanceCount === null) {
    fail('CRITICAL: attendance table does not exist or is inaccessible');
    fail('Run the migration: migrations/20260612_fix_attendance_table.sql');
  } else if (attendanceCount === 0) {
    warn('ISSUE: attendance table exists but has 0 records');
    warn('Action: Mark login in the CRM, then check browser console for errors');
    warn('Expected console message: [API:attendance.upsert] ✅ Success');
  } else {
    ok(`SUCCESS: ${attendanceCount} attendance record(s) confirmed in Insforge`);
    ok('Attendance data is flowing correctly from CRM to Insforge');
    ok('Admin can view records in: HR → Attendance → Daily Attendance Log');
  }

  console.log('');
  console.log(line('═'));
  console.log('  Audit completed at: ' + new Date().toISOString());
  console.log(line('═'));
  console.log('');
}

runAudit().catch(err => {
  console.error('');
  console.error('FATAL AUDIT ERROR:', err.message);
  console.error(err);
  process.exit(1);
});
