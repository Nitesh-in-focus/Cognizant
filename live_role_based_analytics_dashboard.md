# Live Role-Based Analytics Dashboard — Antigravity Implementation Spec

## Objective

Replace the current Power BI dependency with a **fully coded analytics dashboard inside the existing application**.

The dashboard must use the **actual live project database**.

### Non-negotiable

- NO mock/static/hardcoded analytics data.
- NO screenshots of Power BI.
- NO iframe/Power BI embedding.
- NO Power BI Service, organizational email, custom domain, or Power BI credentials.
- Reuse the existing database, authentication, API/client, routing, styling, and realtime infrastructure.
- The database is the single source of truth.
- Analytics must update automatically when relevant database records change.
- After login, detect the user's real role and send them directly to the appropriate dashboard.
- Do not break existing functionality.

---

## 1. Existing Database Tables

Use the actual project schema for these existing tables:

```text
public_app_users
public_exceptions
public_pr_items
public_products
public_purchase_requisitions
public_status_history
public_po_items
public_purchase_orders
public_suppliers
public_warehouses
```

**Do not invent columns.** Inspect the actual schema and existing project code first.

---

## 2. First Inspect the Existing Project

Before coding, inspect:

1. Authentication/session handling.
2. How the logged-in user's role is obtained.
3. Existing route structure.
4. Existing dashboard/home pages.
5. Existing database client.
6. Existing Supabase configuration/client.
7. Existing API/service layer.
8. Existing realtime/subscription implementation.
9. Existing role-based authorization/RLS.
10. Existing procurement components and styling.

Then briefly report what can be reused.

Do not rebuild infrastructure that already exists.

---

# 3. Login → Role-Based Dashboard

After successful login:

```text
LOGIN
  ↓
Authenticated user
  ↓
Get role from public_app_users
  ↓
Determine dashboard
  ↓
Redirect directly to role dashboard
```

Use the actual roles present in the database. Current roles observed in the project include:

```text
PROCUREMENT_OFFICER
PROCUREMENT_MANAGER   (if present in the actual schema)
FINANCE
WORKER
SUPPLIER
LOGISTICS_GATE_POST
RECEIVING_QC
TRUCK_DRIVER
```

If another role exists, support it without breaking the application.

If a role does not have a dedicated analytics dashboard, fall back to its existing role home page.

### Suggested routing

```text
PROCUREMENT_OFFICER → /procurement/dashboard
PROCUREMENT_MANAGER → /procurement/dashboard
FINANCE              → /finance/dashboard
WORKER               → /worker/dashboard
SUPPLIER             → /supplier/dashboard
LOGISTICS_GATE_POST  → /logistics/dashboard
RECEIVING_QC         → /receiving/dashboard
TRUCK_DRIVER         → /driver/dashboard
```

Follow the project's existing route naming conventions if different.

---

# 4. Security

Role-based UI is not enough.

Do not load all sensitive data into the browser and merely hide it visually.

Use the existing authorization/RLS/API architecture.

A user must not be able to access another role's restricted analytics by changing a URL, query parameter, or client-side state.

---

# 5. Global Dashboard Shell

Create a reusable analytics shell:

```text
┌─────────────────────────────────────────────────────────────┐
│ Dashboard title                         User / Live status   │
├─────────────────────────────────────────────────────────────┤
│ KPI 1 │ KPI 2 │ KPI 3 │ KPI 4 │ KPI 5 │ KPI 6             │
├──────────────────────────────┬──────────────────────────────┤
│ Main chart                   │ Secondary chart              │
├──────────────────────────────┼──────────────────────────────┤
│ Trend / performance chart    │ Status / severity chart      │
├─────────────────────────────────────────────────────────────┤
│ Live detailed data table                                    │
└─────────────────────────────────────────────────────────────┘
```

Use the existing app's visual language.

---

# 6. PROCUREMENT OFFICER / PROCUREMENT MANAGER

This is the primary dashboard.

### Title

```text
Procurement Intelligence Dashboard
```

### Subtitle

```text
Real-time overview of procurement operations and exception management.
```

## KPI cards

Calculate dynamically from actual records:

### Total PRs

Source:

```text
public_purchase_requisitions
```

Count real requisitions.

### Total POs

Source:

```text
public_purchase_orders
```

Count real purchase orders.

### Total Procurement Value

Use the actual monetary field(s) and business logic already present in the project.

**Inspect existing schema/business logic before deciding the formula.**

### Open Exceptions

Source:

```text
public_exceptions
```

Count exceptions whose actual status represents an unresolved/open state.

### Total Exceptions

Count real exception records.

### Exception Value

Use the project's actual exception-value definition.

Relevant fields currently visible include:

```text
expected_value
actual_value
difference
```

Do not assume `difference` is automatically the business definition of Exception Value. Inspect existing project logic.

---

# 7. Procurement Charts

## PR Status

Donut/pie chart:

```text
COUNT(PRs) GROUP BY status
```

Source:

```text
public_purchase_requisitions
```

Do not hardcode status categories.

---

## Exceptions By Severity

Donut chart:

```text
COUNT(exceptions) GROUP BY severity
```

Source:

```text
public_exceptions
```

Use actual values from the database.

---

## Exceptions By Type

Horizontal bar chart:

```text
COUNT(exceptions) GROUP BY exception_type
```

Source:

```text
public_exceptions
```

Values currently observed include:

```text
QUANTITY_MISMATCH
PRICE_MISMATCH
DAMAGED_GOODS
OCR_FAILURE
SHIPMENT_DELAY
YARD_CONGESTION
```

But these must be generated dynamically from the database, not hardcoded.

---

## Exception Financial Impact

Create a chart showing actual exception financial impact using the correct existing business definition.

---

## Procurement Trend

Create a time-based chart showing real PR/PO activity using the actual available date fields.

Allow day/week/month aggregation where practical.

---

# 8. Procurement Detail Table

Use real exception records.

Useful fields:

```text
exception_number
exception_type
severity
status
difference
description
created_at
resolved_at
```

Use actual field names from the schema.

Requirements:

- Sorting.
- Filtering.
- Pagination/virtualization if necessary.
- Horizontal scrolling where necessary.
- Live updates.
- Clean empty state.
- No mock rows.

---

# 9. Procurement Filters

Where supported by the schema, provide:

```text
Date
PR Status
PO Status
Exception Type
Exception Severity
Exception Status
Warehouse
Supplier
```

Filters must modify real database/API queries.

Do not filter a fake frontend array.

---

# 10. FINANCE DASHBOARD

Use actual procurement/financial data.

Possible KPIs, only if derivable from the real schema:

```text
Total Procurement Value
Approved PO Value
Pending PO Value
Exception Value
PO Count
PR Count
```

Possible charts:

```text
Procurement Value by Time
PO Status
Exception Financial Impact
Supplier Spend
```

Do not invent financial fields.

---

# 11. WORKER DASHBOARD

Use only records the authenticated worker is authorized to see.

Possible analytics:

```text
My Purchase Requests
Pending Requests
Approved Requests
Rejected Requests
Remaining Quantity
Fulfilled Quantity
```

Possible charts:

```text
My PR Status
Request Activity
Fulfillment Progress
```

Use real relationships and existing business rules.

---

# 12. SUPPLIER DASHBOARD

Use:

```text
public_suppliers
public_purchase_orders
public_po_items
public_products
```

where the existing relationships support it.

Possible analytics:

```text
My Purchase Orders
Pending Orders
Completed Orders
Order Value
Products Supplied
Fulfillment / delivery performance
```

A supplier must only see its authorized data.

---

# 13. LOGISTICS GATE POST DASHBOARD

Use actual logistics-related data available in the project.

Relevant existing tables may include:

```text
public_purchase_orders
public_warehouses
public_exceptions
public_status_history
```

Possible analytics:

```text
Pending gate operations
Recent logistics activity
Shipment-related exceptions
Warehouse activity
Recent status changes
```

Do not invent shipment tables.

---

# 14. RECEIVING QC DASHBOARD

Use actual receiving/product/order/exception information supported by the schema.

Possible analytics:

```text
Pending receiving/QC work
Received quantities
Quantity mismatches
Damaged goods
Exceptions
Recent QC-related status changes
```

Do not invent data.

---

# 15. TRUCK DRIVER DASHBOARD

Use only actual records relevant to the authenticated driver.

Possible information:

```text
Assigned operations
Pending deliveries
Completed operations
Relevant gate/shipment status
Relevant exceptions
```

Do not expose unrelated financial/procurement information unless authorized.

---

# 16. REAL-TIME REQUIREMENT

This is critical.

The dashboard must update automatically when relevant database records change.

First inspect whether the application already uses Supabase Realtime/WebSockets/subscriptions.

If Supabase Realtime is already available, use it.

Relevant tables include:

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
public_app_users
```

Subscribe only to tables relevant to the current dashboard.

Desired flow:

```text
Database change
      ↓
Realtime event
      ↓
Invalidate/refetch affected analytics
      ↓
Recalculate KPIs/charts
      ↓
Update dashboard
```

No manual browser refresh should be required.

---

# 17. Efficient Realtime Updates

Do not reload the entire database after every event.

Use targeted invalidation/refetching.

Example:

```text
Exception INSERT/UPDATE
→ refresh exception KPIs
→ refresh exception charts
→ refresh exception table
→ do not refresh unrelated analytics
```

```text
PO INSERT/UPDATE
→ refresh Total POs
→ refresh Procurement Value
→ refresh PO status analytics
→ refresh relevant trend
```

---

# 18. Database-Side Aggregation

Do not fetch thousands of rows into the browser merely to calculate:

```text
COUNT
SUM
GROUP BY
```

Prefer database/API aggregation where practical.

Use pagination for detailed tables.

Reuse existing APIs/services if they already perform correct calculations.

---

# 19. Loading / Error / Empty States

### Loading

Use skeleton cards/charts.

### Error

Show:

```text
Unable to load analytics.
Please try again.
```

Do not expose raw database errors.

### Empty

Show:

```text
No data available for the selected filters.
```

Do not create fake data just to fill the chart.

---

# 20. Live Status

Where realtime actually works, show:

```text
● Live
Updated just now
```

or:

```text
Last updated: <actual successful refresh time>
```

Do NOT display "Live" if the dashboard is not actually receiving realtime updates.

---

# 21. UI Style

Use an enterprise procurement-intelligence look.

Use:

- Clean cards
- Consistent spacing
- Subtle borders
- Very light shadows
- Rounded corners
- Strong typography hierarchy
- Consistent chart sizing
- Responsive layout

Avoid:

- Excessive gradients
- Huge shadows
- Excessive glow
- Random colors
- Decorative charts
- Unnecessary animations
- Clutter

Suggested semantic colors:

```text
Blue   → primary / neutral
Green  → approved / completed / positive
Amber  → pending / warning
Red    → critical / rejected / high-risk
Purple → secondary analytical category
```

---

# 22. Remove Old Power BI Sections

Remove the old:

```text
Power BI
Power BI & Analytics
```

sections from roles that do not need analytics.

Do not leave dead links or empty placeholders.

Keep analytics access for:

```text
PROCUREMENT_OFFICER
PROCUREMENT_MANAGER
```

For those roles, the coded dashboard becomes the analytics experience.

---

# 23. Do Not Rebuild Existing Business Logic

Search the project for existing implementations of:

```text
Total PR
Total PO
Procurement Value
Exception Value
Open Exceptions
PR status
PO status
```

If an existing service/API/function already calculates these correctly, reuse it.

Do not create conflicting definitions.

---

# 24. Validation

Test with real database changes.

### Test PR

Create/update a real PR.

Expected dashboard changes:

```text
Total PRs
PR status chart
Relevant trend
```

### Test PO

Create/update a real PO.

Expected:

```text
Total POs
Procurement Value
PO status
Relevant trend
```

### Test Exception

Create/update a real exception.

Expected:

```text
Total Exceptions
Open Exceptions
Exception Value
Severity chart
Type chart
Detail table
```

### Test status history

Change a real procurement status.

Expected relevant dashboard information to update.

### Test roles

Login as every supported role and verify the correct dashboard/data.

### Test session switching

Logout and login as another role.

Verify that the previous user's data does not remain visible.

---

# 25. Implementation Order

Do the work in exactly this order:

```text
1. Inspect existing architecture
2. Identify authenticated user + role
3. Identify existing database access
4. Identify existing realtime support
5. Identify/reuse existing analytics APIs/services
6. Implement Procurement dashboard
7. Implement other role dashboards
8. Implement realtime updates
9. Update role-based routing
10. Remove obsolete Power BI navigation
11. Test using real database changes
12. Polish UI
```

---

# 26. Critical Antigravity Instruction

**Do not ask me to manually enter analytics data.**

**Do not create mock data.**

**Do not use hardcoded KPI values.**

**Do not replace real queries with sample arrays.**

**Do not embed Power BI.**

**Do not require Power BI Service.**

The Power BI dashboard I created was only a reference for the analytics structure and visual hierarchy.

The application's existing database is the **single source of truth**.

Build the analytics dashboard directly from the existing live database and existing application architecture.

Before making large changes, inspect the project and explain what already exists so existing functionality can be reused instead of rebuilt.
