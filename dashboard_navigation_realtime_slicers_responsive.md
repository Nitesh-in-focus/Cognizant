# Dashboard Navigation + Live Data Integrity + Interactive Slicers + Responsive UI
## Antigravity Implementation Task

## Goal

The analytics dashboards are now visible in the application, but the implementation is incomplete.

Implement the following four improvements carefully:

1. Add a **Dashboard** option to the left sidebar for every supported user role.
2. Verify and correctly connect every dashboard to the user's **real database data**.
3. Make every dashboard **dynamic and interactive**, including Power-BI-style slicer/cross-filter behavior.
4. Make the **entire application responsive and functional across desktop, laptop, tablet, and mobile devices**.

Do NOT use mock data.

Do NOT hardcode dashboard values.

Do NOT create fake relationships merely to populate charts.

Use the actual existing database and existing application architecture.

---

# PART 1 — INSPECT BEFORE MODIFYING

Before changing code, inspect the current application.

Identify:

- Authentication/session implementation.
- Logged-in user object.
- User role retrieval.
- `public_app_users`.
- Existing role-based routing.
- Existing left sidebar/navigation component.
- Existing dashboard routes/components.
- Existing analytics components.
- Existing Supabase/database client.
- Existing API/service layer.
- Existing Supabase Realtime/WebSocket implementation.
- Existing authorization/RLS policies.
- Existing responsive layout system.
- Existing UI component library.

Do not rebuild anything that already exists.

First give a concise implementation plan listing the files/components/services you intend to modify.

---

# PART 2 — ADD "DASHBOARD" TO THE LEFT SIDEBAR

Every supported authenticated user must have a clear:

**Dashboard**

item in the LEFT SIDEBAR.

Example:

```text
┌──────────────────────┐
│ SUPPLY SYNC          │
│                      │
│ 🏠 Dashboard         │
│ 📦 Procurement       │
│ 🚚 Logistics         │
│ 🧾 Invoices          │
│ 📊 Analytics         │
│ ⚙ Settings           │
└──────────────────────┘
```

Use the application's existing sidebar design and icon system.

Do not create a second sidebar.

Do not duplicate navigation logic.

## Behavior

When the user clicks:

**Dashboard**

they must be routed to their own role-appropriate dashboard.

Examples:

```text
PROCUREMENT_OFFICER
→ Procurement Dashboard

PROCUREMENT_MANAGER
→ Procurement Dashboard

WORKER
→ Worker Dashboard

SUPPLIER
→ Supplier Dashboard

LOGISTICS_GATE_POST
→ Logistics/Gate Dashboard

RECEIVING_QC
→ Receiving/QC Dashboard

TRUCK_DRIVER
→ Driver Dashboard

FINANCE
→ Finance Dashboard
```

Use the project's actual role names and route conventions.

Do not hardcode a single dashboard for everyone.

---

# PART 3 — ROLE-BASED DASHBOARD VERIFICATION

This is extremely important.

The dashboard currently exists, but some users do not yet have their data correctly linked.

Verify every role against the actual database.

Start with:

```text
public_app_users
```

Determine:

- authenticated user ID
- role
- any existing profile/user reference
- relevant foreign keys

Then trace the relationships to the actual operational tables.

Existing relevant tables include:

```text
public_app_users
public_purchase_requisitions
public_pr_items
public_products
public_purchase_orders
public_po_items
public_exceptions
public_status_history
public_suppliers
public_warehouses
```

Do NOT assume relationships.

Inspect:

- primary keys
- foreign keys
- requester/user IDs
- supplier IDs
- warehouse IDs
- PO IDs
- PR IDs
- product IDs
- status/entity IDs
- any driver/worker/role-specific references

Use the actual database schema.

---

# PART 4 — DATA-LINK AUDIT

For each role, verify:

## Worker

Confirm how the authenticated worker is connected to:

```text
public_app_users
→ purchase requisitions / relevant work records
```

The worker dashboard must show the worker's own authorized data.

Do not show another worker's records.

---

## Procurement Officer / Procurement Manager

Verify connections among:

```text
public_app_users
public_purchase_requisitions
public_pr_items
public_purchase_orders
public_po_items
public_products
public_exceptions
public_status_history
public_suppliers
public_warehouses
```

Procurement analytics should reflect actual organizational procurement data.

---

## Supplier

Verify:

```text
authenticated user
→ app user
→ supplier identity
→ purchase orders / PO items / products
```

The supplier dashboard must only show that supplier's authorized records.

---

## Finance

Verify the actual relationship to:

```text
purchase_orders
po_items
exceptions
```

and any real financial/invoice/payment tables already present in the application.

Do not invent financial relationships.

---

## Logistics Gate Post

Verify actual links to:

```text
purchase_orders
warehouses
exceptions
status_history
```

and any logistics tables actually present.

---

## Receiving QC

Verify actual links to:

```text
purchase_orders
po_items
products
exceptions
status_history
```

and any receiving/QC records that actually exist.

---

## Truck Driver

Verify how a driver is associated with actual logistics/delivery records.

Do not assume that `app_users.id` equals a driver ID.

Inspect the schema first.

If the current database genuinely lacks a relationship needed for a driver's dashboard, do NOT fabricate one.

Report the missing relationship clearly and use the safest existing data available.

---

# PART 5 — DATABASE RELATIONSHIP VALIDATION

Before declaring a dashboard "dynamic", verify the actual relationships.

For every analytics query, confirm:

```text
User
 ↓
Role
 ↓
Authorized entity
 ↓
Operational records
 ↓
Analytics aggregation
```

If a relationship is missing, identify it.

Do NOT solve a missing relationship by:

- hardcoding IDs
- matching names approximately
- creating fake records
- duplicating users
- using frontend-only filtering

---

# PART 6 — LIVE / REAL-TIME DATA

The dashboards must use the actual live database.

The desired architecture is:

```text
Supabase/PostgreSQL
       ↓
Realtime event
       ↓
Application data layer
       ↓
Invalidate affected query
       ↓
Refetch/recalculate analytics
       ↓
Update dashboard UI
```

Use the project's existing realtime mechanism if available.

If Supabase Realtime is already configured, use it.

Relevant tables may include:

```text
public_purchase_requisitions
public_purchase_orders
public_pr_items
public_po_items
public_exceptions
public_status_history
public_products
public_suppliers
public_warehouses
```

Subscribe only where necessary.

Do not blindly subscribe every component to every table.

---

# PART 7 — TARGETED REALTIME UPDATES

Do NOT reload the entire application after every database event.

Example:

### Exception changes

If:

```text
public_exceptions
```

changes, update:

- Total Exceptions
- Open Exceptions
- Exception Value
- Exception Severity chart
- Exception Type chart
- Exception table

Do not unnecessarily reload unrelated worker/supplier/finance analytics.

### Purchase order changes

If:

```text
public_purchase_orders
public_po_items
```

change, update relevant:

- PO count
- procurement value
- PO status
- procurement trends
- related exception analytics where logically dependent

### Purchase requisition changes

If:

```text
public_purchase_requisitions
public_pr_items
```

change, update relevant:

- PR count
- PR status
- procurement trends
- related analytics

---

# PART 8 — POWER BI-STYLE SLICERS / CROSS-FILTERING

This is a major requirement.

The dashboard must behave like Power BI.

If a user clicks a category in a chart, the other visuals must update according to that selection.

Example:

```text
Exception Severity

CRITICAL   15
HIGH       20
MEDIUM     10
LOW         5
```

If the user clicks:

```text
HIGH
```

then:

- KPI cards update
- Exception Type chart updates
- Exception table updates
- Exception Value updates
- Other compatible visuals update
- Active filter state is visibly indicated

This must be **real filtering**, not just visual highlighting.

---

# PART 9 — GLOBAL FILTER STATE

Create a clean shared filter/query state for each dashboard.

Possible filter dimensions:

```text
Date Range
PR Status
PO Status
Exception Type
Exception Severity
Exception Status
Supplier
Warehouse
Product
```

Only expose filters supported by the current role and available relationships.

Use the project's existing state-management pattern if one exists.

Do not introduce a new state-management library unless necessary.

---

# PART 10 — CHART CROSS-FILTERING

Charts must be interactive.

Example:

```text
Click HIGH severity
        ↓
Global dashboard filter:
severity = HIGH
        ↓
KPI cards recalculate
        ↓
Exception Type chart recalculates
        ↓
Exception table filters
        ↓
Exception Value recalculates
```

Another example:

```text
Click PRICE_MISMATCH
        ↓
exception_type = PRICE_MISMATCH
        ↓
all compatible dashboard visuals update
```

Clicking the selected category again should clear that selection where appropriate.

---

# PART 11 — SLICER COMPONENTS

Create reusable slicer/filter components.

Recommended behavior:

### Single-select slicer

```text
Status
[ APPROVED ▼ ]
```

### Multi-select slicer

```text
Severity
☑ HIGH
☑ CRITICAL
☐ MEDIUM
☐ LOW
```

### Date slicer

Provide a clean date-range control where the database supports dates.

Example:

```text
From: 01 Aug 2026
To:   17 Aug 2026
```

Filters must be applied to real queries/data services.

Do not download all data and filter enormous datasets only in the browser.

---

# PART 12 — CLEAR ALL FILTERS

Add:

```text
Clear Filters
```

to dashboards with multiple filters.

Clicking it must restore the unfiltered state.

---

# PART 13 — ACTIVE FILTER INDICATOR

Show active filters clearly.

Example:

```text
Active filters:
[ HIGH × ] [ OPEN × ] [ August 2026 × ]
```

This prevents users from wondering why numbers changed.

---

# PART 14 — FILTER PERSISTENCE

If the existing application supports it, preserve filters while navigating within the dashboard.

Do not persist filters across different users.

When the user logs out, clear user-specific filter state.

When another user logs in, they must not inherit the previous user's filters.

---

# PART 15 — ROLE-SPECIFIC FILTERS

Do not give every role every filter.

Example:

### Procurement

```text
Date
PR Status
PO Status
Severity
Exception Type
Supplier
Warehouse
```

### Supplier

```text
Date
PO Status
Product
```

### Worker

```text
Date
PR Status
```

### Finance

```text
Date
PO Status
Supplier
```

Use actual business relationships.

---

# PART 16 — LIVE DASHBOARD STATUS

If realtime is successfully active, show:

```text
● Live
Updated just now
```

or:

```text
● Live
Last updated: 11:34:22 AM
```

The timestamp must reflect the latest successful refresh.

If realtime is disconnected:

```text
○ Reconnecting...
```

If realtime fails:

```text
⚠ Live updates unavailable
Last updated: <actual time>
```

Do not falsely claim realtime.

---

# PART 17 — RESPONSIVE DESIGN

Make the **entire application**, not only analytics, responsive.

Test at least:

```text
Desktop: 1440 × 900
Laptop: 1280 × 720
Tablet: 1024 × 768
Tablet portrait: 768 × 1024
Mobile: 390 × 844
Mobile: 360 × 800
```

Use responsive CSS/layout primitives already used by the project.

Avoid fixed widths that cause horizontal overflow.

---

# PART 18 — SIDEBAR RESPONSIVENESS

Desktop:

```text
Full sidebar
```

Tablet:

```text
Collapsed icon sidebar
```

Mobile:

```text
Hamburger button
↓
Slide-out navigation
```

The Dashboard item must remain easy to access.

Do not duplicate navigation logic between desktop/mobile.

---

# PART 19 — RESPONSIVE KPI GRID

Desktop:

```text
6 cards
```

Tablet:

```text
3 × 2
```

Mobile:

```text
2 × 3
```

or a sensible single-column layout depending on available width.

Cards must never overlap.

Text must never be clipped.

---

# PART 20 — RESPONSIVE CHARTS

Desktop:

```text
2-column chart layout
```

Tablet:

```text
1–2 columns depending on width
```

Mobile:

```text
1 column
```

Charts must preserve readable labels.

Do not squeeze six charts into tiny cards.

---

# PART 21 — RESPONSIVE TABLES

Desktop:

Full table.

Tablet:

Allow horizontal scrolling if necessary.

Mobile:

Use one of:

- horizontally scrollable table
- responsive column prioritization
- expandable row details

Do not shrink text until it becomes unreadable.

---

# PART 22 — RESPONSIVE MODALS / FORMS / PAGES

Audit the entire application for:

- fixed pixel widths
- overflowing containers
- broken forms
- modal overflow
- sidebar overlap
- clipped buttons
- unreadable tables
- navigation overflow
- charts overflowing cards

Fix these systematically.

Do not only make the dashboard responsive.

---

# PART 23 — ACCESSIBILITY

Maintain:

- keyboard navigation
- visible focus states
- readable contrast
- semantic buttons
- accessible labels
- meaningful chart titles
- tooltip text where needed

Do not sacrifice accessibility for visual effects.

---

# PART 24 — PERFORMANCE

Avoid:

- fetching the same data multiple times
- unnecessary realtime subscriptions
- full-table downloads for simple counts
- recalculating every dashboard on every event
- rendering thousands of table rows at once

Use:

- database aggregation
- query caching/deduplication if already available
- pagination
- targeted realtime invalidation
- memoization where useful

---

# PART 25 — DATA CORRECTNESS CHECK

Before finishing, compare every KPI against direct database queries.

For example:

```text
Dashboard Total PRs
==
database COUNT(purchase_requisitions)
```

and:

```text
Dashboard Total Exceptions
==
database COUNT(exceptions)
```

Do this for every major metric.

If a number differs, investigate the query/filter/relationship.

Do not simply adjust the dashboard number until it "looks right."

---

# PART 26 — USER-SPECIFIC DATA TEST

Test at least one real user from each role.

For each:

1. Login.
2. Open Dashboard from sidebar.
3. Verify role.
4. Verify data ownership/authorization.
5. Verify KPIs.
6. Click a chart segment.
7. Verify cross-filtering.
8. Change a database record.
9. Verify realtime update.
10. Logout.
11. Login as another role.
12. Verify previous user's filters/data are gone.

---

# PART 27 — DO NOT BREAK THE EXISTING APP

Do NOT:

- delete working pages
- replace existing business workflows
- replace authentication
- replace the database
- create mock users
- create fake relationships
- hardcode role IDs
- hardcode dashboard numbers
- remove existing APIs without checking consumers
- introduce unnecessary dependencies

Make targeted changes.

---

# PART 28 — Implementation Order

Follow this exact order:

```text
1. Inspect current application
2. Identify existing dashboard routes
3. Identify sidebar/navigation component
4. Add Dashboard navigation item
5. Verify role detection
6. Audit user → database relationships
7. Fix missing legitimate data links
8. Verify existing analytics queries
9. Implement shared filter state
10. Implement slicers
11. Implement chart cross-filtering
12. Implement Clear Filters
13. Implement realtime subscriptions
14. Implement targeted query invalidation
15. Make dashboard responsive
16. Audit entire app responsiveness
17. Test every role
18. Test realtime changes
19. Test filter interactions
20. Test logout/login isolation
21. Final UI polish
```

---

# PART 29 — Definition of Done

The task is complete only when:

- [ ] Every authenticated role has a Dashboard item in the left sidebar.
- [ ] Clicking Dashboard opens the correct role dashboard.
- [ ] Dashboard data comes from the real database.
- [ ] No mock analytics data exists.
- [ ] No hardcoded KPI values exist.
- [ ] User-specific data relationships have been verified.
- [ ] Unauthorized data cannot be accessed.
- [ ] Database changes update relevant dashboards automatically.
- [ ] Realtime status is truthful.
- [ ] Clicking chart categories cross-filters compatible visuals.
- [ ] Slicers update all compatible visuals.
- [ ] Clear Filters works.
- [ ] Active filters are visible.
- [ ] Filters are isolated between users.
- [ ] Dashboard works on desktop.
- [ ] Dashboard works on tablet.
- [ ] Dashboard works on mobile.
- [ ] Entire app has no major responsive overflow.
- [ ] Tables remain usable on small screens.
- [ ] Loading/error/empty states work.
- [ ] Existing application functionality remains intact.
- [ ] No unnecessary duplicate infrastructure was created.

---

# CRITICAL INSTRUCTION

Do not start coding blindly.

First inspect the current application and database relationships.

Then tell me:

1. Which files/components already handle sidebar navigation.
2. Which files/components handle dashboard routing.
3. How the logged-in user's role is determined.
4. Which database tables each role currently maps to.
5. Which analytics queries already exist.
6. Whether Supabase Realtime is already configured.
7. Which user/data relationships are currently missing or incorrect.
8. Exactly which files you plan to change.

Then implement the changes in the order above.

**The application must use real live database data. No mock data, no fake relationships, no hardcoded dashboard numbers.**
