import * as fs from 'fs';
import * as path from 'path';

function inspect() {
  const filePath = path.resolve('src/pages/Exceptions.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log('Exceptions.tsx length:', content.length);

  // Search for how details of matching are evaluated
  const terms = ['mismatch', 'resolve', 'match_status', '3-way'];
  terms.forEach(term => {
    const count = (content.match(new RegExp(term, 'gi')) || []).length;
    console.log(`Term "${term}" occurs ${count} times.`);
  });
}

inspect();
