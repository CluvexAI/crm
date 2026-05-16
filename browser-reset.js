// Browser console script to completely reset the user database
// Copy and paste this into the browser console on the login page

(async function resetDatabase() {
  try {
    // Load bcrypt
    const bcrypt = await import('https://cdn.jsdelivr.net/npm/bcryptjs@3.0.2/dist/bcrypt.min.js');
    
    // Default admin user with properly hashed password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    const defaultUsers = [
      {
        uuid: 'a1b2c3d4-0001-4e5f-8a9b-000000000001',
        id: 1, employeeId: 'EMP-001',
        name: 'Admin User', email: 'admin@zsm.com',
        phone: '9876543210', role: 'Admin',
        department: 'Management', designation: 'CEO',
        status: 'Active', password: hashedPassword,
        dateOfJoining: '2022-01-01', salary: 150000,
        shift: '9:00 AM - 6:00 PM', bloodGroup: 'O+',
        fatherName: 'Mr. Admin Sr.', motherName: 'Mrs. Admin',
        foodPref: 'Non-Veg', address: '123 Main St, Mumbai',
        pan: 'ABCDE1234F', aadhaar: '1234-5678-9012',
        profileImageUrl: null, profileImageSize: null, profileImageType: null,
        profileImageName: null, profileImageUploadedAt: null,
      }
    ];
    
    // Clear and save
    localStorage.removeItem('zsm_crm_users');
    localStorage.setItem('zsm_crm_users', JSON.stringify(defaultUsers));
    
    console.log('✅ Admin password reset successfully!');
    console.log('Refresh the page and try logging in with:');
    console.log('Email: admin@zsm.com');
    console.log('Password: admin123');
    
    // Force reload
    location.reload();
  } catch (e) {
    console.error('❌ Error:', e);
  }
})();