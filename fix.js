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
        if (!content.includes('const API_BASE = process.env.REACT_APP_API_URL')) {
          // add after imports
          const importMatches = [...content.matchAll(/^import .*?;?\n/gm)];
          let insertIdx = 0;
          if (importMatches.length > 0) {
            const lastMatch = importMatches[importMatches.length - 1];
            insertIdx = lastMatch.index + lastMatch[0].length;
          }
          content = content.slice(0, insertIdx) + "\nconst API_BASE = process.env.REACT_APP_API_URL || '';\n" + content.slice(insertIdx);
        }
        content = content.replace(/fetch\('(\/api\/[^']+)'/g, "fetch(`${API_BASE}$1`");
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

processDir('src');
console.log('Done');
