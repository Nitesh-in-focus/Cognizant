# C2 — UPDATES 1
# Role-Based Access Control, Supplier Portal, Quality Control & AI Automation

## 1. PURPOSE

This document contains mandatory updates to the existing C2 Supply Chain Management application.

It adds and/or overrides:
- Strict role-based access control
- A dedicated Supplier Portal
- Quality Check after warehouse receiving
- Supplier performance/rating based on quality and operational history
- Gemini-powered AI assistance
- Gmail/email alert notifications
- Role-specific dashboards and modules
- Backend and frontend authorization
- Workflow-state protection
- Supplier data isolation

The existing database, workflow, integration, and UI specifications remain valid unless they conflict with this document.

---

# 2. FINAL BUSINESS ROLES

Use these business roles:

1. SYSTEM_ADMIN
2. PROCUREMENT_MANAGER
3. LOGISTICS_MANAGER
4. WAREHOUSE_MANAGER
5. GATE_OPERATOR
6. RECEIVING_QC_OPERATOR
7. FINANCE_MANAGER
8. SUPPLIER

The Supplier is an external role and must be isolated from internal users.

SYSTEM_ADMIN is primarily a system-management role and should not automatically become a business approver.

---

# 3. ROLE RESPONSIBILITIES

## 3.1 SYSTEM_ADMIN

Responsible for:
- User management
- Role assignment
- System configuration
- Warehouse/yard/dock configuration
- Alert configuration
- Integration configuration
- AI configuration
- Audit logs
- System health

Admin should NOT automatically approve PRs, POs, invoices, or payments.

Any emergency override must:
- Be explicitly enabled
- Require a reason
- Record the administrator
- Create an audit log
- Be visible to management

---

## 3.2 PROCUREMENT_MANAGER

Primary responsibility:
PROCUREMENT

Can:
- Create PR
- View/edit PR before approval
- Approve/reject PR
- Create PO
- Edit PO before approval
- Approve/reject PO
- Send PO to supplier
- View suppliers
- View supplier performance
- Run AI supplier selection
- Compare suppliers
- View shipment status
- View quality scores
- Review supplier performance

Cannot:
- Perform gate operations
- Assign docks
- Create final GRN
- Perform physical QC
- Approve invoices
- Release payments
- Modify warehouse receiving records

---

## 3.3 LOGISTICS_MANAGER

Primary responsibility:
SHIPMENTS + TRUCKS + ETA

Can:
- View approved POs needed for logistics
- Create shipment records after approved PO
- Update shipment status
- Coordinate truck assignment
- Update truck information
- Monitor GPS
- Monitor ETA
- Update dispatch information
- Monitor active shipments
- Handle shipment delays
- View warehouse destination
- View yard/dock status
- Use AI ETA
- Use AI shipment prioritization
- View logistics alerts

Cannot:
- Create/approve PR
- Approve PO
- Create/finalize GRN
- Perform QC
- Approve invoices
- Release payments
- Change supplier scores

---

## 3.4 WAREHOUSE_MANAGER

Primary responsibility:
WAREHOUSE + YARD + DOCKS

Can:
- View inbound shipments
- View approaching trucks
- View trucks in yard
- View dock availability
- Assign/reassign docks
- Manage waiting queue
- Monitor yard capacity
- Handle yard congestion
- Review gate activity
- Review receiving activity
- View GRNs
- View QC results
- Use AI dock recommendation
- View AI shipment priority

Cannot:
- Create/approve PR
- Approve PO
- Approve/release payment
- Modify supplier commercial information
- Directly change supplier score

---

## 3.5 GATE_OPERATOR

Primary responsibility:
GATE ENTRY + TRUCK VERIFICATION

Can:
- View expected arrivals
- Search truck/shipment
- Verify truck number
- Verify driver
- Verify supplier
- Verify shipment reference
- Record arrival
- Create gate entry
- Mark verification status
- Send truck to waiting area
- View assigned dock

Cannot:
- Approve PR
- Approve PO
- Modify commercial shipment information
- Assign final dock unless explicitly delegated
- Create/finalize GRN
- Perform QC
- Approve invoices
- Release payment

---

## 3.6 RECEIVING_QC_OPERATOR

Primary responsibility:
RECEIVING + GRN + QUALITY CHECK

Can:
- View expected inbound shipments
- View assigned dock
- Record unloading
- Record received quantity
- Record damaged quantity
- Create GRN
- Edit GRN before final submission
- Perform quality inspection
- Record quality findings
- Upload evidence
- Record accepted/rejected quantity
- Submit Quality Check
- View relevant supplier quality history

Cannot:
- Approve PR
- Approve PO
- Select suppliers
- Release payment
- Modify supplier commercial information
- Change final supplier score manually

---

## 3.7 FINANCE_MANAGER

Primary responsibility:
INVOICE + EXCEPTION + PAYMENT

Can:
- View/upload invoices
- Review OCR
- Correct OCR data
- Run/review 3-way matching
- Review PO/GRN/invoice comparison
- Create/review invoice exceptions
- Place payment on hold
- Resolve finance-side exceptions
- Approve invoice for payment
- Approve/release payment
- View payment history

Cannot:
- Approve PR
- Approve PO
- Assign trucks
- Manage docks
- Perform gate verification
- Create operational GRNs
- Modify QC results
- Change supplier rating

Finance may VIEW operational evidence required for matching but must not EDIT operational records.

---

## 3.8 SUPPLIER

Dedicated external Supplier Portal.

Can:
- Log in
- View own profile
- View own POs
- Accept/reject PO
- Request PO clarification
- View PO items
- Update shipment status
- Create/update shipment information
- Provide dispatch date
- Provide expected arrival
- Provide truck number
- Provide driver information
- Provide tracking information
- Update truck location where supported
- Upload shipping documents
- View own shipment history
- View own GRN outcome
- View own QC results
- View own supplier score
- Upload invoice
- View own invoice status
- View own payment status
- Receive own notifications

Cannot:
- Approve PR
- Create/approve company PO
- Approve its own invoice
- Release payment
- Modify GRN
- Modify warehouse records
- Modify QC results
- Modify supplier score
- View another supplier
- View internal exception notes
- View internal management-only financial analytics

---

# 4. PERMISSION MODEL

Use strict RBAC.

Every action must check:

ROLE
→ PERMISSION
→ WORKFLOW STATE
→ ENTITY OWNERSHIP
→ ACTION

Do not rely only on hidden buttons.

Authorization must exist in:
1. Frontend
2. Backend/API
3. Database/RLS where applicable

Unauthorized backend calls must return:
403 FORBIDDEN

---

# 5. PERMISSION MATRIX

| Action | Admin | Procurement | Logistics | Warehouse | Gate | Receiving/QC | Finance | Supplier |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| View dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Own |
| Create PR | Config only | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Approve PR | Override only | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Create PO | Config only | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Approve PO | Override only | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Accept PO | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ own |
| Create shipment | Config only | View | ✓ | View | ✗ | ✗ | ✗ | ✓ own |
| Update shipment | ✗ | View | ✓ | View | ✗ | ✗ | ✗ | ✓ own |
| Update truck | ✗ | View | ✓ | View | Verify | ✗ | ✗ | ✓ own |
| View tracking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Limited | Own |
| Gate verification | ✗ | ✗ | View | View | ✓ | ✗ | ✗ | View |
| Yard entry | ✓ | ✗ | View | ✓ | ✓ | View | ✗ | Own/view |
| Assign dock | Config | View | Recommend | ✓ | ✗ | ✗ | ✗ | ✗ |
| Create GRN | ✗ | View | View | Review | ✗ | ✓ | View | View own |
| Perform QC | ✗ | View | View | Review | ✗ | ✓ | View | View result |
| Modify QC | ✗ | ✗ | ✗ | Review | ✗ | ✓ before finalization | ✗ | ✗ |
| Upload invoice | ✗ | View | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ own |
| OCR review | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | Own upload |
| 3-way match | ✗ | View | View | View | ✗ | View | ✓ | View own status |
| Payment hold | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Approve payment | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Release payment | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Supplier selection | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| AI supplier recommendation | ✗ | ✓ | View | View | ✗ | View | View | ✗ |
| View supplier rating | ✓ | ✓ | View | View | ✗ | View | View | Own |
| Manage users | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

---

# 6. APPROVAL RULES

Approval actions must be protected at frontend AND backend.

Examples:

Only PROCUREMENT_MANAGER:
- Approve PR
- Approve PO

Only FINANCE_MANAGER:
- Approve invoice for payment
- Approve/release payment

Only WAREHOUSE_MANAGER:
- Final dock assignment

Only RECEIVING_QC_OPERATOR:
- Finalize QC

SUPPLIER:
- Accept its own PO
- Update its own shipment/truck data

A Logistics Manager must never be able to approve a PO.

A Finance Manager must never be able to approve a PO.

A Warehouse Manager must never be able to release payment.

---

# 7. WORKFLOW-STATE PROTECTION

Actions must also depend on status.

Examples:

PR approval:
status = PENDING_APPROVAL

PO approval:
status = PENDING_APPROVAL

Supplier acceptance:
status = SENT_TO_SUPPLIER

GRN finalization:
only before GRN is locked/finalized

QC finalization:
only before QC is finalized

Payment release:
invoice must satisfy required matching/approval conditions

Paid invoices must not be silently edited.

Closed exceptions must not be silently edited.

---

# 8. NO SELF-APPROVAL

Where maker-checker is required:

Creator ≠ Approver

For example:

A user who creates a high-value PO should not be the sole approver of that same PO if maker-checker is enabled.

Record creator and approver in audit logs.

---

# 9. SUPPLIER DATA ISOLATION

Supplier A must never see Supplier B.

Enforce supplier_id restrictions through backend and Row Level Security.

Supplier filtering must NOT exist only in React.

Supplier can only query:
supplier_id = authenticated user's supplier_id

---

# 10. SUPPLIER PORTAL

Create:

/supplier

Navigation:

Dashboard
Purchase Orders
Shipments
Trucks
Invoices
Quality
Notifications
Profile

Supplier dashboard:

- Pending PO acceptance
- Accepted POs
- Active shipments
- Trucks in transit
- Upcoming deliveries
- Invoice status
- Quality score
- Payment status
- Notifications

---

# 11. SUPPLIER PO WORKFLOW

PO sent to supplier:

SENT_TO_SUPPLIER

Supplier can:

ACCEPT

or:

REQUEST_CLARIFICATION

or:

REJECT

Supplier cannot change:
- PO quantity
- PO unit price
- PO total
- Company approval data

If clarification/change is requested:

PO status:
CHANGE_REQUESTED

Procurement Manager receives alert.

---

# 12. SUPPLIER SHIPMENT WORKFLOW

After accepting PO, supplier can:

- Create shipment
- Provide dispatch date
- Provide expected arrival
- Provide quantity
- Assign truck
- Provide driver
- Provide tracking reference
- Update shipment status

Logistics Manager can validate/review supplier updates.

---

# 13. SUPPLIER TRUCK INFORMATION

Supplier may provide:

- Truck number
- Driver name
- Driver phone
- Carrier
- Dispatch timestamp
- Tracking reference
- Current location where supported
- Estimated arrival

Store source of every location update.

Priority of trusted location data:

REAL GPS / TELEMATICS
>
VALIDATED SUPPLIER LOCATION
>
MANUAL LOGISTICS UPDATE
>
DEMO SIMULATION

---

# 14. QUALITY CHECK

Quality Check happens AFTER physical warehouse receipt.

Correct workflow:

Shipment
→ Warehouse Arrival
→ Gate Verification
→ Yard
→ Dock
→ Unloading
→ GRN
→ Quality Check
→ Supplier Rating Update

Do not finalize QC before physical receipt.

---

# 15. QUALITY CHECK MODULE

Route:

/quality

Primary user:
RECEIVING_QC_OPERATOR

Viewers:
- Procurement Manager
- Warehouse Manager
- Finance Manager
- Supplier for its own shipment

---

# 16. QUALITY CHECK DATA

Add:

quality_checks

Recommended fields:

- quality_check_id
- supplier_id
- po_id
- shipment_id
- grn_id
- warehouse_id
- product_id
- inspector_id
- inspection_date
- expected_quantity
- received_quantity
- accepted_quantity
- rejected_quantity
- damaged_quantity
- quality_score
- defect_rate
- packaging_score
- product_quality_score
- documentation_score
- delivery_condition_score
- overall_score
- status
- remarks
- evidence_path
- created_at
- finalized_at

If item-level inspection is needed, also create:
quality_check_items

---

# 17. QUALITY SCORE

Suggested weighting:

Product Quality: 40%
Quantity Accuracy: 20%
Packaging: 15%
Documentation: 10%
Delivery Condition: 15%

Total = 100%

Example:

Product = 36/40
Quantity = 18/20
Packaging = 12/15
Documentation = 9/10
Delivery Condition = 13/15

Overall = 88/100

The formula should be configurable.

---

# 18. QUALITY STATUS

Use:

PENDING
IN_PROGRESS
PASSED
PASSED_WITH_ISSUES
FAILED
FINALIZED

Once finalized, QC cannot be silently edited.

Corrections require an authorized correction workflow and audit log.

---

# 19. QUALITY EVIDENCE

Allow:

- Product photos
- Packaging photos
- Damage evidence
- Inspection documents

Use Supabase Storage.

Store only file references/paths in PostgreSQL.

---

# 20. AI QUALITY ANALYSIS

Gemini may assist with:

- Image analysis
- Damage detection
- Defect classification
- Inspection summary
- Recommended quality score
- Historical quality trend analysis

AI output is a recommendation only.

Example:

AI recommended score:
72/100

Human QC operator reviews it.

Human final score:
68/100

The human result is authoritative.

AI must never silently finalize QC.

---

# 21. SUPPLIER PERFORMANCE SCORE

Supplier score should combine:

Delivery Performance: 25%
Quality Performance: 35%
Quantity Accuracy: 15%
Invoice Accuracy: 10%
Responsiveness: 10%
Historical Reliability: 5%

Total = 100%

The exact formula should be configurable.

---

# 22. SUPPLIER SCORE UPDATE

After QC is finalized:

Quality Check
→ Supplier Performance Engine
→ Recalculate supplier score
→ Store score history
→ Update supplier profile
→ Notify Procurement if significant change

Example:

Previous:
91

New:
84

Change:
-7

Create:
SUPPLIER_SCORE_DROP alert

---

# 23. SUPPLIER PERFORMANCE TABLE

Add:

supplier_performance

Fields:

- supplier_performance_id
- supplier_id
- quality_score
- delivery_score
- quantity_accuracy_score
- invoice_accuracy_score
- responsiveness_score
- reliability_score
- overall_score
- sample_size
- calculated_at

---

# 24. SUPPLIER SCORE HISTORY

Add:

supplier_score_history

Fields:

- history_id
- supplier_id
- previous_score
- new_score
- change
- reason
- source_quality_check_id
- calculated_at

This allows Procurement to see score history rather than only the current score.

---

# 25. AI SUPPLIER SELECTION

Use Gemini API for AI-assisted supplier selection.

The AI should consider:

- Price
- Quality score
- Delivery performance
- On-time delivery
- Quantity accuracy
- Invoice accuracy
- Historical exceptions
- Average delay
- Capacity
- Product compatibility
- Geographic distance
- Reliability
- Responsiveness

AI must NOT simply choose the cheapest supplier.

---

# 26. AI SUPPLIER OUTPUT

Return structured data:

Recommended supplier
Confidence
Reasons
Alternative suppliers
Risk factors

Example:

Recommended:
ABC Industrial Supplies

Confidence:
87%

Reasons:
1. High quality score
2. Strong on-time delivery
3. Low exception rate
4. Competitive price
5. Adequate capacity

Procurement Manager makes final decision.

Correct flow:

PR
→ Candidate Suppliers
→ AI Recommendation
→ Procurement Manager Review
→ Final Supplier Selection

---

# 27. GEMINI INTEGRATION

Never expose Gemini API key in React.

Architecture:

React
→ Supabase Edge Function
→ Gemini API
→ Structured recommendation
→ React

Create AI services such as:

/services/ai/supplierRecommendationService
/services/ai/etaPredictionService
/services/ai/dockRecommendationService
/services/ai/shipmentPriorityService
/services/ai/qualityAnalysisService

Log AI recommendations.

---

# 28. AI ETA

AI may assist ETA using:

- Current location
- Historical route duration
- Current speed
- Distance
- Time of day
- Day of week
- Historical delay
- Shipment priority
- Traffic information where available

Output:

- Predicted ETA
- Delay probability
- Confidence
- Contributing factors

AI must not fabricate live traffic/GPS data.

If a routing API is available, use it as the live routing source and AI as an enrichment/prediction layer.

---

# 29. AI ACTIVE-SHIPMENT PRIORITIZATION

Rank active shipments using:

- Delay
- Production impact
- Shipment priority
- Required date
- Supplier reliability
- Product criticality
- Remaining travel time
- Warehouse capacity
- Current exceptions

Output:

CRITICAL
HIGH
MEDIUM
LOW

Example:

SHP-102
Priority:
CRITICAL

Reason:
"Shipment is delayed and contains a production-critical component."

Human logistics/warehouse staff remain responsible for action.

---

# 30. AI DOCK-DOOR RECOMMENDATION

AI can recommend a dock based on:

- Dock availability
- Dock type
- Truck type
- Shipment type
- Product category
- Waiting time
- Expected unloading duration
- Warehouse zone
- Priority
- Congestion

Example:

Recommended:
D04

Confidence:
92%

Reason:
"D04 is compatible and minimizes expected waiting time."

Correct workflow:

Truck arrives
→ Check dock availability
→ AI recommendation
→ Warehouse Manager decision
→ Dock assigned

AI must not independently assign a dock by default.

---

# 31. AI FAILURE FALLBACK

If Gemini is unavailable:

Supplier selection:
Manual supplier comparison

ETA:
Standard ETA calculation

Shipment priority:
Rule-based priority

Dock:
Rule-based assignment

Quality:
Manual QC

The application must continue working.

---

# 32. AI AUDITABILITY

Store:

- ai_recommendation_id
- recommendation_type
- entity_type
- entity_id
- model_name
- recommendation
- confidence
- reasoning_summary
- input_snapshot where appropriate
- human_decision
- decided_by
- decided_at
- created_at

Types:

SUPPLIER_SELECTION
ETA
DOCK_ASSIGNMENT
SHIPMENT_PRIORITY
QUALITY_ANALYSIS

Example:

AI recommended:
Supplier A

Human selected:
Supplier B

Store both.

---

# 33. GMAIL / EMAIL ALERT SYSTEM

Whenever an alert is raised:

Alert
→ Notification Engine
→ Email
→ Relevant user's registered email

MVP channels:
1. In-app
2. Email

Optional:
3. SMS
4. WhatsApp
5. Voice

---

# 34. EMAIL PROVIDER

If Gmail is specifically required:

Use Gmail API/OAuth through secure backend integration.

Alternative email providers can be supported through the same notification abstraction.

Never expose Gmail credentials or email provider secrets in React.

---

# 35. EMAIL ALERT FLOW

Example:

Shipment delayed 90 minutes

→ Alert Engine
→ Identify recipient
→ Create notification
→ Send email
→ Store delivery result

Email should contain:

Alert type
Severity
Entity
Supplier
Truck/shipment
Expected value
Current value
Difference
Action link

---

# 36. EMAIL RECIPIENT RULES

PR pending approval:
Procurement Manager

PO approval:
Procurement Manager

Shipment delay:
Logistics Manager + Warehouse Manager

Yard congestion:
Warehouse Manager

Dock waiting:
Warehouse Manager

Quality failure:
Warehouse Manager + Procurement Manager

Supplier score drop:
Procurement Manager

Invoice mismatch:
Finance Manager

Payment overdue:
Finance Manager

Payment completed:
Finance Manager + relevant Supplier

Supplier-specific shipment alert:
Supplier + Logistics Manager where appropriate

Supplier must only receive alerts for its own records.

---

# 37. EMAIL FAILURE HANDLING

If email fails:

- Keep in-app alert
- Mark notification as FAILED
- Store error
- Retry where appropriate
- Do not lose the alert

---

# 38. ROLE-SPECIFIC DASHBOARDS

Do not give every user the same dashboard.

## Procurement Dashboard

Show:
- Pending PR approvals
- Pending PO approvals
- AI supplier recommendations
- Supplier performance
- Quality scores
- Supplier score changes
- Shipment performance
- Procurement alerts

No dock controls or payment-release controls.

## Logistics Dashboard

Show:
- Active shipments
- Delayed shipments
- Active trucks
- ETA
- Live map
- AI ETA
- Shipment priority
- Upcoming arrivals

No PR/PO approval or payment release.

## Warehouse Dashboard

Show:
- Approaching trucks
- Trucks in yard
- Waiting queue
- Dock status
- Yard capacity
- Dock utilization
- AI dock recommendations
- Receiving
- Quality issues

No PO approval or payment release.

## Gate Dashboard

Show:
- Today's arrivals
- Verification queue
- Gate entries
- Assigned docks
- Waiting trucks

## Receiving/QC Dashboard

Show:
- Expected arrivals
- Active unloading
- Pending GRNs
- Pending QC
- Failed QC
- Damaged goods
- Supplier quality history

## Finance Dashboard

Show:
- Pending invoices
- OCR
- 3-way mismatches
- Payment holds
- Due/overdue invoices
- Approved payments
- Paid value

No dock/gate controls.

## Supplier Dashboard

Show only:
- Own POs
- Own shipments
- Own trucks
- Own invoices
- Own QC results
- Own quality score
- Own payment status
- Own alerts

## Admin Dashboard

Show:
- Users
- Roles
- System health
- Integration status
- AI status
- Email status
- Audit logs

---

# 39. ROUTE GUARDS

Examples:

/purchase-orders/approve
→ PROCUREMENT_MANAGER only

/payments/approve
→ FINANCE_MANAGER only

/quality
→ RECEIVING_QC_OPERATOR + authorized reviewers

/yard
→ WAREHOUSE_MANAGER + authorized operational viewers

/supplier
→ SUPPLIER only

Even if a user can view a record, they must not automatically receive its write/approval permissions.

---

# 40. FIELD-LEVEL ACCESS

Examples:

Logistics can VIEW PO quantity but cannot edit it.

Supplier can VIEW PO price but cannot edit it.

Finance can VIEW GRN quantity but cannot edit it.

Warehouse can VIEW invoice status but cannot change payment status.

---

# 41. CROSS-ROLE READ ACCESS

Read access may be broader than write access.

Procurement:
Can view shipment status.

Logistics:
Can view PO information needed for shipment.

Warehouse:
Can view PO/shipment information needed for receiving.

Finance:
Can view PO + GRN for matching.

But only the responsible role can EDIT/APPROVE its workflow.

---

# 42. AUDIT LOGGING

Record important actions:

- PR approval
- PO approval
- Supplier PO acceptance
- Shipment creation/update
- Truck update
- Gate verification
- Dock assignment
- GRN creation
- QC finalization
- AI recommendation
- Invoice upload
- Match result
- Exception creation/resolution
- Payment approval/release
- Permission violation

---

# 43. DATABASE ADDITIONS

Add at minimum:

quality_checks
quality_check_items (if item-level QC is required)
supplier_performance
supplier_score_history
ai_recommendations

Ensure all new tables have proper:
- Primary keys
- Foreign keys
- Timestamps
- Status fields
- RLS policies
- Indexes where appropriate

---

# 44. FINAL END-TO-END WORKFLOW

PR
↓
Procurement Manager
↓
PO
↓
Procurement approval
↓
Supplier Portal
↓
Supplier accepts PO
↓
Supplier creates/updates shipment
↓
Logistics Manager
↓
Truck tracking
↓
AI ETA
↓
Warehouse arrival
↓
Gate Operator
↓
Yard
↓
AI dock recommendation
↓
Warehouse Manager
↓
Dock assignment
↓
Unloading
↓
Receiving/QC Operator
↓
GRN
↓
Quality Check
↓
AI quality assistance
↓
Supplier performance update
↓
Invoice
↓
Finance Manager
↓
OCR
↓
3-Way Match
↓
Exception if mismatch
↓
Payment Hold
↓
Resolution
↓
Reconciliation
↓
Finance approval
↓
Payment
↓
Supplier sees payment status
↓
Analytics

---

# 45. IMPLEMENTATION PRIORITY

## P0 — SECURITY FIRST

1. Define roles
2. Define permissions
3. Fix overlapping role views
4. Implement route guards
5. Implement action guards
6. Implement backend authorization
7. Implement RLS
8. Implement supplier data isolation
9. Remove unauthorized approval actions
10. Test unauthorized API calls

Do this before AI features.

## P1 — SUPPLIER PORTAL

1. Supplier authentication
2. Supplier dashboard
3. PO acceptance
4. Shipment updates
5. Truck updates
6. Tracking information
7. Invoice upload
8. Payment status
9. QC results
10. Notifications

## P2 — QUALITY CONTROL

1. Quality Check tables
2. QC UI
3. GRN → QC workflow
4. Quality scoring
5. Supplier performance
6. Score history
7. Procurement visibility

## P3 — AI

1. Gemini integration
2. AI supplier selection
3. AI ETA
4. AI shipment prioritization
5. AI dock recommendation
6. AI quality analysis
7. AI audit history
8. Human approval

## P4 — EMAIL

1. Email provider
2. Alert → email
3. Recipient rules
4. Email templates
5. Delivery logs
6. Retry handling

---

# 46. FINAL ACCEPTANCE TEST

## Procurement
- Logistics cannot approve PR
- Finance cannot approve PR
- Warehouse cannot approve PR
- Supplier cannot approve PR
- Only Procurement Manager can approve PR
- Only Procurement Manager can approve PO

## Logistics
- Logistics can manage shipments
- Logistics can manage trucks
- Logistics can see ETA
- Logistics cannot approve PO
- Logistics cannot release payment

## Warehouse
- Warehouse can manage yard
- Warehouse can manage docks
- Warehouse can assign docks
- Warehouse cannot approve PO
- Warehouse cannot release payment

## Gate
- Gate can verify trucks
- Gate can create gate entry
- Gate cannot approve PR/PO
- Gate cannot release payment

## Receiving/QC
- Receiving can create GRN
- Receiving can perform QC
- QC occurs after receipt
- QC updates supplier performance
- Receiving cannot release payment
- Receiving cannot approve PO

## Finance
- Finance can process invoices
- Finance can review 3-way match
- Finance can hold payment
- Finance can approve/release payment
- Finance cannot approve PO
- Finance cannot modify QC

## Supplier
- Supplier sees only its own data
- Supplier can accept PO
- Supplier can update shipment
- Supplier can update truck information
- Supplier can provide tracking
- Supplier can upload invoice
- Supplier can view QC result
- Supplier can view own score
- Supplier cannot modify PO price/quantity
- Supplier cannot modify GRN
- Supplier cannot approve/release payment
- Supplier cannot see another supplier

## AI
- Gemini key is server-side only
- Supplier recommendation works
- ETA recommendation works
- Shipment prioritization works
- Dock recommendation works
- Quality analysis works or has fallback
- AI recommendations are logged
- Human remains final decision-maker

## Email
- Alert creates in-app notification
- Alert sends email to correct user
- Supplier receives only supplier-specific emails
- Email failures do not break alerts
- Delivery status is logged

---

# 47. FINAL PRINCIPLE

The C2 application is a role-based Supply Chain Control Tower.

Every action must have:

WHO
+
WHAT
+
WHEN
+
AUTHORITY

The system must enforce:

ROLE
→ PERMISSION
→ WORKFLOW STATE
→ ENTITY OWNERSHIP
→ ACTION

The application must make it impossible for:
- Logistics to approve a PO
- Warehouse to release payment
- Gate to approve procurement
- Receiving to release payment
- Supplier to modify company records
- Supplier A to see Supplier B
- Unauthorized users to bypass restrictions through direct API calls

At the same time, controlled read access should allow teams to understand the end-to-end supply chain.

The goal is:

RIGHT DATA
+
RIGHT PERSON
+
RIGHT ACTION
+
RIGHT TIME
=
SECURE SUPPLY CHAIN CONTROL TOWER
