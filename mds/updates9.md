# SUPPLY SYNC --- UPDATES 9

## Dispatch, Driver Assignment, Invoice, Traceability, Permissions, Supplier/PO Distribution, Warehouse & Location Management

> This is the next implementation update for Supply Sync. Fix the
> existing database/schema errors first, then implement the workflow
> below. Do not merely hide errors in the UI. Database schema, backend
> queries, frontend forms, relationships, RLS and audit history must all
> agree.

## 1. FIX THE TWO CURRENT DATABASE ERRORS

### Shipment creation error

Current error:

`Shipment creation failed: Could not find the 'destination' column of 'shipments' in the schema cache`

Inspect the real Supabase `shipments` schema and the code. Either:

-   add a properly typed `destination` field if it is genuinely
    required, OR
-   use the existing canonical `destination_location_id`/location
    relationship if destination is already modeled elsewhere.

Do not maintain two conflicting sources of truth.

### Invoice submission error

Current error:

`Invoice submission failed: Could not find the 'shipment_id' column of 'invoices' in the schema cache`

If shipment-level invoicing is the intended workflow, add `shipment_id`
to `invoices` as a valid foreign key to `shipments`. If one invoice can
cover multiple shipments, use an invoice-to-shipment junction table
instead of forcing an invalid one-to-one relationship.

After schema changes:

1.  Apply migration.
2.  Confirm columns and foreign keys in Supabase.
3.  Refresh schema cache where required.
4.  Update generated TypeScript/database types.
5.  Update frontend and backend queries.
6.  Update RLS.
7.  Test INSERT/SELECT/UPDATE.
8.  Test the complete workflow.

## 2. SHIPMENT DATA MODEL

Every shipment must be connected to:

``` text
shipment_id
pr_id
po_id
supplier_id
driver_id
truck_id
origin_location_id
destination_location_id
quantity
shipment_status
dispatch_at
expected_arrival
actual_arrival
tracking information
priority
created_at
updated_at
```

Relationships:

``` text
PR → PO → Shipment → Driver/Truck
                 ├→ Origin
                 └→ Destination
```

A shipment must never be an isolated record.

## 3. SUPPLIER DRIVER REQUEST & SELECTION

Add a dedicated Supplier section:

`Driver Assignment`

The Supplier can see eligible registered Carrier Fleet Drivers from the
organization.

Show only operational information needed for assignment:

-   Driver ID
-   Driver name
-   Availability
-   Vehicle/truck information where appropriate
-   Current assignment status
-   Authorized contact information

Supplier workflow:

``` text
Accepted PO
↓
Create Shipment
↓
Select/request Driver(s)
↓
Enter Driver Compensation
↓
Set Response Deadline
↓
Send Request
↓
Driver receives request
↓
ACCEPT / REJECT
↓
First valid acceptance wins
↓
Shipment assigned
↓
Dispatch
```

## 4. MULTIPLE DRIVER REQUESTS

A Supplier may request multiple drivers for the same shipment:

``` text
Shipment SHP-1001
Driver A → Request
Driver B → Request
Driver C → Request
```

The first valid driver who accepts becomes the assigned driver.

Then:

``` text
Accepted driver → ACTIVE
Other pending requests → CANCELLED
```

Use backend transaction/locking logic so two drivers cannot win the same
shipment due to a race condition.

## 5. DRIVER REQUEST EXPIRATION

Supplier can define:

-   30 minutes
-   1 hour
-   2 hours
-   Custom

After the deadline:

`REQUEST → EXPIRED`

Supplier can request another driver.

## 6. DRIVER COMPENSATION

Supplier must enter:

``` text
Driver Compensation: ₹ ______
```

Store this in the driver-request/assignment record.

Conceptually:

``` text
shipment_id
driver_id
supplier_id
offered_amount
requested_at
expires_at
status
response_at
response_reason
```

Driver must see the offered compensation BEFORE accepting.

Driver request screen:

``` text
Shipment ID
PO ID
Supplier
Origin
Destination
Distance
AI ETA
Offered Compensation
Response Deadline

[ ACCEPT ]
[ REJECT ]
```

## 7. DRIVER IDENTITY

Every real driver has a unique Driver ID.

Example:

``` text
DRV-0001
DRV-0002
DRV-0003
```

Relationship:

``` text
Auth User
↓
User Profile
↓
Driver Profile
↓
driver_id
↓
Driver Requests
↓
Shipment
↓
Truck
↓
Tracking
```

Supplier must see the correct Driver ID when assigning a shipment.

## 8. MULTIPLE SHIPMENTS FOR ONE PO

One accepted PO must support 1..N shipments.

Example:

``` text
PO-1001 = 1000 units

Shipment 1 = 250
Shipment 2 = 300
Shipment 3 = 200
Shipment 4 = 250
```

Enforce:

`SUM(shipment quantities) <= PO quantity`

Never allow over-allocation.

The same driver may handle multiple shipments when operationally valid.

## 9. SUPPLIER SHIPMENT CREATION

Create Shipment modal must show:

``` text
PO ID
Total PO Quantity
Already Allocated
Remaining Quantity
Shipment Quantity
Origin
Destination
Expected Dispatch Date
```

Then:

``` text
CREATE SHIPMENT
↓
DRIVER ASSIGNMENT
↓
DISPATCH
```

Do not mix shipment creation and invoice submission into one ambiguous
action.

## 10. SUPPLIER VIEW PO BUG

Fix the Supplier `View PO` function.

It must load the actual PO belonging to the authenticated Supplier ID.

Show:

-   PO ID
-   PR ID
-   Supplier ID
-   Items
-   Product SKU
-   Quantity
-   Unit price
-   Total value
-   Required date
-   Delivery location
-   Terms
-   Approval history
-   Shipment allocation
-   Status

Supplier must only access POs associated with its own `supplier_id`.

No hardcoded PO.

## 11. SUPPLIER INVOICE WORKFLOW

Supplier invoice flow:

``` text
Supplier
↓
Accepted PO
↓
Dispatched Shipment
↓
Upload Invoice PDF
↓
Invoice ID
↓
PO ID
↓
Shipment ID
↓
Supplier ID
↓
Finance Queue
```

Invoice should contain, where applicable:

``` text
invoice_id
supplier_id
po_id
shipment_id
invoice_number
amount
invoice_date
file/document reference
status
created_at
```

Validate:

`authenticated_supplier_id = invoice.supplier_id`

A supplier cannot submit an invoice under another supplier's identity.

## 12. FINANCE INVOICE QUEUE

All authorized Finance Controllers must see legitimate supplier invoices
in the customer finance section.

Show:

``` text
Invoice ID
Supplier
Supplier ID
PO ID
Shipment ID
Invoice Date
Amount
Upload Date
Status
```

Finance can open/download the invoice.

Then:

``` text
Invoice
+
PO
+
GRN
↓
3-Way Match
```

Match → payment.

Mismatch → exception → payment hold → resolution → reconciliation →
payment.

## 13. TRACEABILITY MATRIX --- PR OFFICER ONLY

Full Traceability Matrix visibility is restricted to:

-   PR Officer
-   Technical Admin, if applicable

No other operational role should access the complete enterprise matrix.

Other roles may see their own authorized records through their own
modules.

## 14. TRACEABILITY MUST BE GROUPED BY PO

A PO number must appear only once at the top level.

Example:

``` text
PO-1001
├── PR-001
├── Supplier
├── PO Status
├── Shipment 1
├── Shipment 2
├── Invoice(s)
├── GRN(s)
├── QC
├── Payment
└── Exceptions
```

Clicking the PO expands its entire connected workflow.

Do not repeat the same PO as separate top-level rows.

## 15. TRACEABILITY STATUS

Use:

``` text
COMPLETED
IN PROGRESS
PENDING
REJECTED
ON HOLD
EXCEPTION
```

Example:

``` text
PR             COMPLETED
PO             COMPLETED
Supplier       ACCEPTED
Shipment 1     COMPLETED
Shipment 2     IN TRANSIT
GRN            PENDING
QC             PENDING
Invoice        RECEIVED
3-Way Match    PENDING
Payment        PENDING
```

Clicking `Shipments` must show all shipments under that PO, including:

-   Shipment ID
-   Quantity
-   Driver
-   Truck
-   Origin
-   Destination
-   Dispatch
-   ETA
-   Current status
-   Gate arrival
-   Dock

## 16. PR → MULTIPLE PO SUPPLIER DISTRIBUTION

PR Officer must be able to distribute one approved PR among multiple
suppliers.

Example:

``` text
PR-001 = 1000 units

Supplier A → PO-A → 400
Supplier B → PO-B → 350
Supplier C → PO-C → 250
```

All POs retain:

`PR ID = PR-001`

Each PO has its own unique PO ID.

Validate:

`SUM(distributed quantities) = approved PR quantity`

unless an explicitly supported partial-order workflow is selected.

## 17. PO DISTRIBUTION VS SHIPMENT SPLITTING

These are different operations.

### PR → Multiple POs

Handled by:

`PR Officer`

Purpose:

`Distribute procurement quantity across suppliers.`

### PO → Multiple Shipments

Handled by:

`Supplier`

Purpose:

`Split an accepted supplier PO into transportable shipments.`

Do not mix these workflows.

## 18. PRODUCT SKU PERMISSIONS

### PR Officer

Can create/update SKU master information where authorized.

### Worker

Can view/select SKU while creating a PR.

Worker cannot:

-   Edit SKU
-   Delete SKU
-   Change SKU master data

Other roles only access SKU information required by their workflow.

## 19. PR CREATION PERMISSIONS

PR may be created ONLY by:

-   Worker
-   PR Officer

Supplier, Carrier Fleet Driver, Logistics & Gate Post, Receiver & QC
Lead and Finance Controller cannot create PRs.

## 20. SUPPLIER MASTER LIST

Only PR Officer can manage the supplier master:

-   Add supplier
-   Edit supplier
-   View supplier
-   Update supplier information
-   Remove/inactivate supplier

Other operational roles cannot modify supplier master data.

## 21. SUPPLIER DELETION

Deleting a supplier must require a reason.

Modal:

``` text
Remove Supplier

Reason for Supplier Removal
[________________________]

[ CANCEL ]
[ CONFIRM REMOVAL ]
```

Reason is mandatory.

Prefer soft deletion/inactivation rather than hard deletion when
historical transactions reference the supplier.

## 22. SUPPLIER REMOVAL NOTIFICATIONS

Workflow:

``` text
PR Officer
↓
Remove Supplier
↓
Reason Required
↓
Supplier marked REMOVED/INACTIVE
↓
Reason stored in audit history
↓
Supplier notified by email
↓
Higher authority notified by email
```

Supplier email should contain:

``` text
Supplier ID
Reason
Effective date
```

Higher-authority email should contain:

``` text
Supplier ID
Supplier name
Removed by
Reason
Timestamp
```

Use real configured email addresses/services.

## 23. WAREHOUSE MANAGEMENT

Add:

`Warehouse Management`

Handled by:

`PR Officer`

PR Officer can:

-   Add warehouse
-   Update warehouse
-   Mark warehouse inactive
-   Change warehouse location
-   View warehouse
-   Confirm location on map

Do not hard-delete warehouses referenced by historical transactions.

Use:

``` text
ACTIVE
INACTIVE
```

## 24. SUPPLIER LOCATION MANAGEMENT

Supplier must have its own location-management section.

Supplier can:

-   Add origin facility
-   Update origin facility
-   Add dispatch location
-   Update location
-   Search/select location on map
-   Confirm location
-   Save location

Every saved location gets a stable `location_id`.

## 25. GOOGLE MAP LOCATION CONFIRMATION

For warehouse/supplier locations:

``` text
Search / Enter Location
↓
Google Maps / Map UI
↓
Select Pin
↓
Show Address
↓
Show Coordinates
↓
[ CONFIRM LOCATION ]
↓
Save
```

Store:

``` text
location_id
name
type
formatted_address
latitude
longitude
status
created_at
updated_at
```

Do not rely only on free-text addresses.

## 26. CENTRAL LOCATION MODEL

Use a canonical `locations` table.

Conceptually:

``` text
locations
----------
location_id
name
type
address
latitude
longitude
status
created_at
updated_at
```

Then reference it using foreign keys:

``` text
Supplier → origin_location_id
Shipment → origin_location_id
Shipment → destination_location_id
Warehouse → location_id
```

Do not create conflicting free-text location sources.

## 27. LOCATION CONSISTENCY & HISTORY

If a warehouse moves:

``` text
Existing Warehouse
↓
Update location
↓
Map confirmation
↓
New coordinates
↓
Database update
```

Future shipments use the new location.

Historical transactions must retain the historical location context
required for auditability; do not rewrite past shipment locations simply
because a warehouse later moved.

## 28. REGISTRATION FORM UX BUG

Current issue:

> Users sometimes have to click multiple times inside a form field
> before typing.

Fix the registration UI so that:

-   Every input focuses on the first click.
-   No transparent overlay blocks inputs.
-   Labels do not intercept clicks incorrectly.
-   Dropdowns open on first click.
-   Phone inputs work normally.
-   Password fields work normally.
-   Date fields work normally.
-   Modal z-index/stacking is correct.
-   Unnecessary re-renders do not steal focus.
-   Controlled inputs preserve typed values.
-   Validation does not reset unrelated fields.
-   Mouse and keyboard navigation both work.

## 29. CONTACT INFORMATION

Phone/contact information must be collected for every applicable
registered user.

The phone field must NOT disappear for Supplier or Driver registration.

Collect contact information for:

-   Worker
-   PR Officer
-   Supplier
-   Carrier Fleet Driver
-   Logistics & Gate Post
-   Receiver & QC Lead
-   Finance Controller

For Supplier, also collect relevant business contact information.

For Driver, collect operational contact information required for
dispatch.

## 30. PHONE DATA MODEL

Use dedicated contact fields, not an unstructured notes field.

Example:

``` text
user_profiles.phone
```

Supplier may additionally require:

``` text
suppliers.contact_phone
```

Driver may additionally require:

``` text
drivers.contact_phone
```

Avoid contradictory duplicate values. Define which field is
authoritative.

## 31. DATABASE INTEGRITY

Every important entity must have one canonical identity:

``` text
pr_id
po_id
supplier_id
shipment_id
driver_id
truck_id
invoice_id
grn_id
warehouse/location_id
```

All modules must reuse those IDs.

No hardcoded names should be used as relational keys.

## 32. EMAIL NOTIFICATIONS

Use real email notifications for relevant events:

### Driver

-   New shipment request
-   Request accepted/rejected

### Supplier

-   PO received
-   PO rejected
-   Driver response
-   Shipment events
-   Supplier-related alerts

### Finance

-   New invoice
-   Invoice exception

### Higher Authority

-   Supplier removal

Use actual email addresses stored against authenticated profiles.

## 33. AUDIT HISTORY

Log important operations:

``` text
PR approval/rejection
PO edit
PO approval
PO supplier distribution
Supplier PO acceptance/rejection
Shipment creation
Driver request
Driver accept/reject
Dispatch
Invoice submission
Supplier removal
Warehouse/location update
QC update
Payment decision
Exception resolution
```

Audit records should contain:

``` text
actor_user_id
actor_role
entity_type
entity_id
action
old_value where appropriate
new_value where appropriate
reason where required
timestamp
```

## 34. RLS / AUTHORIZATION

Update Supabase RLS for all new relationships.

Supplier:

``` text
supplier_id = authenticated user's supplier_id
```

Driver:

``` text
driver_id = authenticated user's driver_id
```

PR Officer:

``` text
authorized procurement access
```

Finance:

``` text
authorized invoice/payment access
```

No role gets access simply because a foreign key exists.

Frontend hiding is not a security mechanism.

## 35. DATABASE TRANSACTION SAFETY

Operations involving several tables must be atomic where necessary.

Driver acceptance example:

``` text
Driver accepts
↓
Lock shipment/request
↓
Assign driver
↓
Close other pending requests
↓
Commit
```

If an operation fails:

``` text
ROLLBACK
```

This prevents inconsistent state.

## 36. FINAL END-TO-END WORKFLOW

``` text
WORKER / PR OFFICER
        ↓
       PR
        ↓
   PR OFFICER
        ↓
Supplier Distribution
        ├──────────────┐
        ↓              ↓
      PO-A           PO-B
        ↓
Supplier accepts PO
        ↓
Create 1..N shipments
        ↓
Request/select driver(s)
        ↓
Driver accepts
        ↓
Dispatch
        ↓
Tracking + AI ETA
        ↓
Logistics / Gate Post
        ↓
Dock / Yard
        ↓
Receiver + QC
        ↓
GRN
        ↓
Supplier Invoice
        ↓
Finance Controller
        ↓
PO + GRN + Invoice
        ↓
Three-Way Match
       / \
   MATCH  MISMATCH
     ↓       ↓
  PAYMENT  EXCEPTION
              ↓
        PR OFFICER
              ↓
         RESOLUTION
              ↓
       RECONCILIATION
              ↓
           PAYMENT
```

## 37. ACCEPTANCE TESTS

### Shipment

-   Create shipment succeeds.
-   No `destination` schema-cache error.
-   Shipment links to PO, PR, Supplier, origin and destination.
-   Quantity cannot exceed remaining PO quantity.

### Driver

-   Supplier sees eligible registered drivers.
-   Supplier can request multiple drivers.
-   Supplier can set response deadline.
-   Supplier can set compensation.
-   Driver sees compensation.
-   Driver can accept/reject.
-   First valid acceptance wins.
-   Other requests close automatically.
-   Correct `driver_id` is written to the shipment.

### Invoice

-   Supplier can upload invoice.
-   No `shipment_id` schema-cache error.
-   Invoice links to Supplier, PO and Shipment where applicable.
-   Finance Controllers can see and download the invoice.

### Supplier PO

-   View PO works.
-   Supplier sees only its own POs.
-   Accept/reject works.
-   Accepted PO enters shipment workflow.

### Multiple shipments

-   One PO supports multiple shipments.
-   Allocation is validated.
-   Remaining quantity is accurate.
-   Same driver can handle multiple valid shipments.

### Traceability

-   Full matrix visible only to PR Officer/Admin.
-   One PO appears only once at top level.
-   Multiple shipments appear beneath the PO.
-   Multiple POs can belong to one PR.
-   Shipment details expand correctly.
-   Statuses are accurate.

### Permissions

-   Worker and PR Officer can create PR.
-   Worker can view SKU but cannot edit it.
-   PR Officer can update SKU.
-   Only PR Officer manages supplier master.
-   Supplier deletion requires a reason.
-   Supplier deletion is auditable.
-   Required notifications are sent.

### Warehouse/location

-   PR Officer can add/update/inactivate warehouses.
-   Supplier can manage its own locations.
-   Map confirmation works.
-   Coordinates are stored.
-   Location IDs are used relationally.
-   Future shipments use the correct location.
-   Historical records remain auditable.

### Registration

-   All seven roles can register.
-   No artificial operational-user limit.
-   Phone field is available for all applicable roles.
-   First click focuses every field.
-   No input requires multiple clicks.
-   Registration creates correct user/profile/role relationships.

## 38. NON-NEGOTIABLE RULE

Never fix a database problem only by changing the UI.

Whenever a field is required:

``` text
UI
↓
Backend
↓
Database
↓
Foreign Key / Constraint
↓
RLS
↓
Audit
```

must agree.

Supply Sync must remain one interconnected system:

**PR → Supplier Distribution → PO → Supplier Acceptance → Shipment(s) →
Driver Request → Driver Acceptance → Dispatch → Tracking → Gate/Dock →
Receiving/QC → GRN → Invoice → Finance → 3-Way Match → Payment**

No isolated forms. No hardcoded relationships. No frontend-only fixes.
No duplicate PO rows in Traceability. No unauthorized role access. Every
action must update the correct database records and reflect wherever
that information is legitimately used.

# SUPPLY SYNC
