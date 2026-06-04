import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

const mapLeadToDB = (lead) => {
  if (!lead) return lead;
  const clean = { ...lead };
  const dbLead = {
    id: clean.id,
    contact_name: clean.contactName || clean.contact_name || '',
    business_name: clean.businessName || clean.business_name || '',
    owner_phone: clean.ownerPhone || clean.owner_phone || '',
    email: clean.email ? String(clean.email).toLowerCase().trim() : '',
    created_at: clean.createdAt || clean.created_at || new Date().toISOString(),
  };
  Object.keys(dbLead).forEach(k => { if (dbLead[k] === undefined || dbLead[k] === null) delete dbLead[k]; });
  return dbLead;
};

async function run() {
  const updates = { contactName: "Fatima Full Flow Test", ownerPhone: "353871234567", email: "fatima@sheikhboutique.com" };
  const id = '11b7567d-592c-44d2-8f41-89ea726fe41d';
  
  const clean = mapLeadToDB({ ...updates, id });
  const { id: _id, created_at: _ca, created_by: _cb, created_by_name: _cbn, ...updatePayload } = clean;
  
  console.log('Sending payload:', updatePayload);
  let { data, error } = await db.from('crm_leads').update(updatePayload).eq('id', id);
  console.log('Update result:', { data, error });
  
  // Now check if a duplicate was created
  const { data: leads } = await db.from('crm_leads').select('*').eq('owner_phone', '353871234567');
  console.log('Leads found:', leads.length);
}

run();
