import { createClient } from '@insforge/sdk';
import dotenv from 'dotenv';
dotenv.config();

const INSFORGE_URL = process.env.REACT_APP_INSFORGE_URL;
const INSFORGE_ANON_KEY = process.env.REACT_APP_INSFORGE_ANON_KEY;

if (!INSFORGE_URL || !INSFORGE_ANON_KEY) {
  console.error('Missing environment variables!');
  process.exit(1);
}

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY
});

async function run() {
  try {
    console.log('Querying users...');
    const { data: users, error: uErr } = await insforge.database.from('users').select('*').limit(2);
    if (uErr) console.error('Users error:', uErr);
    else console.log('Users sample keys:', users.length ? Object.keys(users[0]) : 'empty', users);

    console.log('Querying leads...');
    const { data: leads, error: lErr } = await insforge.database.from('leads').select('*').limit(2);
    if (lErr) console.error('Leads error:', lErr);
    else console.log('Leads sample keys:', leads.length ? Object.keys(leads[0]) : 'empty', leads);

    console.log('Querying sales...');
    const { data: sales, error: sErr } = await insforge.database.from('sales').select('*').limit(2);
    if (sErr) console.error('Sales error:', sErr);
    else console.log('Sales sample keys:', sales.length ? Object.keys(sales[0]) : 'empty', sales);

  } catch (err) {
    console.error('Fatal error during dump:', err);
  }
}

run();
