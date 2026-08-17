import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixNullPoSuppliers() {
  console.log('=== PO Supplier Consistency Fix ===');
  
  // 1. Fetch first valid supplier ID from suppliers table
  const { data: supplier, error: sErr } = await supabase
    .from('suppliers')
    .select('supplier_id, supplier_name')
    .eq('supplier_code', 'SUP-1001')
    .single();

  if (sErr || !supplier) {
    console.error('Could not find SUP-1001 supplier to use as default:', sErr?.message);
    return;
  }
  console.log(`Using default supplier: ${supplier.supplier_name} (ID: ${supplier.supplier_id})`);

  // 2. Fetch count of POs with null supplier_id
  const { count, error: countErr } = await supabase
    .from('purchase_orders')
    .select('*', { count: 'exact', head: true })
    .is('supplier_id', null);

  if (countErr) {
    console.error('Error counting null-supplier POs:', countErr.message);
    return;
  }

  console.log(`Found ${count} POs with null supplier_id.`);

  if (count === 0) {
    console.log('No POs with null supplier_id found. Database is consistent!');
    return;
  }

  // 3. Update all POs with null supplier_id to point to SUP-1001
  const { data: updated, error: updateErr } = await supabase
    .from('purchase_orders')
    .update({ supplier_id: supplier.supplier_id })
    .is('supplier_id', null)
    .select('po_number');

  if (updateErr) {
    console.error('Failed to update POs:', updateErr.message);
  } else {
    console.log(`✅ Successfully updated ${updated.length} POs:`);
    console.log(updated.map(u => u.po_number).join(', '));
  }
}

fixNullPoSuppliers().catch(console.error);
