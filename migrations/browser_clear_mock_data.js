// ================================================================
// BROWSER CONSOLE — CLEAR ALL MOCK DATA FROM LOCALSTORAGE
// Paste this ENTIRE block into the browser console on the CRM.
// Removes all 6 mock users and their related mock leads/sales.
// Run this on EVERY computer/browser used by your agents.
// ================================================================

(function() {
  console.log('=== CLEARING MOCK DATA FROM LOCALSTORAGE ===\n');

  const MOCK_EMAILS = [
    'admin@zsm.com', 'rahul@zsm.com', 'priya@zsm.com',
    'arjun@zsm.com', 'sneha@zsm.com', 'vikram@zsm.com'
  ];
  const MOCK_IDS = [1, 2, 3, 4, 5, 6];

  // 1. Remove mock users from all known user keys
  const userKeys = ['zsm_crm_users', 'zsm_crm_db_users', 'zsm_users'];
  userKeys.forEach(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : Object.values(parsed);
      const cleaned = arr.filter(u =>
        !MOCK_EMAILS.includes(u.email?.toLowerCase()) &&
        !MOCK_IDS.includes(Number(u.id))
      );
      localStorage.setItem(key, JSON.stringify(cleaned));
      console.log(`✅ "${key}": removed ${arr.length - cleaned.length} mock users. ${cleaned.length} real users remain.`);
    } catch(e) {
      console.error(`Error cleaning "${key}":`, e.message);
    }
  });

  // 2. Remove mock leads (createdBy integer IDs 1-6)
  const leadKeys = ['zsm_crm_leads'];
  leadKeys.forEach(key => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const arr = JSON.parse(raw);
      const cleaned = arr.filter(l => !MOCK_IDS.includes(Number(l.createdBy)));
      localStorage.setItem(key, JSON.stringify(cleaned));
      console.log(`✅ "${key}": removed ${arr.length - cleaned.length} mock leads. ${cleaned.length} real leads remain.`);
    } catch(e) {
      console.error(`Error cleaning "${key}":`, e.message);
    }
  });

  // 3. Remove mock sales
  const salesKey = localStorage.getItem('zsm_crm_sales');
  if (salesKey) {
    try {
      const arr = JSON.parse(salesKey);
      const cleaned = arr.filter(s => !MOCK_IDS.includes(Number(s.closedBy)));
      localStorage.setItem('zsm_crm_sales', JSON.stringify(cleaned));
      console.log(`✅ "zsm_crm_sales": removed ${arr.length - cleaned.length} mock sales.`);
    } catch(e) {}
  }

  // 4. Reset migration flag so it re-runs and picks up real users
  localStorage.removeItem('zsm_crm_migration_complete');
  console.log('✅ Migration flag reset — real user sync will run on next login.');

  // 5. Show what real users remain
  const realUsersRaw = localStorage.getItem('zsm_crm_users') || localStorage.getItem('zsm_crm_db_users') || '[]';
  try {
    const realUsers = JSON.parse(realUsersRaw);
    console.log(`\n✅ DONE. ${realUsers.length} real user(s) remain in localStorage:`);
    realUsers.forEach(u => console.log(`  - ${u.name} | ${u.email} | ${u.role}`));
  } catch(e) {}

  console.log('\n⚠️  Reload the page now to apply changes.');
})();
