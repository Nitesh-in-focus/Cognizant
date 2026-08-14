# C2 — UPDATES 3
# Final 8-User Role Hierarchy, NLP PR Creation, AI PO Generation & End-to-End Traceability

## 1. FINAL 8 USERS

The application must have exactly these eight business roles:

1. WORKER
2. PROCUREMENT_OFFICER
3. SUPPLIER
4. TRUCK_DRIVER
5. LOGISTICS
6. GATE_POST_OFFICER
7. RECEIVING_QC
8. FINANCE

**Remove the Warehouse role everywhere.**
**Receiving and Quality Control are one combined role.**

This document overrides conflicting role definitions in previous updates.

---

## 2. WORKER

### Responsibilities
- Create Purchase Requisitions (PR)
- Use NLP/Gemini to create a PR from natural language
- Review and manually edit the AI-generated PR
- Submit PR
- View own PR history
- View approved/rejected status and rejection reasons

### Cannot
Approve/reject PR, approve/send PO, select suppliers, manage shipments/trucks, edit live tracking, assign dock/yard, create GRN, perform QC, perform payment matching, release payment, or resolve finance exceptions.

---

## 3. PROCUREMENT OFFICER

### Responsibilities
- Approve/reject PRs
- View rejected PRs
- Monitor AI supplier selection
- Review/approve AI-generated POs
- Edit PO before sending
- Send approved PO to supplier
- View supplier PO acceptance/rejection
- View rejected POs
- View exceptions
- Coordinate exception resolution
- View complete traceability matrix
- View all workflow/audit history

### Important restriction
Procurement Officer can **view** operational records but cannot edit records owned by Supplier, Driver, Logistics, Gate Post, Receiving/QC, or Finance.

Examples:
- Can view truck location, cannot edit it.
- Can view GRN, cannot edit it.
- Can view payment status, cannot alter payment records.

---

## 4. SUPPLIER

Supplier has access only to its own records.

### Can
- View/accept/reject own POs
- Request clarification
- Give rejection reason
- Manage own shipments
- Create/update ASN
- Enter truck details
- Request/assign a truck driver
- Provide dispatch details
- Provide origin/destination
- Provide expected arrival
- Provide tracking information
- View own shipment status
- Upload invoice PDF
- View own invoice status
- View own GRN/QC outcome
- View own supplier performance
- Receive own notifications

### Cannot
- Change approved company PO terms
- Edit GRN/QC
- Edit financial matching/payment
- Access another supplier
- Manually overwrite trusted GPS
- Change procurement approval history

---

## 5. TRUCK DRIVER

The driver has a deliberately minimal portal.

### Can
- View assigned shipment
- Accept/reject shipment assignment
- View own truck
- View own live location
- View origin
- View destination
- View map/route
- View distance travelled
- View remaining distance
- View ETA
- View assigned dock/yard status

### Cannot
Access PR, PO editing/approval, supplier management, other trucks, GRN, QC, invoice, payment, exceptions, or other users' data.

The driver may transmit GPS through the approved tracking mechanism but must not manually fabricate trusted coordinates.

---

## 6. LOGISTICS

### Responsibilities
- Monitor active trucks
- Monitor shipments
- Monitor live status and ETA
- Monitor delays
- Coordinate inbound/outbound transportation
- Handle logistics errors
- Coordinate driver assignments
- Escalate transportation issues
- View operational alerts
- View traceability

### Cannot
Approve PR/PO, edit procurement records, edit trusted live GPS, create/edit GRN, perform QC, perform 3-way match, or approve/release payment.

**LOGISTICS = MONITOR + COORDINATE.**

---

## 7. GATE POST OFFICER

This role controls facility arrival, yard, dock and the editable live-shipment operational map.

### Can
- Verify truck/driver/supplier/shipment/ASN
- Record gate arrival
- Manage yard
- Allocate parking
- Allocate dock
- Monitor dock availability
- Update live shipment status
- Update trusted operational location
- Move trucks between parking/dock states
- Manage inbound/outbound gate status

### Critical location rule
Only the **GATE_POST_OFFICER** may manually edit the live shipment map/location.

All other users are view-only for the operational map.

Driver GPS can automatically feed location, but this is not a manual location-edit permission.

---

## 8. RECEIVING_QC

Receiving and Quality Control are ONE combined role.

### Can
- View arriving shipments
- Monitor unloading
- Update unloading status
- Create/edit GRN
- Record received/damaged/accepted/rejected quantities
- Perform quality inspection
- Record quality score
- Upload QC evidence
- Finalize QC
- View supplier quality history
- Trigger supplier performance updates

### Cannot
Approve PR/PO, edit procurement records, modify trusted GPS, perform payment matching, approve/release payment, or alter supplier commercial data.

---

## 9. FINANCE

### Can
- Receive supplier invoice
- Enter invoice manually
- Upload/process invoice OCR
- Review/correct OCR extraction
- Perform PO + GRN + Invoice 3-way matching
- Create payment exceptions
- Put payment on hold
- Review/resolve finance-side issues
- Approve/release payment
- View payment and invoice history

### Cannot
Create/approve PR, edit PO, select supplier, edit shipment/truck location, assign dock, edit GRN/QC, or modify supplier rating.

---

# 10. ROLE PERMISSION MATRIX

| Action | Worker | Procurement | Supplier | Driver | Logistics | Gate Post | Receiving/QC | Finance |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Create PR | ✓ | View | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| NLP PR creation | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Approve/reject PR | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| AI supplier selection | ✗ | ✓ | ✗ | ✗ | View | ✗ | ✗ | ✗ |
| AI PO generation | ✗ | Monitor/confirm | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Edit PO | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Send PO | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Accept/reject PO | ✗ | View | ✓ own | ✗ | View | ✗ | ✗ | ✗ |
| Create/update shipment | ✗ | View | ✓ own | Limited own | ✓ | Arrival/status | View | ✗ |
| Assign/request driver | ✗ | ✗ | ✓ own | ✗ | Coordinate | ✗ | ✗ | ✗ |
| Accept/reject driver assignment | ✗ | ✗ | Request | ✓ own | Coordinate | ✗ | ✗ | ✗ |
| View live location | Limited | ✓ | Own | Own | ✓ | ✓ | ✓ | View |
| Edit live location | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Manage yard/dock | ✗ | View | Relevant view | View | View | ✓ | View | ✗ |
| Mark arrival | ✗ | View | View | Own status | View | ✓ | View | ✗ |
| Mark unloading | ✗ | View | View | ✗ | View | View | ✓ | ✗ |
| Create/edit GRN | ✗ | View | View | ✗ | View | View | ✓ | View |
| Quality check | ✗ | View | View own | ✗ | View | View | ✓ | View |
| Invoice upload | ✗ | View | ✓ own | ✗ | ✗ | ✗ | ✗ | ✓ |
| Invoice OCR | ✗ | View | Upload own | ✗ | ✗ | ✗ | ✗ | ✓ |
| 3-way match | ✗ | View | Own status | ✗ | View | ✗ | View | ✓ |
| Payment exception | ✗ | Coordinate | View own | ✗ | Operational | ✗ | View | ✓ |
| Payment approval/release | ✗ | View | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Traceability matrix | Own | ✓ full view | Own | Own shipment | ✓ | ✓ operational | ✓ receiving | ✓ finance |

---

# 11. NLP-BASED PR CREATION

PR creation must be **AI-first**.

Worker should have:

### NLP option
Example:

> “We need 500 units of industrial safety gloves for Warehouse A by 25 August 2026. Priority is high.”

Gemini extracts structured fields such as:
- Product
- Quantity
- Warehouse
- Required date
- Priority
- Other relevant fields

Then show an **AI-generated PR preview**.

Worker can:
- Edit fields
- Add missing information
- Confirm
- Submit

### Manual fallback
A normal structured PR form must remain available.

**NLP is the primary experience. Manual entry is the fallback.**

Never create a final PR directly from raw natural language.

Flow:

```text
Natural Language
↓
Gemini NLP extraction
↓
Structured PR draft
↓
Worker review/edit
↓
Worker confirmation
↓
PR submitted
↓
Procurement Officer approval
```

Store the original natural-language request for traceability.

---

# 12. PR APPROVAL / REJECTION

Procurement Officer receives `PENDING_APPROVAL`.

Actions:

`APPROVE`

or

`REJECT`

If rejected:
- status = `REJECTED`
- rejection reason required
- rejected_by
- rejected_at
- history entry created

Rejected PRs appear in a dedicated:

**REJECTED PR**

section.

Worker can see the rejection and reason.

---

# 13. APPROVED PR → AI SUPPLIER → AI PO

After PR approval:

```text
APPROVED PR
↓
Gemini supplier selection
↓
Supplier selected
↓
Gemini PO generation
↓
PO created
↓
Procurement Officer review
```

Supplier selection should consider:
- price
- quality
- delivery reliability
- historical delays
- quantity accuracy
- invoice accuracy
- capacity
- exceptions
- responsiveness
- compatibility

AI recommendation must be logged.

Manual supplier override must remain available.

If Gemini is unavailable, use rule-based/manual fallback.

---

# 14. AI PO GENERATION

PO is automatically generated from verified database data.

PO contains:
- PO ID/number
- PR ID
- supplier
- products
- quantities
- unit prices
- total
- delivery location
- required date
- terms
- shipping details
- priority

AI must NOT invent transactional identifiers, quantities, prices, supplier IDs, or product IDs.

Database values are authoritative.

PO status starts as:

`DRAFT_AI_GENERATED`

---

# 15. PO PROCUREMENT APPROVAL

Procurement Officer can:

- EDIT
- APPROVE
- REGENERATE
- REJECT

If rejected:

`REJECTED`

Require reason, user and timestamp.

Rejected POs appear in:

**REJECTED PO**

If approved:

`APPROVED`

Then Procurement Officer manually clicks:

**SEND TO SUPPLIER**

Never automatically send the PO.

---

# 16. SUPPLIER PO RESPONSE

Supplier can:

- ACCEPT
- REJECT
- REQUEST CLARIFICATION

If rejected:

`SUPPLIER_REJECTED`

Store:
- reason
- supplier
- timestamp
- PO ID
- user

Show a dedicated:

**SUPPLIER REJECTED POs**

section for Procurement Officer.

Notify Procurement Officer by in-app alert + email.

---

# 17. SHIPMENT WORKFLOW

After supplier accepts:

```text
Supplier accepts PO
↓
Shipment
↓
ASN
↓
Truck
↓
Driver assignment request
↓
Driver accepts/rejects
↓
Dispatch
↓
Live tracking
↓
AI ETA
↓
Logistics monitoring
↓
Gate Post arrival
↓
Yard/Dock
↓
Unloading
↓
GRN
↓
Quality Check
↓
Finance
```

Supplier manages only its own shipment data.

---

# 18. SUPPLIER SHIPMENT DATA

Supplier can manage:
- Shipment ID
- Shipment number
- ASN
- PO
- Product
- Quantity
- Origin
- Destination
- Dispatch date/time
- ETA
- Truck
- Driver
- Carrier
- Tracking reference
- Shipping documents

Use dropdowns for existing records and manual add/create when necessary.

---

# 19. DRIVER ASSIGNMENT

Supplier sends a driver assignment request.

Driver sees:
- shipment
- truck
- origin
- destination
- expected departure/arrival

Driver chooses:

`ACCEPT`

or

`REJECT`

If rejected:
- supplier is notified
- logistics is notified
- supplier can assign another driver
- rejection is stored in history

---

# 20. DRIVER DASHBOARD

Show ONLY:

```text
ASSIGNED SHIPMENT
SHP-10024

TRUCK
WB-12-AB-1234

FROM
Supplier Facility

TO
Destination Facility

CURRENT LOCATION
[Map]

DISTANCE TRAVELLED
126 km

DISTANCE REMAINING
84 km

ETA
3:40 PM

ASSIGNED DOCK
D04

STATUS
IN TRANSIT
```

No unrelated business modules.

---

# 21. LIVE TRACKING

When truck leaves supplier:

Record:
- dispatch time
- origin
- destination
- truck
- driver
- shipment
- ASN
- initial location
- ETA

Preferred source:
GPS/telematics.

Fallback:
supplier-provided tracking.

Demo fallback:
controlled simulation.

Store `location_source`.

---

# 22. LOCATION EDIT PERMISSION

This is a critical bug fix.

Only:

**GATE_POST_OFFICER**

can manually edit operational live-shipment location/status.

All others are VIEW ONLY.

Driver may transmit GPS automatically.

Supplier may provide declared tracking information.

Neither should be allowed to manually overwrite trusted operational coordinates.

Procurement, Logistics, Receiving/QC and Finance cannot manually edit the live map.

---

# 23. LOGISTICS

Logistics monitors:
- active shipments
- active trucks
- inbound/outbound
- ETA
- delays
- driver assignments
- shipment errors
- tracking
- operational alerts

Logistics coordinates transportation but does not control the editable live map.

---

# 24. GATE POST

Gate Post Officer:
- verifies truck
- verifies driver
- verifies supplier
- verifies shipment
- verifies ASN
- records arrival
- manages gate
- manages yard
- assigns parking
- assigns dock
- edits live shipment map
- updates arrival/status

---

# 25. AI ETA + DOCK/PARKING

ETA uses:
- dispatch time
- current location
- origin/destination
- route/distance
- historical travel time
- speed where available
- shipment priority
- historical delays

Gemini can assist prediction, but live GPS/routing data remains authoritative.

For dock/parking, AI considers:
- ETA
- priority
- dock availability
- truck type
- shipment type
- yard capacity
- waiting time
- unloading duration

AI recommends:
`DOCK` or `PARKING`

Gate Post Officer has final authority.

**AI recommends. Gate Post decides.**

---

# 26. RECEIVING + QUALITY

After arrival:

```text
AT_DOCK
↓
UNLOADING
↓
UNLOADED
↓
GRN
↓
QUALITY CHECK
```

Only Receiving_QC can update unloading, create/edit GRN and finalize QC.

---

# 27. GRN

GRN is **MANUAL ONLY**.

Remove OCR from GRN.

Fields:
- GRN ID/number
- PO
- Shipment
- ASN
- Supplier
- Product
- Expected quantity
- Received quantity
- Damaged quantity
- Accepted quantity
- Rejected quantity
- Receiver
- Timestamp
- Remarks

Supplier can view its own result but cannot edit GRN.

---

# 28. QUALITY CHECK

QC occurs after physical receipt.

Evaluate:
- product quality
- quantity
- damage
- packaging
- documentation
- delivery condition

Statuses:
`PASSED`
`PASSED_WITH_ISSUES`
`FAILED`

After finalization:

```text
QC
↓
Supplier performance
↓
Supplier score
↓
Future AI supplier selection
```

This creates a continuous feedback loop.

---

# 29. INVOICE

Supplier sends invoice PDF to Finance.

Two modes:

### MANUAL
Finance manually enters invoice information.

### OCR
Finance uploads invoice PDF/image.
OCR extracts fields.
Finance reviews/corrects extracted data.
Then invoice is submitted.

OCR is **ONLY for invoices**.

No OCR for:
- PR
- PO
- GRN

---

# 30. THREE-WAY MATCH

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

Example:

```text
PO       = 1000
GRN      = 950
Invoice  = 1000
```

Result:

`MISMATCH`

If all required values match:

`MATCHED`

---

# 31. PAYMENT

Matched:

```text
MATCHED
↓
PAYMENT APPROVAL
↓
PAYMENT
↓
PAID
```

Finance owns payment approval/execution.

---

# 32. EXCEPTION HANDLING

If payment is not approved or the 3-way match fails:

```text
MISMATCH
↓
EXCEPTION
↓
PAYMENT HOLD
↓
PROCUREMENT OFFICER NOTIFIED
↓
PROCUREMENT INVESTIGATES/COORDINATES
↓
RESOLUTION
↓
FINANCE
↓
RE-MATCH
↓
PAYMENT
```

Procurement coordinates the business resolution.

Finance remains responsible for financial matching and payment.

---

# 33. REJECTED / FAILED SECTIONS

Create dedicated historical sections:

- `REJECTED PR`
- `REJECTED PO`
- `SUPPLIER REJECTED PO`
- `REJECTED DRIVER ASSIGNMENTS`
- `FAILED QUALITY CHECKS`
- `PAYMENT EXCEPTIONS`

Every rejected/failed record must show:
- record ID
- reason
- rejected/failed by
- timestamp
- previous status
- current status

Never permanently delete rejected business records.

---

# 34. COMPLETE TRACEABILITY MATRIX

Procurement Officer must be able to view the full chain:

```text
PR
↓
PO
↓
SUPPLIER
↓
SHIPMENT
↓
ASN
↓
TRUCK
↓
DRIVER
↓
GATE ENTRY
↓
DOCK/YARD
↓
GRN
↓
QUALITY CHECK
↓
INVOICE
↓
3-WAY MATCH
↓
EXCEPTION (if any)
↓
PAYMENT
```

Every stage must show:
- ID
- status
- creator
- approver
- rejector
- timestamp
- reason
- previous status
- current status
- related records

---

# 35. DATABASE RELATIONSHIPS

Use relational IDs and foreign keys.

Core relationship:

```text
PR
↓
PO
↓
SUPPLIER
↓
SHIPMENT
↓
ASN
↓
TRUCK
↓
DRIVER
↓
GATE_ENTRY
↓
DOCK/YARD
↓
GRN
↓
QUALITY_CHECK
↓
INVOICE
↓
THREE_WAY_MATCH
↓
EXCEPTION
↓
PAYMENT
```

Do not create disconnected duplicate copies of important business state.

Use:
- primary keys
- foreign keys
- referential integrity
- indexes
- transactions for critical operations

---

# 36. DYNAMIC DATA SYNCHRONIZATION

The database is the **single source of truth**.

If one record changes, every authorized connected view must update dynamically.

Example:

Shipment changes:

`IN_TRANSIT → ARRIVED_AT_FACILITY`

Then update automatically:
- Supplier shipment view
- Logistics dashboard
- Gate queue
- Live shipment map
- Procurement traceability
- ETA/status components
- Notifications where appropriate

Use Supabase Realtime/subscriptions for operational data.

Users should not need to manually refresh for important state changes.

---

# 37. TRANSACTION SAFETY

Critical multi-step operations must be atomic.

Example:

PO approval must update:
1. PO status
2. approval history
3. audit event
4. notification/event

Do not allow:

PO = APPROVED

while:

approval history = missing

Use backend transactions/functions where appropriate.

---

# 38. STATUS HISTORY

Every major entity must maintain history:

- PR
- PO
- supplier response
- shipment
- truck
- driver assignment
- gate entry
- dock assignment
- GRN
- QC
- invoice
- exception
- payment

Recommended history structure:

```text
history_id
entity_type
entity_id
old_status
new_status
changed_by
reason
timestamp
metadata
```

---

# 39. NO SILENT EDITS

Any important change must record old and new values.

Example:

```text
PO Quantity
Old: 1000
New: 950
Changed by: Procurement Officer
Reason: Supplier capacity adjustment
Timestamp: ...
```

Apply the same principle to shipment, truck, dock, GRN, QC, invoice, payment and exception records.

---

# 40. AI SERVICES

Centralize Gemini:

```text
Gemini AI
│
├── PR NLP Extraction
├── Supplier Selection
├── PO Generation
├── ETA Prediction
├── Shipment Prioritization
├── Dock/Parking Recommendation
├── Quality Assistance
└── C2 Query Assistant
```

All Gemini calls must go through secure backend/Edge Functions.

AI can recommend, extract, predict and draft.

AI must not bypass human authorization.

---

# 41. AI QUERY ASSISTANT

Create a C2 chat that answers application-related questions.

It must respect the logged-in user's permissions.

Examples:
- “Which shipments are delayed?”
- “Where is truck TRK-1002?”
- “Which suppliers have quality issues?”
- “Which POs were rejected?”
- “Which invoices are on hold?”

Do not give Gemini unrestricted SQL/database access.

Preferred:

```text
User
↓
Role/permission check
↓
Backend authorized data query
↓
Gemini
↓
Answer
```

---

# 42. NOTIFICATIONS

Important events generate in-app + email notifications.

Examples:
- PR approved/rejected
- PO generated
- PO sent
- Supplier accepts/rejects PO
- Driver assignment
- Driver rejection
- Truck arrival
- Shipment delay
- QC failure
- Invoice mismatch
- Payment
- Exception resolution

Supplier notifications must contain only that supplier's data.

---

# 43. ROLE-SPECIFIC DASHBOARDS

### Worker
- Create PR
- My PRs
- Approved PRs
- Rejected PRs
- Notifications

### Procurement Officer
- PR approvals
- AI supplier selection
- AI POs
- PO approval
- PO sending
- Supplier responses
- Rejected POs
- Exceptions
- Traceability matrix
- Notifications

### Supplier
- Own POs
- Accept/reject
- Own shipments
- ASN
- Truck/driver
- Invoice
- QC results
- Payment status
- Notifications

### Driver
- Assigned shipment
- Accept/reject
- Live map
- Origin
- Destination
- Distance
- ETA
- Dock/yard

### Logistics
- Active trucks
- Active shipments
- Inbound/outbound
- Delays
- Tracking
- Driver assignments
- Operational errors

### Gate Post Officer
- Arrivals
- Gate queue
- Live shipment map
- Yard
- Parking
- Docks
- Verification
- Location/status editing

### Receiving/QC
- Arrivals
- Dock assignments
- Unloading
- GRN
- Quality checks
- Failed QC
- Supplier quality history

### Finance
- Invoices
- OCR
- 3-way matching
- Mismatches
- Payment holds
- Exceptions
- Payment
- Payment history

---

# 44. FINAL END-TO-END WORKFLOW

```text
WORKER
↓
NLP PR CREATION
↓
WORKER REVIEW/EDIT
↓
PR SUBMITTED
↓
PROCUREMENT OFFICER
↓
PR APPROVED OR REJECTED
```

Rejected:

```text
PR
↓
REJECTED PR
↓
REASON
↓
WORKER NOTIFIED
```

Approved:

```text
APPROVED PR
↓
GEMINI AI SUPPLIER SELECTION
↓
SUPPLIER SELECTED
↓
GEMINI AI PO GENERATION
↓
PO CREATED
↓
PROCUREMENT OFFICER REVIEW
↓
PO APPROVED OR REJECTED
```

Rejected:

```text
PO
↓
REJECTED PO
↓
REASON
↓
PROCUREMENT HISTORY
```

Approved:

```text
APPROVED PO
↓
PROCUREMENT OFFICER SENDS
↓
SUPPLIER
↓
PO ACCEPTED OR REJECTED
```

Supplier rejected:

```text
SUPPLIER REJECTED
↓
SUPPLIER REJECTED PO SECTION
↓
PROCUREMENT ALERT
```

Supplier accepted:

```text
SUPPLIER
↓
SHIPMENT
↓
ASN
↓
TRUCK
↓
DRIVER REQUEST
↓
DRIVER ACCEPTS
↓
DISPATCH
↓
LIVE TRACKING
↓
AI ETA
↓
LOGISTICS
↓
GATE POST
↓
ARRIVAL
↓
YARD/DOCK
↓
RECEIVING/QC
↓
UNLOADING
↓
GRN
↓
QUALITY CHECK
↓
FINANCE
↓
INVOICE
↓
PO + GRN + INVOICE
↓
3-WAY MATCH
```

Matched:

```text
MATCHED
↓
PAYMENT APPROVAL
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
INVESTIGATION/COORDINATION
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

# 45. STATE-MACHINE PRINCIPLE

C2 must behave as a controlled state machine.

Every major record has:

```text
OWNER
STATUS
PREVIOUS STATUS
VALID NEXT STATUS
AUTHORIZED ROLE
HISTORY
TIMESTAMP
```

Users cannot jump arbitrary workflow states.

Examples:

Worker cannot:
`PR → APPROVED`

Supplier cannot:
`PO → PAID`

Driver cannot:
`SHIPMENT → RECEIVED`

Finance cannot:
`PR → APPROVED`

Only the authorized role can perform each transition.

---

# 46. SECURITY PRINCIPLE

Do not solve authorization by merely hiding buttons.

Every action must pass:

```text
AUTHENTICATED USER
↓
ROLE
↓
PERMISSION
↓
ENTITY OWNERSHIP
↓
CURRENT WORKFLOW STATUS
↓
VALID NEXT ACTION
```

If any check fails:

`403 FORBIDDEN`

Enforce this at:
- Frontend
- Backend/API
- Supabase RLS
- Database functions/constraints
- AI query layer

---

# 47. FINAL SUCCESS CRITERIA

The updated application is correct only when:

- Exactly 8 roles exist
- Warehouse role is completely removed
- Receiving and QC are one role
- Worker creates PR
- PR uses NLP/Gemini as the primary creation method
- Manual PR editing remains available
- Procurement Officer approves/rejects PR
- Rejected PRs are preserved with reasons
- Approved PR triggers AI supplier selection
- AI generates PO automatically
- Procurement Officer reviews/edits/approves PO
- Procurement Officer manually sends PO
- Supplier accepts/rejects PO
- Supplier rejection appears to Procurement
- Supplier manages its own shipment
- Supplier can assign/request a driver
- Driver accepts/rejects assignment
- Driver sees only own route/location/distance/ETA/dock
- Logistics monitors inbound/outbound transportation
- Gate Post controls editable live shipment map
- Everyone else is view-only for trusted live location
- Gate Post manages yard/dock/parking
- Receiving/QC handles unloading, GRN and QC
- Finance receives invoice
- Invoice supports manual + OCR
- GRN has no OCR
- PO has no OCR
- Finance performs 3-way match
- Payment mismatch creates exception
- Procurement Officer is notified
- Finance remains responsible for financial payment
- Every approval/rejection has history
- Every rejection has a reason
- Database entities are linked through IDs
- Changes propagate dynamically
- Critical operations are transaction-safe
- AI recommendations are logged
- AI cannot bypass authorization
- No user can access responsibilities belonging to another role

---

# 48. CORE PROJECT PRINCIPLE

C2 is one connected workflow:

```text
REQUEST
→ APPROVAL
→ AI
→ PROCUREMENT
→ SUPPLIER
→ TRANSPORT
→ GATE
→ RECEIVING
→ QUALITY
→ FINANCE
→ PAYMENT
→ FEEDBACK
```

The database is the single source of truth.

Every stage is connected.

Every important action is traceable.

Every role has only the authority it needs.

AI accelerates decisions, but authorized humans remain in control.
