async function test() {
  const fetch = (await import('node-fetch')).default;
  try {
    const res = await fetch('https://zsm-crm-backend.onrender.com/api/attendance');
    const text = await res.text();
    console.log('Response:', res.status, text.slice(0, 100));
  } catch (e) {
    console.error(e.message);
  }
}
test();
