# C2 — UPDATES 2
# Authentication, Procurement Automation, Shipment/TMS, Driver, AI, Alerts, GRN & Invoice

## Purpose
Fix the existing Antigravity application without removing working functionality. This specification adds strict authentication, workflow automation, role permissions, supplier/driver portals, shipment and truck controls, AI services, alerts, GRN rules, and invoice/OCR rules.

## 1. Authentication — Email OTP
Every login must require OTP verification sent to the user's registered email.

Flow:
Email/login → first-factor authentication → generate 6-digit OTP → email OTP → verify OTP → create session → role-specific dashboard.

OTP:
- 5-minute expiry
- one-time use
- max attempts
- resend cooldown/rate limit
- invalidate old OTP when a new one is issued
- never store plaintext OTP
- audit failed verification attempts

Use a secure backend email integration (Gmail API/OAuth or another mail provider). Never expose mail credentials in the frontend.

## 2. Central Gemini Configuration
Create one server-side AI configuration:
```env
GEMINI_API_KEY=
GEMINI_MODEL=
```
Store secrets only in backend/Supabase Edge Function secrets. Never put the Gemini key in React, browser storage, or public code.

Centralize AI calls:
```text
Frontend → Supabase Edge Function/backend → AI service → Gemini → structured response → Frontend
```

Suggested services:
- supplierSelectionService
- etaService
- dockAssignmentService
- shipmentPriorityService
- qualityAnalysisService
- queryAssistantService

## 3. PR → AI Supplier → Automatic PO
Required flow:
```text
PR created
→ PR submitted
→ PR approved
→ eligible suppliers identified
→ Gemini supplier recommendation
→ supplier finalized
→ PO automatically generated
→ Procurement review/edit
→ PO confirmed
→ Procurement Officer manually sends PO
→ supplier receives PO
```

After PR approval, supplier selection and PO generation should happen automatically by default.

Manual fallback must exist:
- manual supplier selection
- manual PO generation if automation/AI fails

Gemini should consider:
- price
- availability/capacity
- quality score
- on-time delivery
- average delay
- quantity accuracy
- invoice accuracy
- exception history
- reliability
- responsiveness
- distance
- product compatibility

AI recommendation is logged. Procurement can override it. Store AI recommendation, final supplier, override reason, user, and timestamp.

If Gemini fails, use rule-based ranking/manual selection.

## 4. Automatic PO
PO is generated from the approved PR + selected supplier.

PO fields should include:
PO ID, PO number, PR ID, supplier, warehouse, products, quantities, prices, totals, delivery date, payment terms, shipping destination, priority, status, timestamps.

Initial generated state:
`DRAFT_AUTO_GENERATED`

Procurement can:
- Edit
- Confirm

After confirmation:
`READY_TO_SEND`

PO must NOT be automatically sent.

Only authorized Procurement personnel can click:
`SEND TO SUPPLIER`

Then:
`SENT_TO_SUPPLIER`

All PO edits/sends must be audited.

## 5. Supplier Portal
Create a dedicated `/supplier` portal.

Supplier can only access its own records:
- POs
- PO acceptance
- shipment
- ASN
- truck
- driver
- tracking
- invoices
- QC results
- payment status
- alerts

Supplier can:
- accept PO
- reject PO
- request clarification
- create/update its own shipment
- provide ASN
- provide dispatch time
- provide expected arrival
- provide truck/driver
- provide tracking reference
- upload invoice

Supplier cannot:
- change company PO price/quantity
- approve company PR/PO
- edit GRN
- edit QC results
- release payment
- access another supplier

Enforce supplier_id isolation through backend and Supabase RLS, not only frontend filters.

## 6. ASN
ASN = Advance Shipping Notice.

ASN identifies what is being shipped and links:
PO + shipment + supplier + truck.

ASN is NOT GPS tracking.

Use:
- ASN → shipment identity/advance notice
- GPS/telematics → actual location
- supplier declared location → fallback
- simulation → demo fallback

Store `location_source`.

## 7. Shipment Management
Supplier shipment form must support:
- shipment number
- shipment ID
- PO
- ASN
- supplier
- driver
- truck
- origin
- destination
- dispatch time
- ETA
- tracking reference
- current status
- quantity
- carrier
- shipping documents

Allow both:
- dropdown selection of existing truck/driver
- manual add/create when no record exists

Suggested shipment states:
`PLANNED → DISPATCHED → IN_TRANSIT → ARRIVED_AT_FACILITY → AT_GATE → IN_YARD → AT_DOCK → UNLOADING → UNLOADED → RECEIVED`

## 8. Truck Management
Truck record:
- truck ID
- registration/truck number
- driver ID
- driver name/phone
- carrier
- vehicle type
- capacity
- current location
- location source
- current status
- assigned shipment
- assigned dock
- origin
- destination
- dispatch time
- ETA

## 9. Driver Role
Create a separate `TRUCK_DRIVER` role.

Driver can ONLY access:
- assigned shipment
- assigned truck
- live location
- origin
- destination
- route
- ETA
- assigned dock
- parking/waiting status
- assignment accept/reject

Driver cannot access:
PR, PO editing/approval, supplier management, invoice, GRN, QC, payment, procurement, finance, warehouse configuration, other suppliers/trucks.

Driver assignment:
- authorized supplier/logistics user assigns driver
- driver can ACCEPT or REJECT
- rejection creates `DRIVER_ASSIGNMENT_REJECTED` alert to supplier + Logistics Manager

## 10. Location Permissions
Current bug: too many users can edit truck location.

Fix:
- normal users: VIEW ONLY
- authorized Gate/Warehouse operational user: manual correction where explicitly permitted
- System Admin: emergency correction
- driver: may transmit GPS through approved tracking mechanism but cannot manually fabricate coordinates
- supplier: may submit declared tracking information but cannot overwrite trusted GPS

Location record:
latitude, longitude, timestamp, accuracy, source, truck_id, shipment_id.

Never let arbitrary users manually change location.

## 11. Truck Departure / Tracking
When truck leaves supplier:
record:
- departure timestamp
- origin
- destination
- truck
- driver
- shipment
- ASN
- initial location
- ETA

Then shipment becomes `DISPATCHED`, then `IN_TRANSIT`.

Preferred tracking:
GPS/telematics API.

Fallback:
supplier-provided tracking.

Demo fallback:
controlled simulation.

## 12. Gate Arrival
Only authorized Gate/Warehouse operational personnel can mark arrival.

Gate verifies:
- truck
- driver
- supplier
- shipment
- ASN
- PO

Then creates gate entry.

Gate cannot:
- approve PR/PO
- edit PO
- edit invoice
- release payment
- modify supplier score

## 13. AI ETA
ETA should combine:
- dispatch time
- current location
- origin/destination
- distance
- route data where available
- historical travel duration
- speed where available
- shipment priority
- historical delay

Gemini may predict/enrich ETA, but must not invent GPS/traffic.

Recommended:
`Routing/GPS data + historical data + Gemini prediction → ETA`

Store:
- predicted ETA
- delay
- confidence
- factors
- timestamp
- model

## 14. Truck Priority
Every shipment/truck has:
`CRITICAL | HIGH | MEDIUM | LOW`

Priority may consider:
- production impact
- required date
- product criticality
- PO priority
- delay
- customer impact
- inventory shortage
- supplier performance

Only authorized roles can change priority.

## 15. Automatic Dock/Parking Optimization
When trucks approach/arrive, evaluate:
- ETA
- priority
- dock availability
- dock type
- truck type
- shipment type
- unloading duration
- warehouse zone
- yard capacity
- waiting queue

AI recommends:
- dock
or
- parking slot

Flow:
```text
Truck in transit
→ ETA
→ priority
→ dock availability
→ AI recommendation
→ Warehouse Manager confirmation
→ assignment
```

The process should be automatic by default, but Warehouse Manager must have a manual override.

AI = recommendation.
Warehouse Manager = final decision.

Driver sees assignment.
Supplier sees relevant shipment/dock status.

## 16. Parking
If no compatible dock:
`WAITING_FOR_DOCK`
and assign parking slot.

When dock becomes free, automatically recommend the next truck based on:
1. priority
2. ETA
3. waiting time
4. compatibility

Warehouse Manager can override.

## 17. Unloading
Only the Receiving/Unloading/QC team may change:
`AT_DOCK → UNLOADING → UNLOADED`

Nobody else may mark unloading complete.

Admin may have emergency override with audit logging.

## 18. GRN
Remove OCR from GRN entirely.

GRN is manually entered by:
- Receiving/Unloading team
- Quality Check team

Admin may emergency override.

GRN fields:
- GRN ID/number
- PO
- shipment
- ASN
- supplier
- warehouse
- product
- expected quantity
- received quantity
- damaged quantity
- accepted quantity
- rejected quantity
- receiving date
- receiver
- status
- remarks

GRN create/edit:
- Receiving/QC
- authorized unloading operator
- Admin override

Not allowed:
Procurement, Logistics, Finance, Gate, Supplier, Driver.

## 19. Invoice
Invoice is supplied by the supplier.

Exactly two ingestion modes:

### Manual
User enters:
invoice number, PO number, supplier, invoice date, due date, products, quantities, prices, tax, total, payment terms.

### OCR
User uploads invoice image/PDF.
OCR extracts relevant fields.
User reviews and corrects extracted data before submission.

OCR is allowed for INVOICE ONLY.

OCR must NOT be used for PO or GRN.

Architecture:
```text
Invoice PDF/Image
→ Storage
→ OCR
→ extracted fields
→ user review/correction
→ invoice record
→ PO + GRN + invoice matching
```

## 20. Query Chat
Create an in-app `C2 AI Assistant`.

Use Gemini API.

It answers only questions related to the application and authorized data.

Examples:
- Which shipments are delayed?
- Where is truck TRK-WB-1002?
- Which suppliers have quality scores below 80?
- Which invoices are on hold?
- Which trucks are waiting for docks?

The AI MUST respect the logged-in user's permissions.

Do not give Gemini unrestricted SQL/database access.

Preferred:
```text
User → AI Chat → auth/role check → backend query tools → authorized data → Gemini → answer
```

Supplier A must never get Supplier B's information.

## 21. Alerts + Email
Every important alert should create:
- in-app notification
- email notification to the correct user

Examples:
- shipment delay
- driver rejection
- dock congestion
- yard congestion
- quality failure
- supplier score drop
- invoice mismatch
- payment overdue
- PO awaiting supplier acceptance
- truck arrival

Suggested recipients:
- shipment delay → Logistics + Warehouse
- driver rejection → Supplier + Logistics
- dock/yard congestion → Warehouse
- quality failure → Receiving/QC + Procurement
- supplier score drop → Procurement
- invoice mismatch → Finance
- payment overdue → Finance
- PO awaiting acceptance → Supplier + Procurement

Supplier emails must contain only that supplier's information.

Email credentials/API secrets must be server-side.

## 22. Central Notification Service
Create:
```text
/services/notifications/
    alertService
    emailService
    notificationRouter
```

It determines:
- recipient
- channel
- severity
- template
- retry behavior

If email fails:
- keep in-app alert
- mark email FAILED
- store error
- retry where appropriate

## 23. Authority Matrix

| Action | Procurement | Logistics | Warehouse | Gate | Receiving/QC | Finance | Supplier | Driver | Admin |
|---|---|---|---|---|---|---|---|---|---|
| Create PR | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Config |
| Approve PR | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Override |
| AI supplier selection | ✓ | View | View | ✗ | View | View | ✗ | ✗ | Config |
| Edit auto PO | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Override |
| Send PO | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Override |
| Accept PO | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ own | ✗ | ✗ |
| Create/update shipment | View | ✓ | View | ✗ | ✗ | ✗ | ✓ own | Limited | Override |
| Update truck record | View | ✓ | View | Verify | ✗ | ✗ | ✓ own | ✗ | Override |
| View location | ✓ | ✓ | ✓ | ✓ | ✓ | Limited | Own | Own | ✓ |
| Manual location correction | ✗ | ✗ | ✓ if authorized | ✓ if authorized | ✗ | ✗ | ✗ | ✗ | ✓ |
| ETA | View | ✓ | ✓ | View | View | View | Own | Own | ✓ |
| Final dock assignment | ✗ | View/recommend | ✓ | ✗ | View | ✗ | View | View | Override |
| Mark unloaded | ✗ | ✗ | View | ✗ | ✓ | ✗ | ✗ | ✗ | Override |
| Create/edit GRN | View | View | View | ✗ | ✓ | View | View own | ✗ | Override |
| Manual invoice | View | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ own | ✗ | Override |
| Invoice OCR | View | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ own | ✗ | Override |
| Payment | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | View own | ✗ | Config/override |
| AI query | Authorized data only | Authorized data only | Authorized data only | Authorized data only | Authorized data only | Authorized data only | Own data only | Own data only | Configured data |

## 24. Audit Logging
Audit:
- login/OTP failures
- PR approval
- AI supplier recommendation
- manual supplier override
- PO generation/edit/send
- supplier PO acceptance
- shipment creation/update
- truck assignment
- driver accept/reject
- location correction
- ETA prediction
- dock recommendation/override
- unloading completion
- GRN creation/edit
- invoice upload
- OCR correction
- alerts
- email delivery
- unauthorized access attempts

## 25. Automation Boundaries

AUTOMATIC:
- PR approval → supplier recommendation
- finalized supplier → PO generation
- tracking → ETA
- priority/dock availability → dock/parking recommendation
- alert → notification/email
- invoice → matching

MANUAL/AUTHORIZED:
- supplier override
- PO edit
- PO send
- dock override
- unloading completion
- GRN
- invoice review/correction
- exception resolution
- payment release

Never auto-send a PO.
Never auto-release payment.
Never let AI silently make a human-authorized final decision.

## 26. Implementation Priority

### P0 Security
1. OTP authentication
2. roles
3. route guards
4. backend authorization
5. Supabase RLS
6. supplier isolation
7. driver isolation
8. audit logging

### P1 Procurement
1. PR approval event
2. AI supplier selection
3. manual override
4. automatic PO generation
5. PO edit/review
6. PO confirmation
7. manual PO send

### P2 Shipment/TMS
1. supplier shipment module
2. ASN
3. truck records
4. driver records
5. driver accept/reject
6. dispatch
7. GPS/location
8. arrival/gate
9. ETA
10. priority
11. dock/parking optimization
12. manual warehouse override

### P3 Receiving
1. unloading permissions
2. manual GRN
3. GRN restrictions
4. QC integration

### P4 Invoice
1. supplier invoice
2. manual invoice
3. OCR invoice
4. OCR review
5. 3-way match

### P5 AI + Notifications
1. central Gemini service
2. permission-aware chat
3. alerts
4. Gmail/email
5. notification logs

## 27. Acceptance Tests

### Authentication
- [ ] OTP required for login
- [ ] OTP delivered by email
- [ ] OTP expires
- [ ] OTP cannot be reused
- [ ] rate limiting works

### Procurement
- [ ] approved PR triggers supplier selection
- [ ] Gemini recommends supplier
- [ ] manual supplier override exists
- [ ] PO auto-generates after supplier is finalized
- [ ] Procurement can edit PO
- [ ] PO is NOT automatically sent
- [ ] authorized Procurement user can send PO

### Supplier
- [ ] supplier sees only own data
- [ ] supplier can accept/reject/request clarification
- [ ] supplier can manage own shipment
- [ ] supplier can create ASN
- [ ] supplier can provide truck/driver/tracking
- [ ] supplier cannot edit company PO price/quantity
- [ ] supplier cannot edit GRN
- [ ] supplier cannot access another supplier

### Truck/Driver
- [ ] driver can accept/reject assignment
- [ ] driver sees only assigned work
- [ ] driver GPS can transmit location
- [ ] driver cannot manually fabricate coordinates
- [ ] unauthorized users cannot edit location
- [ ] dispatch time is recorded
- [ ] authorized gate user records arrival

### ETA/Dock
- [ ] ETA is calculated
- [ ] AI can assist ETA
- [ ] priority exists
- [ ] AI recommends dock/parking
- [ ] Warehouse Manager can override
- [ ] override is audited
- [ ] driver sees assignment

### Unloading/GRN
- [ ] only receiving/QC can mark unloaded
- [ ] GRN is manual
- [ ] GRN has no OCR
- [ ] unauthorized users cannot edit GRN
- [ ] admin override is audited

### Invoice
- [ ] supplier can submit invoice
- [ ] manual invoice exists
- [ ] OCR invoice exists
- [ ] OCR results can be reviewed/corrected
- [ ] PO + GRN + invoice can be matched

### AI Chat
- [ ] chat exists
- [ ] Gemini key is server-side
- [ ] chat answers only C2-related questions
- [ ] chat respects role permissions
- [ ] chat cannot execute unrestricted SQL

### Alerts
- [ ] alert creates in-app notification
- [ ] correct user gets email
- [ ] supplier gets only own alerts
- [ ] failed email is logged
- [ ] retry is supported where appropriate

## 28. Final Security Rule

Never solve authorization by merely hiding buttons.

Every request must pass:

AUTHENTICATED USER
→ ROLE
→ PERMISSION
→ ENTITY OWNERSHIP
→ WORKFLOW STATE
→ ACTION

Failure:
`403 FORBIDDEN`

This must apply to:
- frontend
- backend/API
- Supabase RLS
- supplier portal
- driver portal
- AI assistant

The goal is a system that automates repetitive workflow while keeping final human authority exactly where it belongs.
