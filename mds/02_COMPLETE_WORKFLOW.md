# C2 Supply Chain Management System
# Complete End-to-End Application Workflow

---

# 1. SYSTEM OBJECTIVE

Build an integrated Supply Chain and Procure-to-Pay (P2P) management platform that connects:

- Procurement
- Supplier Management
- Purchase Requisitions
- Purchase Orders
- Shipment Management
- Truck Tracking
- GPS / ETA
- Warehouse Management
- Yard Management
- Dock Management
- Goods Receiving
- Invoice Processing
- OCR
- 3-Way Matching
- Exception Management
- Payment Management
- Alert & Notification Management
- Analytics
- Power BI

The application should provide end-to-end visibility from the moment a business requirement is identified until the supplier is paid.

The central idea is:

BUSINESS NEED
→ PROCUREMENT
→ SUPPLIER
→ PURCHASE ORDER
→ SHIPMENT
→ TRUCK
→ TRACKING
→ WAREHOUSE
→ YARD
→ DOCK
→ GOODS RECEIPT
→ INVOICE
→ 3-WAY MATCH
→ EXCEPTION HANDLING
→ PAYMENT
→ ANALYTICS

---

# 2. HIGH-LEVEL APPLICATION FLOW

The complete application should follow this logical flow:

Business identifies requirement
        ↓
Purchase Requisition created
        ↓
PR approval
        ↓
Supplier sourcing / selection
        ↓
Purchase Order created
        ↓
PO approval
        ↓
Supplier confirmation
        ↓
Shipment created
        ↓
Truck assigned
        ↓
Truck dispatched
        ↓
Live truck tracking
        ↓
ETA calculation
        ↓
Truck approaches destination
        ↓
Warehouse arrival
        ↓
Gate verification
        ↓
Yard entry
        ↓
Dock availability check
        ↓
 ┌─────────────────────────────┐
 │ Is dock available?          │
 └──────────────┬──────────────┘
                │
        ┌───────┴────────┐
        │                │
       YES               NO
        │                │
        ↓                ↓
 Dock Assignment     Parking / Queue
        │                │
        │          Dock becomes free
        │                │
        └───────┬────────┘
                ↓
           Dock Assigned
                ↓
            Unloading
                ↓
       Physical Verification
                ↓
               GRN
                ↓
         Invoice received
                ↓
          OCR processing
                ↓
       Invoice data extracted
                ↓
          3-Way Matching
                ↓
       ┌────────┴─────────┐
       │                  │
     MATCH             MISMATCH
       │                  │
       ↓                  ↓
 Invoice Approval     Exception
       │                  ↓
       │             Payment Hold
       │                  ↓
       │             Human Review
       │                  ↓
       │              Resolution
       │                  ↓
       │            Reconciliation
       │                  ↓
       │              Re-Matching
       │                  ↓
       └──────────┬───────┘
                  ↓
             Payment Approval
                  ↓
                Payment
                  ↓
          Transaction Completed
                  ↓
              Analytics
                  ↓
          Historical Records

---

# 3. USER ROLES

The application should support role-based access.

Recommended roles:

## 3.1 Procurement Manager

Can:

- Create/approve PRs
- Review suppliers
- Create/approve POs
- View procurement analytics
- Review supplier performance

---

## 3.2 Warehouse Manager

Can:

- Monitor incoming shipments
- Monitor trucks
- Manage yard
- Manage docks
- Assign trucks to docks
- Review GRNs
- Handle receiving exceptions

---

## 3.3 Gate Operator

Can:

- Verify truck
- Verify shipment
- Record truck arrival
- Create yard entry
- Assign tracking/gate reference
- Send truck to parking/yard queue

---

## 3.4 Receiving Operator

Can:

- Verify physical goods
- Record received quantity
- Record damaged quantity
- Create GRN
- Complete receiving process

---

## 3.5 Finance / Accounts Payable

Can:

- Review invoices
- Review 3-way matching
- Handle exceptions
- Approve payments
- Put payments on hold
- Release payments
- View payment history

---

## 3.6 Administrator

Can:

- Manage users
- Manage warehouses
- Manage yards
- Manage docks
- Manage suppliers
- Configure alerts
- Configure system settings

---

# 4. APPLICATION STARTING POINT

After login, the user should see a role-specific dashboard.

The main dashboard should provide:

- Total active POs
- Pending approvals
- Active shipments
- Delayed shipments
- Trucks currently in transit
- Trucks currently in yard
- Trucks waiting for docks
- Available docks
- Occupied docks
- Pending GRNs
- Invoice mismatches
- Open exceptions
- Payments on hold
- Total pending payment value
- Recent alerts

---

# 5. PROCUREMENT WORKFLOW

## 5.1 Business Requirement

A department/warehouse identifies a requirement.

Example:

Warehouse requires:

1000 units of Product A.

The requester creates a Purchase Requisition.

---

## 5.2 Purchase Requisition Creation

User enters:

- Product
- Quantity
- Required date
- Destination warehouse
- Priority
- Reason

System creates:

PR ID
PR Number
PR Items

Status:

PENDING_APPROVAL

---

## 5.3 PR Approval

Procurement manager receives an alert.

Manager reviews:

- Product
- Quantity
- Required date
- Warehouse
- Budget/reason
- Priority

Possible actions:

APPROVE
REJECT
REQUEST_CHANGES

If rejected:

PR
→ REJECTED
→ Requester notified

If approved:

PR
→ APPROVED

---

# 6. SUPPLIER SELECTION

After PR approval, procurement identifies a suitable supplier.

The system should allow procurement to:

- Search suppliers
- Compare supplier performance
- View historical delivery performance
- View previous invoice mismatch rate
- View previous shipment delays
- Select supplier

For the MVP, supplier selection can be manual.

Optional future functionality:

PR
→ RFQ
→ Supplier Quotations
→ Price Comparison
→ Supplier Selection

---

# 7. PURCHASE ORDER WORKFLOW

After supplier selection:

System creates PO.

PO contains:

- Supplier
- Products
- Quantities
- Unit prices
- Taxes
- Total value
- Expected delivery date
- Destination warehouse
- Payment terms

PO status:

DRAFT

---

## 7.1 PO Approval

Procurement manager reviews PO.

If approved:

PO
→ APPROVED

Then:

PO
→ SENT TO SUPPLIER

Supplier confirms the order.

PO:

CONFIRMED

---

# 8. SHIPMENT CREATION

After supplier confirmation:

Supplier prepares goods.

Shipment is created.

Shipment contains:

- Shipment number
- PO
- Origin
- Destination
- Quantity
- Dispatch date
- Expected arrival
- Status

Shipment status:

PLANNED

---

# 9. TRUCK ASSIGNMENT

A truck is assigned to the shipment.

System records:

- Truck number
- Driver
- Driver phone
- Carrier
- Capacity
- Shipment
- Origin
- Destination

Shipment status:

DISPATCHED

Truck status:

IN_TRANSIT

---

# 10. TRUCK TRACKING

The system continuously receives or simulates truck location data.

Truck location data includes:

- Latitude
- Longitude
- Location name
- Timestamp
- Speed
- Status

The frontend should display:

- Current location
- Route
- Destination
- ETA
- Distance
- Delay status

---

# 11. ETA CALCULATION

The system calculates or updates ETA using:

- Current location
- Destination
- Distance
- Speed
- Expected arrival
- Current delay

Example:

Expected arrival:
10:00 AM

Current estimated arrival:
11:15 AM

Delay:

75 minutes

Shipment status:

DELAYED

---

# 12. SHIPMENT ALERTS

When predefined conditions are triggered, the Alert Engine should generate notifications.

Examples:

### Alert: Shipment Delay

Condition:

ETA exceeds expected arrival by configured threshold.

Example:

Delay > 30 minutes

Action:

Create alert.

Notify:

- Warehouse Manager
- Procurement Manager

---

### Alert: Severe Shipment Delay

Condition:

Delay > 2 hours.

Notify:

- Warehouse Manager
- Procurement Manager
- Relevant management

Severity:

HIGH

---

### Alert: Truck Approaching Warehouse

Condition:

Truck is within configured distance from warehouse.

Example:

Truck within 10 km.

Action:

Notify warehouse/gate team.

Message:

"Truck TRK-102 is approaching Warehouse WH-01. ETA: 20 minutes."

---

# 13. WAREHOUSE ARRIVAL

Truck reaches destination.

System detects:

Truck arrival

or gate operator manually records arrival.

System creates:

YARD_ENTRY

Truck status:

AT_YARD

Shipment status:

ARRIVED

---

# 14. GATE VERIFICATION

Gate operator verifies:

- Truck number
- Driver
- Shipment
- PO
- Supplier
- Destination
- Required documents

If verified:

gate_verified = TRUE

Truck is allowed into yard.

If verification fails:

Truck status:

VERIFICATION_FAILED

Create exception if required.

Alert:

Warehouse Manager notified.

---

# 15. YARD MANAGEMENT

After gate entry:

Truck enters yard.

System checks:

- Available docks
- Occupied docks
- Trucks waiting
- Yard capacity
- Dock type
- Shipment priority

---

# 16. DOCK AVAILABILITY

System checks:

Is a suitable dock available?

## YES

Assign truck to dock.

Create:

DOCK_ASSIGNMENT

Truck status:

AT_DOCK

---

## NO

Truck status:

WAITING

Truck moves to:

PARKING / WAITING AREA

System records:

- Entry time
- Waiting start time
- Yard location

---

# 17. YARD CONGESTION ALERT

If:

Number of trucks waiting > configured threshold

or

Average waiting time > configured threshold

Create:

YARD_CONGESTION alert.

Notify:

- Warehouse Manager

Example:

"Yard congestion detected. 14 trucks are currently waiting for dock assignment."

---

# 18. DOCK ASSIGNMENT

When a dock becomes available:

System identifies the next truck based on configurable priority.

Priority can consider:

- Shipment urgency
- Appointment time
- Waiting time
- Product priority
- Perishable goods
- Delay severity

System assigns:

Truck
→ Dock

Update:

Truck status = AT_DOCK

Dock status = OCCUPIED

---

# 19. DOCK WAITING ALERT

If a truck has been waiting longer than threshold:

Example:

Waiting > 30 minutes

Create:

DOCK_WAITING alert.

Notify:

Warehouse Manager.

---

# 20. UNLOADING

Dock operator starts unloading.

Record:

- Dock start time
- Unloading start
- Expected quantity
- Actual quantity
- Damaged quantity

When unloading finishes:

Dock becomes:

AVAILABLE

Truck status:

UNLOADING_COMPLETED

---

# 21. GOODS RECEIPT

Receiving operator physically verifies goods.

Compare:

Expected quantity
vs
Actual quantity

Example:

PO:

1000 units

Shipment:

1000 units

Actual received:

950 units

System records:

GRN = 950 units

---

# 22. GRN CREATION

System creates:

GRN

GRN contains:

- PO
- Shipment
- Yard Entry
- Receiving date
- Receiver
- Status

GRN Items contain:

- Product
- Ordered quantity
- Received quantity
- Damaged quantity
- Accepted quantity

---

# 23. RECEIVING EXCEPTIONS

If:

Actual quantity < expected quantity

create:

QUANTITY_MISMATCH

If:

Damaged quantity > 0

create:

DAMAGED_GOODS

If:

Wrong product received

create:

PRODUCT_MISMATCH

Each exception should have:

- Exception ID
- Type
- Expected value
- Actual value
- Difference
- Severity
- Status
- Description

---

# 24. INVOICE PROCESSING

Supplier sends invoice.

Invoice can be:

- PDF
- Image
- Digital document

User uploads invoice.

System stores document in:

Supabase Storage

System creates invoice record.

Initial status:

OCR_PENDING

---

# 25. OCR WORKFLOW

Invoice document:

PDF/Image
    ↓
OCR Service
    ↓
Extracted Text
    ↓
Structured Invoice Data
    ↓
Invoice Database

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

OCR status:

PROCESSED

If OCR fails:

OCR status:

FAILED

Create:

OCR_FAILURE alert

Notify:

Finance user.

Allow manual entry/correction.

---

# 26. OCR VALIDATION

Before matching:

System validates extracted fields.

Check:

- Supplier exists
- PO exists
- Invoice number exists
- Product exists
- Quantity is valid
- Price is valid
- Total amount is valid

If invalid:

Create:

DATA_VALIDATION_EXCEPTION

---

# 27. 3-WAY MATCHING

The matching engine compares:

PO
+
GRN
+
Invoice

At item level.

Compare:

1. Product
2. Quantity
3. Unit price
4. Supplier
5. PO reference
6. Total amount

---

# 28. MATCH CONDITION

Example:

PO:

1000 units
₹100/unit

GRN:

1000 units

Invoice:

1000 units
₹100/unit

Result:

MATCH

---

# 29. MISMATCH CONDITION

Example:

PO:

1000 units

GRN:

950 units

Invoice:

1000 units

Result:

QUANTITY_MISMATCH

---

Another example:

PO:

₹100/unit

Invoice:

₹120/unit

Result:

PRICE_MISMATCH

---

# 30. MATCHING ENGINE RESULT

If everything passes:

MATCH_STATUS = MATCHED

Invoice:

APPROVED_FOR_PAYMENT

---

If anything fails:

MATCH_STATUS = MISMATCH

Create:

EXCEPTION

Invoice:

PAYMENT_ON_HOLD

---

# 31. EXCEPTION MANAGEMENT

Every mismatch enters the exception workflow:

MISMATCH
    ↓
EXCEPTION CREATED
    ↓
PAYMENT HOLD
    ↓
HUMAN REVIEW
    ↓
ROOT CAUSE ANALYSIS
    ↓
RESOLUTION
    ↓
RECONCILIATION
    ↓
RE-MATCH
    ↓
APPROVAL

---

# 32. ROOT CAUSE ANALYSIS

The system should help determine where the problem originated.

Possible layers:

## Procurement Layer

Possible causes:

- Wrong PO quantity
- Wrong PO price
- Wrong supplier
- Incorrect product

---

## Shipment Layer

Possible causes:

- Partial shipment
- Missing shipment quantity
- Shipment delay
- Wrong shipment

---

## Warehouse Layer

Possible causes:

- Goods lost/damaged
- Incorrect receiving
- Wrong counting
- Dock/yard issue

---

## Supplier Layer

Possible causes:

- Supplier shipped incorrect quantity
- Supplier invoice incorrect
- Wrong product supplied
- Incorrect price on invoice

---

# 33. HUMAN REVIEW

Reviewer should see a single exception screen containing:

PO data
+
Shipment data
+
Truck data
+
GRN data
+
Invoice data
+
OCR extracted data
+
Matching differences

Example:

------------------------------------------------
EXCEPTION EX-1024
------------------------------------------------

PO Quantity:       1000
Received Quantity: 950
Invoice Quantity:  1000

Difference:        50 units

Supplier:          ABC Manufacturing

Shipment:          SHP-1002

Truck:             TRK-302

Status:            PAYMENT HOLD

------------------------------------------------

Reviewer actions:

[Confirm Supplier Error]
[Confirm Warehouse Error]
[Approve Partial Payment]
[Request Supplier Correction]
[Reject Invoice]
[Resolve Exception]
------------------------------------------------

---

# 34. RESOLUTION

Possible resolutions:

### Supplier Error

Supplier must correct invoice or send missing goods.

### Warehouse Error

Warehouse verifies physical receipt.

### Procurement Error

PO is corrected according to business approval.

### Invoice Error

Supplier submits corrected invoice.

---

# 35. RECONCILIATION

After resolution:

System updates:

- PO
- GRN
- Invoice
- Exception

Then performs matching again.

If matching succeeds:

Exception:

RESOLVED

Invoice:

APPROVED_FOR_PAYMENT

---

# 36. PAYMENT

After successful reconciliation:

Payment request is created.

Payment contains:

- Invoice
- Supplier
- Amount
- Payment method
- Payment reference
- Payment date

Payment status:

PENDING

---

# 37. PAYMENT APPROVAL

Finance manager approves payment.

Status:

APPROVED

Then payment is processed.

Status:

PAID

Invoice:

PAID

Exception:

CLOSED

PO:

COMPLETED

---

# 38. PAYMENT ALERTS

Generate alerts for:

### Payment Due Soon

Invoice due date approaching.

Example:

Due within 3 days.

Notify:

Finance team.

---

### Payment Overdue

Invoice exceeds due date.

Notify:

Finance manager.

---

### Payment Released

When payment is successfully processed:

Notify:

Relevant finance user.

Optional:

Notify supplier via email.

---

# 39. ALERT & NOTIFICATION ENGINE

The application should have a centralized Alert Engine.

Architecture:

EVENT
 ↓
RULE EVALUATION
 ↓
ALERT CREATED
 ↓
RECIPIENT IDENTIFICATION
 ↓
NOTIFICATION CHANNEL
 ↓
DELIVERY
 ↓
NOTIFICATION LOG

---

# 40. ALERT EVENT TYPES

The system should support alerts for:

## Procurement

- PR pending approval
- PR approved
- PR rejected
- PO pending approval
- PO approved
- PO rejected

## Shipment

- Shipment dispatched
- Shipment delayed
- Severe shipment delay
- Truck approaching
- ETA changed
- Shipment delivered

## Truck

- Truck entered yard
- Truck verification failed
- Truck waiting too long
- Truck assigned to dock

## Yard

- Yard congestion
- Waiting time exceeded
- Yard capacity threshold reached

## Dock

- Dock unavailable
- Dock assigned
- Dock waiting threshold exceeded
- Dock becomes available

## Receiving

- GRN created
- Quantity mismatch
- Damaged goods
- Wrong product

## Invoice

- Invoice received
- OCR completed
- OCR failed
- Invoice validation failed
- 3-way match successful
- 3-way match failed

## Exception

- Exception created
- Exception escalated
- Exception unresolved for too long
- Exception resolved

## Payment

- Payment pending
- Payment due soon
- Payment overdue
- Payment on hold
- Payment approved
- Payment completed

---

# 41. ALERT SEVERITY

Every alert should have severity:

LOW
MEDIUM
HIGH
CRITICAL

Example:

LOW:
Shipment ETA changed by 10 minutes.

MEDIUM:
Truck delayed by 45 minutes.

HIGH:
Truck delayed by 3 hours.

CRITICAL:
Major shipment failure affecting production.

---

# 42. NOTIFICATION CHANNELS

The system should support multiple notification channels.

## 42.1 In-App Notification

Primary MVP notification mechanism.

Show:

- Notification bell
- Unread count
- Alert list
- Severity
- Timestamp
- Related record

Example:

"Truck TRK-102 has been waiting for Dock D04 for 45 minutes."

---

## 42.2 Email

Use an email service/API.

Possible implementation:

Backend / Edge Function
→ Email Provider
→ User Email

Potential providers:

- Resend
- SendGrid
- SMTP
- Amazon SES

For MVP, choose one provider only.

---

## 42.3 SMS

Optional.

Backend:

Edge Function
→ SMS Provider
→ User Phone

Possible provider:

Twilio

Use only if time permits.

---

## 42.4 WhatsApp

Optional future feature.

Use a WhatsApp Business API provider.

Do not make this a core MVP dependency.

---

## 42.5 Voice Call

Optional high-severity alert mechanism.

Only use for:

CRITICAL alerts

Example:

Major shipment failure.

Architecture:

Alert Engine
→ Voice API
→ Phone Call

This is optional and should not block the core application.

---

# 43. ALERT DELIVERY LOGIC

Example:

Truck delay > 30 minutes

System detects:

DELAYED_SHIPMENT

Then:

1. Create alert
2. Identify warehouse manager
3. Create in-app notification
4. Send email
5. Store notification log

If delay > 2 hours:

1. Create HIGH severity alert
2. Notify warehouse manager
3. Notify procurement manager
4. Send email
5. Optionally send SMS

If CRITICAL:

1. In-app alert
2. Email
3. SMS
4. Optional voice call

---

# 44. NOTIFICATION PREFERENCES

Users should eventually be able to configure:

- Email ON/OFF
- SMS ON/OFF
- WhatsApp ON/OFF
- Critical alerts only
- All alerts
- Quiet hours

For MVP, use sensible defaults.

---

# 45. ALERT DATABASE

Recommended additional tables:

## alerts

Columns:

- `alert_id`
- `alert_type`
- `severity`
- `title`
- `message`
- `entity_type`
- `entity_id`
- `status`
- `created_at`
- `resolved_at`

---

## notifications

Columns:

- `notification_id`
- `alert_id`
- `user_id`
- `channel`
- `recipient`
- `status`
- `sent_at`
- `delivered_at`
- `error_message`

Possible channel:

- IN_APP
- EMAIL
- SMS
- WHATSAPP
- VOICE

Possible status:

- PENDING
- SENT
- DELIVERED
- FAILED

---

# 46. ALERT FLOW

Example:

Shipment delay detected

        ↓

Rule Engine

        ↓

Create Alert

        ↓

Severity Calculation

        ↓

Identify Users

        ↓

┌──────────────┬──────────────┬──────────────┐
│              │              │
▼              ▼              ▼
In-App        Email          SMS
│              │              │
└──────────────┴──────────────┘
               ↓
        Notification Log

---

# 47. ALERT RESOLUTION

An alert should not disappear automatically.

User can:

- Mark as read
- Acknowledge
- Assign
- Resolve
- Escalate

Example:

Shipment delay alert

OPEN
 ↓
ACKNOWLEDGED
 ↓
UNDER_REVIEW
 ↓
RESOLVED

---

# 48. ESCALATION

If an alert remains unresolved beyond a configured threshold:

Example:

Exception unresolved for 4 hours.

System automatically escalates.

Level 1:

Warehouse Manager

↓

Level 2:

Procurement Manager

↓

Level 3:

Senior Management

---

# 49. DASHBOARD ALERT CENTER

Main dashboard should include:

## Active Alerts

- Critical alerts
- High alerts
- Medium alerts
- Low alerts

Example:

CRITICAL — 2
HIGH — 5
MEDIUM — 11
LOW — 23

User can click an alert and navigate directly to the relevant record.

Example:

Alert:

"Truck TRK-102 delayed by 2h 15m."

Click:

→ Truck Tracking Page

---

# 50. END-TO-END DATA CONNECTION

The system must maintain relationships between all stages.

Example:

Supplier
 ↓
PO
 ↓
Shipment
 ↓
Truck
 ↓
GPS
 ↓
Warehouse
 ↓
Yard
 ↓
Dock
 ↓
GRN
 ↓
Invoice
 ↓
3-Way Match
 ↓
Exception
 ↓
Payment

The user should be able to navigate backwards and forwards through this chain.

---

# 51. TRACEABILITY

Every major transaction should be traceable.

For a payment, user should be able to see:

Payment
→ Invoice
→ Exception
→ GRN
→ Shipment
→ Truck
→ PO
→ Supplier
→ PR

For a truck:

Truck
→ Shipment
→ PO
→ Supplier
→ Warehouse
→ Yard
→ Dock
→ GRN
→ Invoice

For an invoice:

Invoice
→ Supplier
→ PO
→ PO Items
→ Shipment
→ GRN
→ 3-Way Match
→ Exception
→ Payment

This traceability is a core feature of the system.

---

# 52. POWER BI ANALYTICS WORKFLOW

Supabase PostgreSQL
        ↓
Power BI
        ↓
Data Model
        ↓
DAX Measures
        ↓
Reports
        ↓
Dashboard

Power BI should provide:

## Procurement Analytics

- PR count
- PO count
- PO value
- Supplier performance

## Shipment Analytics

- On-time delivery %
- Delayed shipment %
- Average delay
- ETA accuracy

## Truck Analytics

- Active trucks
- Average travel time
- Average waiting time
- Trucks currently in transit

## Yard Analytics

- Yard utilization
- Average waiting time
- Congestion frequency

## Dock Analytics

- Dock utilization
- Average unloading time
- Dock idle time

## Invoice Analytics

- Invoice count
- Match rate
- Mismatch rate
- OCR failure rate

## Exception Analytics

- Open exceptions
- Exceptions by type
- Exceptions by supplier
- Average resolution time

## Payment Analytics

- Pending payments
- On-hold payments
- Paid amount
- Outstanding amount

---

# 53. REAL-TIME / LIVE DATA FLOW

Operational application:

React
 ↓
Supabase
 ↓
PostgreSQL

Data changes continuously.

Examples:

Truck location updated
→ truck_locations updated

Truck enters yard
→ yard_entries created

Dock becomes occupied
→ docks status updated

GRN created
→ goods_receipts updated

Invoice processed
→ invoices updated

Exception created
→ exceptions updated

Alerts generated
→ alerts updated

React should refresh or subscribe to relevant changes using Supabase Realtime where appropriate.

---

# 54. POWER BI DATA FLOW

Supabase PostgreSQL
        ↓
Power BI PostgreSQL Connector
        ↓
Power BI Dataset
        ↓
Report
        ↓
Embedded Power BI Report
        ↓
React Application

For MVP:

Use refresh-based data if real-time analytics is not essential.

If fresher analytics are required:

Investigate DirectQuery or appropriate Power BI refresh architecture.

Power BI should NOT be responsible for the core operational workflow.

The React/Supabase application remains the primary operational system.

Power BI is the analytics layer.

---

# 55. OCR DATA FLOW

Invoice Upload
        ↓
Supabase Storage
        ↓
OCR Service
        ↓
Extracted JSON
        ↓
Backend / Edge Function
        ↓
Invoice
        ↓
Invoice Items
        ↓
Validation
        ↓
3-Way Matching

---

# 56. COMPLETE SYSTEM ARCHITECTURE

                         USERS
                           │
                           ▼
                    REACT FRONTEND
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
     Procurement      Logistics       Finance
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                    SUPABASE CLIENT
                           │
                           ▼
                    SUPABASE BACKEND
                           │
       ┌───────────────────┼──────────────────┐
       │                   │                  │
       ▼                   ▼                  ▼
   PostgreSQL          Edge Functions      Storage
       │                   │                  │
       │                   │                  │
       │                   ▼                  ▼
       │                  OCR             Documents
       │
       ├── Suppliers
       ├── Products
       ├── PRs
       ├── POs
       ├── Shipments
       ├── Trucks
       ├── GPS
       ├── Warehouses
       ├── Yards
       ├── Docks
       ├── GRNs
       ├── Invoices
       ├── Exceptions
       ├── Payments
       ├── Alerts
       └── Notifications
                           │
                           ▼
                    ALERT ENGINE
                           │
           ┌───────────────┼────────────────┐
           ▼               ▼                ▼
        In-App           Email             SMS
                                           │
                                  Optional WhatsApp
                                           │
                                  Optional Voice Call


                    POSTGRESQL
                         │
                         ▼
                     POWER BI
                         │
                         ▼
                  C2 ANALYTICS
                         │
                         ▼
                 REACT EMBEDDED REPORT

---

# 57. FAILURE HANDLING

Every external dependency should have failure handling.

## OCR Failure

OCR fails
→ Mark OCR FAILED
→ Create alert
→ Allow manual invoice entry

## Email Failure

Email fails
→ Store notification as FAILED
→ Retry
→ Keep in-app alert active

## GPS Failure

GPS data unavailable
→ Show last known location
→ Mark tracking status as STALE
→ Alert if threshold exceeded

## Power BI Failure

Power BI unavailable
→ Core React dashboard continues functioning

## Payment API Failure

Payment fails
→ Payment status FAILED
→ Create alert
→ Allow retry

The core application should not completely fail because one external service is unavailable.

---

# 58. MVP IMPLEMENTATION PRIORITY

Build in this order:

## PHASE 1 — Core Database

- Suppliers
- Products
- Warehouses
- PR
- PR Items
- PO
- PO Items
- Shipments
- Trucks
- Truck Locations
- Yards
- Docks
- Yard Entries
- GRNs
- GRN Items
- Invoices
- Invoice Items
- Exceptions
- Payments

---

## PHASE 2 — Core Application

Build:

- Login
- Dashboard
- Procurement
- Shipment Tracking
- Truck Tracking
- Yard/Dock Management
- GRN
- Invoice
- Exception Management
- Payment Status

---

## PHASE 3 — Matching Engine

Implement:

PO
+
GRN
+
Invoice
→
3-Way Match

Then:

MATCH
→ Payment

MISMATCH
→ Exception
→ Payment Hold

---

## PHASE 4 — OCR

Implement:

Invoice Upload
→ OCR
→ Extraction
→ Validation
→ Database

---

## PHASE 5 — Alerts

Start with:

1. In-App alerts
2. Email alerts

Only implement SMS/WhatsApp/Voice if sufficient time remains.

---

## PHASE 6 — Power BI

Connect:

Supabase
→ Power BI

Create management dashboard.

---

## PHASE 7 — Power BI Embedding

If time permits:

Power BI
→ React
→ C2 Analytics page

If embedding causes problems, keep Power BI as a separate analytics view/link.

Do NOT allow Power BI embedding to block the core application.

---

# 59. DEMO SCENARIO

The final demonstration should follow one complete story.

Example:

1. Procurement creates PR for 1,000 units.
2. Manager approves PR.
3. Supplier ABC is selected.
4. PO is created for 1,000 units.
5. PO is approved.
6. Supplier dispatches goods.
7. Truck TRK-102 is assigned.
8. Truck location is displayed on map.
9. Truck becomes delayed.
10. Alert is generated.
11. Warehouse receives delay notification.
12. Truck reaches warehouse.
13. Gate verifies truck.
14. Truck enters yard.
15. All docks are occupied.
16. Truck enters waiting queue.
17. Yard congestion alert is generated.
18. Dock becomes available.
19. Truck receives dock assignment.
20. Goods are unloaded.
21. Only 950 units are received.
22. GRN is created for 950 units.
23. Supplier invoice arrives for 1,000 units.
24. OCR extracts invoice information.
25. 3-way matching starts.
26. PO = 1,000
27. GRN = 950
28. Invoice = 1,000
29. System detects quantity mismatch.
30. Exception is created.
31. Payment is automatically placed on hold.
32. Finance manager receives an alert.
33. Human reviews PO, shipment, truck, GRN and invoice.
34. Root cause is identified.
35. Supplier is contacted.
36. Supplier sends corrected invoice OR missing goods are received.
37. GRN/invoice data is reconciled.
38. 3-way matching runs again.
39. Match succeeds.
40. Payment is approved.
41. Payment is processed.
42. Exception is closed.
43. Dashboard updates.
44. Power BI analytics reflects the updated business data.

This single scenario should demonstrate the complete value of the application.

---

# 60. FINAL SYSTEM PRINCIPLE

The system should not merely display data.

It should:

OBSERVE
→ DETECT
→ ALERT
→ INVESTIGATE
→ RESOLVE
→ RECONCILE
→ COMPLETE
→ ANALYZE

The core value proposition is:

"Provide end-to-end visibility across procurement, logistics, warehouse operations and finance while automatically detecting exceptions and notifying the right people before they become larger business problems."
