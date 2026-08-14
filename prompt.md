# C2 — MASTER BUILD PROMPT

You are the lead full-stack engineer responsible for building the complete C2 Supply Chain Management System described in the three specification files in this workspace:

1. 01_DATABASE_SCHEMA.md
2. 02_COMPLETE_WORKFLOW.md
3. 03_INTEGRATIONS_AND_TECHNICAL_ARCHITECTURE.md

READ ALL THREE FILES COMPLETELY BEFORE WRITING OR MODIFYING CODE.

These three files are the primary source of truth for the application.

Do not begin implementation until you have analyzed:
- Database entities
- Relationships
- Business workflows
- User roles
- Exception handling
- Alert system
- External integrations
- Power BI integration point
- Security requirements
- MVP priorities

If something is ambiguous, prefer the simplest implementation consistent with the specifications rather than inventing unnecessary architecture.

==================================================
# 1. PROJECT OBJECTIVE
==================================================

Build a polished, production-style hackathon MVP for an integrated Supply Chain and Procure-to-Pay management platform.

The application must connect:

Procurement
→ Purchase Requisition
→ Purchase Order
→ Supplier
→ Shipment
→ Truck
→ GPS / ETA
→ Warehouse
→ Yard
→ Dock
→ Goods Receipt
→ Invoice
→ OCR
→ 3-Way Match
→ Exception
→ Resolution
→ Payment
→ Alerts
→ Analytics

The application should not be a collection of disconnected CRUD pages.

The user must be able to trace a transaction end-to-end.

For example:

PO
→ Supplier
→ Shipment
→ Truck
→ Current Location
→ Warehouse
→ Yard
→ Dock
→ GRN
→ Invoice
→ 3-Way Match
→ Exception
→ Payment

==================================================
# 2. TECHNOLOGY STACK
==================================================

Use:

Frontend:
- React
- TypeScript
- Modern component-based architecture

Backend:
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions where backend logic is required

Development:
- Google Antigravity
- MCP where useful

Analytics:
- Power BI

Do not introduce unnecessary technologies such as:
- Microservices
- Kafka
- Redis
- Complex orchestration systems
- Unnecessary backend servers

unless there is a genuine requirement.

Keep the architecture simple enough to complete within the hackathon timeline.

==================================================
# 3. FIRST TASK — ANALYZE BEFORE CODING
==================================================

Before implementation:

1. Read all three MD files.
2. Identify every database entity.
3. Identify every relationship.
4. Identify every major workflow.
5. Identify every external integration.
6. Identify which features are P0, P1 and P2.
7. Identify all secrets/API credentials that will eventually be required.
8. Identify all places where external services may be unavailable.
9. Identify the Power BI integration point.
10. Create an implementation plan.

Do NOT immediately generate the entire application in one uncontrolled step.

Work incrementally.

After each major phase:
- Check for errors.
- Check database relationships.
- Check TypeScript compilation.
- Check Supabase integration.
- Check that the implemented workflow matches the MD specifications.
- Fix issues before moving to the next phase.

==================================================
# 4. DATABASE — IMPLEMENT FIRST
==================================================

Create the PostgreSQL schema in Supabase according to:

01_DATABASE_SCHEMA.md

Implement the required tables, including:

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

Use proper:
- Primary keys
- Foreign keys
- Constraints
- Indexes where useful
- Timestamps
- Status fields
- Relationships

Use UUIDs where appropriate.

Do not flatten everything into one giant table.

Maintain proper relational structure.

==================================================
# 5. SECURITY
==================================================

Implement Supabase Auth.

Implement appropriate Row Level Security.

Never expose:
- Supabase service-role key
- OCR API secrets
- Email API secrets
- SMS API secrets
- Power BI private credentials
- Any server-side secret

in frontend code.

Use environment variables.

Use Edge Functions for server-side operations requiring secrets.

==================================================
# 6. DEMO DATA
==================================================

Create realistic synthetic seed/demo data.

The data must cover the entire workflow.

Include:

- Multiple suppliers
- Multiple products
- Multiple warehouses
- Multiple PRs
- Multiple POs
- Multiple shipments
- Multiple trucks
- Truck location history
- Multiple yards
- Multiple docks
- Yard entries
- GRNs
- Invoices
- Exceptions
- Payments

IMPORTANT:

Do not create only successful records.

Intentionally create realistic exception scenarios:

1. Normal matched PO
2. Quantity mismatch
3. Price mismatch
4. Delayed shipment
5. Partial delivery
6. Damaged goods
7. Invoice mismatch
8. Yard congestion
9. Dock waiting
10. Payment hold
11. Resolved exception
12. Completed payment

This data is necessary for the dashboard and final demonstration.

==================================================
# 7. DEMO MODE
==================================================

Implement:

DEMO_MODE=true

when external APIs are unavailable.

Demo mode should support:

- Simulated GPS
- Simulated truck movement
- Simulated ETA
- Demo OCR
- Demo alerts
- Synthetic shipment updates
- Demo invoice extraction

The UI must clearly indicate when demo mode is active.

Do not permanently replace real integrations with fake data.

Create proper service abstractions so real APIs can be connected later.

==================================================
# 8. AUTHENTICATION
==================================================

Implement login using Supabase Auth.

Support these roles:

- ADMIN
- PROCUREMENT_MANAGER
- WAREHOUSE_MANAGER
- GATE_OPERATOR
- RECEIVING_OPERATOR
- FINANCE_MANAGER

Implement role-aware navigation and permissions.

Do not rely only on frontend permission checks.

==================================================
# 9. MAIN APPLICATION PAGES
==================================================

Create:

/login

/dashboard

/procurement

/purchase-requisitions

/purchase-orders

/suppliers

/products

/shipments

/trucks

/trucks/:id

/yard

/docks

/grn

/invoices

/invoices/:id

/exceptions

/exceptions/:id

/payments

/alerts

/analytics

/settings

==================================================
# 10. MAIN DASHBOARD
==================================================

Build a polished executive/operations dashboard.

Display:

PROCUREMENT:
- Pending PRs
- Pending POs
- PO value

LOGISTICS:
- Active shipments
- Delayed shipments
- Active trucks

TRUCKS:
- Trucks in transit
- Trucks in yard
- Trucks waiting

WAREHOUSE:
- Available docks
- Occupied docks
- Yard utilization

RECEIVING:
- Pending GRNs
- Quantity discrepancies
- Damaged goods

FINANCE:
- Invoice mismatches
- Open exceptions
- Payment holds
- Outstanding payment value

ALERTS:
- Critical
- High
- Medium
- Recent alerts

Use cards, tables, charts and meaningful visual hierarchy.

Do not overload the dashboard with unnecessary charts.

==================================================
# 11. PROCUREMENT MODULE
==================================================

Implement:

Purchase Requisition creation
→ PR approval
→ Supplier selection
→ Purchase Order creation
→ PO approval
→ Supplier confirmation

Users should be able to:

- View PRs
- Create PR
- Approve/reject PR
- View POs
- Create PO
- Approve/reject PO
- View supplier information
- View PO details
- View PO items

==================================================
# 12. SUPPLIER MODULE
==================================================

Create supplier management.

Display:

- Supplier name
- Contact
- Products
- PO count
- PO value
- Shipment performance
- Delay rate
- Invoice mismatch rate
- Exception count

Provide supplier detail pages.

==================================================
# 13. SHIPMENT MODULE
==================================================

Implement:

PO
→ Shipment
→ Truck

Shipment page should show:

- Shipment number
- PO
- Supplier
- Origin
- Destination
- Quantity
- Dispatch date
- Expected arrival
- Current ETA
- Delay
- Status
- Assigned truck

==================================================
# 14. TRUCK TRACKING
==================================================

Create a dedicated truck tracking experience.

Show:

- Truck number
- Driver
- Carrier
- Shipment
- Current location
- Destination
- ETA
- Delay
- Status
- Location history

Create a reusable map component.

If a real map API is unavailable:

Use DEMO_MODE and simulated coordinates.

Do not block the project on the map API.

==================================================
# 15. GPS SIMULATION
==================================================

Implement a demo GPS simulator.

A truck should appear to move through a predefined route.

Example:

Supplier
→ Checkpoint 1
→ Checkpoint 2
→ Warehouse

Periodically update:

- latitude
- longitude
- timestamp
- speed
- status

Use the same database/service architecture that would later accept real GPS data.

==================================================
# 16. ETA
==================================================

Create ETA logic.

Inputs:

- Current truck location
- Destination
- Expected arrival
- Route/travel time

Output:

- Current ETA
- Delay minutes
- Shipment status

If real routing API is unavailable:

Use demo ETA calculation.

==================================================
# 17. WAREHOUSE MODULE
==================================================

Create warehouse management.

Display:

- Warehouses
- Capacity
- Yard
- Docks
- Current trucks
- Available docks
- Occupied docks
- Waiting trucks

==================================================
# 18. YARD MANAGEMENT
==================================================

Create:

Yard overview

Display:

- Yard capacity
- Current trucks
- Waiting trucks
- Dock availability
- Average waiting time
- Congestion status

Allow:

- Gate entry
- Truck verification
- Yard entry
- Queue management
- Dock assignment

==================================================
# 19. DOCK MANAGEMENT
==================================================

Display docks visually.

Each dock should show:

- Dock number
- Type
- Status
- Assigned truck
- Start time
- End time

Statuses:

- AVAILABLE
- OCCUPIED
- MAINTENANCE

Implement:

Truck
→ Yard
→ Dock assignment

If no dock is available:

Truck
→ Waiting queue

When a dock becomes available:

Assign next appropriate truck.

==================================================
# 20. GOODS RECEIVING
==================================================

Implement GRN creation.

Receiving operator should be able to record:

- PO
- Shipment
- Product
- Ordered quantity
- Received quantity
- Damaged quantity
- Accepted quantity
- Inspection status

Example:

PO = 1000
Received = 950

System should detect:

50-unit discrepancy.

==================================================
# 21. INVOICE MODULE
==================================================

Implement invoice upload and management.

Allow:

- Upload PDF/image
- View invoice
- View invoice details
- View OCR status
- View matching status
- View payment status

Store documents using Supabase Storage.

==================================================
# 22. OCR
==================================================

Implement OCR using the integration architecture described in:

03_INTEGRATIONS_AND_TECHNICAL_ARCHITECTURE.md

Do not hard-code a provider into the UI.

Create:

OCRService

Support:

- Real provider when configured
- Demo OCR when DEMO_MODE=true

Extract:

- Invoice number
- Supplier
- PO number
- Invoice date
- Product
- Quantity
- Unit price
- Tax
- Total amount

Allow the user to review/correct OCR output before final matching.

==================================================
# 23. THREE-WAY MATCHING
==================================================

Implement the core matching engine.

Compare:

PO
+
GRN
+
Invoice

At item level.

Check:

- Supplier
- PO reference
- Product
- Quantity
- Unit price
- Total

Return:

MATCH

or:

MISMATCH

Show the comparison visually.

Example:

             PO       GRN      INVOICE

Quantity    1000      950       1000
Price       ₹100      —         ₹100

Result:

QUANTITY MISMATCH

==================================================
# 24. EXCEPTION MANAGEMENT
==================================================

If matching fails:

MISMATCH
→ EXCEPTION
→ PAYMENT HOLD

Create a detailed exception page.

Show:

- Exception ID
- Type
- Severity
- Expected value
- Actual value
- Difference
- PO
- Supplier
- Shipment
- Truck
- GRN
- Invoice
- Description
- Timeline

Allow:

- Acknowledge
- Assign
- Investigate
- Resolve
- Escalate
- Close

==================================================
# 25. ROOT CAUSE ANALYSIS
==================================================

The exception page should help identify the problem layer.

Possible layers:

- PROCUREMENT
- SUPPLIER
- SHIPMENT
- WAREHOUSE
- RECEIVING
- INVOICE

Allow reviewer to record root cause.

Example:

50 units missing.

Possible root causes:

SUPPLIER_SHORT_SHIPMENT
WAREHOUSE_RECEIVING_ERROR
TRANSPORT_LOSS
DATA_ENTRY_ERROR

==================================================
# 26. PAYMENT
==================================================

If invoice matches:

Invoice
→ Approved
→ Payment

If mismatch:

Invoice
→ Payment Hold

After resolution:

Exception
→ Resolved
→ Reconciliation
→ Re-match
→ Payment

Payment page should display:

- Invoice
- Supplier
- Amount
- Status
- Payment date
- Transaction reference

==================================================
# 27. ALERT ENGINE
==================================================

Implement a centralized Alert Engine.

Events include:

- PR pending approval
- PO pending approval
- Shipment delayed
- Severe shipment delay
- Truck approaching
- Truck verification failure
- Yard congestion
- Dock waiting
- Quantity mismatch
- Damaged goods
- OCR failure
- Invoice validation failure
- 3-way match failure
- Exception created
- Exception escalated
- Payment due
- Payment overdue
- Payment on hold
- Payment completed

Architecture:

EVENT
→ RULE
→ ALERT
→ RECIPIENT
→ NOTIFICATION
→ LOG

==================================================
# 28. ALERT SEVERITY
==================================================

Use:

LOW
MEDIUM
HIGH
CRITICAL

Examples:

LOW:
ETA changed by 10 minutes.

MEDIUM:
Truck delayed by 45 minutes.

HIGH:
Truck delayed by 2+ hours.

CRITICAL:
Major supply chain disruption.

==================================================
# 29. NOTIFICATIONS
==================================================

MVP notification channels:

1. In-App
2. Email

Optional:

3. SMS
4. WhatsApp
5. Voice

Do NOT make SMS/WhatsApp/Voice a dependency for the core project.

Implement the alert engine so additional channels can be added later.

==================================================
# 30. IN-APP ALERT CENTER
==================================================

Create:

/alerts

Show:

- Alert title
- Severity
- Message
- Related entity
- Timestamp
- Status

Actions:

- Mark read
- Acknowledge
- Resolve
- Escalate

Clicking an alert should navigate to the relevant record.

Example:

Shipment delay alert
→ Shipment page
→ Truck
→ Location
→ Warehouse

==================================================
# 31. EMAIL
==================================================

Create an email integration abstraction.

Example:

sendEmail()

Use provider configured through environment variables.

If no email provider is configured:

- Keep in-app notification working.
- Store email notification as pending/demo.
- Do not break the application.

==================================================
# 32. REALTIME
==================================================

Use Supabase Realtime for appropriate operational data.

Potential realtime entities:

- truck_locations
- trucks
- shipments
- yard_entries
- docks
- dock_assignments
- invoices
- exceptions
- alerts
- notifications

When truck location changes:

Update map automatically.

When dock status changes:

Update yard UI automatically.

When exception is created:

Update dashboard alert count.

==================================================
# 33. POWER BI PLACEHOLDER
==================================================

Create:

/analytics

The page must be designed specifically for future Power BI integration.

Create a clean component such as:

PowerBIReportContainer

Initially, if Power BI is not configured:

Show the native analytics dashboard or a clear placeholder.

Do NOT make Power BI a dependency for the application.

Create a clean integration point so I can later add:

- Report ID
- Workspace ID
- Embed URL
- Authentication/token configuration

without rewriting the analytics page.

==================================================
# 34. NATIVE ANALYTICS FALLBACK
==================================================

Before Power BI is connected, create a native React analytics dashboard using application data.

Show:

- PO value
- Active shipments
- Delayed shipments
- On-time delivery %
- Active trucks
- Yard waiting time
- Dock utilization
- Invoice match rate
- Open exceptions
- Exception resolution time
- Payment hold value
- Paid amount

This ensures the application remains complete even before Power BI integration.

==================================================
# 35. API ABSTRACTION
==================================================

External API calls must NOT be embedded directly into UI components.

Use service modules.

Example:

/services/ocr
/services/maps
/services/routing
/services/notifications
/services/powerbi
/services/matching
/services/alerts

UI components should call services.

Services should call Edge Functions/API endpoints where necessary.

==================================================
# 36. ENVIRONMENT CONFIGURATION
==================================================

Create:

.env.example

Include placeholders for:

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

Server-side:

SUPABASE_SERVICE_ROLE_KEY

OCR_API_KEY

MAPS_API_KEY

ROUTING_API_KEY

EMAIL_API_KEY

SMS_API_KEY

Power BI configuration placeholders.

Never commit real secrets.

==================================================
# 37. API FAILURE HANDLING
==================================================

External API failure must never crash the core application.

If:

OCR fails
→ Allow manual invoice entry.

Maps fail
→ Use demo map/tracking mode.

GPS unavailable
→ Show last known location.

Email fails
→ Keep in-app alert active.

Power BI unavailable
→ Show native analytics.

Payment API fails
→ Mark payment as failed and allow retry.

==================================================
# 38. UI/UX
==================================================

Build a professional enterprise supply-chain dashboard.

Design goals:

- Clean
- Modern
- Responsive
- Data-dense but readable
- Clear status indicators
- Clear severity indicators
- Fast navigation
- Consistent components
- Professional enterprise appearance

Avoid excessive animations.

Prioritize usability.

Important status colors should be consistent:

SUCCESS
WARNING
ERROR
INFO

Do not use colors randomly across different pages.

==================================================
# 39. GLOBAL SEARCH
==================================================

If practical, implement global search.

Search by:

- PO number
- PR number
- Shipment number
- Truck number
- Invoice number
- GRN number
- Supplier
- Exception number

Search result should navigate directly to the relevant entity.

==================================================
# 40. END-TO-END TRACEABILITY
==================================================

This is one of the most important features.

Every entity should link to related entities.

Example:

PO:

PO-1025

Supplier:
ABC Manufacturing

Shipment:
SHP-201

Truck:
TRK-102

Current location:
Checkpoint 4

ETA:
10:45 AM

Warehouse:
WH-01

Yard:
YARD-01

Dock:
D-04

GRN:
GRN-301

Invoice:
INV-901

Match:
MISMATCH

Exception:
EX-501

Payment:
ON_HOLD

The user should be able to navigate through this chain.

==================================================
# 41. AUDIT LOGGING
==================================================

Where practical, implement audit logging for critical actions:

- PR approval
- PO approval
- Shipment dispatch
- Truck verification
- Dock assignment
- GRN creation
- Invoice upload
- OCR processing
- Match result
- Exception creation
- Exception resolution
- Payment approval
- Payment completion

==================================================
# 42. IMPLEMENTATION ORDER
==================================================

Follow this order.

PHASE 1:
Project setup

PHASE 2:
Supabase connection

PHASE 3:
Database schema

PHASE 4:
Seed/demo data

PHASE 5:
Authentication

PHASE 6:
Dashboard shell/navigation

PHASE 7:
Procurement

PHASE 8:
Shipment + truck tracking

PHASE 9:
Warehouse + yard + docks

PHASE 10:
GRN

PHASE 11:
Invoice

PHASE 12:
3-way matching

PHASE 13:
Exception management

PHASE 14:
Payment

PHASE 15:
Alert engine

PHASE 16:
Email

PHASE 17:
OCR

PHASE 18:
Map/GPS

PHASE 19:
Native analytics

PHASE 20:
Power BI integration placeholder

PHASE 21:
Testing

PHASE 22:
Polish

==================================================
# 43. P0 — MUST WORK
==================================================

The following are mandatory:

- Supabase
- PostgreSQL
- Authentication
- Procurement
- Suppliers
- Products
- Purchase Orders
- Shipments
- Trucks
- Yard
- Docks
- GRN
- Invoices
- 3-way matching
- Exceptions
- Payment status
- Dashboard
- Demo data
- End-to-end traceability

==================================================
# 44. P1 — HIGH VALUE
==================================================

Implement if possible:

- OCR
- Truck map
- Simulated GPS
- ETA
- Realtime
- Alert engine
- Email notifications

==================================================
# 45. P2 — OPTIONAL
==================================================

Only implement after P0/P1 are stable:

- Power BI embedding
- SMS
- WhatsApp
- Voice calls
- Advanced predictive analytics
- Advanced supplier scoring
- Advanced AI features

==================================================
# 46. DEMO SCENARIO
==================================================

The application must support this complete demonstration:

1. Create PR for 1,000 units.
2. Approve PR.
3. Select supplier.
4. Create PO.
5. Approve PO.
6. Create shipment.
7. Assign truck.
8. Show truck moving on map/demo GPS.
9. Simulate shipment delay.
10. Generate alert.
11. Truck approaches warehouse.
12. Gate verification.
13. Yard entry.
14. All docks occupied.
15. Truck waits.
16. Yard/dock alert generated.
17. Dock becomes available.
18. Truck assigned to dock.
19. Goods unloaded.
20. Only 950 units received.
21. GRN created for 950 units.
22. Supplier invoice for 1,000 units uploaded.
23. OCR extracts invoice information.
24. 3-way matching runs.
25. Quantity mismatch detected.
26. Exception created.
27. Payment automatically placed on hold.
28. Finance manager receives alert.
29. Reviewer opens exception.
30. Reviewer sees PO + shipment + truck + GRN + invoice.
31. Root cause recorded.
32. Exception resolved.
33. Invoice reconciled.
34. 3-way matching succeeds.
35. Payment approved.
36. Payment marked completed.
37. Exception closed.
38. Dashboard updates.
39. Analytics update.

This must be possible using demo data even if external APIs are unavailable.

==================================================
# 47. QUALITY REQUIREMENTS
==================================================

Do not leave:

- Broken routes
- Placeholder buttons that pretend to work
- Dead navigation
- Unhandled errors
- Hardcoded secrets
- Fake data permanently embedded in components
- Duplicate business logic
- Unnecessary tables
- Unnecessary dependencies

If a feature is not fully implemented:

Either:
1. Implement a functional demo-mode fallback, or
2. Clearly mark it as an integration placeholder.

Never silently fake real-world functionality.

==================================================
# 48. CODE ORGANIZATION
==================================================

Keep code modular.

Recommended structure:

src/

    components/
        dashboard/
        procurement/
        shipments/
        trucks/
        yard/
        docks/
        grn/
        invoices/
        exceptions/
        payments/
        alerts/
        analytics/

    pages/

    services/
        ocr/
        maps/
        routing/
        alerts/
        notifications/
        matching/
        powerbi/

    hooks/

    lib/
        supabase/

    types/

    utils/

    config/

Do not put the entire application inside one or two massive files.

==================================================
# 49. DATABASE ACCESS
==================================================

Use typed database access where practical.

Avoid blindly querying all columns.

Only retrieve fields needed by each page.

Use appropriate joins and indexes.

Respect foreign key relationships.

==================================================
# 50. BUSINESS LOGIC
==================================================

Critical business logic should be centralized.

Do NOT implement separate versions of 3-way matching on different pages.

Do NOT implement separate versions of shipment delay calculation on different pages.

Create reusable services/functions.

Examples:

ThreeWayMatchService
ShipmentDelayService
ETAService
AlertEngine
ExceptionService
PaymentService

==================================================
# 51. FINAL ACCEPTANCE TEST

Before considering the project complete, verify:

[ ] Login works

[ ] Roles work

[ ] Database connected

[ ] Seed data exists

[ ] Dashboard loads

[ ] PR can be created

[ ] PR can be approved

[ ] PO can be created

[ ] PO can be approved

[ ] Shipment exists

[ ] Truck exists

[ ] Truck tracking works

[ ] Demo GPS works

[ ] ETA works

[ ] Warehouse exists

[ ] Yard works

[ ] Dock assignment works

[ ] Waiting queue works

[ ] GRN can be created

[ ] Invoice can be uploaded

[ ] OCR works or demo OCR fallback works

[ ] Invoice items are stored

[ ] 3-way match works

[ ] Match scenario works

[ ] Mismatch scenario works

[ ] Exception is created

[ ] Payment is placed on hold

[ ] Exception can be resolved

[ ] Reconciliation works

[ ] Payment can be completed

[ ] Alert is generated

[ ] In-app notification works

[ ] Email integration is ready

[ ] Native analytics work

[ ] Power BI integration placeholder exists

[ ] No secrets are exposed

[ ] No major console errors

[ ] No broken routes

[ ] Demo scenario can be completed end-to-end

==================================================
# 52. MOST IMPORTANT INSTRUCTION
==================================================

Do NOT optimize for writing the maximum amount of code.

Optimize for a working, coherent, demonstrable end-to-end system.

The application must demonstrate:

VISIBILITY
+
AUTOMATION
+
EXCEPTION DETECTION
+
ALERTING
+
TRACEABILITY
+
ANALYTICS

The most important demonstration is:

PO
→ Shipment
→ Truck
→ Warehouse
→ Yard
→ Dock
→ GRN
→ Invoice
→ 3-Way Match
→ Exception
→ Payment Hold
→ Resolution
→ Payment

Everything else is secondary.

==================================================
# 53. START NOW
==================================================

First, inspect the three MD files.

Then provide a concise implementation plan based on them.

Then begin with:

1. Project setup
2. Supabase connection
3. Database schema
4. Seed/demo data
5. Authentication
6. Core application shell

After completing each phase, verify it before moving forward.

Do not wait for unnecessary clarification if the specifications already contain enough information.

Use sensible defaults where necessary.

Keep all external integrations modular.

Keep DEMO_MODE available.

Build the application incrementally and maintain a clean, working state throughout development.