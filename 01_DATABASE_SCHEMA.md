# C2 Supply Chain Management System — Database Schema Specification

## 1. Project Context

We are building an end-to-end Supply Chain and Procure-to-Pay (P2P) management system.

The system should connect:

- Procurement
- Purchase Requisitions
- Purchase Orders
- Suppliers
- Products
- Shipments
- Truck Tracking
- GPS/ETA
- Warehouse
- Yard Management
- Dock Management
- Goods Receipt
- Invoice Processing
- OCR
- 3-Way Matching
- Exception Management
- Payment

Core business flow:

Business Need
→ Purchase Requisition
→ PR Approval
→ Supplier/Sourcing
→ Purchase Order
→ Supplier Confirmation
→ Shipment
→ Truck Tracking
→ Facility Arrival
→ Gate Check-in
→ Yard
→ Dock Assignment
→ Unloading
→ Goods Receipt
→ Invoice
→ 3-Way Match
→ Exception Resolution if required
→ Payment

---

# 2. Database Technology

Database:

- PostgreSQL
- Hosted on Supabase

Primary keys should preferably use UUIDs.

All tables should have:

- `created_at`
- `updated_at`

where appropriate.

Use foreign keys to maintain referential integrity.

---

# 3. TABLES

## 3.1 suppliers

Stores supplier/vendor master information.

Columns:

- `supplier_id` UUID PRIMARY KEY
- `supplier_code` VARCHAR UNIQUE NOT NULL
- `supplier_name` VARCHAR NOT NULL
- `contact_person` VARCHAR
- `email` VARCHAR
- `phone` VARCHAR
- `address` TEXT
- `city` VARCHAR
- `status` VARCHAR DEFAULT 'ACTIVE'
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible statuses:

- ACTIVE
- INACTIVE
- SUSPENDED

---

## 3.2 products

Stores materials/products purchased by the organization.

Columns:

- `product_id` UUID PRIMARY KEY
- `product_code` VARCHAR UNIQUE NOT NULL
- `product_name` VARCHAR NOT NULL
- `category` VARCHAR
- `unit_of_measure` VARCHAR
- `unit_price` DECIMAL(12,2)
- `description` TEXT
- `status` VARCHAR DEFAULT 'ACTIVE'
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Examples of unit_of_measure:

- PCS
- KG
- L
- BOX
- TON

---

## 3.3 warehouses

Stores receiving/storage facilities.

Columns:

- `warehouse_id` UUID PRIMARY KEY
- `warehouse_code` VARCHAR UNIQUE NOT NULL
- `warehouse_name` VARCHAR NOT NULL
- `address` TEXT
- `city` VARCHAR
- `latitude` DECIMAL(10,7)
- `longitude` DECIMAL(10,7)
- `total_docks` INTEGER
- `status` VARCHAR DEFAULT 'ACTIVE'
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

---

# 4. PROCUREMENT TABLES

## 4.1 purchase_requisitions

Represents an internal request for goods.

A PR is NOT sent directly to the supplier.

Columns:

- `pr_id` UUID PRIMARY KEY
- `pr_number` VARCHAR UNIQUE NOT NULL
- `requester_id` UUID
- `warehouse_id` UUID REFERENCES warehouses(warehouse_id)
- `request_date` TIMESTAMP
- `required_date` TIMESTAMP
- `priority` VARCHAR
- `status` VARCHAR
- `reason` TEXT
- `approved_at` TIMESTAMP
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible priority:

- LOW
- MEDIUM
- HIGH
- CRITICAL

Possible status:

- DRAFT
- PENDING_APPROVAL
- APPROVED
- REJECTED
- PARTIALLY_CONVERTED
- CONVERTED
- CLOSED

---

## 4.2 pr_items

Contains the individual products requested in a PR.

Columns:

- `pr_item_id` UUID PRIMARY KEY
- `pr_id` UUID NOT NULL REFERENCES purchase_requisitions(pr_id)
- `product_id` UUID NOT NULL REFERENCES products(product_id)
- `requested_quantity` DECIMAL(12,2) NOT NULL
- `required_date` TIMESTAMP
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Relationship:

Purchase Requisition 1 → N PR Items

Product 1 → N PR Items

---

## 4.3 purchase_orders

Represents the formal purchase order issued to a supplier.

Columns:

- `po_id` UUID PRIMARY KEY
- `po_number` VARCHAR UNIQUE NOT NULL
- `pr_id` UUID REFERENCES purchase_requisitions(pr_id)
- `supplier_id` UUID NOT NULL REFERENCES suppliers(supplier_id)
- `warehouse_id` UUID REFERENCES warehouses(warehouse_id)
- `order_date` TIMESTAMP
- `expected_delivery_date` TIMESTAMP
- `currency` VARCHAR DEFAULT 'INR'
- `subtotal` DECIMAL(14,2)
- `tax_amount` DECIMAL(14,2)
- `total_amount` DECIMAL(14,2)
- `payment_terms` VARCHAR
- `status` VARCHAR
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible status:

- DRAFT
- PENDING_APPROVAL
- APPROVED
- SENT
- CONFIRMED
- PARTIALLY_SHIPPED
- SHIPPED
- PARTIALLY_RECEIVED
- COMPLETED
- CANCELLED

---

## 4.4 po_items

Contains individual products, quantities and prices in a PO.

Columns:

- `po_item_id` UUID PRIMARY KEY
- `po_id` UUID NOT NULL REFERENCES purchase_orders(po_id)
- `product_id` UUID NOT NULL REFERENCES products(product_id)
- `ordered_quantity` DECIMAL(12,2) NOT NULL
- `unit_price` DECIMAL(12,2) NOT NULL
- `tax_rate` DECIMAL(5,2)
- `line_total` DECIMAL(14,2)
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Relationship:

Purchase Order 1 → N PO Items

Product 1 → N PO Items

---

# 5. LOGISTICS / SHIPMENT TABLES

## 5.1 shipments

Represents the movement of goods from supplier/origin to warehouse/destination.

Columns:

- `shipment_id` UUID PRIMARY KEY
- `shipment_number` VARCHAR UNIQUE NOT NULL
- `po_id` UUID NOT NULL REFERENCES purchase_orders(po_id)
- `origin` TEXT
- `destination_warehouse_id` UUID REFERENCES warehouses(warehouse_id)
- `dispatch_date` TIMESTAMP
- `expected_arrival` TIMESTAMP
- `actual_arrival` TIMESTAMP
- `status` VARCHAR
- `total_quantity` DECIMAL(12,2)
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible status:

- PLANNED
- DISPATCHED
- IN_TRANSIT
- DELAYED
- ARRIVED
- UNLOADING
- DELIVERED
- CANCELLED

Relationship:

Purchase Order 1 → N Shipments

---

## 5.2 trucks

Stores physical transportation vehicles.

Columns:

- `truck_id` UUID PRIMARY KEY
- `vehicle_number` VARCHAR UNIQUE NOT NULL
- `driver_name` VARCHAR
- `driver_phone` VARCHAR
- `carrier_name` VARCHAR
- `truck_type` VARCHAR
- `capacity` DECIMAL(12,2)
- `status` VARCHAR
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible status:

- AVAILABLE
- ASSIGNED
- IN_TRANSIT
- AT_YARD
- WAITING
- AT_DOCK
- LOADING
- UNLOADING
- COMPLETED

For this hackathon MVP, assume:

Shipment 1 → 1 Truck

This is a simplification for the prototype.

---

## 5.3 truck_locations

Stores truck location history.

Columns:

- `location_id` UUID PRIMARY KEY
- `truck_id` UUID NOT NULL REFERENCES trucks(truck_id)
- `shipment_id` UUID REFERENCES shipments(shipment_id)
- `latitude` DECIMAL(10,7)
- `longitude` DECIMAL(10,7)
- `location_name` VARCHAR
- `timestamp` TIMESTAMP NOT NULL
- `speed` DECIMAL(8,2)
- `status` VARCHAR
- `created_at` TIMESTAMP

This table allows:

- Current truck location
- Location history
- Route visualization
- Delay detection
- ETA updates

For a hackathon, truck movement can be simulated rather than connected to real GPS.

---

# 6. YARD AND DOCK MANAGEMENT

## 6.1 yards

Stores yard information associated with a warehouse.

Columns:

- `yard_id` UUID PRIMARY KEY
- `warehouse_id` UUID NOT NULL REFERENCES warehouses(warehouse_id)
- `yard_name` VARCHAR
- `capacity` INTEGER
- `status` VARCHAR
- `description` TEXT
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Relationship:

Warehouse 1 → N Yards

---

## 6.2 docks

Stores loading/unloading docks.

Columns:

- `dock_id` UUID PRIMARY KEY
- `yard_id` UUID NOT NULL REFERENCES yards(yard_id)
- `dock_number` VARCHAR NOT NULL
- `dock_type` VARCHAR
- `status` VARCHAR
- `capacity` DECIMAL(12,2)
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible status:

- AVAILABLE
- OCCUPIED
- MAINTENANCE

Possible dock_type:

- INBOUND
- OUTBOUND
- BOTH

Relationship:

Yard 1 → N Docks

---

## 6.3 yard_entries

Records truck arrival and departure from a facility.

Columns:

- `yard_entry_id` UUID PRIMARY KEY
- `truck_id` UUID NOT NULL REFERENCES trucks(truck_id)
- `shipment_id` UUID REFERENCES shipments(shipment_id)
- `yard_id` UUID NOT NULL REFERENCES yards(yard_id)
- `entry_time` TIMESTAMP
- `exit_time` TIMESTAMP
- `status` VARCHAR
- `waiting_minutes` INTEGER
- `gate_verified` BOOLEAN DEFAULT FALSE
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible status:

- WAITING
- DOCK_ASSIGNED
- AT_DOCK
- UNLOADING
- COMPLETED

---

## 6.4 dock_assignments

Tracks assignment of trucks to docks.

Columns:

- `assignment_id` UUID PRIMARY KEY
- `yard_entry_id` UUID NOT NULL REFERENCES yard_entries(yard_entry_id)
- `dock_id` UUID NOT NULL REFERENCES docks(dock_id)
- `assigned_at` TIMESTAMP
- `dock_start_time` TIMESTAMP
- `dock_end_time` TIMESTAMP
- `status` VARCHAR
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible status:

- QUEUED
- ACTIVE
- COMPLETED
- CANCELLED

This table allows calculation of:

- Dock utilization
- Waiting time
- Unloading duration
- Dock congestion

---

# 7. GOODS RECEIVING

## 7.1 goods_receipts

GRN header.

A GRN represents what was physically received.

Columns:

- `grn_id` UUID PRIMARY KEY
- `grn_number` VARCHAR UNIQUE NOT NULL
- `po_id` UUID NOT NULL REFERENCES purchase_orders(po_id)
- `shipment_id` UUID REFERENCES shipments(shipment_id)
- `yard_entry_id` UUID REFERENCES yard_entries(yard_entry_id)
- `received_date` TIMESTAMP
- `received_by` UUID
- `status` VARCHAR
- `notes` TEXT
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible status:

- PENDING
- PARTIAL
- COMPLETE
- REJECTED

Important:

A PO can have multiple GRNs because partial deliveries are possible.

---

## 7.2 grn_items

Stores actual received quantities.

Columns:

- `grn_item_id` UUID PRIMARY KEY
- `grn_id` UUID NOT NULL REFERENCES goods_receipts(grn_id)
- `po_item_id` UUID NOT NULL REFERENCES po_items(po_item_id)
- `product_id` UUID NOT NULL REFERENCES products(product_id)
- `ordered_quantity` DECIMAL(12,2)
- `received_quantity` DECIMAL(12,2)
- `damaged_quantity` DECIMAL(12,2)
- `accepted_quantity` DECIMAL(12,2)
- `inspection_status` VARCHAR
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible inspection status:

- PENDING
- PASSED
- FAILED
- PARTIAL

---

# 8. INVOICE / OCR

## 8.1 invoices

Stores supplier invoice headers.

Columns:

- `invoice_id` UUID PRIMARY KEY
- `invoice_number` VARCHAR NOT NULL
- `po_id` UUID REFERENCES purchase_orders(po_id)
- `supplier_id` UUID NOT NULL REFERENCES suppliers(supplier_id)
- `invoice_date` TIMESTAMP
- `due_date` TIMESTAMP
- `subtotal` DECIMAL(14,2)
- `tax_amount` DECIMAL(14,2)
- `total_amount` DECIMAL(14,2)
- `document_url` TEXT
- `ocr_status` VARCHAR
- `match_status` VARCHAR
- `payment_status` VARCHAR
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible OCR status:

- PENDING
- PROCESSING
- PROCESSED
- FAILED

Possible match status:

- PENDING
- MATCHED
- MISMATCH
- UNDER_REVIEW
- RESOLVED

Possible payment status:

- PENDING
- ON_HOLD
- APPROVED
- PAID
- REJECTED

---

## 8.2 invoice_items

Stores invoice line items extracted manually or through OCR.

Columns:

- `invoice_item_id` UUID PRIMARY KEY
- `invoice_id` UUID NOT NULL REFERENCES invoices(invoice_id)
- `po_item_id` UUID REFERENCES po_items(po_item_id)
- `product_id` UUID REFERENCES products(product_id)
- `invoiced_quantity` DECIMAL(12,2)
- `unit_price` DECIMAL(12,2)
- `tax_rate` DECIMAL(5,2)
- `line_total` DECIMAL(14,2)
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

---

# 9. EXCEPTION MANAGEMENT

## 9.1 exceptions

Stores mismatches and operational exceptions.

Columns:

- `exception_id` UUID PRIMARY KEY
- `exception_number` VARCHAR UNIQUE NOT NULL
- `po_id` UUID REFERENCES purchase_orders(po_id)
- `invoice_id` UUID REFERENCES invoices(invoice_id)
- `grn_id` UUID REFERENCES goods_receipts(grn_id)
- `exception_type` VARCHAR
- `expected_value` DECIMAL(14,2)
- `actual_value` DECIMAL(14,2)
- `difference` DECIMAL(14,2)
- `severity` VARCHAR
- `status` VARCHAR
- `description` TEXT
- `created_at` TIMESTAMP
- `resolved_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible exception types:

- QUANTITY_MISMATCH
- PRICE_MISMATCH
- AMOUNT_MISMATCH
- DUPLICATE_INVOICE
- MISSING_PO
- SUPPLIER_MISMATCH
- LATE_SHIPMENT
- DAMAGED_GOODS
- MISSING_GOODS

Possible severity:

- LOW
- MEDIUM
- HIGH
- CRITICAL

Possible status:

- OPEN
- UNDER_REVIEW
- RESOLVED
- CLOSED

---

# 10. PAYMENTS

## 10.1 payments

Stores supplier payments.

Columns:

- `payment_id` UUID PRIMARY KEY
- `invoice_id` UUID NOT NULL REFERENCES invoices(invoice_id)
- `supplier_id` UUID NOT NULL REFERENCES suppliers(supplier_id)
- `payment_amount` DECIMAL(14,2)
- `payment_date` TIMESTAMP
- `payment_method` VARCHAR
- `status` VARCHAR
- `transaction_reference` VARCHAR
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Possible status:

- PENDING
- APPROVED
- ON_HOLD
- PAID
- FAILED

---

# 11. RELATIONSHIPS

## Main Procurement Relationships

Supplier 1 → N Purchase Orders

Purchase Requisition 1 → N Purchase Orders

Purchase Requisition 1 → N PR Items

Product 1 → N PR Items

Purchase Order 1 → N PO Items

Product 1 → N PO Items

Supplier 1 → N Purchase Orders

Warehouse 1 → N Purchase Requisitions

Warehouse 1 → N Purchase Orders

---

## Logistics Relationships

Purchase Order 1 → N Shipments

Shipment 1 → 1 Truck
(Simplified assumption for hackathon MVP)

Truck 1 → N Truck Locations

Shipment 1 → N Truck Locations

Warehouse 1 → N Yards

Yard 1 → N Docks

Truck 1 → N Yard Entries

Shipment 1 → N Yard Entries

Yard 1 → N Yard Entries

Yard Entry 1 → N Dock Assignments

Dock 1 → N Dock Assignments

---

## Receiving Relationships

Purchase Order 1 → N Goods Receipts

Shipment 1 → N Goods Receipts

Yard Entry 1 → N Goods Receipts

Goods Receipt 1 → N GRN Items

PO Item 1 → N GRN Items

Product 1 → N GRN Items

---

## Invoice Relationships

Purchase Order 1 → N Invoices

Supplier 1 → N Invoices

Invoice 1 → N Invoice Items

PO Item 1 → N Invoice Items

Product 1 → N Invoice Items

---

## Exception Relationships

Purchase Order 1 → N Exceptions

Invoice 1 → N Exceptions

Goods Receipt 1 → N Exceptions

---

## Payment Relationships

Invoice 1 → N Payments

Supplier 1 → N Payments

For the MVP, normally only one successful payment should exist per invoice.

---

# 12. COMPLETE BUSINESS FLOW

## Procurement

Business Need
→ Purchase Requisition
→ PR Approval
→ Sourcing / Supplier Selection
→ Purchase Order
→ PO Approval
→ Supplier Confirmation

## Logistics

Purchase Order
→ Shipment
→ Truck Assignment
→ Dispatch
→ GPS Tracking
→ ETA
→ Facility Arrival
→ Gate Check-in
→ Yard
→ Dock Assignment
→ Unloading

## Receiving

Unloading
→ Physical Verification
→ GRN
→ GRN Items
→ Actual Quantity Recorded

## Invoice

Supplier Invoice
→ Upload PDF/Image
→ OCR
→ Extract Invoice Fields
→ Store Invoice Data
→ Invoice Items

## Matching

PO Items
+
GRN Items
+
Invoice Items
→ 3-Way Match

Matching should evaluate:

- Product
- Quantity
- Unit price
- Total amount
- Supplier
- PO reference

## If Match

MATCH
→ Invoice Approved
→ Payment Approved
→ Payment
→ Completed

## If Mismatch

MISMATCH
→ Exception Created
→ Payment Hold
→ Human Review
→ Resolution
→ Reconciliation
→ Re-Match
→ Approval
→ Payment

---

# 13. IMPORTANT BUSINESS RULES

## Rule 1 — PR

A Purchase Requisition is an internal request.

It does NOT represent a supplier order.

---

## Rule 2 — PO

A Purchase Order is the formal order sent to a supplier.

---

## Rule 3 — Shipment

A PO can have multiple shipments.

Example:

PO = 1,000 units

Shipment 1 = 400

Shipment 2 = 300

Shipment 3 = 300

---

## Rule 4 — GRN

GRN represents actual physical receipt.

Example:

PO = 1,000

Actual received = 950

GRN = 950

---

## Rule 5 — Invoice

Invoice can arrive before or after GRN depending on the business process.

Do NOT assume a fixed chronological relationship.

---

## Rule 6 — 3-Way Matching

Compare:

PO + GRN + Invoice

Example:

PO = 1,000

GRN = 950

Invoice = 1,000

Result:

MISMATCH

---

## Rule 7 — Price Matching

PO price and invoice price should be compared according to the configured business tolerance.

Example:

PO = ₹100/unit

Invoice = ₹120/unit

Result:

PRICE MISMATCH

---

## Rule 8 — Partial Delivery

A partial delivery is not automatically an error.

Example:

PO = 1,000

Shipment 1 = 500

Shipment 2 = 500

Two GRNs can represent the two receipts.

---

## Rule 9 — Payment Hold

Invoices with unresolved critical mismatches should not proceed automatically to payment.

---

## Rule 10 — Exception Management

A mismatch should create a trackable exception rather than simply displaying "ERROR".

Exception should contain:

- Type
- Expected value
- Actual value
- Difference
- Severity
- Status
- Description

---

# 14. C2 DASHBOARD DATA REQUIREMENTS

The database should support these KPIs:

## Procurement

- Total PRs
- Pending PRs
- Approved PRs
- Total POs
- Pending POs
- PO value
- Supplier performance

## Shipment

- Total shipments
- In-transit shipments
- Delayed shipments
- Delivered shipments
- Average delay
- Average ETA deviation

## Truck

- Active trucks
- Trucks in transit
- Trucks at yard
- Trucks waiting
- Average truck waiting time

## Yard

- Yard capacity
- Current trucks in yard
- Yard utilization
- Average waiting time

## Dock

- Total docks
- Available docks
- Occupied docks
- Dock utilization
- Average unloading time

## Receiving

- Total GRNs
- Partial receipts
- Complete receipts
- Quantity discrepancies
- Damaged goods

## Invoice

- Total invoices
- Processed invoices
- OCR failures
- Matched invoices
- Mismatched invoices
- Payment holds

## Payment

- Pending payments
- Payments on hold
- Paid amount
- Outstanding amount

---

# 15. C2 INNOVATION / ANALYTICS REQUIREMENTS

The system should eventually support:

### Supplier Risk

Calculate supplier performance using:

- Shipment delays
- Quantity discrepancies
- Invoice mismatches
- Average delivery delay

### Shipment Risk

Calculate:

- ETA deviation
- Current delay
- Yard congestion
- Dock availability

### Exception Intelligence

Identify:

- Quantity mismatch
- Price mismatch
- Invoice mismatch
- Late shipment
- Missing goods
- Damaged goods

### Predictive / Decision Support

Potential future enhancement:

Shipment delay
→ ETA impact
→ Dock impact
→ Receiving impact
→ PO impact
→ Invoice/payment impact

---

# 16. C2 MVP PRIORITY

The MVP should prioritize:

1. Supplier Management
2. Purchase Requisition
3. Purchase Orders
4. Shipment Tracking
5. Truck Tracking
6. Yard Management
7. Dock Management
8. GRN
9. Invoice Management
10. OCR
11. 3-Way Matching
12. Exception Management
13. Payment Status
14. Analytics

Do NOT prioritize advanced features such as:

- Microservices
- Kafka
- Redis
- Complex CI/CD
- Advanced ML
- Complex DAX
- Advanced database optimization

unless the core system is already working.

---

# 17. SIMPLIFIED SYSTEM ARCHITECTURE

Frontend:

React + TypeScript

Backend:

Supabase + Edge Functions

Database:

PostgreSQL via Supabase

Storage:

Supabase Storage

Authentication:

Supabase Auth

OCR:

External OCR service/API

Analytics:

Power BI

Development:

Google Antigravity + MCP

Architecture:

React
→ Supabase Client/API
→ Supabase PostgreSQL

For server-side business logic:

React
→ Edge Function
→ PostgreSQL / External API

For OCR:

Invoice PDF/Image
→ OCR
→ Edge Function/Backend
→ Invoice Data
→ PostgreSQL

For matching:

PO Items
+
GRN Items
+
Invoice Items
→ Matching Logic
→ Match / Mismatch
→ Exception
→ Payment

For analytics:

Supabase PostgreSQL
→ Power BI
→ C2 Analytics Dashboard

---

# 18. SECURITY

Use Supabase Row Level Security (RLS).

Do NOT expose privileged database credentials in the React frontend.

Frontend should use the public Supabase client configuration.

Sensitive operations should be handled server-side through Edge Functions.

Never place service-role keys or private API keys in frontend code.

---

# 19. DATA GENERATION

The system should support synthetic/demo data.

Generate realistic records for:

- Suppliers
- Products
- PRs
- POs
- Shipments
- Trucks
- GPS locations
- Yard entries
- Dock assignments
- GRNs
- Invoices
- Exceptions
- Payments

The generated dataset should intentionally include:

### Normal cases

- Fully matched PO/GRN/Invoice
- On-time shipments
- Available docks

### Exception cases

- Quantity mismatch
- Price mismatch
- Delayed shipment
- Partial delivery
- Damaged goods
- Invoice mismatch
- Yard congestion
- Dock congestion

This is necessary so that the dashboard and business logic can demonstrate meaningful scenarios.

---

# 20. IMPORTANT IMPLEMENTATION PRINCIPLE

Do NOT build this application as a collection of disconnected pages.

All modules should be connected through the underlying business entities.

Example:

Clicking a PO should allow the user to see:

PO
→ Supplier
→ PO Items
→ Shipment
→ Truck
→ Current Location
→ ETA
→ Yard Entry
→ Dock Assignment
→ GRN
→ Invoice
→ 3-Way Match
→ Exception
→ Payment

Similarly, clicking a truck should allow the user to see:

Truck
→ Shipment
→ PO
→ Supplier
→ Destination
→ ETA
→ Yard
→ Dock
→ GRN
→ Invoice

The goal is to create an integrated end-to-end supply-chain visibility system rather than separate CRUD screens.

---

# 21. PRIMARY C2 VALUE PROPOSITION

The system should connect:

PROCUREMENT
+
PHYSICAL LOGISTICS
+
RECEIVING
+
FINANCE

into a single connected workflow.

The central concept is:

"Connect procurement decisions with real-time physical supply-chain execution and automatically identify downstream business risks and exceptions."

End-to-end flow:

PR
→ PO
→ Shipment
→ Truck
→ GPS / ETA
→ Yard
→ Dock
→ GRN
→ Invoice
→ 3-Way Match
→ Exception / Approval
→ Payment
→ Analytics