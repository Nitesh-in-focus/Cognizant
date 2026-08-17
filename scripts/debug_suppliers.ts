import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugSuppliers() {
  console.log('--- Fetching All Suppliers ---');
  const { data: suppliers, error: sErr } = await supabase
    .from('suppliers')
    .select('supplier_id, supplier_code, supplier_name');
  
  if (sErr) {
    console.error('Error fetching suppliers:', sErr.message);
    return;
  }
  console.log(`Found ${suppliers.length} suppliers:`);
  console.log(suppliers);

  console.log('\n--- Fetching Purchase Orders with Supplier ID ---');
  const { data: pos, error: pErr } = await supabase
    .from('purchase_orders')
    .select('po_number, supplier_id');
  
  if (pErr) {
    console.error('Error fetching POs:', pErr.message);
    return;
  }

  console.log(`Found ${pos.length} POs.`);
  
  const supplierIds = new Set(suppliers.map(s => s.supplier_id));
  let unmatchedCount = 0;
  
  for (const po of pos) {
    if (!supplierIds.has(po.supplier_id)) {
      console.log(`❌ PO ${po.po_number} has unmatched supplier_id: ${po.supplier_id}`);
      unmatchedCount++;
    }
  }

  if (unmatchedCount === 0) {
    console.log('✅ All PO supplier_id values match valid suppliers!');
  } else {
    console.log(`❌ Found ${unmatchedCount} POs with unmatched supplier_id values!`);
  }
}

debugSuppliers().catch(console.error);
