import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

async function run() {
  console.log('Testing INSERT with existing ID...');
  const existingId = '11b7567d-592c-44d2-8f41-89ea726fe41d';
  
  const { data, error } = await db.from('crm_leads').insert([{
    id: existingId,
    contact_name: 'Constraint Test',
    owner_phone: '+919999999999'
  }]);
  
  if (error) {
    console.error('Insert Error:', error);
  } else {
    console.log('Insert Success:', data);
  }
}
run();
