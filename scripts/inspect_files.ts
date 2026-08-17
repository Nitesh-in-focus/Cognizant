import * as fs from 'fs';
import * as path from 'path';

function inspect() {
  const filePath = path.resolve('src/pages/PurchaseOrders.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log('File length:', content.length);

  // Search for how suppliers is accessed on po objects
  const regex = /po\.suppliers/gi;
  let match;
  console.log('Matches for po.suppliers:');
  while ((match = regex.exec(content)) !== null) {
    console.log(`Found match at index ${match.index}: ${content.substring(match.index - 50, match.index + 50)}`);
  }

  // Also search for suppliers? or suppliers.
  const regex2 = /po\?\.\w+/gi;
  console.log('Matches for po?.something:');
  // Just print a count
  const count = (content.match(/\?\./g) || []).length;
  console.log('Optional chaining count:', count);
}

inspect();
