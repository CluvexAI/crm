const REAL_USERS = [
  { name: 'Achena Aich', email: 'achena.aich@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Admin User', email: 'admin@zsmeservices.com', role: 'Admin' },
  { name: 'Arindam Samanta', email: 'arindam.samanta@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Arshee Khatoon', email: 'arshee.khatoon@zsmeservices.com', role: 'Sales Agent', uuid: '2eab48d9-b005-4a6b-b1bb-bfb481de316b' },
  { name: 'Chayan Gayen', email: 'chayan.gayen@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Ehtesham Nasim', email: 'ehtesham.nasim@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Gourab Das', email: 'gourab.das@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Mahin Khan', email: 'mahin.khan@zsmeservices.com', role: 'Sales Agent' },
  { name: 'MD Rizwan Hussain', email: 'mdrizwan.hussain@zsmeservices.com', role: 'Sales Agent' },
  { name: 'MD. Ayan', email: 'md.ayan@zsmeservices.com', role: 'Sales Agent', uuid: '0f8d95b7-e071-4c1a-a1ea-74b5ad632639' },
  { name: 'Mdkhurram Khan', email: 'mdkhurram.khan@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Moumita Acharya', email: 'moumita.acharya@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Moumita Acharya (HR)', email: 'hr@zsmeservices.com', role: 'HR' },
  { name: 'Muzammil Hussain', email: 'muzammil.hussain@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Pallabi Kundu', email: 'pallabi.kundu@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Priyanka Ghosh', email: 'priyanka.ghosh@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Radha Rani', email: 'radha.rani@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Shazia Parveen', email: 'shazia.parveen@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Siddhartha Maity', email: 'siddhartha.maity@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Tanmoy Mondal', email: 'tanmoy.mondal@zsmeservices.com', role: 'Sales Agent' },
  { name: 'Titli Sarkar', email: 'titli.sarkar@zsmeservices.com', role: 'Sales Agent' }
];

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

console.log('-- INSERT REAL USERS (Fixing integer ID issue)');
REAL_USERS.forEach((u, i) => {
  const id = 100 + i; // safe integer ID
  const uuid = u.uuid || generateUUID();
  console.log(`INSERT INTO users (id, uuid, name, email, role, status) VALUES (${id}, '${uuid}', '${u.name.replace(/'/g, "''")}', '${u.email}', '${u.role}', 'Active') ON CONFLICT (email) DO NOTHING;`);
});
