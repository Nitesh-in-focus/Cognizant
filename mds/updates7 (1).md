# SUPPLY SYNC — UPDATES 7
## Authentication, Self-Registration, Seven Fixed Roles, Supplier Initialization & Private User Management

> Replace the current "Corporate User Directory & Multi-Role Register" implementation with the authentication workflow below.
> This update takes precedence over conflicting older requirements.

## 1. REMOVE THE CURRENT USER DIRECTORY

Remove the current User Directory / Multi-Role Register from the normal application UI, including:

- User Directory
- Total registered-user count
- Admin count
- Registered-user search/filter
- User cards
- User "Switch" controls
- Quick-fill role presets
- User registration management as an operational dashboard

Normal users must never see a directory of registered users.

Do not show user counts anywhere on the dashboard, header, profile menu, analytics, traceability, supplier, procurement, logistics or finance screens.

User-account administration belongs in the secure authentication/backend/database administration layer only.

## 2. AUTHENTICATION VS USER DIRECTORY

These are separate concepts.

Visible to users:

```text
SIGN IN
SIGN UP
FORGOT PASSWORD
LOG OUT
```

Not visible to normal users:

```text
Registered-user list
User count
User directory
Other users' emails/profiles
Account-management dashboard
```

## 3. LOGIN PAGE

Create a clean Supply Sync landing/authentication page with two clear paths:

```text
SUPPLY SYNC

Procurement & Logistics Intelligence

[ DEMO MODE ]
Explore pre-populated Supply Sync data

[ ENTER DEMO ]

----------------------------

[ ACTUAL LOGIN ]

[ SIGN IN ]    [ SIGN UP ]
```

Demo and Actual must use separate data environments.

## 4. SIGN UP WORKFLOW

```text
SIGN UP
↓
Full Name
↓
Email
↓
Password
↓
Confirm Password
↓
Select one of seven roles
↓
Email verification / OTP
↓
Account created
↓
Sign in
↓
Role-specific dashboard
```

A user may register for any of the seven approved roles.

There must be no artificial limit on the number of users for operational roles.

## 5. EXACTLY SEVEN OPERATIONAL ROLES

The role selector must contain exactly:

1. Worker
2. PR Officer
3. Supplier
4. Carrier Fleet Driver
5. Logistics & Gate Post
6. Receiver & QC Lead
7. Finance Controller

No other operational roles.

Do not create separate roles named Buyer, Procurement Manager, Finance Manager, Gate Operator, Receiving Operator, QC Lead, Driver, etc.

Do not provide a "Create New Role" feature.

## 6. UNLIMITED USERS

There is no operational-user limit for:

- Worker
- PR Officer
- Supplier
- Carrier Fleet Driver
- Logistics & Gate Post
- Receiver & QC Lead
- Finance Controller

Examples such as 500 workers or 1,000 suppliers are illustrative only. Do not impose artificial role-count limits.

If a technical Platform Admin is required by the authentication/backend infrastructure, keep it outside the seven operational roles. It must not appear in the role selector or normal workflow UI.

## 7. ROLE-BASED DASHBOARDS

After authentication:

```text
Authenticated User
↓
User Profile
↓
Role
↓
Authorization
↓
Role-Specific Dashboard
```

Mapping:

```text
Worker
→ Worker Dashboard

PR Officer
→ PR / PO / Procurement Dashboard

Supplier
→ Supplier Dashboard

Carrier Fleet Driver
→ Driver Dashboard

Logistics & Gate Post
→ Logistics / Gate / Shipment Dashboard

Receiver & QC Lead
→ Receiving / QC Dashboard

Finance Controller
→ Finance Dashboard
```

Backend authorization and Supabase RLS must enforce the same restrictions. Do not rely only on hiding frontend buttons.

## 8. ROLE PERMISSIONS

### Worker
Can:
- Create PR
- Use PR NLP
- Review/edit own PR before submission
- View own PR history

Cannot:
- Approve PR
- Edit/approve PO
- Manage shipments
- Assign drivers
- Edit tracking
- Perform QC
- Approve payments

### PR Officer
Can:
- View/approve/reject PRs
- View rejected PRs
- Review AI supplier selection
- Review/edit AI-generated PO
- Approve final PO
- Send PO to supplier
- Handle procurement exceptions
- View Traceability Matrix
- View connected operational information through traceability

Cannot:
- Edit live GPS
- Perform gate operations
- Finalize QC
- Approve finance payment

### Supplier
Can:
- View only its own POs
- Receive PO notifications
- Accept/reject its own POs
- Create 1..N shipments against accepted POs
- Manage its own shipments
- Request carrier fleet drivers
- Dispatch its own shipments
- Upload its invoices
- View its own history/rating where permitted

Cannot:
- See other suppliers or their records
- See internal finance data
- See the user directory
- Access other users' private data

### Carrier Fleet Driver
Can:
- View own profile and Driver ID
- Receive/accept/reject shipment requests
- View assigned shipment/truck
- View own route, location, distance and AI ETA
- View own shipment history

Cannot:
- Manually edit GPS
- Edit PO
- Approve PR/PO
- Edit supplier records
- Perform gate operations
- Perform QC
- Approve payment

### Logistics & Gate Post
Can:
- Monitor active shipments
- View truck locations
- Monitor inbound/outbound
- Handle operational shipment errors
- Manage gate arrival and verification
- Verify truck/driver/shipment/ASN/PO
- Manage yard, parking and dock assignment
- Edit live operational shipment information where authorized

Cannot:
- Approve PR
- Edit/approve PO
- Finalize QC
- Approve payment

### Receiver & QC Lead
Can:
- Confirm unloading
- Create/update GRN
- Perform/finalize QC
- Enter quality factors
- Upload evidence
- Update supplier quality rating
- View receiving records

Cannot:
- Approve PR
- Edit/approve PO
- Dispatch trucks
- Edit live GPS
- Approve payment

### Finance Controller
Can:
- Receive/view/download supplier invoices
- Run/correct OCR
- Perform PO + GRN + Invoice three-way matching
- Approve payment when valid
- Put payments on hold
- Handle finance exceptions

Cannot:
- Approve PR
- Edit PO
- Manage shipments/drivers
- Edit live tracking
- Perform QC

## 9. SUPPLIER REGISTRATION

Do not pre-populate suppliers in Actual Mode.

The user must be able to create/register supplier accounts.

Workflow:

```text
SIGN UP
↓
Select Supplier
↓
Create Supplier Account
↓
Supplier Profile
↓
Generate Supplier ID
↓
Supplier receives assigned POs
```

## 10. SUPPLIER ID

Every supplier gets a unique Supplier ID, for example:

```text
SUP-0001
SUP-0002
SUP-0003
```

Supplier ID is the central business identity connecting:

- Authentication user ID
- Supplier profile
- POs
- Shipments
- Driver requests
- Trucks/transport records where applicable
- Invoices
- QC results
- Supplier ratings
- Exceptions
- Payment-related records
- Supplier history

Example:

```text
SUP-0001
├── PO-1001
│   ├── Shipment-001
│   ├── Shipment-002
│   ├── Invoice-001
│   └── QC-001
├── PO-1015
│   └── Shipment-008
└── Rating History
```

Use stable IDs for relationships. Do not use email alone as a relational identity.

## 11. SUPPLIER PO DELIVERY

When Procurement sends a PO:

```text
PO
↓
supplier_id
↓
Authenticated Supplier Account
↓
Supplier Email Notification
+
Supplier Dashboard
```

Only the supplier associated with that Supplier ID receives the PO.

Supplier actions:

```text
[ ACCEPT PO ]
[ REJECT PO ]
```

Accepted:

```text
PO
→ ACCEPTED_BY_SUPPLIER
→ Shipment Creation
```

Rejected:

```text
PO
→ REJECTED_BY_SUPPLIER
→ Reason Required
→ PR Officer Notification
```

## 12. SUPPLIER INVOICE IDENTITY

When a supplier submits an invoice:

```text
Authenticated Supplier
↓
Supplier ID
↓
PO ID
↓
Invoice ID
↓
Invoice
```

Backend must verify:

```text
authenticated_supplier_id = invoice.supplier_id
```

A supplier cannot submit an invoice belonging to another supplier.

Supplier notifications must use the actual email associated with that supplier account. Do not use hardcoded demo emails.

## 13. NO USER SWITCHING

Remove the current "Switch" functionality.

A logged-in user operates only as their authenticated account/role.

The profile menu should contain only relevant information, for example:

```text
Name
Role
Email

[ My Profile ]
[ Sign Out ]
```

Do not show user counts, directories, admin counts or switch-user controls.

## 14. CLEAN SIGN-IN UI

Use a professional Supply Sync authentication screen.

Sign In:

```text
Email
Password

[ SIGN IN ]

Forgot Password?
```

If real email verification/OTP is configured:

```text
Email
↓
OTP
↓
Verify
↓
Login
```

Never expose demo OTPs in Actual Mode.

## 15. CLEAN SIGN-UP UI

```text
Full Name
Email
Password
Confirm Password
Role

[ CREATE ACCOUNT ]
```

The role selector contains exactly the seven approved roles.

Do not show role counts or existing users.

Role-specific fields should appear only where actually required.

## 16. AUTHENTICATION DATA MODEL

Keep authentication identity separate from business profiles:

```text
AUTH USER
├── auth_user_id
├── email
└── authentication metadata
       ↓
USER PROFILE
├── user_id
├── auth_user_id
├── full_name
├── role
└── status
       ├── Supplier → supplier_id
       └── Driver → driver_id
```

Use stable IDs for all relationships.

## 17. DATABASE ACCESS / RLS

RLS and backend authorization must prevent cross-user and cross-organization access.

Examples:

Supplier:
```text
supplier_id = authenticated user's supplier_id
```

Driver:
```text
driver_id = authenticated user's driver_id
```

Other roles receive only their authorized operational data.

Supplier A must never query Supplier B's:
- POs
- Shipments
- Invoices
- Ratings
- Records

Driver A must never query Driver B's:
- Requests
- Location
- Shipment history

## 18. DEMO VS ACTUAL MODE

These are completely separate environments.

### DEMO MODE

Contains the prepared synthetic dataset for demonstration:

- Demo users
- Demo suppliers
- PRs
- POs
- Shipments
- Trucks
- Drivers
- Docks
- GRNs
- QC
- Invoices
- Payments
- Exceptions
- Traceability
- Simulated tracking

### ACTUAL MODE

Contains the same database schema but starts with no pre-filled business transaction data.

Schema:
YES

Tables:
YES

Columns:
YES

Relationships:
YES

Constraints:
YES

RLS:
YES

Pre-filled business transactions:
NO

Demo suppliers:
NO

Demo POs:
NO

Demo shipments:
NO

Demo invoices:
NO

Demo GRNs:
NO

Demo QC:
NO

Demo payments:
NO

The user will create all real users and operational data themselves through the application.

## 19. DATABASE SEPARATION

Preferred:

```text
DEMO
→ Demo Supabase project/database
→ Synthetic data

ACTUAL
→ Actual/Production Supabase project/database
→ User-created data
```

If separate projects are not practical, use strongly isolated schemas/tables plus environment-level configuration and RLS.

Do not use only a frontend flag against one shared database.

Demo actions must never modify Actual data.

Actual actions must never modify Demo data.

## 20. LOGIN PAGE — TWO PATHS

The landing page should clearly separate:

```text
DEMO MODE
Pre-populated workflow
[ ENTER DEMO ]

ACTUAL MODE
Real account
[ SIGN IN ]
[ SIGN UP ]
```

Demo and Actual must connect to different data sources/environments.

## 21. ACTUAL MODE STARTING STATE

When a user enters Actual Mode:

```text
Schema exists
↓
No fake transactions
↓
User creates accounts/data
↓
Worker creates first PR
↓
Real Supply Sync workflow begins
```

This lets the user test the real scenario themselves and discover what works or fails.

## 22. DEMO MODE PURPOSE

Demo mode exists only to demonstrate the complete Supply Sync workflow using synthetic data.

It must not be treated as real operational data.

## 23. FINAL AUTHENTICATION FLOW

```text
OPEN SUPPLY SYNC
       │
       ├───────────────┐
       │               │
   DEMO MODE       ACTUAL MODE
       │               │
       ↓               ↓
Demo Environment   SIGN IN / SIGN UP
       │               │
Synthetic Data      Create/Use Account
       │               │
       │          Email Verification/OTP
       │               │
       │               ↓
       │          Authenticate
       │               │
       │               ↓
       │          Identify Role
       │               │
       │               ↓
       │       Role-Based Dashboard
       │
       ↓
Pre-populated Demo Workflow
```

## 24. FINAL ROLE ARCHITECTURE

Exactly seven operational roles:

```text
1. WORKER
2. PR OFFICER
3. SUPPLIER
4. CARRIER FLEET DRIVER
5. LOGISTICS & GATE POST
6. RECEIVER & QC LEAD
7. FINANCE CONTROLLER
```

No eighth operational role.
No custom role creation.
No artificial user-count limit.
No user-count display.
No public user directory.

## 25. FINAL ACCEPTANCE CRITERIA

The implementation is correct only when:

- Current User Directory is completely removed.
- Normal users cannot see total registered users.
- Normal users cannot see a list of registered users.
- Normal users cannot see other users' emails/profiles.
- User switching is removed.
- No dashboard displays user counts.
- Sign In and Sign Up are clearly available.
- Users can register for any of the seven roles.
- There is no artificial limit on operational users.
- Actual Mode contains schema but no pre-filled business transactions.
- Actual Mode does not contain demo suppliers.
- Demo Mode remains populated with synthetic data.
- Demo and Actual use isolated data environments.
- Exactly seven operational roles exist.
- No extra operational roles appear anywhere.
- Supplier registration generates a unique Supplier ID.
- Supplier ID links all supplier-related records.
- Supplier receives only POs addressed to its Supplier ID.
- Supplier invoice submissions are tied to the authenticated Supplier ID.
- Driver ID is similarly tied to the authenticated driver account.
- RLS/backend authorization prevents cross-user/cross-supplier access.
- Role-based dashboards show only authorized information.
- Actual users can build the workflow from an empty business dataset.
- The UI is clean, professional and consistent with Supply Sync.

## 26. CORE PRINCIPLE

Supply Sync must behave like a real enterprise application:

**Anyone can register as one of the seven authorized operational roles, but nobody can browse the user database.**

**Demo data demonstrates the product.**

**Actual Mode starts with the correct schema but empty business data, allowing the user to create the real workflow themselves.**

**Authentication identifies the person.**

**The role determines what they are allowed to do.**

**Supplier ID and Driver ID connect users to their operational records.**

**The database remains the single source of truth.**

# SUPPLY SYNC
