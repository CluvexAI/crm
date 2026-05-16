const bcrypt = require('bcryptjs');

async function fixAdminPassword() {
  const STORAGE_KEY = 'zsm_crm_users';
  
  // Read current localStorage
  let users = [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      users = JSON.parse(stored);
    }
  } catch (e) {
    console.log('No localStorage found, will initialize fresh');
  }
  
  // Find admin user
  const adminUser = users.find(u => u.email === 'admin@zsm.com');
  
  if (!adminUser) {
    console.log('Admin user not found in database!');
    return;
  }
  
  // Hash new password
  const newHash = await bcrypt.hash('admin123', 12);
  
  // Update admin password
  adminUser.password = newHash;
  
  // Save back to localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  
  console.log('Admin password fixed!');
  console.log('New hash:', newHash);
}

fixAdminPassword();