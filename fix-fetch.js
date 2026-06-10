const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes("fetch('/api/")) {
        console.log('Updating: ' + fullPath);
        // Replace fetch('/api/...') with fetch((process.env.REACT_APP_API_URL || '') + '/api/...')
        content = content.replace(/fetch\('(\/api\/[^']+)'/g, "fetch((process.env.REACT_APP_API_URL || '') + '$1'");
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

processDir('src');
console.log('Done replacement');
