// Run this in browser console to reset admin password
(async () => {
  const STORAGE_KEY = 'zsm_crm_users';
  const bcrypt = window.bcrypt || await import('https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm').then(m => m.default);
  
  // Read current users
  let users = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  
  // Find admin
  const adminIndex = users.findIndex(u => u.email === 'admin@zsm.com');
  
  if (adminIndex === -1) {
    console.log('Admin user not found!');
    return;
  }
  
  // Hash password with bcrypt
  const hash = await bcrypt.hash('admin123', 12);
  console.log('New hash:', hash);
  
  // Update admin
  users[adminIndex].password = hash;
  
  // Save
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  console.log('Admin password fixed! Hash length:', hash.length);
  console.log('Try logging in now with: admin@zsm.com / admin123');
})();