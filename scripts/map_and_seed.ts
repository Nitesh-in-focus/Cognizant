import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * SQL Value Parser helper
 */
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

  // Split tuples like (val1, val2, ...), (val1, val2, ...)
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
    // Split tuple values respecting quoted strings
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

async function runSeed() {
  console.log('====================================================');
  console.log('🚀 Starting C2 Synthetic Seed Mapping & Ingestion');
  console.log('Target DB URL:', supabaseUrl);
  console.log('====================================================\n');

  const seedSql = fs.readFileSync(path.join(process.cwd(), 'supabase/C2_synthetic_seed_data.sql'), 'utf8');

  // 1. SUPPLIERS
  console.log('📦 Parsing & Mapping: suppliers...');
  const rawSuppliers = parseSqlTuples(seedSql, 'suppliers');
  const mappedSuppliers = rawSuppliers.map((s) => ({
    supplier_id: s.supplier_id,
    supplier_code: s.supplier_code,
    supplier_name: s.supplier_name,
    contact_person: s.supplier_name.split(' ')[0] + ' Operations Lead',
    email: s.email,
    phone: s.phone,
    city: s.city,
    address: `Plot ${Math.floor(10 + Math.random() * 90)}, MIDC Industrial Zone, ${s.city}`,
    status: s.status || 'ACTIVE',
    created_at: s.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: supErr } = await supabase.from('suppliers').upsert(mappedSuppliers);
  if (supErr) console.error('Error seeding suppliers:', supErr.message);
  else console.log(`✅ Seeded ${mappedSuppliers.length} suppliers successfully.`);

  // 2. PRODUCTS
  console.log('📦 Parsing & Mapping: products...');
  const rawProducts = parseSqlTuples(seedSql, 'products');
  const mappedProducts = rawProducts.map((p) => ({
    product_id: p.product_id,
    product_code: p.product_code,
    product_name: p.product_name,
    category: p.category || 'Industrial',
    unit_of_measure: p.unit || 'PCS',
    unit_price: p.unit_price,
    description: `${p.product_name} - Standard Industrial Grade OEM Component`,
    status: p.status || 'ACTIVE',
    created_at: p.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: prodErr } = await supabase.from('products').upsert(mappedProducts);
  if (prodErr) console.error('Error seeding products:', prodErr.message);
  else console.log(`✅ Seeded ${mappedProducts.length} products successfully.`);

  // 3. WAREHOUSES
  console.log('📦 Parsing & Mapping: warehouses...');
  const rawWarehouses = parseSqlTuples(seedSql, 'warehouses');
  const mappedWarehouses = rawWarehouses.map((w, idx) => ({
    warehouse_id: w.warehouse_id,
    warehouse_code: w.warehouse_code,
    warehouse_name: w.warehouse_name,
    city: w.city,
    address: `Central Logistics Terminal ${idx + 1}, ${w.city}`,
    latitude: 18.5204 + idx * 0.05,
    longitude: 73.8567 + idx * 0.05,
    total_docks: 6,
    status: w.status || 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: whErr } = await supabase.from('warehouses').upsert(mappedWarehouses);
  if (whErr) console.error('Error seeding warehouses:', whErr.message);
  else console.log(`✅ Seeded ${mappedWarehouses.length} warehouses successfully.`);

  // 4. PURCHASE REQUISITIONS
  console.log('📦 Parsing & Mapping: purchase_requisitions...');
  const rawPRs = parseSqlTuples(seedSql, 'purchase_requisitions');
  const mappedPRs = rawPRs.map((pr) => {
    let priority = 'MEDIUM';
    if (pr.priority_score >= 4 || pr.priority === 'HIGH') priority = 'HIGH';
    else if (pr.priority_score <= 1 || pr.priority === 'LOW') priority = 'LOW';
    else if (pr.priority_score === 5) priority = 'CRITICAL';

    return {
      pr_id: pr.pr_id,
      pr_number: pr.pr_number,
      warehouse_id: pr.warehouse_id,
      reason: pr.reason || 'Replenishment order for monthly production schedule',
      priority: priority,
      request_date: pr.requested_date || pr.created_at || new Date().toISOString(),
      required_date: pr.required_date || new Date().toISOString(),
      status: pr.status || 'APPROVED',
      approved_at: pr.status === 'APPROVED' ? pr.requested_date || new Date().toISOString() : null,
      created_at: pr.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: prErr } = await supabase.from('purchase_requisitions').upsert(mappedPRs);
  if (prErr) console.error('Error seeding purchase_requisitions:', prErr.message);
  else console.log(`✅ Seeded ${mappedPRs.length} purchase_requisitions successfully.`);

  // 5. PR ITEMS
  console.log('📦 Parsing & Mapping: pr_items...');
  const rawPRItems = parseSqlTuples(seedSql, 'pr_items');
  const mappedPRItems = rawPRItems.map((pri) => ({
    pr_item_id: pri.pr_item_id,
    pr_id: pri.pr_id,
    product_id: pri.product_id,
    requested_quantity: pri.quantity || pri.requested_quantity || 100,
    required_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: priErr } = await supabase.from('pr_items').upsert(mappedPRItems);
  if (priErr) console.error('Error seeding pr_items:', priErr.message);
  else console.log(`✅ Seeded ${mappedPRItems.length} pr_items successfully.`);

  // 6. PURCHASE ORDERS
  console.log('📦 Parsing & Mapping: purchase_orders...');
  const rawPOs = parseSqlTuples(seedSql, 'purchase_orders');
  const mappedPOs = rawPOs.map((po) => {
    const totalVal = Number(po.total_value || po.total_amount || 50000);
    const subtotal = Math.round((totalVal / 1.18) * 100) / 100;
    const tax = Math.round((totalVal - subtotal) * 100) / 100;

    return {
      po_id: po.po_id,
      po_number: po.po_number,
      pr_id: po.pr_id,
      supplier_id: po.supplier_id,
      warehouse_id: po.warehouse_id,
      order_date: po.po_date || new Date().toISOString(),
      expected_delivery_date: po.expected_delivery_date || new Date().toISOString(),
      currency: 'INR',
      subtotal: subtotal,
      tax_amount: tax,
      total_amount: totalVal,
      payment_terms: po.payment_terms || 'Net 30 Days',
      status: po.status || 'CONFIRMED',
      created_at: po.po_date || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: poErr } = await supabase.from('purchase_orders').upsert(mappedPOs);
  if (poErr) console.error('Error seeding purchase_orders:', poErr.message);
  else console.log(`✅ Seeded ${mappedPOs.length} purchase_orders successfully.`);

  // 7. PO ITEMS
  console.log('📦 Parsing & Mapping: po_items...');
  const rawPOItems = parseSqlTuples(seedSql, 'po_items');
  const mappedPOItems = rawPOItems.map((poi) => {
    const qty = Number(poi.quantity || poi.ordered_quantity || 100);
    const price = Number(poi.unit_price || 250);
    const lineTotal = Number(poi.line_total || qty * price);

    return {
      po_item_id: poi.po_item_id,
      po_id: poi.po_id,
      product_id: poi.product_id,
      ordered_quantity: qty,
      unit_price: price,
      tax_rate: 18.0,
      line_total: lineTotal,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: poiErr } = await supabase.from('po_items').upsert(mappedPOItems);
  if (poiErr) console.error('Error seeding po_items:', poiErr.message);
  else console.log(`✅ Seeded ${mappedPOItems.length} po_items successfully.`);

  // 8. SHIPMENTS
  console.log('📦 Parsing & Mapping: shipments...');
  const rawShipments = parseSqlTuples(seedSql, 'shipments');
  const mappedShipments = rawShipments.map((s) => ({
    shipment_id: s.shipment_id,
    shipment_number: s.shipment_number,
    po_id: s.po_id,
    origin: 'Mumbai Factory Logistics Hub',
    destination_warehouse_id: s.warehouse_id,
    dispatch_date: s.dispatch_date || new Date().toISOString(),
    expected_arrival: s.expected_arrival || new Date().toISOString(),
    actual_arrival: s.actual_arrival || null,
    status: s.status || 'IN_TRANSIT',
    total_quantity: s.quantity || s.total_quantity || 100,
    created_at: s.dispatch_date || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: shpErr } = await supabase.from('shipments').upsert(mappedShipments);
  if (shpErr) console.error('Error seeding shipments:', shpErr.message);
  else console.log(`✅ Seeded ${mappedShipments.length} shipments successfully.`);

  // 9. TRUCKS
  console.log('📦 Parsing & Mapping: trucks...');
  const rawTrucks = parseSqlTuples(seedSql, 'trucks');
  const mappedTrucks = rawTrucks.map((t) => ({
    truck_id: t.truck_id,
    vehicle_number: t.truck_number || t.vehicle_number,
    driver_name: t.driver_name,
    driver_phone: t.driver_phone,
    carrier_name: t.carrier || t.carrier_name || 'BlueDart Freight Logistics',
    truck_type: 'CONTAINER_20FT',
    capacity: t.capacity_kg || t.capacity || 25000,
    status: t.status || 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: trkErr } = await supabase.from('trucks').upsert(mappedTrucks);
  if (trkErr) console.error('Error seeding trucks:', trkErr.message);
  else console.log(`✅ Seeded ${mappedTrucks.length} trucks successfully.`);

  // 10. TRUCK LOCATIONS
  console.log('📦 Parsing & Mapping: truck_locations...');
  const rawLocations = parseSqlTuples(seedSql, 'truck_locations');
  const mappedLocations = rawLocations.map((loc) => ({
    location_id: loc.location_id,
    truck_id: loc.truck_id,
    shipment_id: loc.shipment_id,
    latitude: loc.latitude || 18.7557,
    longitude: loc.longitude || 73.4091,
    location_name: loc.location_name || 'Lonavala Expressway Corridor',
    timestamp: loc.recorded_at || loc.timestamp || new Date().toISOString(),
    speed: loc.speed_kmph || loc.speed || 55,
    status: 'ON_TIME',
    created_at: new Date().toISOString(),
  }));

  const { error: locErr } = await supabase.from('truck_locations').upsert(mappedLocations);
  if (locErr) console.error('Error seeding truck_locations:', locErr.message);
  else console.log(`✅ Seeded ${mappedLocations.length} truck_locations successfully.`);

  // 11. YARDS
  console.log('📦 Parsing & Mapping: yards...');
  const rawYards = parseSqlTuples(seedSql, 'yards');
  const mappedYards = rawYards.map((y) => ({
    yard_id: y.yard_id,
    warehouse_id: y.warehouse_id,
    yard_name: y.yard_code ? `North Inbound Yard (${y.yard_code})` : 'North Inbound Yard',
    capacity: y.capacity_trucks || y.capacity || 40,
    status: y.status || 'ACTIVE',
    description: `Active staging yard with capacity for ${y.capacity_trucks || 40} container trucks.`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: yardErr } = await supabase.from('yards').upsert(mappedYards);
  if (yardErr) console.error('Error seeding yards:', yardErr.message);
  else console.log(`✅ Seeded ${mappedYards.length} yards successfully.`);

  // 12. DOCKS
  console.log('📦 Parsing & Mapping: docks...');
  const rawDocks = parseSqlTuples(seedSql, 'docks');
  const mappedDocks = rawDocks.map((d) => ({
    dock_id: d.dock_id,
    yard_id: d.yard_id,
    dock_number: d.dock_code || d.dock_number || 'D01',
    dock_type: d.dock_type || 'INBOUND',
    status: d.status || 'AVAILABLE',
    capacity: 25000.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: dockErr } = await supabase.from('docks').upsert(mappedDocks);
  if (dockErr) console.error('Error seeding docks:', dockErr.message);
  else console.log(`✅ Seeded ${mappedDocks.length} docks successfully.`);

  // 13. YARD ENTRIES
  console.log('📦 Parsing & Mapping: yard_entries...');
  const rawYardEntries = parseSqlTuples(seedSql, 'yard_entries');
  const mappedYardEntries = rawYardEntries.map((ye) => ({
    yard_entry_id: ye.yard_entry_id,
    truck_id: ye.truck_id,
    shipment_id: ye.shipment_id,
    yard_id: ye.yard_id,
    entry_time: ye.arrival_time || ye.entry_time || new Date().toISOString(),
    exit_time: null,
    status: ye.verification_status === 'VERIFIED' ? 'WAITING' : 'CHECKED_IN',
    waiting_minutes: 18,
    gate_verified: ye.verification_status === 'VERIFIED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: yeErr } = await supabase.from('yard_entries').upsert(mappedYardEntries);
  if (yeErr) console.error('Error seeding yard_entries:', yeErr.message);
  else console.log(`✅ Seeded ${mappedYardEntries.length} yard_entries successfully.`);

  // 14. DOCK ASSIGNMENTS
  console.log('📦 Parsing & Mapping: dock_assignments...');
  const rawDockAssigns = parseSqlTuples(seedSql, 'dock_assignments');
  const mappedDockAssigns = rawDockAssigns.map((da, index) => {
    // Lookup matching yard_entry_id or assign matching index
    const matchingYe = mappedYardEntries.find((ye) => ye.truck_id === da.truck_id) || mappedYardEntries[index % mappedYardEntries.length];

    return {
      assignment_id: da.dock_assignment_id || da.assignment_id,
      yard_entry_id: matchingYe.yard_entry_id,
      dock_id: da.dock_id,
      assigned_at: da.assigned_at || new Date().toISOString(),
      dock_start_time: da.assigned_at || new Date().toISOString(),
      dock_end_time: da.released_at || null,
      status: da.status || 'UNLOADING',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: daErr } = await supabase.from('dock_assignments').upsert(mappedDockAssigns);
  if (daErr) console.error('Error seeding dock_assignments:', daErr.message);
  else console.log(`✅ Seeded ${mappedDockAssigns.length} dock_assignments successfully.`);

  // 15. GOODS RECEIPTS (GRN)
  console.log('📦 Parsing & Mapping: goods_receipts...');
  const rawGRNs = parseSqlTuples(seedSql, 'goods_receipts');
  const mappedGRNs = rawGRNs.map((g, index) => {
    const matchingYe = mappedYardEntries.find((ye) => ye.shipment_id === g.shipment_id) || mappedYardEntries[index % mappedYardEntries.length];

    return {
      grn_id: g.grn_id,
      grn_number: g.grn_number,
      po_id: g.po_id,
      shipment_id: g.shipment_id,
      yard_entry_id: matchingYe.yard_entry_id,
      received_date: g.received_date || new Date().toISOString(),
      received_by: null,
      status: g.status || 'COMPLETED',
      notes: `QA Inspection Intake: Received ${g.received_quantity || 100} units, Damaged ${g.damaged_quantity || 0} units.`,
      created_at: g.received_date || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: grnErr } = await supabase.from('goods_receipts').upsert(mappedGRNs);
  if (grnErr) console.error('Error seeding goods_receipts:', grnErr.message);
  else console.log(`✅ Seeded ${mappedGRNs.length} goods_receipts successfully.`);

  // 16. GRN ITEMS
  console.log('📦 Parsing & Mapping: grn_items...');
  const rawGRNItems = parseSqlTuples(seedSql, 'grn_items');
  const mappedGRNItems = rawGRNItems.map((gri, index) => {
    const parentGrn = mappedGRNs.find((g) => g.grn_id === gri.grn_id);
    const matchingPoItem = mappedPOItems.find((poi) => poi.po_id === parentGrn?.po_id && poi.product_id === gri.product_id) || mappedPOItems[index % mappedPOItems.length];

    const expQty = Number(gri.expected_quantity || 100);
    const recQty = Number(gri.received_quantity || 100);
    const dmgQty = Number(gri.damaged_quantity || 0);
    const accQty = Math.max(0, recQty - dmgQty);

    return {
      grn_item_id: gri.grn_item_id,
      grn_id: gri.grn_id,
      po_item_id: matchingPoItem.po_item_id,
      product_id: gri.product_id,
      ordered_quantity: expQty,
      received_quantity: recQty,
      damaged_quantity: dmgQty,
      accepted_quantity: accQty,
      inspection_status: dmgQty > 0 ? 'PARTIAL' : 'ACCEPTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: griErr } = await supabase.from('grn_items').upsert(mappedGRNItems);
  if (griErr) console.error('Error seeding grn_items:', griErr.message);
  else console.log(`✅ Seeded ${mappedGRNItems.length} grn_items successfully.`);

  // 17. INVOICES
  console.log('📦 Parsing & Mapping: invoices...');
  const rawInvoices = parseSqlTuples(seedSql, 'invoices');
  const mappedInvoices = rawInvoices.map((inv) => {
    const total = Number(inv.total_amount || 50000);
    const subtotal = Math.round((total / 1.18) * 100) / 100;
    const tax = Math.round((total - subtotal) * 100) / 100;

    let paymentStatus = 'UNPAID';
    if (inv.match_status === 'MATCHED') paymentStatus = 'PROCESSING';
    else if (inv.match_status === 'MISMATCH') paymentStatus = 'ON_HOLD';

    return {
      invoice_id: inv.invoice_id,
      invoice_number: inv.invoice_number,
      po_id: inv.po_id,
      supplier_id: inv.supplier_id,
      invoice_date: inv.invoice_date || new Date().toISOString(),
      due_date: inv.due_date || new Date().toISOString(),
      subtotal: subtotal,
      tax_amount: tax,
      total_amount: total,
      document_url: inv.document_path || '/documents/invoices/standard_invoice.pdf',
      ocr_status: inv.ocr_status || 'COMPLETED',
      match_status: inv.match_status || 'MATCHED',
      payment_status: paymentStatus,
      created_at: inv.invoice_date || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: invErr } = await supabase.from('invoices').upsert(mappedInvoices);
  if (invErr) console.error('Error seeding invoices:', invErr.message);
  else console.log(`✅ Seeded ${mappedInvoices.length} invoices successfully.`);

  // 18. INVOICE ITEMS
  console.log('📦 Parsing & Mapping: invoice_items...');
  const rawInvItems = parseSqlTuples(seedSql, 'invoice_items');
  const mappedInvItems = rawInvItems.map((ii, index) => {
    const parentInv = mappedInvoices.find((i) => i.invoice_id === ii.invoice_id);
    const matchingPoItem = mappedPOItems.find((poi) => poi.po_id === parentInv?.po_id && poi.product_id === ii.product_id) || mappedPOItems[index % mappedPOItems.length];

    const qty = Number(ii.quantity || 100);
    const price = Number(ii.unit_price || 250);
    const lineTotal = Number(ii.line_total || qty * price);

    return {
      invoice_item_id: ii.invoice_item_id,
      invoice_id: ii.invoice_id,
      po_item_id: matchingPoItem.po_item_id,
      product_id: ii.product_id,
      invoiced_quantity: qty,
      unit_price: price,
      tax_rate: 18.0,
      line_total: lineTotal,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: iiErr } = await supabase.from('invoice_items').upsert(mappedInvItems);
  if (iiErr) console.error('Error seeding invoice_items:', iiErr.message);
  else console.log(`✅ Seeded ${mappedInvItems.length} invoice_items successfully.`);

  // 19. EXCEPTIONS
  console.log('📦 Parsing & Mapping: exceptions...');
  const rawExceptions = parseSqlTuples(seedSql, 'exceptions');
  const mappedExceptions = rawExceptions.map((exc) => {
    const po = mappedPOs.find((p) => p.po_id === exc.po_id);
    const inv = mappedInvoices.find((i) => i.invoice_id === exc.invoice_id);

    const expVal = Number(po?.total_amount || 45000);
    const actVal = Number(inv?.total_amount || 49500);
    const diff = actVal - expVal;

    return {
      exception_id: exc.exception_id,
      exception_number: exc.exception_number,
      po_id: exc.po_id,
      invoice_id: exc.invoice_id,
      grn_id: exc.grn_id,
      exception_type: exc.exception_type || 'PRICE_MISMATCH',
      expected_value: expVal,
      actual_value: actVal,
      difference: diff,
      severity: exc.severity || 'HIGH',
      status: exc.status || 'OPEN',
      description: exc.description || `AI 3-Way Reconciliation flagged variance of ₹${diff.toLocaleString()}`,
      created_at: exc.created_at || new Date().toISOString(),
      resolved_at: exc.resolved_at || null,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: excErr } = await supabase.from('exceptions').upsert(mappedExceptions);
  if (excErr) console.error('Error seeding exceptions:', excErr.message);
  else console.log(`✅ Seeded ${mappedExceptions.length} exceptions successfully.`);

  // 20. PAYMENTS
  console.log('📦 Parsing & Mapping: payments...');
  const rawPayments = parseSqlTuples(seedSql, 'payments');
  const mappedPayments = rawPayments.map((p) => ({
    payment_id: p.payment_id,
    invoice_id: p.invoice_id,
    supplier_id: p.supplier_id,
    payment_amount: Number(p.amount || 50000),
    payment_date: p.payment_date || new Date().toISOString(),
    payment_method: 'NEFT',
    status: p.status || 'COMPLETED',
    transaction_reference: p.transaction_reference || `NEFT-${Date.now()}`,
    created_at: p.payment_date || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error: payErr } = await supabase.from('payments').upsert(mappedPayments);
  if (payErr) console.error('Error seeding payments:', payErr.message);
  else console.log(`✅ Seeded ${mappedPayments.length} payments successfully.`);

  console.log('\n====================================================');
  console.log('🎉 All 20 C2 Operational Datasets Ingested Successfully!');
  console.log('====================================================\n');
}

runSeed().catch((err) => {
  console.error('Fatal seed execution error:', err);
  process.exit(1);
});
