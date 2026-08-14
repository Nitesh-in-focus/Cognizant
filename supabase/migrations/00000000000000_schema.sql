-- PostgreSQL Schema for C2 Supply Chain Management System MVP

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3.1 suppliers
CREATE TABLE suppliers (
    supplier_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_code VARCHAR UNIQUE NOT NULL,
    supplier_name VARCHAR NOT NULL,
    contact_person VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    address TEXT,
    city VARCHAR,
    status VARCHAR DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.2 products
CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code VARCHAR UNIQUE NOT NULL,
    product_name VARCHAR NOT NULL,
    category VARCHAR,
    unit_of_measure VARCHAR,
    unit_price DECIMAL(12,2),
    description TEXT,
    status VARCHAR DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3.3 warehouses
CREATE TABLE warehouses (
    warehouse_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_code VARCHAR UNIQUE NOT NULL,
    warehouse_name VARCHAR NOT NULL,
    address TEXT,
    city VARCHAR,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    total_docks INTEGER,
    status VARCHAR DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.1 purchase_requisitions
CREATE TABLE purchase_requisitions (
    pr_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pr_number VARCHAR UNIQUE NOT NULL,
    requester_id UUID,
    warehouse_id UUID REFERENCES warehouses(warehouse_id),
    request_date TIMESTAMP WITH TIME ZONE,
    required_date TIMESTAMP WITH TIME ZONE,
    priority VARCHAR,
    status VARCHAR,
    reason TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.2 pr_items
CREATE TABLE pr_items (
    pr_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pr_id UUID NOT NULL REFERENCES purchase_requisitions(pr_id),
    product_id UUID NOT NULL REFERENCES products(product_id),
    requested_quantity DECIMAL(12,2) NOT NULL,
    required_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.3 purchase_orders
CREATE TABLE purchase_orders (
    po_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number VARCHAR UNIQUE NOT NULL,
    pr_id UUID REFERENCES purchase_requisitions(pr_id),
    supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id),
    warehouse_id UUID REFERENCES warehouses(warehouse_id),
    order_date TIMESTAMP WITH TIME ZONE,
    expected_delivery_date TIMESTAMP WITH TIME ZONE,
    currency VARCHAR DEFAULT 'INR',
    subtotal DECIMAL(14,2),
    tax_amount DECIMAL(14,2),
    total_amount DECIMAL(14,2),
    payment_terms VARCHAR,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4.4 po_items
CREATE TABLE po_items (
    po_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id),
    product_id UUID NOT NULL REFERENCES products(product_id),
    ordered_quantity DECIMAL(12,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    tax_rate DECIMAL(5,2),
    line_total DECIMAL(14,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.1 shipments
CREATE TABLE shipments (
    shipment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_number VARCHAR UNIQUE NOT NULL,
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id),
    origin TEXT,
    destination_warehouse_id UUID REFERENCES warehouses(warehouse_id),
    dispatch_date TIMESTAMP WITH TIME ZONE,
    expected_arrival TIMESTAMP WITH TIME ZONE,
    actual_arrival TIMESTAMP WITH TIME ZONE,
    status VARCHAR,
    total_quantity DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.2 trucks
CREATE TABLE trucks (
    truck_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_number VARCHAR UNIQUE NOT NULL,
    driver_name VARCHAR,
    driver_phone VARCHAR,
    carrier_name VARCHAR,
    truck_type VARCHAR,
    capacity DECIMAL(12,2),
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5.3 truck_locations
CREATE TABLE truck_locations (
    location_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL REFERENCES trucks(truck_id),
    shipment_id UUID REFERENCES shipments(shipment_id),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    location_name VARCHAR,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    speed DECIMAL(8,2),
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6.1 yards
CREATE TABLE yards (
    yard_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(warehouse_id),
    yard_name VARCHAR,
    capacity INTEGER,
    status VARCHAR,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6.2 docks
CREATE TABLE docks (
    dock_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    yard_id UUID NOT NULL REFERENCES yards(yard_id),
    dock_number VARCHAR NOT NULL,
    dock_type VARCHAR,
    status VARCHAR,
    capacity DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6.3 yard_entries
CREATE TABLE yard_entries (
    yard_entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id UUID NOT NULL REFERENCES trucks(truck_id),
    shipment_id UUID REFERENCES shipments(shipment_id),
    yard_id UUID NOT NULL REFERENCES yards(yard_id),
    entry_time TIMESTAMP WITH TIME ZONE,
    exit_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR,
    waiting_minutes INTEGER,
    gate_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6.4 dock_assignments
CREATE TABLE dock_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    yard_entry_id UUID NOT NULL REFERENCES yard_entries(yard_entry_id),
    dock_id UUID NOT NULL REFERENCES docks(dock_id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    dock_start_time TIMESTAMP WITH TIME ZONE,
    dock_end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7.1 goods_receipts
CREATE TABLE goods_receipts (
    grn_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grn_number VARCHAR UNIQUE NOT NULL,
    po_id UUID NOT NULL REFERENCES purchase_orders(po_id),
    shipment_id UUID REFERENCES shipments(shipment_id),
    yard_entry_id UUID REFERENCES yard_entries(yard_entry_id),
    received_date TIMESTAMP WITH TIME ZONE,
    received_by UUID,
    status VARCHAR,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7.2 grn_items
CREATE TABLE grn_items (
    grn_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grn_id UUID NOT NULL REFERENCES goods_receipts(grn_id),
    po_item_id UUID NOT NULL REFERENCES po_items(po_item_id),
    product_id UUID NOT NULL REFERENCES products(product_id),
    ordered_quantity DECIMAL(12,2),
    received_quantity DECIMAL(12,2),
    damaged_quantity DECIMAL(12,2),
    accepted_quantity DECIMAL(12,2),
    inspection_status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8.1 invoices
CREATE TABLE invoices (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR NOT NULL,
    po_id UUID REFERENCES purchase_orders(po_id),
    supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id),
    invoice_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    subtotal DECIMAL(14,2),
    tax_amount DECIMAL(14,2),
    total_amount DECIMAL(14,2),
    document_url TEXT,
    ocr_status VARCHAR,
    match_status VARCHAR,
    payment_status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8.2 invoice_items
CREATE TABLE invoice_items (
    invoice_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id),
    po_item_id UUID REFERENCES po_items(po_item_id),
    product_id UUID REFERENCES products(product_id),
    invoiced_quantity DECIMAL(12,2),
    unit_price DECIMAL(12,2),
    tax_rate DECIMAL(5,2),
    line_total DECIMAL(14,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9.1 exceptions
CREATE TABLE exceptions (
    exception_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exception_number VARCHAR UNIQUE NOT NULL,
    po_id UUID REFERENCES purchase_orders(po_id),
    invoice_id UUID REFERENCES invoices(invoice_id),
    grn_id UUID REFERENCES goods_receipts(grn_id),
    exception_type VARCHAR,
    expected_value DECIMAL(14,2),
    actual_value DECIMAL(14,2),
    difference DECIMAL(14,2),
    severity VARCHAR,
    status VARCHAR,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10.1 payments
CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id),
    supplier_id UUID NOT NULL REFERENCES suppliers(supplier_id),
    payment_amount DECIMAL(14,2),
    payment_date TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR,
    status VARCHAR,
    transaction_reference VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
