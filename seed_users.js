/**
 * seed_users.js — Directly writes all mock users into server/data/users.json
 * Run with: node seed_users.js
 */
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, 'server', 'data', 'users.json');

const users = [
  {
    uuid: 'a1b2c3d4-0001-4e5f-8a9b-000000000001',
    id: 1, employeeId: 'EMP-001',
    name: 'Admin User', email: 'admin@zsmeservices.com',
    phone: '9876543210', whatsapp: '9876543210', role: 'Admin',
    department: 'Management', designation: 'CEO', dateOfJoining: '2022-01-01',
    salary: 150000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'O+',
    status: 'Active', fatherName: 'Mr. Admin Sr.', motherName: 'Mrs. Admin',
    foodPref: 'Non-Veg', address: '123 Main St, Mumbai',
    password: 'admin123', pan: 'ABCDE1234F', aadhaar: '1234-5678-9012',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
  {
    uuid: 'a1b2c3d4-0002-4e5f-8a9b-000000000002',
    id: 2, employeeId: 'EMP-002',
    name: 'Rahul Sharma', email: 'rahul@zsmeservices.com',
    phone: '9123456789', whatsapp: '9123456789', role: 'Sales Agent',
    department: 'Sales', designation: 'Sales Executive', dateOfJoining: '2022-03-15',
    salary: 45000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'A+',
    status: 'Active', fatherName: 'Rajesh Sharma', motherName: 'Priya Sharma',
    foodPref: 'Veg', address: '456 Park Ave, Delhi',
    password: 'rahul123', pan: 'BCDEF2345G', aadhaar: '2345-6789-0123',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
  {
    uuid: 'a1b2c3d4-0003-4e5f-8a9b-000000000003',
    id: 3, employeeId: 'EMP-003',
    name: 'Priya Patel', email: 'priya@zsmeservices.com',
    phone: '9234567890', whatsapp: '9234567890', role: 'HR Manager',
    department: 'HR', designation: 'HR Manager', dateOfJoining: '2022-06-01',
    salary: 60000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'B+',
    status: 'Active', fatherName: 'Suresh Patel', motherName: 'Meena Patel',
    foodPref: 'Veg', address: '789 Garden Rd, Ahmedabad',
    password: 'priya123', pan: 'CDEFG3456H', aadhaar: '3456-7890-1234',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
  {
    uuid: 'a1b2c3d4-0004-4e5f-8a9b-000000000004',
    id: 4, employeeId: 'EMP-004',
    name: 'Arjun Nair', email: 'arjun@zsmeservices.com',
    phone: '9345678901', whatsapp: '9345678901', role: 'Backend User',
    department: 'Backend', designation: 'Web Developer', dateOfJoining: '2023-01-10',
    salary: 55000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'AB+',
    status: 'Active', fatherName: 'Vijay Nair', motherName: 'Lakshmi Nair',
    foodPref: 'Non-Veg', address: '321 Tech Park, Bangalore',
    password: 'arjun123', pan: 'DEFGH4567I', aadhaar: '4567-8901-2345',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
  {
    uuid: 'a1b2c3d4-0005-4e5f-8a9b-000000000005',
    id: 5, employeeId: 'EMP-005',
    name: 'Sneha Gupta', email: 'sneha@zsmeservices.com',
    phone: '9456789012', whatsapp: '9456789012', role: 'Sales Agent',
    department: 'Sales', designation: 'Web Consultant', dateOfJoining: '2023-04-20',
    salary: 42000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'O-',
    status: 'Active', fatherName: 'Ramesh Gupta', motherName: 'Kavita Gupta',
    foodPref: 'Veg', address: '567 Market St, Pune',
    password: 'sneha123', pan: 'EFGHI5678J', aadhaar: '5678-9012-3456',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
  {
    uuid: 'a1b2c3d4-0006-4e5f-8a9b-000000000006',
    id: 6, employeeId: 'EMP-006',
    name: 'Vikram Singh', email: 'vikram@zsmeservices.com',
    phone: '9567890123', whatsapp: '9567890123', role: 'Accounts',
    department: 'Accounts', designation: 'Accountant', dateOfJoining: '2022-09-01',
    salary: 50000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'A-',
    status: 'Active', fatherName: 'Harbhajan Singh', motherName: 'Gurpreet Singh',
    foodPref: 'Non-Veg', address: '890 Finance Blvd, Chennai',
    password: 'vikram123', pan: 'FGHIJ6789K', aadhaar: '6789-0123-4567',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
  {
    uuid: 'a1b2c3d4-0007-4e5f-8a9b-000000000007',
    id: 7, employeeId: 'EMP-007',
    name: 'Neha Verma', email: 'neha@zsmeservices.com',
    phone: '9678901234', whatsapp: '9678901234', role: 'Graphics Manager',
    department: 'Graphics', designation: 'Graphics Manager', dateOfJoining: '2023-06-01',
    salary: 65000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'B+',
    status: 'Active', fatherName: 'Ravi Verma', motherName: 'Sunita Verma',
    foodPref: 'Veg', address: '123 Design District, Noida',
    password: 'neha123', pan: 'GHIJK7890L', aadhaar: '7890-1234-5678',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
  {
    uuid: 'a1b2c3d4-0008-4e5f-8a9b-000000000008',
    id: 8, employeeId: 'EMP-008',
    name: 'Rohan Desai', email: 'rohan.d@zsmeservices.com',
    phone: '9789012345', whatsapp: '9789012345', role: 'Graphic Designer',
    department: 'Graphics', designation: 'Graphic Designer', dateOfJoining: '2023-08-15',
    salary: 45000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'A+',
    status: 'Active', fatherName: 'Mohan Desai', motherName: 'Anita Desai',
    foodPref: 'Veg', address: '456 Creative Hub, Pune',
    password: 'rohan123', pan: 'JKLMN8901P', aadhaar: '8901-2345-6789',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
  {
    uuid: 'a1b2c3d4-0009-4e5f-8a9b-000000000009',
    id: 9, employeeId: 'EMP-009',
    name: 'Kavya Sharma', email: 'kavya@zsmeservices.com',
    phone: '9890123456', whatsapp: '9890123456', role: 'Jr. Graphic Designer',
    department: 'Graphics', designation: 'Junior Graphic Designer', dateOfJoining: '2024-02-01',
    salary: 30000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'O+',
    status: 'Active', fatherName: 'Rajeev Sharma', motherName: 'Neelam Sharma',
    foodPref: 'Non-Veg', address: '789 Art Street, Bangalore',
    password: 'kavya123', pan: 'LMNOP9012Q', aadhaar: '9012-3456-7890',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
  {
    uuid: 'a1b2c3d4-0010-4e5f-8a9b-000000000010',
    id: 10, employeeId: 'EMP-010',
    name: 'Arun Mehta', email: 'arun.m@zsmeservices.com',
    phone: '9901234567', whatsapp: '9901234567', role: 'Video Editor',
    department: 'Graphics', designation: 'Video Editor', dateOfJoining: '2023-11-20',
    salary: 40000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'B-',
    status: 'Active', fatherName: 'Kishore Mehta', motherName: 'Radhika Mehta',
    foodPref: 'Veg', address: '321 Film Nagar, Hyderabad',
    password: 'arun123', pan: 'MNOPQ0123R', aadhaar: '0123-4567-8901',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
  {
    uuid: 'a1b2c3d4-0011-4e5f-8a9b-000000000011',
    id: 11, employeeId: 'EMP-011',
    name: 'Pooja Iyer', email: 'pooja@zsmeservices.com',
    phone: '9012345678', whatsapp: '9012345678', role: 'Motion Graphic Designer',
    department: 'Graphics', designation: 'Motion Graphic Designer', dateOfJoining: '2024-04-10',
    salary: 55000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'AB+',
    status: 'Active', fatherName: 'Sridhar Iyer', motherName: 'Lalitha Iyer',
    foodPref: 'Non-Veg', address: '654 Animation Zone, Chennai',
    password: 'pooja123', pan: 'NOPQR1234S', aadhaar: '1234-5678-9013',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
  },
];

// Ensure directory exists
const dir = path.dirname(USERS_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
console.log(`✅ Seeded ${users.length} users into ${USERS_FILE}`);

// Also clear localStorage hint — print instructions
console.log('\n📋 Next steps:');
console.log('  1. Open browser DevTools → Application → Local Storage → http://localhost:3000');
console.log('  2. Delete the key: zsm_crm_users');
console.log('  3. Refresh the page — backend will be the source of truth');
