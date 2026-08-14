# C2 Synthetic Seed Data

This package contains 50 synthetic rows for each major operational table in the C2 supply-chain MVP.

## Important
The SQL assumes the table names and column names match the C2 specifications. Because Antigravity may have generated slightly different column names/types, have it inspect the existing Supabase schema and map/adjust the INSERT statements before executing them.

## Included
- suppliers
- products
- warehouses
- purchase_requisitions
- pr_items
- purchase_orders
- po_items
- shipments
- trucks
- truck_locations
- yards
- docks
- yard_entries
- dock_assignments
- goods_receipts
- grn_items
- invoices
- invoice_items
- exceptions
- payments
- alerts
- notifications
- audit_logs

The dataset intentionally contains both successful and problematic scenarios:
- shipment delays
- quantity mismatches
- price mismatches
- damaged goods
- OCR failures
- yard congestion
- dock waiting
- payment holds
- resolved exceptions
- completed payments

Ask Antigravity to validate the existing schema and foreign keys before running the seed.
