# SUPPLY SYNC — UPDATES 5
## PO Acceptance → Multi-Shipment Dispatch → Driver Assignment → Invoice → Payment + Traceability/NLP/QC Fixes

> This is the latest implementation update for Supply Sync. Apply these requirements to the current application and database. Do not break existing working functionality. Where this document conflicts with an older implementation, this document takes precedence.

---

# 1. CORE CHANGE — PO TO SHIPMENT WORKFLOW

Once the Procurement Officer approves and sends a PO:

```text
PO APPROVED
↓
PO SENT TO SUPPLIER
↓
SUPPLIER FEED
↓
SUPPLIER ACCEPTS / REJECTS PO
```

If accepted:

```text
PO ACCEPTED
↓
SHIPMENT CREATION
↓
DISPATCH MANAGEMENT
```

The PO remains available under Accepted POs / PO History / Related Records / Traceability, but transportation activity moves to **SHIPMENT & DISPATCH**.

---

# 2. SUPPLIER FEED — SENT PO

When Procurement sends a PO, it must appear in the correct supplier's feed.

Supplier card should show:

- PO ID
- Supplier
- Products
- Quantity
- Delivery Location
- Required Date
- Priority
- Total Amount
- PO Status
- Sent Date

Actions:

`ACCEPT PO` `REJECT PO` `VIEW PO`

Supplier rejection requires a reason and must notify Procurement.

---

# 3. ACCEPTED PO SECTION

After acceptance:

`PO STATUS = ACCEPTED_BY_SUPPLIER`

Show it under **ACCEPTED POs** rather than pending supplier approval.

The accepted PO must remain linked to:

- PR
- Supplier
- Shipments
- Trucks
- Drivers
- Invoice(s)
- GRN
- QC
- Exceptions
- Payment
- Traceability

---

# 4. ONE PO → MULTIPLE SHIPMENTS

A supplier can fulfil one PO using 1, 2, 3, 4, or any practical number of shipments.

Relationship:

```text
ONE PO
  ↓
ONE OR MANY SHIPMENTS
```

Every shipment must contain at least:

```text
shipment_id
po_id
supplier_id
shipment_number
quantity
origin
destination
status
dispatch_time
eta
asn_id
```

Example:

```text
PO-1001 = 1000 units

Shipment 1 = 300
Shipment 2 = 250
Shipment 3 = 200
Shipment 4 = 250

TOTAL = 1000
```

The backend must prevent total allocated shipment quantity from exceeding the PO quantity unless an authorized PO amendment exists.

---

# 5. SUPPLIER SHIPMENT CREATION

After accepting the PO, supplier gets **CREATE SHIPMENT**.

Supplier chooses:

- PO
- Product(s)
- Shipment quantity
- Origin
- Destination
- ASN
- Expected dispatch
- Expected arrival
- Truck/carrier information

Show:

```text
PO QUANTITY
ALLOCATED TO SHIPMENTS
REMAINING QUANTITY
```

Example:

```text
PO Quantity: 1000
Already allocated: 700
Remaining: 300
```

---

# 6. DISPATCH SECTION

Created shipments must appear in **SHIPMENT & DISPATCH**, not as active work inside the PO section.

Example:

```text
SHIPMENT ID: SHP-1004
PO: PO-1045
SUPPLIER: ABC Ltd
QUANTITY: 300
ASN: ASN-1004
STATUS: READY FOR DISPATCH
DRIVER: Not Assigned
ETA: Pending
```

Actions:

- Assign Driver
- View Shipment
- Prepare Dispatch
- Dispatch

---

# 7. SHIPMENT STATUS

Recommended states:

```text
CREATED
READY_FOR_DRIVER
DRIVER_REQUESTED
DRIVER_ACCEPTED
DRIVER_REJECTED
READY_FOR_DISPATCH
DISPATCHED
IN_TRANSIT
ARRIVED_AT_FACILITY
AT_DOCK
UNLOADING
UNLOADED
RECEIVED
COMPLETED
CANCELLED
```

Do not mark the PO as shipped. The shipment owns transportation status.

---

# 8. MULTIPLE DRIVER REQUESTS

Supplier can send a shipment request to multiple eligible drivers simultaneously.

Example:

```text
Shipment SHP-1004

Driver A → REQUESTED
Driver B → REQUESTED
Driver C → REQUESTED
Driver D → REQUESTED
```

Each request must contain:

- request_id
- shipment_id
- driver_id
- truck_id where applicable
- supplier_id
- sent_at
- expires_at
- status
- response_at

States:

`PENDING` `ACCEPTED` `REJECTED` `EXPIRED` `CANCELLED`

---

# 9. DRIVER REQUEST TIMEOUT

Supplier sets a response window, for example 10 minutes.

If the driver does not respond:

`PENDING → EXPIRED`

Supplier can then request other drivers.

---

# 10. FIRST ACCEPTANCE WINS

If multiple drivers receive a request, the first valid acceptance wins.

Example:

```text
Driver A → ACCEPT
Driver B → ACCEPT almost simultaneously
```

Database result must be exactly one winner:

```text
Driver A → ASSIGNED
Driver B → CANCELLED
```

or the reverse.

Never allow two drivers to become assigned to the same shipment.

Implement this atomically at the backend/database level using an appropriate transaction/locking/function strategy, not only frontend checks.

---

# 11. DRIVER ELIGIBILITY

Supplier can see eligible drivers with:

- Driver ID
- Driver name
- Availability
- Current assignment
- Truck where applicable
- Permitted location/status
- Relevant rating/history if used

Do not offer unavailable/ineligible drivers.

---

# 12. DRIVER FEED SECURITY

A request must appear only in the targeted driver's feed.

Every request must link:

```text
driver_id
shipment_id
supplier_id
```

Enforce this through Supabase RLS/backend authorization. Do not rely only on frontend filtering.

---

# 13. DRIVER ID — MANDATORY

Every driver account gets a unique Driver ID automatically at registration.

```text
Authentication Account
↓
Driver Profile
↓
Automatically generated Driver ID
```

Example:

`DRV-1001`, `DRV-1002`, `DRV-1003`

Link Driver ID to:

- auth user ID
- driver profile
- truck
- shipment
- assignment requests
- history

Supplier must see the Driver ID before assigning a driver.

---

# 14. DRIVER HISTORY

Driver dashboard must show:

- Accepted assignments
- Rejected assignments
- Expired requests
- Cancelled requests
- Successfully transported/completed shipments

Example:

```text
DRIVER ID: DRV-1024

Accepted: 42
Rejected: 6
Expired: 3
Cancelled: 5
Successfully Transported: 38
```

Detailed history should include:

```text
Shipment ID
PO ID
Supplier
Origin
Destination
Accepted At
Dispatched At
Arrived At
Completed At
Status
```

---

# 15. DISPATCH CONFIRMATION

After driver acceptance:

```text
DRIVER_ACCEPTED
↓
READY_FOR_DISPATCH
```

Supplier can then click **DISPATCH**.

```text
READY_FOR_DISPATCH
↓
DISPATCHED
↓
IN_TRANSIT
```

Store:

- dispatch timestamp
- shipment ID
- PO ID
- driver ID
- truck ID
- origin
- destination
- ASN
- tracking reference

After dispatch, show the shipment under **ACTIVE SHIPMENTS / IN TRANSIT**.

---

# 16. PO VS SHIPMENT SEPARATION

### PO section = commercial information

- PR
- PO
- Supplier
- Products
- Quantity
- Price
- Terms
- PO status
- Approval history
- Supplier acceptance

### Shipment section = transportation information

- Shipment
- PO reference
- ASN
- Truck
- Driver
- Dispatch
- Live tracking
- ETA
- Origin
- Destination
- Dock
- Arrival

The PO remains linked to shipment, but operational shipment activity belongs in Shipment & Dispatch.

---

# 17. INVOICE AFTER DISPATCH

After dispatch, supplier can submit an invoice.

Invoice must contain:

```text
invoice_id
po_id
supplier_id
shipment_id where applicable
invoice_date
amount
currency
document
status
```

Example:

```text
Invoice ID: INV-2001
PO ID: PO-1045
Shipment ID: SHP-1004
Supplier: ABC Ltd
```

For split shipments, support either multiple shipment-level invoices or a consolidated invoice linked to the PO and applicable shipments, according to business rules.

---

# 18. INVOICE DELIVERY TO FINANCE

Supplier uploads the invoice PDF:

```text
Supplier
↓
Invoice PDF
↓
Secure Storage
↓
Invoice Record
↓
Finance Dashboard
```

Finance must be able to:

- View invoice
- Preview/download PDF
- Run OCR
- Correct OCR extraction
- Link invoice to PO
- Link invoice to shipment
- Perform 3-way match

Where email integration exists, notify Finance by email as well.

---

# 19. THREE-WAY MATCHING FOR SPLIT SHIPMENTS

Finance performs:

```text
PO
+
GRN
+
INVOICE
↓
3-WAY MATCH
```

For partial deliveries, matching must account for:

```text
PO total
+
Shipment allocation
+
GRN received
+
Invoice quantity
```

Do not compare a partial-shipment invoice incorrectly against the entire PO quantity.

---

# 20. TRACEABILITY MATRIX — DATABASE CONNECTED

The Traceability Matrix must be a live database view, not a static diagram.

Example:

| Stage | ID | Status |
|---|---|---|
| PR | PR-1001 | COMPLETED |
| PO | PO-1045 | ACCEPTED |
| Shipment | SHP-1004 | IN_TRANSIT |
| Driver | DRV-1024 | ASSIGNED |
| Truck | TRK-1008 | IN_TRANSIT |
| Dock | D-04 | PENDING |
| GRN | — | PENDING |
| QC | — | PENDING |
| Invoice | — | PENDING |
| Payment | — | PENDING |

Every ID/node must open the actual database record.

---

# 21. TRACEABILITY STATUS LOGIC

Use accurate states such as:

```text
COMPLETED
ACTIVE
IN_PROGRESS
PENDING
REJECTED
FAILED
ON_HOLD
NOT_STARTED
```

Never mark future stages completed merely because a previous stage completed.

Example:

```text
PR       → COMPLETED
PO       → COMPLETED
SHIPMENT → ACTIVE
DRIVER   → COMPLETED
DOCK     → PENDING
GRN      → NOT_STARTED
QC       → NOT_STARTED
INVOICE  → PENDING
PAYMENT  → NOT_STARTED
```

---

# 22. TRACEABILITY CLICK BEHAVIOUR

Clicking PR shows PR data, NLP input, extracted fields, date, priority, approval/rejection and related PO.

Clicking PO shows PR, supplier, products, quantities, prices, approval, supplier response and related shipments.

Clicking Shipment shows shipment, PO, ASN, quantity, truck, driver, dispatch, tracking, ETA, gate, dock, GRN and invoice.

Clicking Invoice shows invoice ID, PO, shipment, supplier, amount, PDF, OCR data and match status.

Clicking Payment shows payment ID, invoice, PO, GRN, amount, match, approval and payment status.

All values must come from the actual database.

---

# 23. GATE CHECKING — PO RELATIONSHIP

Gate entry must be linked to:

```text
PO
Shipment
ASN
Truck
Driver
Supplier
```

Minimum gate data:

```text
Gate Entry ID
PO ID
Shipment ID
ASN ID
Truck ID
Truck Number
Driver ID
Driver Name
Supplier ID
Supplier Name
Arrival Time
Gate Status
Verification Status
Dock Assignment
```

Do not rely only on truck number. The truck must be associated with the correct shipment and PO through relational IDs.

---

# 24. GATE VERIFICATION

When the truck arrives, Gate Post/Logistics & Gate Post must be able to verify:

```text
Truck
↓
Shipment
↓
ASN
↓
PO
↓
Supplier
↓
Driver
```

Example:

```text
TRUCK: WB-12-AB-1234
DRIVER: DRV-1024
SHIPMENT: SHP-1004
ASN: ASN-1004
PO: PO-1045
SUPPLIER: ABC Ltd
```

---

# 25. QUALITY CHECK — RLS BUG FIX

The current Product Quality Check operation is failing due to Row Level Security.

Fix Supabase RLS correctly. Do **not** disable RLS globally.

Receiving + QC must be allowed to:

- INSERT quality checks
- UPDATE authorized quality checks
- SELECT required quality data

Other roles receive only their permitted access.

Supplier can view only its own finalized QC.
Procurement can view QC for procurement decisions.
Finance can view QC required for financial processing.

Inspect and test:

- authenticated user ID
- role mapping
- user profile
- Receiving + QC role
- table RLS state
- SELECT policy
- INSERT policy
- UPDATE policy
- DELETE policy
- foreign keys
- `auth.uid()`
- helper functions used by policies

Never solve this by disabling RLS.

---

# 26. QUALITY CHECK INPUT FACTORS

Expand the QC form beyond one generic rating.

Suggested 1–10 factors:

- Product Quality
- Quantity Accuracy
- Packaging Quality
- Damage Condition
- Documentation Accuracy
- Delivery Condition
- Compliance
- Overall Quality

Also record:

- damaged quantity
- rejected quantity
- accepted quantity
- missing quantity
- remarks
- evidence/photo if required

---

# 27. QUALITY SCORE CALCULATION

Store individual scores in the database.

Example:

```text
Product Quality      = 9
Quantity Accuracy    = 10
Packaging            = 8
Damage Condition     = 9
Documentation        = 10
Delivery Condition   = 8
Compliance            = 9
```

Calculate the overall score using one authoritative backend/database formula, preferably a configurable weighted average.

Do not let different frontend screens calculate different supplier scores.

---

# 28. SUPPLIER RATING UPDATE

When QC is finalized:

```text
QC FINALIZED
↓
Calculate Supplier Performance
↓
Create Supplier Rating Event
↓
Update Supplier Performance Summary
↓
Update Supplier Profile
↓
Update Supplier History
↓
AI Supplier Selection Data
```

The supplier profile should show:

- Current rating
- Quality rating
- Delivery rating
- Quantity accuracy
- Damage rate
- Completed orders
- Failed QC count
- Historical trend

A finalized QC should create one rating event unless an audited correction/revision occurs.

---

# 29. SUPPLIER RATING HISTORY

Every rating event must link to:

- supplier
- PO
- shipment
- GRN
- QC
- timestamp

Supplier history should show previous scores and trends.

---

# 30. AI SUPPLIER SELECTION MUST USE QC DATA

Gemini supplier selection should consider authorized structured supplier performance data:

- Quality score
- Delivery score
- Quantity accuracy
- Historical delays
- Damage rate
- Completed shipments
- Failed QC
- Price
- Capacity
- Previous exceptions

The recommendation and reasoning should be logged.

If AI is unavailable, retain a deterministic/manual fallback.

---

# 31. NLP DATE EXTRACTION — FIX

The current PR NLP sometimes fails to extract dates. Fix the extraction pipeline.

Support:

```text
by 25 August
before 25/08/2026
needed on 25 August
required next Monday
deliver within 10 days
tomorrow
next week
```

Gemini should return structured data such as:

```json
{
  "required_date": "2026-08-25",
  "date_confidence": 0.98,
  "date_source_text": "by 25 August"
}
```

Backend must validate AI output before saving.

---

# 32. NLP DATE NORMALIZATION

Store dates consistently in the database, preferably:

`YYYY-MM-DD`

Use timezone-aware timestamps where time is involved.

UI can display human-friendly dates, but database formats must remain consistent.

---

# 33. NLP URGENCY / PRIORITY DETECTION

Gemini must infer urgency from both natural-language wording and the required date.

Suggested priority levels:

```text
LOW
MEDIUM
HIGH
URGENT
```

Examples:

```text
"Need immediately" → URGENT
"Required within two weeks" → MEDIUM/HIGH depending on rules
"Required next month" → LOW/MEDIUM depending on rules
```

The system should show the reason.

Example:

```text
Priority: URGENT
Reason: Required date is within 24 hours.
```

Priority should be derived from:

```text
Natural Language
+
Required Date
+
Business Rules
↓
Priority
```

---

# 34. NLP VALIDATION

Before PR submission validate:

- Product
- Quantity
- Unit
- Required date
- Destination
- Priority
- Description

If required information is missing, ask the worker rather than inventing it.

---

# 35. NLP EXTRACTION LOGGING

Store:

- Original text
- Extracted values
- Confidence where available
- AI metadata where appropriate
- Worker corrections
- Final submitted values
- Timestamp

This is required for debugging extraction failures.

---

# 36. DRIVER ID VISIBILITY FOR SUPPLIER

Supplier driver-selection UI must show:

```text
Driver Name
Driver ID
Availability
Current Assignment
Truck
```

Example:

```text
Rahul Kumar
DRV-1024
AVAILABLE
Truck: WB-12-AB-1234
```

When sending a request:

```text
driver_id = DRV-1024
shipment_id = SHP-1004
supplier_id = SUP-001
```

The request must appear in that driver's feed only.

---

# 37. FINAL RELATIONAL STRUCTURE

The data model should behave like:

```text
PR
│
└── PO
     │
     ├── Supplier
     │
     ├── Shipment 1
     │    ├── ASN
     │    ├── Truck
     │    ├── Driver
     │    ├── Gate Entry
     │    ├── Dock
     │    ├── GRN
     │    ├── QC
     │    └── Invoice
     │
     ├── Shipment 2
     │    ├── ASN
     │    ├── Truck
     │    ├── Driver
     │    ├── Gate Entry
     │    ├── Dock
     │    ├── GRN
     │    ├── QC
     │    └── Invoice
     │
     └── Shipment N
          └── ...
```

This must be represented with real foreign-key relationships.

---

# 38. FINAL TRACEABILITY EXAMPLE

```text
PR
PR-1001
COMPLETED
↓
PO
PO-1045
ACCEPTED
↓
SUPPLIER
SUP-001
ABC Ltd
↓
SHIPMENT
SHP-1004
IN_TRANSIT
↓
TRUCK
TRK-1008
WB-12-AB-1234
↓
DRIVER
DRV-1024
Rahul Kumar
↓
GATE
GATE-202
PENDING
↓
DOCK
D-04
PENDING
↓
GRN
NOT CREATED
↓
QC
NOT STARTED
↓
INVOICE
NOT RECEIVED
↓
PAYMENT
NOT STARTED
```

Every item must be clickable and load the actual database record.

---

# 39. STATUS COHERENCE

Use consistent states:

```text
COMPLETED
ACTIVE
IN_PROGRESS
PENDING
REJECTED
FAILED
ON_HOLD
NOT_STARTED
```

Never show contradictory states between modules.

---

# 40. IMPLEMENTATION PRIORITY

Implement in this order:

### Priority 1 — Database relationships
PR → PO → Shipment → Driver/Truck → Gate → Dock → GRN → QC → Invoice → Payment.

### Priority 2 — PO acceptance and multi-shipment
Supplier PO feed, acceptance, shipment splitting and quantity validation.

### Priority 3 — Driver assignment
Driver IDs, multiple requests, timeout and first-acceptance-wins.

### Priority 4 — Invoice
PDF upload, PO/shipment linking and Finance feed.

### Priority 5 — Traceability
Connect every traceability node to actual records and dynamic statuses.

### Priority 6 — QC/RLS
Fix Quality Check RLS and implement expanded rating factors.

### Priority 7 — NLP
Fix date extraction, priority detection, validation and correction logging.

### Priority 8 — Supplier AI
Feed finalized supplier performance data into Gemini supplier selection.

---

# 41. FINAL SUPPLY SYNC WORKFLOW

```text
WORKER
↓
NLP PR
↓
WORKER REVIEW
↓
PROCUREMENT OFFICER
↓
PR APPROVED
↓
GEMINI SUPPLIER SELECTION
↓
GEMINI PO GENERATION
↓
PROCUREMENT OFFICER APPROVES
↓
PROCUREMENT OFFICER SENDS PO
↓
SUPPLIER FEED
↓
SUPPLIER ACCEPTS PO
↓
ACCEPTED PO
↓
SUPPLIER CREATES 1..N SHIPMENTS
↓
SHIPMENT / DISPATCH
↓
SUPPLIER SENDS DRIVER REQUESTS
↓
MULTIPLE DRIVERS MAY RECEIVE REQUEST
↓
FIRST VALID DRIVER TO ACCEPT WINS
↓
OTHER REQUESTS CANCELLED
↓
DRIVER ACCEPTED
↓
READY FOR DISPATCH
↓
DISPATCH
↓
AUTOMATIC TRACKING
↓
AI ETA
↓
LOGISTICS & GATE POST
↓
GATE ARRIVAL
↓
YARD / PARKING / DOCK
↓
RECEIVING + QC
↓
UNLOADING
↓
NLP/MANUAL GRN
↓
QUALITY CHECK
↓
SUPPLIER RATING
↓
SUPPLIER PERFORMANCE DATABASE
↓
FINANCE
↓
INVOICE PDF
↓
OCR / MANUAL
↓
PO + GRN + INVOICE
↓
3-WAY MATCH
```

Matched:

```text
MATCH
↓
PAYMENT
↓
SUPPLIER NOTIFIED
```

Mismatch:

```text
MISMATCH
↓
EXCEPTION
↓
PAYMENT HOLD
↓
PROCUREMENT OFFICER
↓
RESOLUTION
↓
FINANCE
↓
RE-MATCH
↓
PAYMENT
```

---

# 42. FINAL ACCEPTANCE CRITERIA

The update is correct only when:

- Sent POs appear in the correct supplier feed.
- Supplier can accept/reject a PO.
- Accepted POs appear under Accepted POs.
- One PO can generate any practical number of shipments.
- Shipment quantity cannot exceed remaining PO quantity.
- Shipment activity belongs in Shipment & Dispatch.
- Every shipment retains its PO ID.
- Supplier can request multiple drivers simultaneously.
- Driver requests have expiration times.
- Expired requests become EXPIRED.
- First valid driver acceptance wins atomically.
- Other pending requests are cancelled.
- Every driver has an automatically generated Driver ID.
- Supplier can see Driver ID before assigning a driver.
- Driver sees only requests assigned to that driver's account.
- Driver history tracks accepted, rejected, expired, cancelled and successfully transported shipments.
- Invoice contains Invoice ID + PO ID + shipment relationship.
- Finance can view/download supplier invoice.
- Split shipments are correctly handled by 3-way matching.
- Traceability is database-connected, not static.
- Clicking a traceability stage opens its real record.
- Completed/pending/active/rejected/on-hold states are accurate.
- Gate records link PO + shipment + ASN + truck + driver + supplier.
- Quality Check RLS is fixed without disabling RLS.
- Receiving + QC can create/edit/finalize QC.
- QC has multiple rating factors.
- Final QC updates supplier rating exactly once per QC.
- Supplier rating history is stored.
- Supplier profile rating is updated.
- Gemini supplier selection uses supplier quality/performance data.
- NLP reliably extracts dates.
- NLP normalizes dates.
- NLP determines urgency/priority using required date + language + business rules.
- Missing NLP information is flagged rather than invented.
- NLP extraction/corrections are logged.
- All connected records update dynamically through the database/realtime system.
- No unrelated driver can receive or view another driver's assignment.
- No manual GPS coordinate editing is available.
- Live tracking and simulation remain separate.
- Supply Sync remains the single source of truth for the complete workflow.

---

# 43. CORE PRINCIPLE

Supply Sync must operate as one interconnected system:

## REQUEST → PROCUREMENT → SUPPLIER → SHIPMENT → DRIVER → GATE → DOCK → RECEIVING → QUALITY → INVOICE → PAYMENT

The PO is the commercial parent.

The Shipment is the transportation execution record.

The database connects everything.

The Traceability Matrix visualizes the real database state.

AI assists decisions and extraction.

Authorized humans remain responsible for approvals and operational actions.

**No disconnected records.**
**No contradictory statuses.**
**No unauthorized edits.**
**No duplicate workflow state.**
