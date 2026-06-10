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
const fakeUser = {
  employeeId: 'EMP-999',
  name: 'Test',
  email: 'test@test.com',
  phone: '1234',
  whatsapp: '1234',
  role: 'Sales',
  department: 'Sales',
  designation: 'Rep',
  dateOfJoining: '2023-01-01',
  shift: '9-5',
  salary: '1000',
  qualification: 'BSc',
  experience: '1 year',
  bloodGroup: 'O+',
  status: 'Active',
  fatherName: 'F',
  motherName: 'M',
  foodPref: 'Veg',
  hobbies: 'None',
  localStation: 'A',
  localPostOffice: 'B',
  referredBy: 'C',
  address: 'Address',
  password: 'hash',
  pan: 'PAN',
  aadhaar: 'AAD',
  voterId: 'VOTER'
};
const payload = mapToSnake(fakeUser);
delete payload.version;
delete payload.mail_config;

console.log('Payload:', Object.keys(payload));

fetch('https://7xxqu53k.ap-southeast.insforge.app/api/database/records/users?uuid=eq.d5c3bdc3-942f-4d60-a5e3-e3d52235fa4c', { 
  method: 'PATCH', 
  headers: { 
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDE4NjV9.-wAdNgjLACNi9Cq-RUSrBOCXrQ4ti0EJ_SpvWufvGBI', 
    'Content-Type': 'application/json', 
    'Prefer': 'return=representation' 
  }, 
  body: JSON.stringify(payload) 
}).then(async r => {
  const text = await r.text();
  console.log('Status:', r.status);
  console.log('Response:', text);
}).catch(console.error);
