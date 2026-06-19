const { createClient } = require('@insforge/sdk');
const c = createClient({ baseUrl: 'http://a', anonKey: 'b' });
console.log(Object.keys(c.auth).filter(k => k.toLowerCase().includes('update')));
