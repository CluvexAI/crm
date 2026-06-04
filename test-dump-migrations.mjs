import fs from 'fs';
import path from 'path';

async function run() {
  const dir = 'h:/zsmeservices-crm/crm/migrations';
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf-8');
    if (content.toLowerCase().includes('trigger') || content.toLowerCase().includes('insert into crm_leads')) {
      console.log('---', f, '---');
      console.log(content.split('\n').filter(l => l.toLowerCase().includes('insert') || l.toLowerCase().includes('trigger')).join('\n'));
    }
  }
}
run();
