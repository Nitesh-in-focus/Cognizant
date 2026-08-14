-- Seed Data for C2 Supply Chain MVP

-- 1. Suppliers
INSERT INTO suppliers (supplier_id, supplier_code, supplier_name, contact_person, email, city)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'SUP-001', 'Acme Corp', 'John Doe', 'john@acme.com', 'Mumbai'),
  ('22222222-2222-2222-2222-222222222222', 'SUP-002', 'TechFlow Industries', 'Jane Smith', 'jane@techflow.com', 'Delhi')
ON CONFLICT (supplier_code) DO NOTHING;

-- 2. Products
INSERT INTO products (product_id, product_code, product_name, category, unit_of_measure, unit_price)
VALUES 
  ('33333333-3333-3333-3333-333333333333', 'PRD-101', 'Steel Bearings', 'Hardware', 'BOX', 50.00),
  ('44444444-4444-4444-4444-444444444444', 'PRD-102', 'Hydraulic Pumps', 'Machinery', 'PCS', 1500.00)
ON CONFLICT (product_code) DO NOTHING;

-- 3. Warehouses
INSERT INTO warehouses (warehouse_id, warehouse_code, warehouse_name, city, total_docks)
VALUES 
  ('55555555-5555-5555-5555-555555555555', 'WH-MAIN', 'Central Hub', 'Pune', 5)
ON CONFLICT (warehouse_code) DO NOTHING;

-- 4. PR
INSERT INTO purchase_requisitions (pr_id, pr_number, warehouse_id, priority, status, reason)
VALUES 
  ('66666666-6666-6666-6666-666666666666', 'PR-2026-001', '55555555-5555-5555-5555-555555555555', 'HIGH', 'APPROVED', 'Stock depletion')
ON CONFLICT (pr_number) DO NOTHING;

-- 5. PR Items
INSERT INTO pr_items (pr_id, product_id, requested_quantity)
VALUES 
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 100);

-- 6. PO
INSERT INTO purchase_orders (po_id, po_number, pr_id, supplier_id, warehouse_id, status, total_amount)
VALUES 
  ('77777777-7777-7777-7777-777777777777', 'PO-2026-101', '66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'CONFIRMED', 5000.00)
ON CONFLICT (po_number) DO NOTHING;

-- 7. PO Items
INSERT INTO po_items (po_item_id, po_id, product_id, ordered_quantity, unit_price, line_total)
VALUES 
  ('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', 100, 50.00, 5000.00);

-- 8. Shipments
INSERT INTO shipments (shipment_id, shipment_number, po_id, destination_warehouse_id, status, total_quantity)
VALUES 
  ('99999999-9999-9999-9999-999999999999', 'SHP-9901', '77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'IN_TRANSIT', 100)
ON CONFLICT (shipment_number) DO NOTHING;

-- 9. Trucks
INSERT INTO trucks (truck_id, vehicle_number, driver_name, status, capacity)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MH-12-AB-1234', 'Raj Kumar', 'IN_TRANSIT', 1000)
ON CONFLICT (vehicle_number) DO NOTHING;

-- 10. Truck Locations
INSERT INTO truck_locations (truck_id, shipment_id, location_name, timestamp, status)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999999', 'Checkpoint Alpha', CURRENT_TIMESTAMP, 'ON_TIME');

-- 11. Yards
INSERT INTO yards (yard_id, warehouse_id, yard_name, capacity, status)
VALUES 
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'North Yard', 10, 'ACTIVE');

-- 12. Docks
INSERT INTO docks (dock_id, yard_id, dock_number, dock_type, status)
VALUES 
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'DOCK-1', 'INBOUND', 'AVAILABLE');
