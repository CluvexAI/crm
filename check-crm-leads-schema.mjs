import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });

async function checkLeadsSchema() {
  const { data, error } = await insforge.from('crm_leads').select('*').limit(1);
  if (error) {
    console.error('Error fetching crm_leads:', error);
  } else {
    console.log('crm_leads columns (from first row if any):');
    if (data.length > 0) {
      console.log(Object.keys(data[0]));
    } else {
      console.log('No rows in crm_leads.');
      
      // Let's insert a dummy row and rollback or delete it just to see schema
      const { data: insertData, error: insertError } = await insforge.from('crm_leads').insert([{
        owner_phone: '11111111',
        email: 'dummy@example.com',
        created_by: '0f8d95b7-e071-4c1a-a1ea-74b5ad632639'
      }]).select().single();
      
      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        console.log('Columns:', Object.keys(insertData));
        await insforge.from('crm_leads').delete().eq('id', insertData.id);
      }
    }
  }
}

checkLeadsSchema().catch(console.error);
