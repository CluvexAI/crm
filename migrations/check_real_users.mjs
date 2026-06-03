import { createClient } from '@insforge/sdk';

const INSFORGE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI';
const insforge = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });
const db = insforge.database;

const REAL_USERS = [
  { name: 'Achena Aich', email: 'achena.aich@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Admin User', email: 'admin@zsmeservices.com', role: 'Admin' },
  { name: 'Arindam Samanta', email: 'arindam.samanta@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Arshee Khatoon', email: 'arshee.khatoon@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Chayan Gayen', email: 'chayan.gayen@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Ehtesham Nasim', email: 'ehtesham.nasim@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Gourab Das', email: 'gourab.das@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Mahin Khan', email: 'mahin.khan@zsmeservices.com', role: 'Sales Agent' },
  { name: 'MD Rizwan Hussain', email: 'mdrizwan.hussain@zsmeservices.com', role: 'Sales Agent' },
  { name: 'MD. Ayan', email: 'md.ayan@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Mdkhurram Khan', email: 'mdkhurram.khan@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Moumita Acharya', email: 'moumita.acharya@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Moumita Acharya (HR)', email: 'hr@zsmeservices.com', role: 'HR' },
  { name: 'Muzammil Hussain', email: 'muzammil.hussain@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Pallabi Kundu', email: 'pallabi.kundu@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Priyanka Ghosh', email: 'priyanka.ghosh@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Radha Rani', email: 'radha.rani@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Shazia Parveen', email: 'shazia.parveen@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Siddhartha Maity', email: 'siddhartha.maity@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Tanmoy Mondal', email: 'tanmoy.mondal@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Titli Sarkar', email: 'titli.sarkar@zsmeservices.com', role: 'Sales Agent' }
];

// Fallback UUID generation since crypto isn't always available in basic node scripts
function generateUUID() {
  let d = new Date().getTime();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
      d += performance.now(); //use high-precision timer if available
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      let r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function run() {
  console.log('=== REAL USERS MIGRATION CHECK ===\n');

  const { data: cloudUsers, error: usersErr } = await db.from('users').select('*');
  if (usersErr) {
    console.error('❌ Failed to fetch cloud users:', usersErr.message);
    return;
  }

  console.log(`Found ${cloudUsers.length} users currently in Cloud DB.\n`);

  const missingUsers = [];
  const foundUsers = [];

  for (const ru of REAL_USERS) {
    const match = cloudUsers.find(cu => cu.email.toLowerCase() === ru.email.toLowerCase());
    if (match) {
      foundUsers.push(match);
      console.log(`✅ FOUND: ${ru.name} (${ru.email}) -> ID: ${match.id}`);
    } else {
      missingUsers.push(ru);
      console.log(`❌ MISSING: ${ru.name} (${ru.email})`);
    }
  }

  console.log(`\n=== SUMMARY: ${foundUsers.length} Found | ${missingUsers.length} Missing ===\n`);

  if (missingUsers.length > 0) {
    console.log('--- ACTION REQUIRED: INSERT MISSING USERS ---');
    console.log('Run the following SQL in the InsForge SQL Editor to add the missing real users:\n');
    
    missingUsers.forEach(u => {
      const id = generateUUID();
      console.log(`INSERT INTO users (id, name, email, role, status) VALUES ('${id}', '${u.name.replace(/'/g, "''")}', '${u.email}', '${u.role}', 'Active') ON CONFLICT (email) DO NOTHING;`);
    });
  }

  console.log('\n\n=== ACTION REQUIRED: CORRECTED MOCK DATA DELETION ===');
  console.log('The previous DELETE failed because `sales` must be deleted before `leads`.');
  console.log('Run the following SQL exactly in this order:\n');

  console.log(`-- 1. Delete invoices (child of sales)`);
  console.log(`DELETE FROM invoices WHERE id IN ('INV-2026-001','INV-2026-002');`);
  
  console.log(`\n-- 2. Delete sales (child of leads)`);
  console.log(`DELETE FROM sales WHERE closed_by IN ('1','2','3','4','5','6');`);
  console.log(`DELETE FROM sales WHERE lead_id IN (SELECT id FROM leads WHERE created_by IN ('1','2','3','4','5','6'));`);
  
  console.log(`\n-- 3. Delete leads (child of users)`);
  console.log(`DELETE FROM leads WHERE created_by IN ('1','2','3','4','5','6');`);
  
  console.log(`\n-- 4. Delete mock users`);
  console.log(`DELETE FROM users WHERE id IN ('1','2','3','4','5','6');`);
}

run().catch(console.error);
