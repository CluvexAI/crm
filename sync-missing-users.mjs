import fs from 'fs';

const BASE_URL = 'https://7xxqu53k.ap-southeast.insforge.app';
const API_KEY = 'ik_b3885d51d56e5cd4d58d5b21fefa58d7';

const snakeToCamel = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
const camelToSnake = (str) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const mapToSnake = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj = {};
  for (const key in obj) {
    if (key === 'mailConfig') continue; 
    newObj[camelToSnake(key)] = obj[key];
  }
  return newObj;
};

async function syncMissingUsers() {
  const localUsers = JSON.parse(fs.readFileSync('./server/data/users.json', 'utf8'));
  
  // Fetch existing users from InsForge
  const res = await fetch(`${BASE_URL}/api/database/records/users`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const dbUsers = await res.json();
  const dbEmails = new Set(dbUsers.map(u => u.email));
  
  const missingUsers = localUsers.filter(u => !dbEmails.has(u.email));
  console.log(`Found ${missingUsers.length} missing users to insert.`);

  for (const user of missingUsers) {
    if (!user.uuid) continue;

    console.log(`Inserting missing user ${user.email}...`);
    const payload = mapToSnake(user);
    delete payload.version;
    delete payload.mail_config;
    delete payload.password_changed_at;
    delete payload.password_changed_by;
    delete payload.id;
    if (payload.salary === "") delete payload.salary;

    try {
      const postRes = await fetch(`${BASE_URL}/api/database/records/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });
      if (!postRes.ok) {
        const err = await postRes.text();
        console.error(`Failed to insert ${user.email}: ${err}`);
      } else {
        console.log(`Successfully inserted ${user.email}`);
      }
    } catch (e) {
      console.error(`Error for ${user.email}:`, e.message);
    }
  }
}

syncMissingUsers();
