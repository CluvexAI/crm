/**
 * Discover exact PostgreSQL roles in this Insforge instance
 */
import { createClient } from '@insforge/sdk';

const INSFORGE_URL      = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';

const db = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY }).database;

async function run() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Insforge Role & Permission Discovery');
  console.log('══════════════════════════════════════════════\n');

  // 1. Try rpc to get current user/role
  try {
    const { data, error } = await db.rpc('get_current_user_info', {});
    console.log('rpc get_current_user_info:', data, error?.message);
  } catch(e) { console.log('rpc not available:', e.message); }

  // 2. Try to discover via information_schema
  const tables = ['attendance', 'crm_leads', 'users', 'sales'];
  for (const t of tables) {
    try {
      const { data, error } = await db.from('information_schema.role_table_grants')
        .select('grantee,privilege_type')
        .eq('table_name', t);
      if (!error && data?.length > 0) {
        console.log(`\nGrants on "${t}":`);
        data.forEach(r => console.log(`  grantee=${r.grantee}  privilege=${r.privilege_type}`));
      } else {
        console.log(`Grants on "${t}": ${error?.message || 'no data'}`);
      }
    } catch(e) { console.log(`Grants check error: ${e.message}`); }
  }

  // 3. Try inserting with just anon to see the real error message
  console.log('\n── INSERT test (raw) ──');
  try {
    const { data, error } = await db.from('attendance').insert([{
      user_id:   'ROLE_TEST',
      user_name: 'Role Test',
      date:      '1970-01-01',
      status:    'Present',
      breaks:    [],
      meetings:  [],
    }]);
    if (error) {
      console.log('INSERT error code   :', error.code);
      console.log('INSERT error message:', error.message);
      console.log('INSERT error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('INSERT succeeded! id:', data?.[0]?.id);
      // Clean up
      if (data?.[0]?.id) {
        await db.from('attendance').delete().eq('id', data[0].id);
        console.log('Test record deleted.');
      }
    }
  } catch(e) { console.log('INSERT exception:', e.message); }

  // 4. Try upsert 
  console.log('\n── UPSERT test (raw) ──');
  try {
    const { data, error } = await db.from('attendance').upsert([{
      user_id:   'ROLE_TEST_UPSERT',
      user_name: 'Role Upsert Test',
      date:      '1970-01-01',
      status:    'Present',
      breaks:    [],
      meetings:  [],
    }], { onConflict: 'user_id,date' });
    if (error) {
      console.log('UPSERT error code   :', error.code);
      console.log('UPSERT error message:', error.message);
      console.log('UPSERT error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('UPSERT succeeded! id:', data?.[0]?.id);
      if (data?.[0]?.id) {
        await db.from('attendance').delete().eq('id', data[0].id);
        console.log('Test record deleted.');
      }
    }
  } catch(e) { console.log('UPSERT exception:', e.message); }

  console.log('\n══════════════════════════════════════════════');
  console.log('  Discovery complete');
  console.log('══════════════════════════════════════════════\n');
}

run().catch(console.error);
