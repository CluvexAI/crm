const ADMIN_KEY = 'ik_b3885d51d56e5cd4d58d5b21fefa58d7';
fetch('https://7xxqu53k.ap-southeast.insforge.app/api/database/advance/rawsql', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + ADMIN_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: "NOTIFY pgrst, 'reload schema';" })
})
.then(r => r.json())
.then(d => console.log('Reloaded schema cache:', d))
.catch(e => console.error(e));
