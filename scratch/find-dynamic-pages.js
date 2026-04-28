const fs = require('fs');
const path = require('path');

function findPages(dir, results = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findPages(fullPath, results);
    } else if (file === 'page.tsx') {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (
        content.includes('cookies(') ||
        content.includes('headers(') ||
        content.includes('createClient(') ||
        content.includes('auth(') ||
        content.includes('getUser(') ||
        content.includes('searchParams') ||
        content.includes('redirect(')
      ) {
        if (!content.includes('export const dynamic = "force-dynamic"')) {
          results.push(fullPath);
        }
      }
    }
  }
  return results;
}

const appDir = path.join(process.cwd(), 'src/app');
const pages = findPages(appDir);
console.log(JSON.stringify(pages, null, 2));
