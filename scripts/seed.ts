import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Seeding Database...');

  // Clear existing
  console.log('Clearing old data (this relies on cascading deletes if set, otherwise might fail if tables have data)...');

  // Insert Suppliers
  const { data: suppliers, error: sErr } = await supabase.from('suppliers').insert([
    { supplier_code: 'SUP-001', supplier_name: 'Acme Corp', contact_person: 'John Doe', email: 'john@acme.com', city: 'Mumbai' },
    { supplier_code: 'SUP-002', supplier_name: 'TechFlow Industries', contact_person: 'Jane Smith', email: 'jane@techflow.com', city: 'Delhi' }
  ]).select();
  if (sErr) console.error('Suppliers error:', sErr);

  // Insert Products
  const { data: products, error: pErr } = await supabase.from('products').insert([
    { product_code: 'PRD-101', product_name: 'Steel Bearings', category: 'Hardware', unit_of_measure: 'BOX', unit_price: 50.00 },
    { product_code: 'PRD-102', product_name: 'Hydraulic Pumps', category: 'Machinery', unit_of_measure: 'PCS', unit_price: 1500.00 }
  ]).select();
  if (pErr) console.error('Products error:', pErr);

  // Insert Warehouse
  const { data: warehouses, error: wErr } = await supabase.from('warehouses').insert([
    { warehouse_code: 'WH-MAIN', warehouse_name: 'Central Hub', city: 'Pune', total_docks: 5 }
  ]).select();
  if (wErr) console.error('Warehouse error:', wErr);

  // Proceed if base data exists
  if (suppliers && products && warehouses) {
    const s1 = suppliers[0].supplier_id;
    const p1 = products[0].product_id;
    const w1 = warehouses[0].warehouse_id;

    // PR
    const { data: prs, error: prErr } = await supabase.from('purchase_requisitions').insert([
      { pr_number: 'PR-2026-001', warehouse_id: w1, priority: 'HIGH', status: 'APPROVED', reason: 'Stock depletion' }
    ]).select();
    
    if (prs) {
      const pr1 = prs[0].pr_id;
      await supabase.from('pr_items').insert([{ pr_id: pr1, product_id: p1, requested_quantity: 100 }]);

      // PO
      const { data: pos, error: poErr } = await supabase.from('purchase_orders').insert([
        { po_number: 'PO-2026-101', pr_id: pr1, supplier_id: s1, warehouse_id: w1, status: 'CONFIRMED', total_amount: 5000.00 }
      ]).select();

      if (pos) {
        const po1 = pos[0].po_id;
        const { data: poItems } = await supabase.from('po_items').insert([
          { po_id: po1, product_id: p1, ordered_quantity: 100, unit_price: 50.00, line_total: 5000.00 }
        ]).select();
        
        // Shipment
        const { data: shipments } = await supabase.from('shipments').insert([
          { shipment_number: 'SHP-9901', po_id: po1, destination_warehouse_id: w1, status: 'IN_TRANSIT', total_quantity: 100 }
        ]).select();

        if (shipments) {
          const shp1 = shipments[0].shipment_id;
          
          // Truck
          const { data: trucks } = await supabase.from('trucks').insert([
            { vehicle_number: 'MH-12-AB-1234', driver_name: 'Raj Kumar', status: 'IN_TRANSIT', capacity: 1000 }
          ]).select();
          
          if (trucks) {
            const trk1 = trucks[0].truck_id;

            // Truck Location
            await supabase.from('truck_locations').insert([
              { truck_id: trk1, shipment_id: shp1, location_name: 'Checkpoint Alpha', timestamp: new Date().toISOString(), status: 'ON_TIME' }
            ]);
            
            // Yard & Dock
            const { data: yards } = await supabase.from('yards').insert([
              { warehouse_id: w1, yard_name: 'North Yard', capacity: 10, status: 'ACTIVE' }
            ]).select();
            
            if (yards) {
              const y1 = yards[0].yard_id;
              const { data: docks } = await supabase.from('docks').insert([
                { yard_id: y1, dock_number: 'DOCK-1', dock_type: 'INBOUND', status: 'AVAILABLE' }
              ]).select();
            }
          }
        }
      }
    }
  }

  console.log('Seeding complete.');
}

seed().catch(console.error);
