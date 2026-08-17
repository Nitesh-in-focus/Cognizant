import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRelations() {
  console.log('--- Fetching POs with supplier_id = null ---');
  const { data: pos, error: pErr } = await supabase
    .from('purchase_orders')
    .select('po_id, po_number, status')
    .is('supplier_id', null);

  if (pErr) {
    console.error('Error fetching POs:', pErr.message);
    return;
  }

  console.log(`Found ${pos.length} POs with supplier_id = null.`);
  if (pos.length === 0) return;

  const poIds = pos.map(po => po.po_id);

  console.log('\n--- Checking Linked Shipments ---');
  const { data: shipments, error: shErr } = await supabase
    .from('shipments')
    .select('shipment_id, shipment_number, po_id, status')
    .in('po_id', poIds);

  if (shErr) {
    console.error('Error fetching shipments:', shErr.message);
  } else {
    console.log(`Found ${shipments.length} shipments linked to these POs:`);
    shipments.forEach(s => {
      const parentPo = pos.find(po => po.po_id === s.po_id);
      console.log(`  Shipment ${s.shipment_number} (status: ${s.status}) linked to PO ${parentPo?.po_number}`);
    });
  }

  console.log('\n--- Checking Linked Invoices ---');
  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select('invoice_id, invoice_number, po_id, match_status')
    .in('po_id', poIds);

  if (invErr) {
    console.error('Error fetching invoices:', invErr.message);
  } else {
    console.log(`Found ${invoices.length} invoices linked to these POs:`);
    invoices.forEach(inv => {
      const parentPo = pos.find(po => po.po_id === inv.po_id);
      console.log(`  Invoice ${inv.invoice_number} (match_status: ${inv.match_status}) linked to PO ${parentPo?.po_number}`);
    });
  }

  console.log('\n--- Checking Linked Goods Receipts (GRNs) ---');
  const { data: grns, error: grnErr } = await supabase
    .from('goods_receipts')
    .select('grn_id, grn_number, po_id, status')
    .in('po_id', poIds);

  if (grnErr) {
    console.error('Error fetching GRNs:', grnErr.message);
  } else {
    console.log(`Found ${grns.length} GRNs linked to these POs:`);
    grns.forEach(grn => {
      const parentPo = pos.find(po => po.po_id === grn.po_id);
      console.log(`  GRN ${grn.grn_number} (status: ${grn.status}) linked to PO ${parentPo?.po_number}`);
    });
  }
}

checkRelations().catch(console.error);
