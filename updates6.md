# SUPPLY SYNC --- UPDATES 6

## PO Editing, NLP Accuracy, Driver Tracking, Persistent Navigation, OTP Authentication & Demo/Actual Separation

> This is the latest implementation update. It takes precedence over
> conflicting older requirements.

## 1. PO EDITING --- PROCUREMENT OFFICER ONLY

AI-generated POs are drafts, not final truth.

Workflow:

``` text
Approved PR
→ Gemini supplier selection
→ Gemini PO generation
→ PO DRAFT
→ Procurement Officer review
→ Procurement Officer EDIT if needed
→ Procurement Officer APPROVES
→ Procurement Officer SENDS to Supplier
```

Only the **Procurement Officer** may edit a PO.

The edit permission must be enforced by backend authorization and
Supabase RLS, not merely by hiding a frontend button.

Before sending, the Procurement Officer must be able to edit relevant
fields such as:

-   Quantity
-   Product
-   Unit
-   Required date
-   Delivery location
-   Price/terms where authorized
-   Other valid PO fields

After the PO is sent to the supplier, normal editing must be disabled.
If a later change is required, use an audited PO amendment/revision
process.

### PO edit history

Every edit must record:

-   PO ID
-   Editor user ID/name
-   Timestamp
-   Field changed
-   Previous value
-   New value
-   Reason where applicable

The original AI-generated version must remain traceable.

The final approved PO is the human-reviewed version.

------------------------------------------------------------------------

## 2. NLP --- FIX EXACT VALUE EXTRACTION

The current NLP is sometimes changing or missing values supplied by the
user. Fix NLP throughout:

-   PR NLP
-   PR chat/input
-   AI Query Chat
-   AI-assisted GRN
-   Any natural-language form

### Exact values must be preserved

If the user says:

> I need 500 units by 28 August.

The structured result must contain exactly:

``` json
{
  "quantity": 500,
  "required_date": "2026-08-28"
}
```

Do not silently convert 500 into another quantity.

If the user explicitly supplies a value, that value has priority.

### Never invent missing values

If the user does not provide a warehouse, date, quantity, supplier,
etc., return it as missing and ask the user when necessary.

Do not invent:

-   Quantity
-   Product
-   Date
-   Location
-   Supplier
-   Price
-   Priority

------------------------------------------------------------------------

## 3. NLP STRUCTURED PIPELINE

Do not allow raw Gemini text to directly modify critical database
records.

Use:

``` text
User Natural Language
→ Gemini NLP
→ Structured JSON
→ Schema Validation
→ Business Validation
→ User Review
→ Database
```

Example:

``` json
{
  "product": "Safety Gloves",
  "quantity": 500,
  "unit": "units",
  "required_date": "2026-08-28",
  "destination": "Warehouse A",
  "priority": "HIGH"
}
```

Before final submission, show:

``` text
AI EXTRACTED PR

Product: Safety Gloves
Quantity: 500
Required Date: 28 Aug 2026
Destination: Warehouse A
Priority: HIGH

[EDIT] [CONFIRM]
```

If the Worker changes an AI value, the final user-confirmed value
becomes authoritative and the correction should be logged.

------------------------------------------------------------------------

## 4. NLP DATE + PRIORITY DETECTION

Support:

``` text
25 August 2026
25/08/2026
25-08-2026
by 25 August
before 25 August
tomorrow
next Monday
within 10 days
```

Normalize dates to:

``` text
YYYY-MM-DD
```

For ambiguous dates, ask for clarification instead of guessing.

Priority should be inferred from:

``` text
Explicit user language
+
Required date
+
Business rules
```

Use:

``` text
LOW
MEDIUM
HIGH
URGENT
```

Examples:

``` text
"Need immediately" → URGENT
"Required within 2 days" → HIGH
"Required next week" → MEDIUM
"Required next month" → LOW
```

If the user explicitly says the priority, preserve it unless a human
changes it.

------------------------------------------------------------------------

## 5. AI QUERY CHAT

The Chat section must use actual database information.

Preferred architecture:

``` text
User Question
→ Role/Permission Check
→ Authorized Backend Query
→ Database Result
→ Gemini Explanation
→ User
```

Gemini must not guess values from conversation context.

Example:

> How many units are in PO-1045?

The answer must come from the actual PO record.

Do not give Gemini unrestricted raw database/SQL access.

------------------------------------------------------------------------

# 6. DRIVER DASHBOARD --- MY LIVE JOURNEY

Add a dedicated driver section showing the driver's own journey.

Display:

-   Driver ID
-   Shipment ID
-   Truck
-   Current location
-   Starting location
-   Destination
-   Route map
-   Distance travelled
-   Distance remaining
-   AI ETA
-   Shipment status

Example:

``` text
MY LIVE JOURNEY

SHIPMENT: SHP-1004
TRUCK: WB-12-AB-1234
DRIVER ID: DRV-1024

FROM: Supplier Facility
TO: Customer Facility

CURRENT LOCATION:
Barrackpore, West Bengal

DISTANCE TRAVELLED:
126 KM

DISTANCE REMAINING:
84 KM

AI ETA:
03:40 PM

STATUS:
IN TRANSIT
```

The driver may view this information but must not manually edit GPS
coordinates.

ETA is calculated using Gemini AI and available tracking/shipment data.

------------------------------------------------------------------------

## 7. DRIVER TRACKING VISIBILITY

The following can see appropriate tracking data:

-   Driver → Own journey
-   Supplier → Its own shipment
-   Logistics & Gate Post → Operational shipments
-   Procurement Officer → Through Traceability Matrix

The Procurement Officer should not receive unnecessary operational
editing controls.

When the Driver stage is opened in Traceability, show:

-   Driver ID
-   Driver name
-   Shipment
-   Truck
-   Current location
-   Distance travelled
-   Distance remaining
-   ETA
-   Dispatch time
-   Arrival time
-   Driver status

All values come from the database.

------------------------------------------------------------------------

# 8. PAGE REFRESH MUST PRESERVE CURRENT PAGE

Refreshing the browser must NOT send the user to a default page.

Example:

``` text
Before refresh:
/finance/invoices

After refresh:
/finance/invoices
```

Use proper URL-based routing.

Suggested routes:

``` text
/worker/pr
/procurement/pr
/procurement/po
/procurement/exceptions
/supplier/pos
/supplier/shipments
/supplier/invoices
/driver/dashboard
/driver/history
/logistics/shipments
/logistics/docks
/receiving/grn
/receiving/qc
/finance/invoices
/finance/payments
/traceability
/chat
```

On refresh, restore the current authorized route.

Only redirect to a role dashboard when there is no valid previous route.

If the route is no longer authorized, redirect safely to the user's
authorized dashboard.

------------------------------------------------------------------------

# 9. REAL EMAIL OTP AUTHENTICATION

Actual login must use real email OTP:

``` text
Enter Email
→ Send OTP
→ User receives OTP by Email
→ Enter OTP
→ Verify
→ Login
```

There must be **no demo OTP shown during the actual working process**.

Never display OTP in:

-   UI
-   toast
-   alert
-   frontend code
-   browser console
-   production logs

Do not hardcode OTP.

Use the configured authentication provider/backend and secure OTP
expiry/rate limiting where supported.

------------------------------------------------------------------------

# 10. DEMO MODE AND ACTUAL WORKING MODE MUST BE SEPARATE

Create two completely isolated environments:

## A. DEMO MODE

Contains synthetic/pre-filled data for:

-   Presentation
-   Testing
-   Dashboards
-   Power BI
-   Demonstration

May contain:

-   Demo users
-   PRs
-   POs
-   Suppliers
-   Shipments
-   Trucks
-   Drivers
-   Docks
-   GRNs
-   QC
-   Invoices
-   Payments
-   Exceptions
-   Traceability
-   Simulated tracking

## B. ACTUAL WORKING MODE

Starts with **no pre-filled business transaction data**.

The user creates everything through the real workflow:

``` text
Worker creates PR
→ Procurement approves
→ AI generates PO
→ Supplier accepts
→ Shipment created
→ Driver assigned
→ Dispatch
→ Gate
→ Dock
→ GRN
→ QC
→ Invoice
→ 3-way match
→ Payment
```

Do not preload fake transactions into Actual Mode.

------------------------------------------------------------------------

# 11. DEMO AND ACTUAL DATABASES MUST NOT BE MERGED

Preferred architecture:

``` text
DEMO
→ Demo Supabase project/database
→ Synthetic data
```

and:

``` text
ACTUAL
→ Actual/Production Supabase project/database
→ Real user-created data
```

If separate projects are not practical, use strongly isolated
schemas/tables with environment-level configuration and RLS.

Do NOT use only a frontend flag such as:

``` text
if demoMode
```

against the same database and call that separation.

Demo actions must never modify Actual data.

Actual actions must never modify Demo data.

------------------------------------------------------------------------

# 12. DEMO ENVIRONMENT

Demo can contain the required sample roles:

-   Worker
-   Procurement Officer
-   Supplier
-   Truck Driver
-   Logistics & Gate Post
-   Receiving + QC
-   Finance
-   System Admin if technically required

Use synthetic accounts and synthetic records only.

------------------------------------------------------------------------

# 13. ACTUAL ENVIRONMENT

Actual mode uses real authentication and starts without fake operational
history.

When a real user logs in:

``` text
Real Email
→ OTP
→ Authentication
→ User Profile
→ Role
→ Authorized Dashboard
```

Business records are created by actual users through the workflow.

------------------------------------------------------------------------

# 14. ENVIRONMENT INDICATOR

Clearly show the active environment:

``` text
SUPPLY SYNC
● DEMO MODE
```

or:

``` text
SUPPLY SYNC
● ACTUAL MODE
```

Users must never mistake demo records for actual records.

------------------------------------------------------------------------

# 15. POWER BI

If Power BI is connected later, keep analytics environment-specific:

``` text
DEMO DATABASE
→ Demo Power BI dataset

ACTUAL DATABASE
→ Actual Power BI dataset
```

Do not combine synthetic demo metrics with actual operational metrics.

------------------------------------------------------------------------

# 16. FINAL UPDATED WORKFLOW

``` text
WORKER
↓
NLP PR
↓
EXACT VALUE EXTRACTION
↓
WORKER REVIEW
↓
PROCUREMENT OFFICER
↓
PR APPROVAL
↓
GEMINI SUPPLIER SELECTION
↓
GEMINI PO GENERATION
↓
PROCUREMENT OFFICER REVIEW
↓
PO EDIT IF REQUIRED
↓
PO APPROVAL
↓
PO SENT TO SUPPLIER
↓
SUPPLIER FEED
↓
SUPPLIER ACCEPTS
↓
ACCEPTED PO
↓
SUPPLIER CREATES 1..N SHIPMENTS
↓
DRIVER REQUESTS
↓
MULTIPLE DRIVERS MAY RECEIVE REQUEST
↓
FIRST VALID DRIVER ACCEPTANCE WINS
↓
OTHER REQUESTS CANCELLED
↓
DISPATCH
↓
AUTOMATIC TRACKING
↓
GEMINI AI ETA
↓
DRIVER LIVE JOURNEY
↓
LOGISTICS & GATE POST
↓
GATE
↓
YARD / PARKING / DOCK
↓
RECEIVING + QC
↓
GRN
↓
QUALITY CHECK
↓
SUPPLIER RATING
↓
FINANCE
↓
INVOICE
↓
3-WAY MATCH
↓
PAYMENT
```

------------------------------------------------------------------------

# 17. FINAL ACCEPTANCE CRITERIA

### PO

-   AI generates PO draft.
-   Procurement Officer can edit it.
-   Nobody else can edit it.
-   Edits are validated.
-   Edits are audited.
-   Procurement Officer approves the final version.
-   Sent PO cannot be silently edited.

### NLP

-   Exact quantities are preserved.
-   Exact dates are preserved.
-   Exact products are preserved.
-   Exact locations are preserved.
-   Missing values are not invented.
-   Dates are normalized.
-   Urgency/priority is detected.
-   User can review/correct AI extraction.
-   Chat answers use actual database values.

### Driver

-   Every driver has a unique Driver ID.
-   Supplier can see Driver ID.
-   Driver sees only their own requests.
-   Driver sees own location.
-   Driver sees distance travelled.
-   Driver sees distance remaining.
-   Driver sees Gemini AI ETA.
-   Driver sees route/map.
-   Driver sees shipment history.

### Navigation

-   Browser refresh keeps the current route.
-   No unnecessary redirect to a default dashboard.
-   Unauthorized routes still redirect safely.
-   URLs represent actual pages.

### Authentication

-   Actual users receive OTP through email.
-   No demo OTP is shown in Actual Mode.
-   OTP is not exposed in frontend/logs.
-   Authentication remains secure.

### Demo/Actual

-   Separate databases/environments.
-   Demo contains synthetic data.
-   Actual starts with no pre-filled business transactions.
-   Demo actions never affect Actual.
-   Actual actions never affect Demo.
-   Environment is clearly visible.

### Data integrity

-   PR, PO, shipment, driver, truck, invoice, GRN, QC and payment remain
    interconnected.
-   Database is the source of truth.
-   Traceability reflects real database state.
-   No contradictory statuses.
-   No unauthorized edits.
-   No accidental demo/actual data mixing.

------------------------------------------------------------------------

# 18. CORE PRINCIPLE

Supply Sync must distinguish between:

## AI SUGGESTION

and

## HUMAN-AUTHORIZED ACTION

Gemini can assist with:

-   NLP extraction
-   Supplier selection
-   PO generation
-   ETA estimation
-   QC analysis
-   Query/chat responses

Humans remain responsible for:

-   PR approval
-   PO editing
-   PO approval
-   PO sending
-   Supplier acceptance
-   Shipment execution
-   Driver acceptance
-   Gate operations
-   GRN confirmation
-   QC finalization
-   Payment approval

Therefore:

**AI assistance + human control + strict authorization + database
traceability.**

# SUPPLY SYNC
