const bcrypt = require('bcryptjs');

const testLogin = async () => {
  // Simulate stored hash from localStorage (we'll read from a file since we can't access browser localStorage)
  const testHash = await bcrypt.hash('admin123', 12);
  console.log('Generated hash:', testHash);
  console.log('Hash length:', testHash.length);
  console.log('Starts with $2a$:', testHash.startsWith('$2a$'));
  console.log('Starts with $2b$:', testHash.startsWith('$2b$'));
  
  // Test verify
  const isValid = await bcrypt.compare('admin123', testHash);
  console.log('Verification result:', isValid);
};

testLogin();