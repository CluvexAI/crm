/**
 * ============================================================
 * COMPLETE ATTENDANCE API INVESTIGATION
 * Tests ALL attendance endpoints across:
 *   Layer 1 — Express backend server (localhost:5001)
 *   Layer 2 — Insforge SDK (direct DB calls)
 *
 * Run: node investigate-attendance-api.mjs
 * ============================================================
 */

import { createClient } from '@insforge/sdk';

// ─── Config ──────────────────────────────────────────────────────────────────
const SERVER_BASE       = 'http://localhost:5001';
const INSFORGE_URL      = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';

const db = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY }).database;

const today   = new Date().toISOString().split('T')[0];
const now     = new Date().toISOString();
const TEST_ID = `TEST_${Date.now()}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const line  = (c = '─', n = 62) => c.repeat(n);
const head  = (t) => { console.log(`\n${line('═')}\n  ${t}\n${line('═')}`); };
const sub   = (t) => { console.log(`\n  ▶  ${t}\n  ${line('─', 56)}`); };
const pass  = (m) => console.log(`  ✅  ${m}`);
const fail  = (m) => console.log(`  ❌  ${m}`);
const warn  = (m) => console.log(`  ⚠️   ${m}`);
const info  = (m) => console.log(`  ℹ️   ${m}`);
const dump  = (label, val) => console.log(`     ${label.padEnd(20)}: ${JSON.stringify(val)}`);

const results = [];
function record(endpoint, method, status, ok, reqBody, resBody, err) {
  results.push({ endpoint, method, status, ok, reqBody, resBody, err });
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────
async function http(method, path, body) {
  const url = `${SERVER_BASE}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res  = await fetch(url, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { ok: res.ok, status: res.status, data, url };
  } catch (e) {
    if (e.name === 'TimeoutError' || e.code === 'ECONNREFUSED' || e.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return { ok: false, status: 0, data: null, url, err: `Server unreachable: ${e.message}` };
    }
    return { ok: false, status: 0, data: null, url, err: e.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
async function runInvestigation() {

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   ATTENDANCE API INVESTIGATION — ZSM CRM                    ║');
  console.log('║   ' + new Date().toISOString() + '                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // ══════════════════════════════════════════════════════════════════════════
  head('LAYER 1 — EXPRESS BACKEND SERVER (localhost:5001)');
  // ══════════════════════════════════════════════════════════════════════════

  // ── 1A: GET /api/attendance ───────────────────────────────────────────────
  sub('1A. GET /api/attendance  →  Fetch all attendance logs');
  {
    const r = await http('GET', '/api/attendance');
    dump('URL',      r.url);
    dump('Status',   r.status || r.err);
    if (r.err) {
      fail(`Request failed: ${r.err}`);
      record('/api/attendance', 'GET', r.status, false, null, null, r.err);
    } else if (r.ok) {
      pass(`Status ${r.status} OK`);
      dump('success', r.data?.success);
      dump('records', Array.isArray(r.data?.data) ? r.data.data.length : 'N/A');
      if (Array.isArray(r.data?.data) && r.data.data.length > 0) {
        console.log('     Sample record:', JSON.stringify(r.data.data[0], null, 6).slice(0, 300));
      } else {
        warn('Server attendance.json is empty (no records persisted to file)');
      }
      record('/api/attendance', 'GET', r.status, true, null, r.data, null);
    } else {
      fail(`Status ${r.status}: ${JSON.stringify(r.data)}`);
      record('/api/attendance', 'GET', r.status, false, null, r.data, null);
    }
  }

  // ── 1B: POST /api/attendance  →  Upsert a log ────────────────────────────
  sub('1B. POST /api/attendance  →  Upsert attendance log');
  {
    const payload = {
      userId:    TEST_ID,
      userName:  'API Test User',
      date:      today,
      loginTime: now,
      logoutTime: null,
      breaks:    [],
      meetings:  [],
      status:    'Present',
    };
    dump('URL',     `${SERVER_BASE}/api/attendance`);
    dump('Payload', payload);

    const r = await http('POST', '/api/attendance', payload);
    dump('Status',  r.status || r.err);
    if (r.err) {
      fail(`Request failed: ${r.err}`);
      record('/api/attendance', 'POST', r.status, false, payload, null, r.err);
    } else if (r.ok) {
      pass(`Status ${r.status} OK`);
      dump('Response', r.data);
      record('/api/attendance', 'POST', r.status, true, payload, r.data, null);
    } else {
      fail(`Status ${r.status}: ${JSON.stringify(r.data)}`);
      record('/api/attendance', 'POST', r.status, false, payload, r.data, null);
    }
  }

  // ── 1C: POST /api/attendance  →  Update same log (logout) ────────────────
  sub('1C. POST /api/attendance  →  Update existing log (logout)');
  {
    const payload = {
      userId:    TEST_ID,
      userName:  'API Test User',
      date:      today,
      loginTime: now,
      logoutTime: new Date().toISOString(),
      breaks:    [{ startTime: now, endTime: new Date().toISOString(), duration: 300 }],
      meetings:  [],
      status:    'Present',
    };
    dump('URL',     `${SERVER_BASE}/api/attendance`);
    dump('Payload', payload);

    const r = await http('POST', '/api/attendance', payload);
    dump('Status',  r.status || r.err);
    if (r.err) {
      fail(`Request failed: ${r.err}`);
      record('/api/attendance [update]', 'POST', r.status, false, payload, null, r.err);
    } else if (r.ok) {
      pass(`Status ${r.status} OK — logout update accepted`);
      dump('Response', r.data);
      record('/api/attendance [update]', 'POST', r.status, true, payload, r.data, null);
    } else {
      fail(`Status ${r.status}: ${JSON.stringify(r.data)}`);
      record('/api/attendance [update]', 'POST', r.status, false, payload, r.data, null);
    }
  }

  // ── 1D: GET /api/attendance  →  Verify record was saved to file ──────────
  sub('1D. GET /api/attendance  →  Verify record persisted in server file');
  {
    const r = await http('GET', '/api/attendance');
    if (r.err) {
      fail(`Request failed: ${r.err}`);
    } else if (r.ok && Array.isArray(r.data?.data)) {
      const saved = r.data.data.find(l => l.userId === TEST_ID);
      if (saved) {
        pass(`Test record found in server attendance.json`);
        dump('Saved record', saved);
        record('/api/attendance [verify]', 'GET', r.status, true, null, saved, null);
      } else {
        fail(`Test record NOT found in server file — POST did not persist`);
        record('/api/attendance [verify]', 'GET', r.status, false, null, r.data, 'Record not found in response');
      }
    } else {
      fail(`Could not read attendance logs: ${r.err || r.status}`);
    }
  }

  // ── 1E: POST /api/attendance/seed ────────────────────────────────────────
  sub('1E. POST /api/attendance/seed  →  Seed multiple logs');
  {
    const payload = {
      logs: [
        { userId: `${TEST_ID}_S1`, userName: 'Seed User 1', date: today, loginTime: now, status: 'Present', breaks: [], meetings: [] },
        { userId: `${TEST_ID}_S2`, userName: 'Seed User 2', date: today, loginTime: now, status: 'Present', breaks: [], meetings: [] },
      ],
    };
    dump('URL',     `${SERVER_BASE}/api/attendance/seed`);
    dump('Payload', `${payload.logs.length} seed records`);

    const r = await http('POST', '/api/attendance/seed', payload);
    dump('Status',  r.status || r.err);
    if (r.err) {
      fail(`Request failed: ${r.err}`);
      record('/api/attendance/seed', 'POST', r.status, false, payload, null, r.err);
    } else if (r.ok) {
      pass(`Status ${r.status} OK`);
      dump('added',   r.data?.added);
      record('/api/attendance/seed', 'POST', r.status, true, payload, r.data, null);
    } else {
      fail(`Status ${r.status}: ${JSON.stringify(r.data)}`);
      record('/api/attendance/seed', 'POST', r.status, false, payload, r.data, null);
    }
  }

  // ── 1F: POST /api/attendance/seed  →  Invalid payload ────────────────────
  sub('1F. POST /api/attendance/seed  →  Invalid payload (error handling)');
  {
    const r = await http('POST', '/api/attendance/seed', { invalid: true });
    dump('Status',   r.status || r.err);
    if (r.err) {
      warn(`Server unreachable: ${r.err}`);
    } else if (!r.ok && r.status === 400) {
      pass(`Status 400 — correct error response for invalid payload`);
      dump('Response', r.data);
    } else {
      warn(`Unexpected response: ${r.status} — ${JSON.stringify(r.data)}`);
    }
    record('/api/attendance/seed [invalid]', 'POST', r.status, r.status === 400, { invalid: true }, r.data, r.err);
  }

  // ══════════════════════════════════════════════════════════════════════════
  head('LAYER 2 — INSFORGE SDK (Direct Database API)');
  // ══════════════════════════════════════════════════════════════════════════
  info(`Insforge URL: ${INSFORGE_URL}`);
  info(`Table: attendance`);

  // ── 2A: GET all attendance ───────────────────────────────────────────────
  sub('2A. api.attendance.getAll()  →  SELECT * FROM attendance');
  {
    const { data, error } = await db.from('attendance').select('*');
    dump('SQL',      'SELECT * FROM attendance');
    if (error) {
      fail(`Error: ${error.message}  (code: ${error.code})`);
      record('insforge:attendance.getAll', 'SELECT', error.code, false, null, null, error.message);
    } else {
      pass(`OK — ${data?.length ?? 0} total record(s) in Insforge attendance table`);
      record('insforge:attendance.getAll', 'SELECT', 200, true, null, { count: data?.length }, null);
      if (data?.length > 0) {
        console.log('     Latest record:');
        const latest = [...data].sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''))[0];
        Object.entries(latest).forEach(([k,v]) => console.log(`       ${k.padEnd(14)}: ${JSON.stringify(v)}`));
      }
    }
  }

  // ── 2B: UPSERT (login) ───────────────────────────────────────────────────
  sub('2B. api.attendance.upsert()  →  Mark Login (INSERT via UPSERT)');
  {
    const payload = {
      user_id:    TEST_ID,
      user_name:  'API Test User (Insforge)',
      date:       today,
      login_time: now,
      logout_time: null,
      breaks:     [],
      meetings:   [],
      status:     'Present',
    };
    dump('SQL',     `UPSERT INTO attendance ON CONFLICT (user_id, date)`);
    dump('Payload', payload);

    const { data, error } = await db.from('attendance').upsert([payload], { onConflict: 'user_id,date' });
    dump('Status',  error ? `ERROR ${error.code}` : 'OK');
    if (error) {
      fail(`Error: ${error.message}  (code: ${error.code})`);
      dump('Details', error);
      record('insforge:attendance.upsert[login]', 'UPSERT', error.code, false, payload, null, error.message);
    } else {
      pass(`UPSERT OK — login record inserted/updated`);
      dump('Returned', data?.[0] || '(no row returned — normal for some SDK versions)');
      record('insforge:attendance.upsert[login]', 'UPSERT', 200, true, payload, data?.[0], null);
    }
  }

  // ── 2C: UPSERT (logout) ──────────────────────────────────────────────────
  sub('2C. api.attendance.upsert()  →  Mark Logout (UPDATE via UPSERT)');
  {
    const payload = {
      user_id:     TEST_ID,
      user_name:   'API Test User (Insforge)',
      date:        today,
      login_time:  now,
      logout_time: new Date().toISOString(),
      breaks:      [],
      meetings:    [],
      status:      'Present',
    };
    dump('SQL',    `UPSERT INTO attendance ON CONFLICT (user_id, date) DO UPDATE SET logout_time=...`);
    dump('Payload', payload);

    const { data, error } = await db.from('attendance').upsert([payload], { onConflict: 'user_id,date' });
    if (error) {
      fail(`Error: ${error.message}  (code: ${error.code})`);
      record('insforge:attendance.upsert[logout]', 'UPSERT', error.code, false, payload, null, error.message);
    } else {
      pass(`UPSERT OK — logout_time updated`);
      record('insforge:attendance.upsert[logout]', 'UPSERT', 200, true, payload, data?.[0], null);
    }
  }

  // ── 2D: GET by date ──────────────────────────────────────────────────────
  sub(`2D. api.attendance.getByDate('${today}')  →  SELECT WHERE date='${today}'`);
  {
    const { data, error } = await db.from('attendance').select('*').eq('date', today);
    dump('SQL',    `SELECT * FROM attendance WHERE date = '${today}'`);
    if (error) {
      fail(`Error: ${error.message}`);
      record(`insforge:attendance.getByDate(${today})`, 'SELECT', error.code, false, { date: today }, null, error.message);
    } else {
      pass(`OK — ${data?.length ?? 0} record(s) for today`);
      data?.forEach((r,i) => {
        console.log(`     [${i+1}] user_name=${r.user_name}, login=${r.login_time}, logout=${r.logout_time}`);
      });
      record(`insforge:attendance.getByDate(${today})`, 'SELECT', 200, true, { date: today }, { count: data?.length }, null);
    }
  }

  // ── 2E: GET by user_id ───────────────────────────────────────────────────
  sub(`2E. api.attendance.getByUser('${TEST_ID}')  →  SELECT WHERE user_id='${TEST_ID}'`);
  {
    const { data, error } = await db.from('attendance').select('*').eq('user_id', TEST_ID);
    dump('SQL',    `SELECT * FROM attendance WHERE user_id = '${TEST_ID}'`);
    if (error) {
      fail(`Error: ${error.message}`);
      record('insforge:attendance.getByUser', 'SELECT', error.code, false, { user_id: TEST_ID }, null, error.message);
    } else {
      const rec = data?.[0];
      if (rec) {
        pass(`OK — Record found for test user`);
        dump('id',          rec.id);
        dump('user_id',     rec.user_id);
        dump('date',        rec.date);
        dump('login_time',  rec.login_time);
        dump('logout_time', rec.logout_time);
        dump('status',      rec.status);
        record('insforge:attendance.getByUser', 'SELECT', 200, true, { user_id: TEST_ID }, rec, null);
      } else {
        warn(`No record found for test user_id — upsert may not have been saved`);
        record('insforge:attendance.getByUser', 'SELECT', 200, false, { user_id: TEST_ID }, null, 'No record found');
      }
    }
  }

  // ── 2F: Row count verification ───────────────────────────────────────────
  sub('2F. Attendance row count — before cleanup');
  {
    const { data } = await db.from('attendance').select('*');
    pass(`Total records in attendance table: ${data?.length ?? 0}`);
  }

  // ── 2G: DELETE test record ───────────────────────────────────────────────
  sub('2G. api.attendance.delete()  →  DELETE WHERE user_id=TEST_ID');
  {
    const { error } = await db.from('attendance').delete()
      .eq('user_id', TEST_ID).eq('date', today);
    dump('SQL',  `DELETE FROM attendance WHERE user_id='${TEST_ID}' AND date='${today}'`);
    if (error) {
      fail(`Delete failed: ${error.message}`);
      record('insforge:attendance.delete', 'DELETE', error.code, false, { user_id: TEST_ID }, null, error.message);
    } else {
      pass('Test record deleted successfully');
      record('insforge:attendance.delete', 'DELETE', 200, true, { user_id: TEST_ID }, null, null);
    }
  }

  // ── 2H: Reports query — count per user ───────────────────────────────────
  sub('2H. Attendance Reports  →  Record count per user (last 30 days)');
  {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data, error } = await db.from('attendance').select('*').gte('date', since);
    dump('SQL',   `SELECT * FROM attendance WHERE date >= '${since}'`);
    if (error) {
      fail(`Error: ${error.message}`);
    } else if (!data?.length) {
      warn(`0 records in last 30 days — no real attendance marked yet`);
    } else {
      pass(`${data.length} record(s) in last 30 days`);
      const byUser = {};
      data.forEach(r => { byUser[r.user_name||r.user_id] = (byUser[r.user_name||r.user_id]||0)+1; });
      Object.entries(byUser).forEach(([u,c]) => console.log(`       ${u}: ${c} day(s)`));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  head('FINAL REPORT — ALL ENDPOINTS SUMMARY');
  // ══════════════════════════════════════════════════════════════════════════

  console.log('');
  console.log('  Endpoint'.padEnd(46) + 'Method'.padEnd(10) + 'Status'.padEnd(10) + 'Result');
  console.log('  ' + line('─', 60));

  results.forEach(r => {
    const status = r.ok ? '✅ PASS' : '❌ FAIL';
    const code   = r.status ? String(r.status) : 'N/A';
    const ep     = r.endpoint.length > 42 ? r.endpoint.slice(0, 42) + '..' : r.endpoint;
    console.log(`  ${ep.padEnd(46)}${r.method.padEnd(10)}${code.padEnd(10)}${status}`);
    if (!r.ok && r.err) console.log(`    └─ Error: ${r.err}`);
  });

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log('');
  console.log(`  Total: ${results.length}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('');
    warn('Some endpoints failed. Check the errors above for details.');
  } else {
    console.log('');
    pass('ALL ENDPOINTS OPERATIONAL');
    pass('Attendance data correctly reaches the backend (server file + Insforge DB).');
  }

  console.log('');
  console.log(line('═'));
  console.log(`  Investigation completed at: ${new Date().toISOString()}`);
  console.log(line('═'));
  console.log('');
}

runInvestigation().catch(err => {
  console.error('\n❌ INVESTIGATION CRASHED:', err.message);
  console.error(err);
  process.exit(1);
});
