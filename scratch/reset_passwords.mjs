const emailsToReset = [
  'sumana.ghosh@zsmeservices.com',
  'gourab.das@zsmeservices.com',
  'shazia.parveen@zsmeservices.com'
];

async function run() {
  const usersRes = await fetch('https://zsm-crm-backend.onrender.com/api/users');
  const usersJson = await usersRes.json();
  const users = usersJson.data;
  
  for (const email of emailsToReset) {
    const user = users.find(u => u.email === email);
    if (!user) {
      console.log(`User ${email} not found on Render backend.`);
      continue;
    }
    
    console.log(`Resetting password for ${email} (UUID: ${user.uuid})...`);
    
    try {
      const resetRes = await fetch(`https://zsm-crm-backend.onrender.com/api/users/${user.uuid}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: 'Password@123',
          isAdminReset: true,
          changedBy: 'admin',
          changedByEmail: 'admin@zsmeservices.com'
        })
      });
      
      const resetJson = await resetRes.json();
      if (resetJson.success) {
        console.log(`Successfully reset password for ${email}. New password: Password@123`);
      } else {
        console.error(`Failed to reset password for ${email}:`, resetJson);
      }
    } catch (e) {
      console.error(`Error resetting ${email}:`, e.message);
    }
  }
}

run();
