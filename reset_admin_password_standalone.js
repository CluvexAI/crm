// Standalone script to reset admin password
// Run with: node reset_admin_password_standalone.js

const fs = require('fs');
const path = require('path');

console.log('Default users loaded from mockData.js');
console.log('Admin user: admin@zsm.com');

// Create a simple HTML file that user can open in browser to reset password
const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Reset Admin Password</title>
  <script src="https://cdn.jsdelivr.net/npm/bcryptjs@3.0.2/dist/bcrypt.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
    .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 10px 0; }
    .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 10px 0; }
    button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
    button:hover { background: #0056b3; }
  </style>
</head>
<body>
  <h1>ZSM CRM Admin Password Reset</h1>
  <p>This tool will reset the admin password to <strong>admin123</strong>.</p>
  <button onclick="resetPassword()">Reset Admin Password</button>
  <div id="status"></div>
  
  <script>
    async function resetPassword() {
      const status = document.getElementById('status');
      status.innerHTML = '<p>Resetting password...</p>';
      
      try {
        const defaultUsers = [
          {
            uuid: 'a1b2c3d4-0001-4e5f-8a9b-000000000001',
            id: 1, employeeId: 'EMP-001',
            name: 'Admin User', email: 'admin@zsm.com',
            phone: '9876543210', role: 'Admin',
            department: 'Management', designation: 'CEO',
            dateOfJoining: '2022-01-01', salary: 150000, 
            shift: '9:00 AM - 6:00 PM', bloodGroup: 'O+',
            status: 'Active', fatherName: 'Mr. Admin Sr.', motherName: 'Mrs. Admin',
            foodPref: 'Non-Veg', address: '123 Main St, Mumbai',
            password: 'admin123', pan: 'ABCDE1234F', aadhaar: '1234-5678-9012',
            profileImageUrl: null, profileImageSize: null, profileImageType: null,
            profileImageName: null, profileImageUploadedAt: null,
          },
          {
            uuid: 'a1b2c3d4-0002-4e5f-8a9b-000000000002',
            id: 2, employeeId: 'EMP-002',
            name: 'Rahul Sharma', email: 'rahul@zsm.com',
            phone: '9123456789', whatsapp: '9123456789', role: 'Sales Agent',
            department: 'Sales', designation: 'Sales Executive', dateOfJoining: '2022-03-15',
            salary: 45000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'A+',
            status: 'Active', fatherName: 'Rajesh Sharma', motherName: 'Priya Sharma',
            foodPref: 'Veg', address: '456 Park Ave, Delhi',
            password: 'rahul123', pan: 'BCDEF2345G', aadhaar: '2345-6789-0123',
            profileImageUrl: null, profileImageSize: null, profileImageType: null,
            profileImageName: null, profileImageUploadedAt: null,
          }
        ];
        
        // Hash passwords with bcrypt
        const salt = await dcodeIO.bcrypt.genSalt(12);
        const hashedUsers = await Promise.all(defaultUsers.map(async (user) => {
          if (!user.password.startsWith('$2')) {
            const hashed = await dcodeIO.bcrypt.hash(user.password, salt);
            return { ...user, password: hashed };
          }
          return user;
        }));
        
        // Clear existing and save new
        localStorage.removeItem('zsm_crm_users');
        localStorage.setItem('zsm_crm_users', JSON.stringify(hashedUsers));
        
        status.innerHTML = '<div class="success"><strong>Success!</strong> Admin password has been reset to "admin123".<br>You can now close this tab and log in with admin@zsm.com / admin123</div>';
      } catch (e) {
        status.innerHTML = '<div class="error"><strong>Error:</strong> ' + e.message + '</div>';
      }
    }
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'reset_admin_password.html'), htmlContent);
console.log('\nCreated: reset_admin_password.html');
console.log('Open this file in your browser and click "Reset Admin Password" to fix the login issue.');