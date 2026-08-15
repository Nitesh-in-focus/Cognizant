# Supply Sync — UPDATES 4
## Current Application Corrections & Feature Updates

> This document is the latest update for the existing application. Apply these changes to the current Supply Sync build without breaking working features. Where this file conflicts with an older implementation, this file takes precedence.

---

# 1. APPLICATION NAME

The application name is now:

# SUPPLY SYNC

Replace the old project/app name in all user-facing locations:

- Login/authentication
- Browser title
- Sidebar/navigation
- Dashboards
- Supplier portal
- Driver portal
- Procurement screens
- Logistics screens
- Receiving/QC screens
- Finance screens
- Notifications
- Emails
- AI Chat
- Reports
- Traceability
- Empty/error states

Use **Supply Sync** consistently.

Do not unnecessarily rename existing database tables if that could break existing data. Change application-facing labels first.

---

# 2. IMPORTANT CURRENT ROLE STRUCTURE

Merge:

- Gate Post Officer
- Logistics Coordinator

into:

## LOGISTICS & GATE POST

Also merge:

- Receiving
- Quality Control

into:

## RECEIVING + QC

The current functional business roles are therefore:

1. Worker
2. Procurement Officer
3. Supplier
4. Truck Driver
5. Logistics & Gate Post
6. Receiving + QC
7. Finance

If the existing application requires an eighth account type, use a **technical System Admin** role only. Do not invent another operational supply-chain role merely to reach eight. Admin must not alter the normal workflow unless explicitly performing an audited emergency/system action.

---

# 3. PR ↔ PO RELATIONSHIP

PR and PO must be directly linked.

Every PO must contain the originating `pr_id`.

Every PR must be able to show its related PO.

Users must be able to navigate:

```text
PR → Related PO
PO → Originating PR
```

Do not create disconnected duplicate records.

---

# 4. NLP PR CREATION

PR creation must be **NLP-first using Gemini**.

Example:

> "We need 500 safety gloves for Warehouse A by 25 August with high priority."

Gemini extracts:

- Product
- Quantity
- Required location
- Required date
- Priority
- Other relevant fields

Flow:

```text
Natural Language
↓
Gemini NLP
↓
Structured PR Draft
↓
Worker Review/Edit
↓
Submit PR
↓
Procurement Officer
```

Manual PR entry remains available as a fallback.

The worker must be able to correct the AI-generated draft before submission.

Store the original natural-language request for traceability.

---

# 5. AI PO GENERATION

After the Procurement Officer approves a PR:

```text
Approved PR
↓
Gemini Supplier Selection
↓
Supplier Selected
↓
Gemini PO Generation
↓
PO Draft
↓
Procurement Officer Review
↓
PO Approval
↓
Send to Supplier
```

The PO is generated automatically by Gemini.

The Procurement Officer can review/edit/approve it.

The Procurement Officer manually sends the approved PO to the supplier.

AI must never invent transactional values. Supplier IDs, product IDs, quantities, prices, PR IDs and other authoritative values must come from the database.

---

# 6. SUPPLIER PO RESPONSE

Supplier can:

- Accept PO
- Reject PO
- Request clarification

If rejected:

```text
PO REJECTED BY SUPPLIER
↓
Reason Required
↓
Procurement Officer Notified
↓
Rejected/Supplier-Rejected PO Section
```

Store:

- PO ID
- Supplier ID
- Reason
- User
- Timestamp
- Previous status
- New status

---

# 7. LIVE MAP — REMOVE MANUAL LOCATION EDITING

This is a critical correction.

There must be **NO generic manual "Update Location" button** on the live shipment map.

Users must not drag a truck marker or type arbitrary latitude/longitude.

The displayed truck position should come from the configured tracking source:

```text
GPS / Telematics / Simulation
↓
Backend
↓
Supabase
↓
Realtime
↓
Live Map
```

Users can view the location according to their permissions.

### Legitimate operational events may still be updated by Logistics & Gate Post:

- Arrived at facility
- Entered gate
- Assigned parking
- Assigned dock
- Started unloading
- Left dock
- Departed facility

These are **workflow events**, not manual GPS coordinate edits.

---

# 8. LOCATION DATA

Store:

- shipment_id
- truck_id
- latitude
- longitude
- timestamp
- accuracy
- speed where available
- heading where available
- location_source

Allowed location sources:

```text
GPS
TELEMATICS
SIMULATION
SUPPLIER_DECLARED
```

For the demo, simulation and live tracking must remain technically separate.

---

# 9. LIVE TRACKING VS SIMULATION

Create clearly separated modes.

### LIVE TRACKING

```text
Real Tracking Source
↓
Backend
↓
Database
↓
Live Map
```

### SIMULATION

```text
Simulation Engine
↓
Database/Realtime
↓
Simulation Map
```

The UI must clearly show:

`● LIVE TRACKING`

or:

`● SIMULATION MODE`

Do not place simulation controls inside the real live-tracking controls.

---

# 10. SUPPLIER SHIPMENT MANAGEMENT

Supplier can:

- Accept/reject PO
- Create shipment
- Create/update ASN
- Enter truck details
- Enter driver details
- Request/assign driver
- Provide dispatch information
- Provide origin/destination
- Provide tracking reference
- View shipment status
- Upload invoice

Supplier cannot manually overwrite trusted GPS coordinates.

Supplier can only access its own records.

---

# 11. DRIVER ID

When a driver registers:

```text
Driver Signup
↓
Authentication Account
↓
Unique Driver ID Generated
↓
Driver Profile Linked
```

Driver must not manually choose a random Driver ID.

Link:

```text
auth_user_id
↓
driver_id
↓
driver profile
↓
assigned truck
↓
assigned shipment
```

Driver profile should contain:

- Driver ID
- Name
- Phone
- Email
- License/reference data where required
- Account status
- Assigned truck
- Assigned shipment

---

# 12. DRIVER DASHBOARD

Driver should see only their own operational information:

- Assigned shipment
- Truck
- Current location
- Starting location
- Destination
- Map
- Distance travelled
- Distance remaining
- ETA
- Route
- Assigned dock/yard

Example:

```text
SHIPMENT: SHP-1024
TRUCK: WB-12-AB-1234

FROM: Supplier Facility
TO: Destination Facility

DISTANCE TRAVELLED: 126 KM
DISTANCE REMAINING: 84 KM
ETA: 03:40 PM

STATUS: IN TRANSIT
```

Driver cannot access PR, PO management, finance, GRN, QC or other users' records.

---

# 13. TRACEABILITY MATRIX — DYNAMIC

The traceability matrix must update dynamically whenever connected data changes.

Core chain:

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
EXCEPTION
↓
PAYMENT
```

Every stage should show:

- ID
- Current status
- Previous status
- Created by
- Approved by
- Rejected by
- Timestamp
- Reason
- Related records

Clicking a stage should open its detailed record.

Use Supabase Realtime where appropriate.

---

# 14. DYNAMIC DATABASE BEHAVIOUR

The database is the single source of truth.

If a source record changes, every authorized connected view must update.

Example:

```text
Shipment:
IN_TRANSIT
↓
ARRIVED_AT_FACILITY
```

This should update automatically in:

- Supplier shipment view
- Logistics dashboard
- Gate queue
- Live shipment status
- Procurement traceability
- Relevant notifications

Do not maintain disconnected copies of the same state.

Use primary keys, foreign keys, referential integrity and appropriate transactions.

---

# 15. DOCK MANAGEMENT

Every dock must be clickable.

Clicking a dock should open its detailed current data.

Minimum dock fields:

- Dock ID
- Dock number/name
- Status
- Current shipment
- Current truck
- Driver
- Supplier
- PO
- ETA
- Arrival time
- Unloading start
- Unloading end

Dock statuses:

```text
AVAILABLE
RESERVED
OCCUPIED
UNLOADING
MAINTENANCE
BLOCKED
```

Example:

```text
DOCK D-01
STATUS: OCCUPIED

SHIPMENT: SHP-1004
TRUCK: WB-12-AB-1234
DRIVER: Rahul Kumar
SUPPLIER: Supplier A
PO: PO-1004
ETA: 03:25 PM
ARRIVAL: 03:17 PM
UNLOADING: IN PROGRESS
```

Free dock:

```text
DOCK D-02
STATUS: AVAILABLE
```

Reserved dock:

```text
DOCK D-03
STATUS: RESERVED
NEXT TRUCK: TRK-1008
ETA: 04:10 PM
```

Dock cards must never show generic empty information when linked data exists.

---

# 16. DOCK DATA MUST UPDATE AUTOMATICALLY

When a truck is assigned:

```text
Dock status → RESERVED/OCCUPIED
```

When unloading starts:

```text
Dock status → UNLOADING
```

When unloading finishes and the truck leaves according to the workflow:

```text
Dock status → AVAILABLE
```

Update all relevant authorized dashboards through the database/realtime layer.

---

# 17. LOGISTICS + GATE POST MERGE

The new role:

# LOGISTICS & GATE POST

is responsible for:

- Truck monitoring
- Shipment monitoring
- Inbound
- Outbound
- Gate arrival
- Gate verification
- Yard
- Parking
- Dock allocation
- Live shipment monitoring
- Operational shipment errors
- Driver assignment monitoring
- Dock availability
- Gate events

This role is the operational transportation/facility-entry control center.

It can update legitimate operational workflow events.

It cannot manually fabricate GPS coordinates.

---

# 18. GATE POST CANNOT COMPLETE UNLOADING

Logistics & Gate Post can assign and monitor a dock.

It cannot mark unloading as completed.

Only:

# RECEIVING + QC

can mark:

```text
UNLOADING
↓
UNLOADED
```

Then Receiving + QC creates/finalizes the GRN and performs QC.

---

# 19. GRN — NLP + MANUAL

GRN must support:

1. NLP/AI-assisted entry
2. Manual entry

Example:

> "Received 950 units, 20 damaged and 30 missing."

Gemini creates a draft:

```text
Expected: 1000
Received: 950
Damaged: 20
Missing: 30
Accepted: 930
```

Receiving + QC reviews the draft and can correct it.

Flow:

```text
NLP Input
↓
Gemini Extraction
↓
GRN Draft
↓
Receiving + QC Review
↓
Manual Correction
↓
Confirm GRN
```

AI must not silently finalize GRN.

Manual entry must remain available.

---

# 20. GRN AUTHORITY

Only **Receiving + QC** can:

- Create GRN
- Edit GRN
- Finalize GRN

Other roles can only view according to permission.

GRN is linked to:

- PO
- Shipment
- ASN
- Supplier
- Products

---

# 21. QUALITY CHECK + SUPPLIER RATING

After unloading:

```text
UNLOADED
↓
GRN
↓
QUALITY CHECK
↓
FINALIZE QC
↓
UPDATE SUPPLIER RATING
```

Receiving + QC performs the quality check.

Possible outcomes:

```text
PASSED
PASSED_WITH_ISSUES
FAILED
```

Quality can evaluate:

- Product quality
- Quantity accuracy
- Damage
- Packaging
- Documentation
- Delivery condition

---

# 22. FIX SUPPLIER RATING BUG

Supplier rating must update only after a QC is finalized.

Do not update the rating multiple times for the same QC.

Use a unique relationship such as:

```text
QC_ID → Supplier Performance Event
```

A finalized QC should produce one supplier-performance event unless an audited correction/revision is explicitly made.

Suggested dimensions:

- Quality
- Quantity accuracy
- Delivery performance
- Damage rate
- Documentation
- Overall score

---

# 23. SUPPLIER FEEDBACK LOOP

Supplier performance must feed back into future AI supplier selection.

```text
SUPPLIER
↓
SHIPMENT
↓
RECEIVING
↓
QC
↓
SUPPLIER RATING
↓
DATABASE
↓
GEMINI SUPPLIER SELECTION
↓
FUTURE PR
```

This feedback loop is a core Supply Sync feature.

---

# 24. AI QUERY CHAT

Improve the existing chat section.

It should understand natural-language questions and provide intelligent answers from authorized application data.

Examples:

> "Which trucks are delayed?"

> "Which dock is free?"

> "Why is PO-1045 on hold?"

> "Which supplier has the best quality score?"

> "Show today's rejected POs."

> "Where is shipment SHP-1024?"

The AI must respect the logged-in user's permissions.

Do not give Gemini unrestricted database/SQL access.

Preferred architecture:

```text
User Question
↓
Role/Permission Check
↓
Authorized Backend Query
↓
Gemini
↓
Intelligent Answer
```

Example:

Instead of dumping rows for:

> "Why is PO-1045 delayed?"

Answer:

```text
PO-1045 is delayed because shipment SHP-204
is currently behind its expected arrival.

Current ETA: 4:20 PM
Reason: Late dispatch + current route delay
Supplier: Supplier A
```

Include optional links/actions:

- View PO
- View Shipment
- View Traceability

---

# 25. EMAIL + WHATSAPP ALERTS

Alert delivery should support:

- In-app notification
- Email
- WhatsApp where a valid approved API integration exists

Architecture:

```text
ALERT
↓
NOTIFICATION ROUTER
├── In-App
├── Email
└── WhatsApp
```

Do not send WhatsApp unless a valid WhatsApp Business/API integration is configured.

---

# 26. ALERT RECIPIENTS

Examples:

### PR Rejected
Worker + Procurement Officer

### PO Rejected by Supplier
Procurement Officer

### Driver Assignment Rejected
Supplier + Logistics & Gate Post

### Shipment Delayed
Supplier + Logistics & Gate Post + Procurement where appropriate

### Truck Arrived
Logistics & Gate Post + Receiving/QC

### Quality Failure
Receiving/QC + Procurement Officer

### Invoice Mismatch
Finance + Procurement Officer

### Payment Released
Supplier + Finance

### Payment Exception
Finance + Procurement Officer

---

# 27. DATABASE RELATIONSHIPS

Maintain the complete relational chain:

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
EXCEPTION
↓
PAYMENT
```

Every relationship should use IDs/foreign keys.

The database must remain normalized enough to avoid inconsistent duplicated state.

---

# 28. REALTIME SYNCHRONIZATION

Use Supabase Realtime/subscriptions for operational changes such as:

- Truck location
- Shipment status
- Driver assignment
- PO supplier response
- Dock assignment
- GRN completion
- QC result
- Invoice mismatch
- Payment status
- Exceptions

No manual refresh should be required for important realtime state changes.

---

# 29. WORKFLOW HISTORY

Every major event must be stored:

```text
PR CREATED
PR APPROVED
PR REJECTED
PO GENERATED
PO EDITED
PO APPROVED
PO SENT
PO ACCEPTED
PO REJECTED
SHIPMENT CREATED
DRIVER ASSIGNED
DRIVER ACCEPTED
DISPATCHED
ARRIVED
DOCK ASSIGNED
UNLOADING
GRN CREATED
QC FINALIZED
INVOICE RECEIVED
MATCHED
MISMATCH
EXCEPTION
RESOLVED
PAYMENT
```

Each history event should include:

- event ID
- entity type
- entity ID
- old status
- new status
- actor
- timestamp
- reason
- metadata

Never silently overwrite important workflow history.

---

# 30. FINAL SUPPLY SYNC WORKFLOW

```text
WORKER
↓
NLP PR CREATION
↓
WORKER REVIEW
↓
PROCUREMENT OFFICER
↓
PR APPROVED / REJECTED
```

Rejected:

```text
REJECTED PR
↓
Reason
↓
Worker notified
```

Approved:

```text
APPROVED PR
↓
Gemini Supplier Selection
↓
Gemini PO Generation
↓
Procurement Officer Review
↓
PO Approved
↓
PO Sent
↓
Supplier
↓
PO Accepted / Rejected
```

If supplier rejects:

```text
SUPPLIER REJECTED
↓
Reason
↓
Procurement Officer Alert
↓
Rejected PO Section
```

If supplier accepts:

```text
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
AUTOMATIC TRACKING
↓
AI ETA
↓
LOGISTICS & GATE POST
↓
GATE ARRIVAL
↓
YARD/PARKING/DOCK
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
FINANCE
↓
INVOICE
↓
OCR/MANUAL
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

# 31. IMPLEMENTATION REQUIREMENT

Do not patch only the frontend.

For each change:

1. Update database relationships if necessary
2. Update backend/business logic
3. Update permissions
4. Update Supabase RLS
5. Update realtime subscriptions
6. Update frontend
7. Update workflow state transitions
8. Update history/audit
9. Test related modules
10. Preserve existing valid data

The final application must behave as one connected system.

# SUPPLY SYNC

Core principles:

**One source of truth.**
**Automatic synchronization.**
**AI-assisted decisions.**
**Real-time visibility.**
**Strict authorization.**
**Complete PR-to-payment traceability.**
