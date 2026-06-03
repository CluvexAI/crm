import { createClient } from '@insforge/sdk';
import dotenv from 'dotenv';
dotenv.config();

const INSFORGE_URL = process.env.REACT_APP_INSFORGE_URL;
const INSFORGE_ANON_KEY = process.env.REACT_APP_INSFORGE_ANON_KEY;

const insforge = createClient({
  baseUrl: INSFORGE_URL,
  anonKey: INSFORGE_ANON_KEY
});

async function run() {
  try {
    const { data: users } = await insforge.database.from('users').select('*');
    const { data: leads } = await insforge.database.from('leads').select('*');
    const { data: sales } = await insforge.database.from('sales').select('*');

    console.log('--- ALL UNIQUE LEAD STATUSES ---');
    const leadStatuses = new Set(leads.map(l => l.status));
    console.log(Array.from(leadStatuses));

    console.log('--- ALL UNIQUE USER ROLES ---');
    const userRoles = new Set(users.map(u => u.role));
    console.log(Array.from(userRoles));

    // Let's print out what is actually in the leads table
    console.log(`Total users: ${users?.length}`);
    console.log(`Total leads: ${leads?.length}`);
    console.log(`Total sales: ${sales?.length}`);

  } catch (err) {
    console.error(err);
  }
}

run();
