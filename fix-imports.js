const fs = require('fs');

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) {
     filePath = filePath.replace(/\\\\/g, '/');
     if (!fs.existsSync(filePath)) return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove existing API_BASE declaration
  const apiBaseRegex = /const API_BASE = process\.env\.REACT_APP_API_URL \|\| '';\r?\n?/g;
  content = content.replace(apiBaseRegex, '');

  let lastImportPos = content.lastIndexOf('import ');
  let lastFromPos = content.lastIndexOf("from '");
  if (content.lastIndexOf("from \"") > lastFromPos) lastFromPos = content.lastIndexOf("from \"");
  
  let maxPos = Math.max(lastImportPos, lastFromPos);
  
  if (maxPos !== -1) {
    let newlinePos = content.indexOf('\n', maxPos);
    if (newlinePos !== -1) {
       content = content.slice(0, newlinePos + 1) + "\nconst API_BASE = process.env.REACT_APP_API_URL || '';\n" + content.slice(newlinePos + 1);
    } else {
       content = content + "\n\nconst API_BASE = process.env.REACT_APP_API_URL || '';\n";
    }
  } else {
    content = "const API_BASE = process.env.REACT_APP_API_URL || '';\n\n" + content;
  }
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed: ' + filePath);
}

function walk(dir) {
   let results = [];
   const list = fs.readdirSync(dir);
   list.forEach(file => {
      file = dir + '/' + file;
      const stat = fs.statSync(file);
      if (stat && stat.isDirectory()) { 
         results = results.concat(walk(file));
      } else { 
         if (file.endsWith('.js') || file.endsWith('.jsx')) results.push(file);
      }
   });
   return results;
}

const allFiles = walk('src');
for (const file of allFiles) {
   let content = fs.readFileSync(file, 'utf8');
   if (content.includes('process.env.REACT_APP_API_URL')) {
      fixFile(file);
   }
}
