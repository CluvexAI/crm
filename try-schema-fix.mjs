import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function run() {
  console.log('=== ATTEMPTING SCHEMA FIX VIA RPC ===\n');

  // Try to run the ALTER TABLE via a raw RPC or SQL execution
  // InsForge SDK - try sql endpoint
  try {
    const result = await insforge.database.rpc('run_sql', {
      sql: "ALTER TABLE leads ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT"
    });
    console.log('run_sql result:', JSON.stringify(result));
  } catch (e) {
    console.log('run_sql not available:', e.message);
  }

  // Try using fetch directly to the InsForge REST API
  try {
    const resp = await fetch(`${INSFORGE_URL}/rest/v1/rpc/run_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': INSFORGE_ANON_KEY,
        'Authorization': `Bearer ${INSFORGE_ANON_KEY}`
      },
      body: JSON.stringify({ sql: "SELECT current_user, version()" })
    });
    const data = await resp.json();
    console.log('Direct REST response:', JSON.stringify(data));
  } catch (e) {
    console.log('Direct REST failed:', e.message);
  }

  // Try using the pg endpoint
  try {
    const resp = await fetch(`${INSFORGE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': INSFORGE_ANON_KEY,
        'Authorization': `Bearer ${INSFORGE_ANON_KEY}`
      },
      body: JSON.stringify({ query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='leads' AND column_name='created_by'" })
    });
    const data = await resp.json();
    console.log('PG query response:', JSON.stringify(data));
  } catch (e) {
    console.log('PG query failed:', e.message);
  }
}

run().catch(console.error);
