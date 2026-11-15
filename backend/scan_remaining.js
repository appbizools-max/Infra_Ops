const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'src/index.ts'), 'utf8');
const lines = src.split('\n');

const regex = /app\.(get|post|put|patch|delete)\(\s*(?:\[([^\]]+)\]|['"`]([^'"`]+)['"`])/;
for (let i = 0; i < lines.length; i++) {
  const match = lines[i].match(regex);
  if (match) {
    const rawPath = match[3] || match[2] || '';
    const cleanPath = rawPath.split(',')[0].replace(/['"`]/g, '').trim();
    console.log(`L${i + 1}: ${lines[i].match(/app\.(get|post|put|patch|delete)/)[1].toUpperCase()} ${cleanPath}`);
  }
}
