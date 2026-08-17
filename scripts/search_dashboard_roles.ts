import * as fs from 'fs';
import * as path from 'path';

function inspect() {
  const filePath = path.resolve('src/pages/Dashboard.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    if (line.includes('role ===') || line.includes('role !==') || line.includes('UserRole') || line.includes('roles.')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}

inspect();
