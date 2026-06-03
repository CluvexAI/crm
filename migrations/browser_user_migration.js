// ================================================================
// BROWSER CONSOLE USER MIGRATION SCRIPT
// Run this in the browser console while logged in as Admin.
// It reads ALL real users from localStorage and prints the
// INSERT SQL you need to run in InsForge SQL Editor.
// ================================================================

(function() {
  console.log('=== USER MIGRATION DIAGNOSTIC ===\n');

  // Read all localStorage keys that might store users
  const allKeys = Object.keys(localStorage);
  console.log('All localStorage keys:', allKeys);

  // Find the users key
  const userKey = allKeys.find(k =>
    k.toLowerCase().includes('user') ||
    k.toLowerCase().includes('employee') ||
    k.toLowerCase().includes('staff')
  );

  console.log('\nUser localStorage key found:', userKey || 'NONE');

  let users = [];

  if (userKey) {
    try {
      const raw = localStorage.getItem(userKey);
      const parsed = JSON.parse(raw);
      users = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      console.log(`\nTotal users in localStorage: ${users.length}`);
    } catch(e) {
      console.error('Parse error:', e.message);
    }
  }

  // Also try common CRM key patterns
  const keysToTry = [
    'zsm_crm_users', 'zsm_users', 'crm_users',
    'zsm_crm_employees', 'employees', 'staff',
    'zsm_crm_db_users'
  ];

  for (const k of keysToTry) {
    const raw = localStorage.getItem(k);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
        if (arr.length > 0) {
          console.log(`\nFound ${arr.length} users under key "${k}":`);
          arr.forEach(u => console.log(`  - ${u.name || u.email} | Role: ${u.role}`));
          if (arr.length > users.length) users = arr;
        }
      } catch(e) {}
    }
  }

  if (users.length === 0) {
    console.log('\n❌ No users found in localStorage.');
    console.log('All localStorage contents:');
    allKeys.forEach(k => {
      try {
        const val = localStorage.getItem(k);
        console.log(`  "${k}":`, val?.substring(0, 100));
      } catch(e) {}
    });
    return;
  }

  console.log(`\n=== ${users.length} USERS FOUND ===`);
  users.forEach((u, i) => {
    console.log(`${i+1}. UUID: ${u.uuid || u.id} | Name: ${u.name} | Email: ${u.email} | Role: ${u.role}`);
  });

  // Generate INSERT SQL for InsForge
  console.log('\n=== SQL TO RUN IN INSFORGE SQL EDITOR ===');
  console.log('-- Copy everything below this line:\n');

  const sqlLines = users
    .filter(u => u.email && u.name)
    .map(u => {
      const uuid = u.uuid || String(u.id || '');
      const name = (u.name || '').replace(/'/g, "''");
      const email = (u.email || '').toLowerCase().replace(/'/g, "''");
      const role = (u.role || 'Sales Agent').replace(/'/g, "''");
      const status = (u.status || 'Active').replace(/'/g, "''");
      const empId = (u.employeeId || '').replace(/'/g, "''");
      const phone = (u.phone || '').replace(/'/g, "''");
      const dept = (u.department || '').replace(/'/g, "''");

      return `INSERT INTO users (id, name, email, role, status) VALUES ('${uuid}', '${name}', '${email}', '${role}', '${status}') ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, role=EXCLUDED.role, status=EXCLUDED.status;`;
    });

  console.log(sqlLines.join('\n'));
  console.log('\n-- Also verify after running:');
  console.log('SELECT id, name, email, role, status FROM users ORDER BY name;');
})();
