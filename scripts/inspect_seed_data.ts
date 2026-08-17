import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';

// We need parseSqlTuples here or just require it. Let's write the parsing function in inspect_seed_data.ts
function parseSqlTuples(sql: string, tableName: string): Array<Record<string, any>> {
  const insertPrefix = `INSERT INTO ${tableName}`;
  const startIdx = sql.indexOf(insertPrefix);
  if (startIdx === -1) return [];

  const valuesIdx = sql.indexOf('VALUES', startIdx);
  if (valuesIdx === -1) return [];

  const colsHeader = sql.slice(startIdx + insertPrefix.length, valuesIdx).trim();
  const cols = colsHeader
    .replace(/^\(/, '')
    .replace(/\)$/, '')
    .split(',')
    .map((c) => c.trim());

  let semiIdx = sql.indexOf(';', valuesIdx);
  if (semiIdx === -1) semiIdx = sql.length;

  const rawValues = sql.slice(valuesIdx + 'VALUES'.length, semiIdx).trim();

  const tuples: string[] = [];
  let currentTuple = '';
  let inString = false;
  let depth = 0;

  for (let i = 0; i < rawValues.length; i++) {
    const char = rawValues[i];
    if (char === "'" && rawValues[i - 1] !== '\\') {
      inString = !inString;
      currentTuple += char;
    } else if (char === '(' && !inString) {
      depth++;
      if (depth === 1) {
        currentTuple = '';
      } else {
        currentTuple += char;
      }
    } else if (char === ')' && !inString) {
      depth--;
      if (depth === 0) {
        tuples.push(currentTuple.trim());
        currentTuple = '';
      } else {
        currentTuple += char;
      }
    } else {
      if (depth > 0) {
        currentTuple += char;
      }
    }
  }

  const rows: Array<Record<string, any>> = [];

  for (const t of tuples) {
    const vals: any[] = [];
    let curVal = '';
    let inValString = false;

    for (let j = 0; j < t.length; j++) {
      const c = t[j];
      if (c === "'" && t[j - 1] !== '\\') {
        inValString = !inValString;
      } else if (c === ',' && !inValString) {
        vals.push(formatSqlValue(curVal.trim()));
        curVal = '';
      } else {
        curVal += c;
      }
    }
    if (curVal.trim().length > 0) {
      vals.push(formatSqlValue(curVal.trim()));
    }

    const rowObj: Record<string, any> = {};
    cols.forEach((colName, index) => {
      rowObj[colName] = vals[index];
    });
    rows.push(rowObj);
  }

  return rows;
}

function formatSqlValue(val: string): any {
  if (val === 'NULL' || val === 'null') return null;
  if (val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1).replace(/''/g, "'");
  }
  if (!isNaN(Number(val))) {
    return Number(val);
  }
  if (val === 'TRUE' || val === 'true') return true;
  if (val === 'FALSE' || val === 'false') return false;
  return val;
}

function inspect() {
  const filePath = path.resolve('supabase/C2_synthetic_seed_data.sql');
  const content = fs.readFileSync(filePath, 'utf-8');
  const rawPOs = parseSqlTuples(content, 'purchase_orders');
  console.log('Number of parsed POs:', rawPOs.length);
  if (rawPOs.length > 0) {
    console.log('First parsed raw PO:', rawPOs[0]);
  }
}

inspect();
