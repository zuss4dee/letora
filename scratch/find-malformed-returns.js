const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const pattern = /return\s*\(\s*className=\{cn\(/;

walk('src', (file) => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    const content = fs.readFileSync(file, 'utf8');
    if (pattern.test(content)) {
      console.log(`FOUND: ${file}`);
      // Find the line number
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('className={cn(')) {
            // Check if previous non-empty line contains 'return ('
            let prev = i - 1;
            while (prev >= 0 && lines[prev].trim() === '') prev--;
            if (prev >= 0 && lines[prev].includes('return (')) {
                console.log(`  Line ${i + 1}: ${line.trim()}`);
            }
        }
      });
    }
  }
});
