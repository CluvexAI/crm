// Script to reset admin password by clearing localStorage
// Run this in the browser console to fix the issue

// Clear the stored users to force re-initialization with fresh hashed passwords
localStorage.removeItem('zsm_crm_users');
console.log('Users database cleared. Refresh the page to reinitialize with fresh admin password.');

// Alternative: If you want to manually set the admin password with a fresh hash
async function resetAdminPassword() {
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const defaultUsers = [
    {
      uuid: 'a1b2c3d4-0001-4e5f-8a9b-000000000001',
      id: 1, employeeId: 'EMP-001',
      name: 'Admin User', email: 'admin@zsm.com',
      phone: '9876543210', role: 'Admin',
      department: 'Management', designation: 'CEO',
      status: 'Active', password: hashedPassword,
    }
  ];
  
  localStorage.setItem('zsm_crm_users', JSON.stringify(defaultUsers));
  console.log('Admin password reset successfully!');
}

// To run: resetAdminPassword()