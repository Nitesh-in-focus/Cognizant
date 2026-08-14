import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
  console.log('====================================================');
  console.log('🔍 C2 Database Live Connection & Verification Check');
  console.log('====================================================\n');

  const tables = [
    'suppliers',
    'products',
    'warehouses',
    'purchase_requisitions',
    'pr_items',
    'purchase_orders',
    'po_items',
    'shipments',
    'trucks',
    'truck_locations',
    'yards',
    'docks',
    'yard_entries',
    'dock_assignments',
    'goods_receipts',
    'grn_items',
    'invoices',
    'invoice_items',
    'exceptions',
    'payments',
  ];

  console.log('--- Table Record Counts (Anonymous Web Client Role) ---');
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ ${t.padEnd(24)}: Error - ${error.message}`);
    } else {
      console.log(`✅ ${t.padEnd(24)}: ${count} rows`);
    }
  }

  console.log('\n--- Testing Frontend End-to-End Relational Query ---');
  const { data: pos, error: poErr } = await supabase
    .from('purchase_orders')
    .select(`
      po_number,
      total_amount,
      status,
      suppliers(supplier_name, city),
      purchase_requisitions(pr_number),
      shipments(shipment_number, status),
      invoices(invoice_number, match_status, payment_status)
    `)
    .limit(3);

  if (poErr) {
    console.error('❌ Relational Join Query Failed:', poErr.message);
  } else {
    console.log('✅ Successfully executed 5-table deep relational join:');
    console.log(JSON.stringify(pos, null, 2));
  }
}

checkDatabase().catch(console.error);
