// Mock data store for ZSM CRM

export const ROLES = {
  ADMIN: 'Admin',
  HR: 'HR',
  SALES: 'Sales Agent',
  BACKEND: 'Backend User',
  ACCOUNTS: 'Accounts',
  SUPPORT: 'Support',
  QUALITY: 'Quality',
  TRAINEE: 'Trainee',
};

export const DEPARTMENTS = ['Sales', 'Backend', 'HR', 'Accounts', 'Support', 'Quality', 'Management'];

export const PROPOSAL_TYPES = [
  'GMB Plan', 'SEO Plan', 'Web Design Plan', 'SEM Plan', 'Google Ads Plan',
  'Graphic Design Plan', 'Website Management Plan', 'Logo Design Plan',
  'Visiting Card Design Plan', 'Review Scanner', 'GMB Support Plan', 'E-commerce Plan',
];

export const LEAD_STATUSES = ['New Lead', 'Follow-Up', 'Pending', 'Closed (Won)', 'Closed (Lost)', 'Expired'];

export const BUSINESS_CATEGORIES = [
  'Retail', 'Restaurant', 'Healthcare', 'Real Estate', 'Technology',
  'Education', 'Manufacturing', 'Finance', 'Legal', 'Hospitality', 'Other',
];

export const users = [
  {
    // ── Internal immutable system identity (UUID — Primary Key) ──
    uuid: 'a1b2c3d4-0001-4e5f-8a9b-000000000001',
    // ── Business-facing identifier (editable by Admin) ──
    id: 1, employeeId: 'EMP-001',
    name: 'Admin User', email: 'admin@zsm.com',
    phone: '9876543210', whatsapp: '9876543210', role: ROLES.ADMIN,
    department: 'Management', designation: 'CEO', dateOfJoining: '2022-01-01',
    salary: 150000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'O+',
    status: 'Active', fatherName: 'Mr. Admin Sr.', motherName: 'Mrs. Admin',
    foodPref: 'Non-Veg', address: '123 Main St, Mumbai',
    password: 'admin123', pan: 'ABCDE1234F', aadhaar: '1234-5678-9012',
    // ── Profile Image (URL + metadata stored; binary never in DB) ──
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
  },
  {
    uuid: 'a1b2c3d4-0002-4e5f-8a9b-000000000002',
    id: 2, employeeId: 'EMP-002',
    name: 'Rahul Sharma', email: 'rahul@zsm.com',
    phone: '9123456789', whatsapp: '9123456789', role: ROLES.SALES,
    department: 'Sales', designation: 'Sales Executive', dateOfJoining: '2022-03-15',
    salary: 45000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'A+',
    status: 'Active', fatherName: 'Rajesh Sharma', motherName: 'Priya Sharma',
    foodPref: 'Veg', address: '456 Park Ave, Delhi',
    password: 'rahul123', pan: 'BCDEF2345G', aadhaar: '2345-6789-0123',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
  },
  {
    uuid: 'a1b2c3d4-0003-4e5f-8a9b-000000000003',
    id: 3, employeeId: 'EMP-003',
    name: 'Priya Patel', email: 'priya@zsm.com',
    phone: '9234567890', whatsapp: '9234567890', role: ROLES.HR,
    department: 'HR', designation: 'HR Manager', dateOfJoining: '2022-06-01',
    salary: 60000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'B+',
    status: 'Active', fatherName: 'Suresh Patel', motherName: 'Meena Patel',
    foodPref: 'Veg', address: '789 Garden Rd, Ahmedabad',
    password: 'priya123', pan: 'CDEFG3456H', aadhaar: '3456-7890-1234',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
  },
  {
    uuid: 'a1b2c3d4-0004-4e5f-8a9b-000000000004',
    id: 4, employeeId: 'EMP-004',
    name: 'Arjun Nair', email: 'arjun@zsm.com',
    phone: '9345678901', whatsapp: '9345678901', role: ROLES.BACKEND,
    department: 'Backend', designation: 'Web Developer', dateOfJoining: '2023-01-10',
    salary: 55000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'AB+',
    status: 'Active', fatherName: 'Vijay Nair', motherName: 'Lakshmi Nair',
    foodPref: 'Non-Veg', address: '321 Tech Park, Bangalore',
    password: 'arjun123', pan: 'DEFGH4567I', aadhaar: '4567-8901-2345',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
  },
  {
    uuid: 'a1b2c3d4-0005-4e5f-8a9b-000000000005',
    id: 5, employeeId: 'EMP-005',
    name: 'Sneha Gupta', email: 'sneha@zsm.com',
    phone: '9456789012', whatsapp: '9456789012', role: ROLES.SALES,
    department: 'Sales', designation: 'Web Consultant', dateOfJoining: '2023-04-20',
    salary: 42000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'O-',
    status: 'Active', fatherName: 'Ramesh Gupta', motherName: 'Kavita Gupta',
    foodPref: 'Veg', address: '567 Market St, Pune',
    password: 'sneha123', pan: 'EFGHI5678J', aadhaar: '5678-9012-3456',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
  },
  {
    uuid: 'a1b2c3d4-0006-4e5f-8a9b-000000000006',
    id: 6, employeeId: 'EMP-006',
    name: 'Vikram Singh', email: 'vikram@zsm.com',
    phone: '9567890123', whatsapp: '9567890123', role: ROLES.ACCOUNTS,
    department: 'Accounts', designation: 'Accountant', dateOfJoining: '2022-09-01',
    salary: 50000, shift: '9:00 AM - 6:00 PM', bloodGroup: 'A-',
    status: 'Active', fatherName: 'Harbhajan Singh', motherName: 'Gurpreet Singh',
    foodPref: 'Non-Veg', address: '890 Finance Blvd, Chennai',
    password: 'vikram123', pan: 'FGHIJ6789K', aadhaar: '6789-0123-4567',
    profileImageUrl: null, profileImageSize: null, profileImageType: null,
    profileImageName: null, profileImageUploadedAt: null,
  },
];

export const leads = [
  {
    id: 1, contactName: 'Rohan Mehta', businessName: 'Mehta Textiles',
    ownerPhone: '+917890123456', altPhone: '+917890123457', website: 'www.mehtatextiles.com',
    country: 'India', address: '12 Trade Center, Mumbai', county: 'Maharashtra',
    email: 'rohan@mehtatextiles.com', businessCategory: 'Retail',
    status: 'Follow-Up', createdBy: 2, assignedTo: 2,
    followUpResult: 'Interested in Web Design', city: 'Mumbai',
    companyType: 'Private Ltd', remarks: [
      { text: 'Initial contact made, interested in website', timestamp: '2026-04-15T10:30:00Z', by: 'Rahul Sharma' },
      { text: 'Called again, asked for proposal', timestamp: '2026-04-18T14:00:00Z', by: 'Rahul Sharma' },
    ],
    createdAt: '2026-04-15T09:00:00Z', lastFollowUp: '2026-04-18T14:00:00Z',
    proposalType: 'Web Design Plan',
  },
  {
    id: 2, contactName: 'Anjali Krishnan', businessName: 'AK Restaurants',
    ownerPhone: '+918901234567', altPhone: '', website: '',
    country: 'India', address: '56 Food Street, Bangalore', county: 'Karnataka',
    email: 'anjali@akrestaurants.com', businessCategory: 'Restaurant',
    status: 'New Lead', createdBy: 2, assignedTo: 2,
    followUpResult: '', city: 'Bangalore',
    companyType: 'Proprietorship', remarks: [
      { text: 'First call made, callback requested', timestamp: '2026-04-19T11:00:00Z', by: 'Rahul Sharma' },
    ],
    createdAt: '2026-04-19T10:00:00Z', lastFollowUp: '2026-04-19T11:00:00Z',
    proposalType: 'GMB Plan',
  },
  {
    id: 3, contactName: 'Deepak Kumar', businessName: 'DK Healthcare',
    ownerPhone: '+919012345678', altPhone: '+919012345679', website: 'www.dkhealthcare.com',
    country: 'India', address: '789 Medical Lane, Delhi', county: 'Delhi',
    email: 'deepak@dkhealthcare.com', businessCategory: 'Healthcare',
    status: 'Closed (Won)', createdBy: 5, assignedTo: 5,
    followUpResult: 'Closed', city: 'Delhi',
    companyType: 'Private Ltd', remarks: [
      { text: 'Deal closed for SEO Plan', timestamp: '2026-04-10T16:00:00Z', by: 'Sneha Gupta' },
    ],
    createdAt: '2026-04-01T09:00:00Z', lastFollowUp: '2026-04-10T16:00:00Z',
    proposalType: 'SEO Plan',
  },
  {
    id: 4, contactName: 'Fatima Sheikh', businessName: 'Sheikh Boutique',
    ownerPhone: '+918123456789', altPhone: '', website: '',
    country: 'India', address: '34 Fashion St, Hyderabad', county: 'Telangana',
    email: 'fatima@sheikhboutique.com', businessCategory: 'Retail',
    status: 'Pending', createdBy: 2, assignedTo: 2,
    followUpResult: 'Thinking', city: 'Hyderabad',
    companyType: 'Proprietorship', remarks: [
      { text: 'Sent proposal, awaiting decision', timestamp: '2026-04-17T13:00:00Z', by: 'Rahul Sharma' },
    ],
    createdAt: '2026-04-12T09:00:00Z', lastFollowUp: '2026-04-17T13:00:00Z',
    proposalType: 'GMB Plan',
  },
  {
    id: 5, contactName: 'Prakash Iyer', businessName: 'Iyer Law Associates',
    ownerPhone: '+919234567891', altPhone: '', website: 'www.iyerlaw.com',
    country: 'India', address: '100 Court Road, Chennai', county: 'Tamil Nadu',
    email: 'prakash@iyerlaw.com', businessCategory: 'Legal',
    status: 'Follow-Up', createdBy: 5, assignedTo: 5,
    followUpResult: 'Interested', city: 'Chennai',
    companyType: 'Partnership', remarks: [
      { text: 'Very interested in SEO + Google Ads combo', timestamp: '2026-04-20T10:00:00Z', by: 'Sneha Gupta' },
    ],
    createdAt: '2026-04-16T09:00:00Z', lastFollowUp: '2026-04-20T10:00:00Z',
    proposalType: 'SEO Plan',
  },
];

export const sales = [
  {
    id: 1, leadId: 3, leadName: 'Deepak Kumar', businessName: 'DK Healthcare',
    closedBy: 5, closedByName: 'Sneha Gupta',
    proposalType: 'SEO Plan', amount: 25000,
    saleStatus: 'Closed', paymentStatus: 'Full Payment',
    invoiceStatus: 'Generated', invoiceId: 'INV-2026-001',
    createdAt: '2026-04-10T16:00:00Z',
    installments: 1, paidInstallments: 1,
  },
  {
    id: 2, leadId: 1, leadName: 'Rohan Mehta', businessName: 'Mehta Textiles',
    closedBy: 2, closedByName: 'Rahul Sharma',
    proposalType: 'Web Design Plan', amount: 35000,
    saleStatus: 'Pending', paymentStatus: 'Installments',
    invoiceStatus: 'Generated', invoiceId: 'INV-2026-002',
    createdAt: '2026-04-18T14:00:00Z',
    installments: 3, paidInstallments: 1,
  },
];

export const invoices = [
  {
    id: 'INV-2026-001', saleId: 1, leadName: 'DK Healthcare',
    amount: 25000, status: 'Paid',
    generatedDate: '2026-04-10', dueDate: '2026-04-25',
    items: [{ description: 'SEO Plan - 3 Months', amount: 25000 }],
  },
  {
    id: 'INV-2026-002', saleId: 2, leadName: 'Mehta Textiles',
    amount: 35000, status: 'Pending',
    generatedDate: '2026-04-18', dueDate: '2026-05-18',
    items: [{ description: 'Web Design Plan', amount: 35000 }],
  },
];

export const projects = [
  {
    id: 1, saleId: 1, projectName: 'DK Healthcare - SEO',
    clientName: 'DK Healthcare', assignedTo: 4, assignedToName: 'Arjun Nair',
    status: 'In Progress', startDate: '2026-04-12',
    wpUrl: 'www.dkhealthcare.com/wp-admin',
    wpUsername: 'admin_dkh',
    wpPassword: '****hidden****',
    domainRegistrar: 'GoDaddy',
    domainUsername: 'dkh_domain',
    domainPassword: '****hidden****',
    cpanelUser: 'dkh_cpanel',
    cpanelPass: '****hidden****',
    facebookPage: 'fb.com/dkhealthcare',
    gmailAcc: 'dkh@gmail.com',
    reports: [
      { date: '2026-04-13', summary: 'Completed keyword research and on-page optimization for 10 pages.', by: 'Arjun Nair', immutable: true },
      { date: '2026-04-15', summary: 'Built 5 quality backlinks. Google Search Console connected.', by: 'Arjun Nair', immutable: true },
    ],
  },
  {
    id: 2, saleId: 2, projectName: 'Mehta Textiles - Web Design',
    clientName: 'Mehta Textiles', assignedTo: 4, assignedToName: 'Arjun Nair',
    status: 'Planning', startDate: '2026-04-20',
    wpUrl: '',
    wpUsername: '',
    wpPassword: '',
    domainRegistrar: 'Namecheap',
    domainUsername: 'mehta_nc',
    domainPassword: '****hidden****',
    cpanelUser: '',
    cpanelPass: '',
    facebookPage: '',
    gmailAcc: 'mehtabiz@gmail.com',
    reports: [],
  },
];

export const attendance = [
  { id: 1, userId: 2, userName: 'Rahul Sharma', date: '2026-04-20', loginTime: '09:02:00', logoutTime: null, breaks: [], meetings: [], status: 'Present' },
  { id: 2, userId: 3, userName: 'Priya Patel', date: '2026-04-20', loginTime: '09:10:00', logoutTime: null, breaks: [], meetings: [], status: 'Present' },
  { id: 3, userId: 4, userName: 'Arjun Nair', date: '2026-04-20', loginTime: '09:05:00', logoutTime: null, breaks: [], meetings: [], status: 'Present' },
  { id: 4, userId: 5, userName: 'Sneha Gupta', date: '2026-04-20', loginTime: '09:15:00', logoutTime: null, breaks: [], meetings: [], status: 'Present' },
  { id: 5, userId: 6, userName: 'Vikram Singh', date: '2026-04-20', loginTime: '09:08:00', logoutTime: null, breaks: [], meetings: [], status: 'Present' },
  { id: 6, userId: 2, userName: 'Rahul Sharma', date: '2026-04-19', loginTime: '09:00:00', logoutTime: '18:02:00', breaks: [{ in: '13:00', out: '13:30' }], meetings: [], status: 'Present' },
  { id: 7, userId: 3, userName: 'Priya Patel', date: '2026-04-19', loginTime: '09:05:00', logoutTime: '17:55:00', breaks: [], meetings: [], status: 'Present' },
];

export const leaveRequests = [
  {
    id: 1, userId: 2, userName: 'Rahul Sharma', type: 'Full Day',
    date: '2026-04-25', reason: 'Personal work',
    status: 'Pending', appliedOn: '2026-04-20',
  },
  {
    id: 2, userId: 5, userName: 'Sneha Gupta', type: 'Half Day',
    date: '2026-04-22', reason: 'Medical appointment',
    status: 'Approved', appliedOn: '2026-04-19',
  },
];

export const messages = [
  {
    id: 1, fromId: 1, toId: 2, fromName: 'Admin User', toName: 'Rahul Sharma',
    message: 'Great work on the DK Healthcare deal!', timestamp: '2026-04-20T09:30:00Z', read: true,
  },
  {
    id: 2, fromId: 2, toId: 1, fromName: 'Rahul Sharma', toName: 'Admin User',
    message: 'Thank you! Working on Mehta Textiles proposal now.', timestamp: '2026-04-20T09:35:00Z', read: true,
  },
  {
    id: 3, fromId: 3, toId: 2, fromName: 'Priya Patel', toName: 'Rahul Sharma',
    message: 'Reminder: attendance review this Friday.', timestamp: '2026-04-20T10:00:00Z', read: false,
  },
];

export const auditLogs = [
  { id: 1, action: 'User Login', user: 'Admin User', timestamp: '2026-04-20T08:55:00Z', details: 'Successful login' },
  { id: 2, action: 'Lead Created', user: 'Rahul Sharma', timestamp: '2026-04-20T09:10:00Z', details: 'Lead: Anjali Krishnan (AK Restaurants)' },
  { id: 3, action: 'Sale Closed', user: 'Sneha Gupta', timestamp: '2026-04-20T09:45:00Z', details: 'Sale #2 - Web Design Plan - ₹35,000' },
  { id: 4, action: 'Invoice Generated', user: 'Vikram Singh', timestamp: '2026-04-20T10:00:00Z', details: 'INV-2026-002 for Mehta Textiles' },
  { id: 5, action: 'Project Assigned', user: 'Admin User', timestamp: '2026-04-20T10:15:00Z', details: 'Project: Mehta Textiles assigned to Arjun Nair' },
];
