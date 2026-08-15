# SUPPLY SYNC — UPDATES 10
## Gate-In, Search & Filters, Partial Dispatch, Driver Fallback, Supplier Fleet, Parking & Dock Management

> Fix the existing database/schema errors first, then implement this update. Do not hide errors in the UI. Database schema, backend queries, frontend forms, foreign keys, RLS and audit history must agree.

## 1. FIX THE CURRENT GATE-IN ERROR

The current Gate-In error is:

`Could not find the 'po_id' column of 'yard_entries' in the schema cache`

Inspect the real Supabase `yard_entries` schema and every Gate-In query.

Preferred relational structure:

```text
yard_entries
------------
yard_entry_id
shipment_id
po_id
supplier_id
driver_id
truck_id
yard_id
gate_in_time
gate_out_time
status
created_at
updated_at
```

Use valid foreign keys:

```text
shipment_id → shipments
po_id → purchase_orders
supplier_id → suppliers
driver_id → drivers
truck_id → trucks
yard_id → yards
```

If `po_id` is already derivable through the canonical `shipment_id → PO` relationship and the database intentionally does not store `po_id` in `yard_entries`, then refactor the application to use that canonical relationship instead of querying a nonexistent column. Do not create redundant data merely to silence the error.

After any migration:
1. Apply migration.
2. Verify schema and foreign keys.
3. Refresh Supabase schema cache where required.
4. Update generated database/TypeScript types.
5. Update frontend/backend queries.
6. Update RLS.
7. Test INSERT, SELECT and UPDATE.
8. Test the complete Gate-In workflow.

The schema-cache error must disappear completely.

---

## 2. GATE-IN WORKFLOW

```text
Shipment In Transit
↓
Truck Arrives
↓
Logistics / Gate Post searches shipment/truck
↓
Select Shipment
↓
Verify PO + Supplier + Driver + Truck + Shipment
↓
Select Yard
↓
Gate-In
↓
Create Yard Entry
↓
Assign Dock OR Parking
```

Gate Post should select existing linked records instead of manually retyping information already present in the database.

Gate-In should display:

```text
Shipment ID
PO ID
Supplier / Supplier ID
Driver ID / Driver Name
Truck ID / Truck Number
Origin
Destination
ETA
Quantity
Priority
Current Shipment Status
Gate-In Time
Yard
Status
Notes
```

---

## 3. GATE-IN SEARCH & FILTERS

Add a prominent search bar:

`Search shipment, PO, truck, driver or supplier...`

Search by:

```text
Shipment ID
PO ID
Truck Number
Driver ID
Driver Name
Supplier Name
Supplier ID
```

Add filters for:

```text
Status
Supplier
Priority
Arrival Date
ETA
Yard
Truck
Driver
PO
Shipment
```

Useful statuses:

```text
IN TRANSIT
ARRIVING
ARRIVED
GATE-IN
WAITING FOR DOCK
IN PARKING
AT DOCK
UNLOADING
COMPLETED
```

For large datasets, use server-side filtering/pagination where practical, indexes for common searches, debounced text search, and preserve filters while navigating.

---

## 4. GLOBAL SEARCH/FILTER REQUIREMENT

Every major operational section should have useful search/filter controls:

```text
PR
PO
Supplier
Shipment
Driver
Truck
Gate-In
Yard
Parking
Dock
GRN
QC
Invoice
Exceptions
Payments
Traceability
```

Use actual database values. Do not create decorative filters that do nothing.

---

## 5. PARTIAL DISPATCH

Supplier must choose how many units of an accepted PO to dispatch.

Example:

```text
PO Quantity = 1000
Dispatch Now = 300
Remaining = 700
```

Allow:

```text
Full Dispatch
OR
Partial Dispatch
```

Maintain:

```text
PO Total Quantity
Allocated Quantity
Dispatched Quantity
Remaining Quantity
```

Never allow:

`Total shipped > PO quantity`

This must be enforced in backend/database logic, not only in the frontend.

Statuses:

```text
NOT_DISPATCHED
PARTIALLY_DISPATCHED
FULLY_DISPATCHED
```

---

## 6. PROCUREMENT OFFICER — REMAINING REQUIREMENTS

Add:

`Remaining Procurement Requirements`

Show requirements that remain unfulfilled after partial dispatch.

Example:

```text
PR-001
Required: 1000
Fulfilled: 600
Remaining: 400
```

PR Officer can assign the remaining requirement to another supplier.

Workflow:

```text
Remaining Requirement
↓
PR Officer
↓
Select Supplier
↓
Create New PO
↓
New PO retains original PR ID
↓
Traceability links both POs to same PR
```

Example:

```text
PR-001 = 1000

PO-001 → Supplier A → 600
PO-002 → Supplier B → 400
```

---

## 7. KEEP PR DISTRIBUTION AND PARTIAL DISPATCH SEPARATE

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

---

## 8. DRIVER REGISTRATION → ELIGIBLE SUPPLIER DRIVER LIST

Whenever a user registers as:

`Carrier Fleet Driver`

create a unique Driver ID and Driver Profile.

Example:

```text
DRV-0001
DRV-0002
DRV-0003
```

The driver should become available to Suppliers who are authorized to request that driver.

Do NOT copy the full driver record into every supplier record.

---

## 9. DRIVER-SUPPLIER RELATIONSHIP WITHOUT REDUNDANCY

Use stable relational IDs.

Conceptually:

```text
drivers
-------
driver_id
name
phone
status
...

supplier_driver_access
----------------------
supplier_id
driver_id
status
created_at
```

The canonical driver information exists only once.

If only one driver is eligible for a Supplier/shipment, show only that driver.

Do not show unrelated drivers.

---

## 10. DRIVER REQUEST FALLBACK

Supplier workflow:

```text
Shipment Created
↓
Request eligible organization driver(s)
↓
Driver accepts?
```

If YES:

```text
Assign Driver
↓
Dispatch
```

If the driver:

```text
Rejects
OR
Request expires
```

then:

```text
Supplier Fleet becomes available
↓
Supplier selects own driver
↓
Supplier selects own truck
↓
Validate availability
↓
Assign
↓
Dispatch
```

---

## 11. MULTIPLE DRIVER REQUESTS

Supplier may request multiple eligible organization drivers for one shipment.

Example:

```text
Driver A → REQUESTED
Driver B → REQUESTED
Driver C → REQUESTED
```

First valid acceptance wins.

After acceptance:

```text
Accepted Driver → ACTIVE
Other Requests → CANCELLED
```

Use backend transaction/locking logic to prevent two drivers from winning the same shipment due to a race condition.

---

## 12. DRIVER REQUEST EXPIRATION

Supplier can specify:

```text
30 minutes
1 hour
2 hours
Custom
```

After deadline:

`REQUEST → EXPIRED`

Supplier can then use fallback fleet.

---

## 13. DRIVER COMPENSATION

Supplier must enter the amount offered to the driver.

```text
Driver Compensation: ₹ ______
```

Store it in the driver-request record:

```text
request_id
shipment_id
supplier_id
driver_id
offered_amount
requested_at
expires_at
status
response_at
response_reason
```

Driver must see compensation before accepting.

Driver request screen:

```text
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

---

## 14. SUPPLIER-OWNED DRIVER PANEL

Add:

`Supplier Fleet / Drivers`

Supplier can maintain its own fleet drivers.

Suggested fields:

```text
supplier_driver_id
supplier_id
driver_name
phone
license/reference information where required
availability
status
vehicle/truck reference
created_at
updated_at
```

Supplier-owned drivers must remain private to that Supplier.

Supplier A must not see Supplier B's private fleet.

---

## 15. SUPPLIER-OWNED TRUCK PANEL

Add:

`Supplier Fleet / Trucks`

Suggested fields:

```text
truck_id
supplier_id
registration_number
vehicle_type
capacity
status
assigned_driver_id where applicable
```

Supplier can maintain its own trucks and use them when organization-driver requests are rejected or expire.

Prevent assignment of an unavailable truck.

---

## 16. DRIVER + TRUCK VALIDATION

Before assignment:

```text
Driver = Available
Truck = Available
Truck capacity >= shipment quantity
```

where capacity is relevant.

Do not allow the same unavailable driver/truck to be assigned to overlapping active shipments.

---

## 17. MULTIPLE SHIPMENTS FOR ONE PO

One PO must support:

```text
1 PO
→ 1 Shipment

1 PO
→ 2 Shipments

1 PO
→ N Shipments
```

Example:

```text
PO-001 = 1000 units

Shipment 1 = 300
Shipment 2 = 250
Shipment 3 = 450
```

Enforce:

`SUM(all shipment quantities) <= PO quantity`

Remaining quantity must update dynamically.

---

## 18. PARKING MANAGEMENT

Add:

`Parking Management`

Handled by:

`Logistics / Gate Post team`

Each parking slot should have:

```text
parking_id
yard_id
slot_code
status
current_shipment_id
current_truck_id
assigned_at
released_at
```

Statuses:

```text
AVAILABLE
RESERVED
OCCUPIED
MAINTENANCE
```

Relationship:

```text
Yard
↓
Parking Slot
↓
Shipment / Truck
```

---

## 19. PARKING ASSIGNMENT

If no suitable dock is available:

```text
Gate-In
↓
Check Dock Availability
↓
No suitable Dock
↓
Assign Parking Slot
↓
Shipment = IN PARKING
```

When a dock becomes available:

```text
Parking Queue
↓
Priority / ETA / Arrival Time
↓
Dock Assignment
↓
Call Truck
↓
Truck Moves to Dock
```

Do not allow two active trucks/shipments to occupy the same parking slot.

---

## 20. DOCK MANAGEMENT

Maintain a proper Dock Management section.

Each dock:

```text
dock_id
yard_id
dock_code
dock_type
status
current_shipment_id
current_truck_id
assigned_at
released_at
```

Statuses:

```text
AVAILABLE
RESERVED
OCCUPIED
UNLOADING
MAINTENANCE
```

Only one active shipment can occupy a dock at a time.

---

## 21. DOCK ASSIGNMENT

```text
Truck Gate-In
↓
Find eligible docks
↓
Check priority
↓
Check ETA / arrival
↓
Check dock availability
↓
Assign Dock
```

If unavailable:

```text
Assign Parking
```

Use deterministic fallback rules even if AI optimization is later added.

---

## 22. DOCK + PARKING DATABASE DESIGN

Keep entities separate:

```text
yards
├── docks
└── parking_slots

shipments
├── dock_assignment
└── parking_assignment
```

Use IDs instead of duplicating entire dock/parking objects inside shipments.

---

## 23. GATE → PARKING → DOCK STATE MACHINE

Implement clear backend-valid state transitions:

```text
IN_TRANSIT
↓
ARRIVED_AT_GATE
↓
GATE_VERIFIED
↓
WAITING_FOR_DOCK
├──→ PARKED
│      ↓
│   WAITING_FOR_DOCK
│
└──→ DOCK_ASSIGNED
       ↓
    AT_DOCK
       ↓
    UNLOADING
       ↓
    RELEASED
```

Reject invalid state transitions.

---

## 24. GATE POST PERMISSIONS

Gate Post can:

- Search shipments/trucks
- Verify arrival
- Record Gate-In
- Manage yard entry
- Participate in dock/parking operational workflow
- View live shipment status

Gate Post cannot:

- Approve PR
- Approve PO
- Modify Supplier master
- Perform Finance payment
- Modify QC results
- Edit unrelated shipment master data

---

## 25. LOGISTICS PERMISSIONS

Logistics can:

- Monitor shipments
- Monitor trucks
- View live locations
- Handle operational shipment errors
- Coordinate inbound/outbound
- Manage parking
- Manage dock availability/assignment
- Coordinate Gate Post

Logistics cannot approve PR/PO or perform Finance payment.

---

## 26. DATABASE DYNAMIC LINKING

Every operational record must remain connected.

Example:

```text
Shipment SHP-001
↓
PO-001
↓
Supplier A
↓
Driver DRV-002
↓
Truck TRK-009
↓
Gate Entry
↓
Parking P-04
↓
Dock D-02
```

When a dock/parking/shipment/driver state changes, all authorized modules must reflect the new state from the database.

Do not manually duplicate state in unrelated tables.

---

## 27. SEARCH BY STABLE IDs

Prioritize:

```text
PR ID
PO ID
Supplier ID
Shipment ID
Driver ID
Truck ID
Invoice ID
GRN ID
```

Names can also be searchable.

For large datasets use indexes, pagination and server-side filters where practical.

---

## 28. AUDIT HISTORY

Log:

```text
Gate-In
Parking assignment
Dock assignment
Dock release
Parking release
Driver request
Driver rejection
Driver expiration
Fallback driver assignment
Truck assignment
Partial dispatch
Remaining quantity update
Supplier fleet changes
```

Audit fields:

```text
actor_user_id
actor_role
entity_type
entity_id
action
old_value
new_value
timestamp
reason where required
```

---

## 29. FINAL END-TO-END FLOW

```text
PR
↓
PO
↓
Supplier
↓
Accepted PO
↓
Supplier selects dispatch quantity
↓
FULL / PARTIAL DISPATCH
↓
Shipment Created
↓
Driver Request
├── Driver accepts
│      ↓
│   Assign Driver
│
└── Driver rejects / expires
       ↓
   Supplier Fleet
       ↓
   Select Supplier Driver
       ↓
   Select Supplier Truck
       ↓
   Assign
       ↓
     Dispatch
       ↓
   Tracking / AI ETA
       ↓
     Gate-In
       ↓
 Search / Verify Shipment
       ↓
    Yard Entry
       ↓
  Dock Available?
      /           YES        NO
     ↓          ↓
   Dock       Parking
     ↓          ↓
  Unload   Wait / Queue
     ↓          ↓
     └────→ Dock Assignment
              ↓
           Unloading
```

---

## 30. ACCEPTANCE TESTS

### Gate-In
- Gate-In succeeds.
- No `yard_entries.po_id` schema-cache error.
- Shipment/truck/PO/supplier/driver search works.
- Gate-In creates a valid linked yard entry.
- Unauthorized users cannot modify Gate-In.

### Partial Dispatch
- Supplier can choose dispatch quantity.
- Partial dispatch creates shipment(s).
- Remaining quantity updates immediately.
- Multiple shipments are supported.
- Over-dispatch is impossible.
- PO status becomes `PARTIALLY_DISPATCHED` or `FULLY_DISPATCHED` correctly.

### Driver Assignment
- Registered organization drivers populate the eligible list.
- Only authorized/eligible drivers are shown.
- Supplier can request one or multiple drivers.
- Driver sees compensation.
- Driver can accept/reject.
- Deadline works.
- Rejection/expiration enables supplier-fleet fallback.
- Supplier-owned driver and truck can be selected.
- Driver/truck availability is validated.
- The correct driver receives the request.

### Parking
- Parking slots exist in the database.
- Logistics/Gate Post can see availability according to permissions.
- Shipment can enter parking.
- Parking can transition to dock.
- Two active shipments cannot occupy the same slot.

### Dock
- Dock data is stored centrally.
- Availability updates dynamically.
- No double booking.
- Dock release updates status.
- Parking queue can move into a dock.

### Search/Filters
- Every major operational module has useful filters.
- Search uses actual database records.
- Large datasets do not require loading everything into the browser.

---

## 31. NON-NEGOTIABLE RULE

Do not solve these problems with frontend-only mock logic.

The complete chain must agree:

```text
UI
↓
Backend/API
↓
Supabase Database
↓
Foreign Keys
↓
RLS
↓
Transactions
↓
Audit History
```

The system must remain relational:

**PR → PO → Supplier → Shipment → Driver/Truck → Gate-In → Yard → Parking/Dock → Receiving/QC → GRN → Invoice → Finance**

No isolated forms.

No hardcoded driver lists.

No hardcoded shipments.

No duplicate driver records for every supplier.

No duplicate PO rows in traceability.

No unauthorized access.

No over-dispatch.

No double-booked driver, truck, parking slot or dock.

No schema-cache errors.

# SUPPLY SYNC
