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
    const { data: leads, error } = await insforge.database.from('leads').select('*');
    if (error) {
      console.error(error);
      return;
    }
    console.log('--- ALL LEADS IN DATABASE ---');
    console.log(JSON.stringify(leads, null, 2));

    const { data: sales, error: sErr } = await insforge.database.from('sales').select('*');
    if (sErr) {
      console.error(sErr);
      return;
    }
    console.log('--- ALL SALES IN DATABASE ---');
    console.log(JSON.stringify(sales, null, 2));

  } catch (err) {
    console.error(err);
  }
}

run();
