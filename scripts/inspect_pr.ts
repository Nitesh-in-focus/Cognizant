import * as fs from 'fs';
import * as path from 'path';

function inspect() {
  const filePath = path.resolve('src/pages/PurchaseRequisitions.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  console.log('File lines count:', lines.length);

  lines.forEach((line, index) => {
    if (line.includes('purchase_orders')) {
      console.log(`Match at line ${index + 1}: ${line.trim()}`);
      // Print 3 lines before and 15 lines after if it looks like an insert or query
      if (line.includes('insert') || (lines[index + 1] && lines[index + 1].includes('insert')) || (lines[index - 1] && lines[index - 1].includes('from'))) {
        const start = Math.max(0, index - 3);
        const end = Math.min(lines.length - 1, index + 15);
        for (let i = start; i <= end; i++) {
          console.log(`  ${i + 1}: ${lines[i]}`);
        }
        console.log('--------------------------------------------------');
      }
    }
  });
}

inspect();
