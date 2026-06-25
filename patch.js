const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server', 'index.js');
let code = fs.readFileSync(file, 'utf8');

const regex = /const \{ createClient \} = require\('@insforge\/sdk'\);[\s\S]*?console\.error\('Failed to init InsForge client for LLM routes', err\);\s*\}\s*\}/;

const replacement = `const reqInsforge = async (table, method, body = null, query = '') => {
  const url = \`\${process.env.REACT_APP_INSFORGE_URL}/rest/v1/\${table}\${query}\`;
  const headers = { 
    'apikey': process.env.INSFORGE_API_KEY || process.env.REACT_APP_INSFORGE_ANON_KEY, 
    'Authorization': \`Bearer \${process.env.INSFORGE_API_KEY || process.env.REACT_APP_INSFORGE_ANON_KEY}\`, 
    'Content-Type': 'application/json', 
    'Prefer': 'return=representation' 
  };
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const e = await res.json().catch(()=>({}));
    throw new Error(e.message || res.statusText);
  }
  return res.json();
};
const insforgeClient = { 
  from: (table) => ({ 
    select: (cols) => ({ 
      limit: (n) => ({ 
        maybeSingle: async () => { 
          try { 
            const data = await reqInsforge(table, 'GET', null, \`?select=\${cols}&limit=\${n}\`); 
            return { data: data[0] || null, error: null }; 
          } catch (error) { return { data: null, error }; } 
        } 
      }) 
    }), 
    insert: async (payloads) => { 
      try { 
        const data = await reqInsforge(table, 'POST', payloads); 
        return { data, error: null }; 
      } catch (error) { return { data: null, error }; } 
    }, 
    update: (payload) => ({ 
      eq: async (col, val) => { 
        try { 
          const data = await reqInsforge(table, 'PATCH', payload, \`?\${col}=eq.\${val}\`); 
          return { data, error: null }; 
        } catch (error) { return { data: null, error }; } 
      } 
    }) 
  }) 
};`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(file, code, 'utf8');
  console.log('Patched successfully');
} else {
  console.log('Regex did not match!');
}
