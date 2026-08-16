# Supply Sync — EmailJS Pipeline & PO Visibility Implementation

## IMPLEMENTATION DIRECTIVE

Implement the following changes in the existing Supply Sync application.

Work directly with the existing codebase and database.

Do not ask the user to manually implement code unless absolutely required by a missing external credential/configuration.

Do not make destructive database changes.

Do not implement Accept/Reject action buttons inside emails in this iteration. That will be implemented later.

Follow the phases below in order. Do not jump ahead before the previous phase is working.

---

# PHASE 1 — FIX AND VERIFY EMAILJS

The application already has these environment variables:

```env
VITE_EMAILJS_PUBLIC_KEY=...
VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_NOTIFICATION_TEMPLATE_ID=...
VITE_EMAILJS_PO_ACTION_TEMPLATE_ID=...
```

Use these existing variables through `import.meta.env`.

Do not hardcode EmailJS credentials or IDs.

If `@emailjs/browser` is not installed, install it.

Create or use a centralized email service/helper rather than scattering EmailJS calls across components.

The service should support reusable functions for:

- generic notification email
- PO notification email
- invoice email

Initialize EmailJS correctly and ensure the application actually sends a test email.

When sending an email:

- show loading state
- show success only when EmailJS actually succeeds
- show the real failure state/error when EmailJS fails
- never silently swallow errors
- do not expose private credentials

The application must not display "Email sent successfully" unless EmailJS actually returned success.

---

# PHASE 2 — EMAILJS TEMPLATE PARAMETERS

Use consistent variable names between the application and EmailJS templates.

Recommended parameters:

```text
to_email
to_name
event_type
po_id
shipment_id
supplier_name
invoice_id
invoice_number
invoice_amount
asn_number
quantity
message
```

If the existing templates use equivalent variables, adapt the application to those existing variables rather than unnecessarily creating duplicates.

Ensure EmailJS template variables exactly match the application parameters.

---

# PHASE 3 — PO LIFECYCLE AND VISIBILITY

This is a critical fix.

Current incorrect behavior:

```text
PR Officer creates PO
        ↓
Supplier immediately sees PO
```

This must NOT happen.

Correct behavior:

```text
PR Officer creates PO
        ↓
PO = DRAFT
        ↓
Supplier cannot see it
        ↓
Supplier receives no email
        ↓
PR Officer reviews PO
        ↓
PR Officer clicks "Send to Supplier"
        ↓
PO = SENT_TO_SUPPLIER
        ↓
Supplier can see PO
        ↓
Supplier receives PO email
```

Creating a PO must NOT automatically expose it to the supplier.

---

# PHASE 4 — PO STATUS

Use the existing PO status model if it already contains equivalent states.

At minimum, the lifecycle must distinguish:

```text
DRAFT
SENT_TO_SUPPLIER
ACCEPTED
REJECTED
PARTIALLY_DISPATCHED
DISPATCHED
COMPLETED
```

The important rule is:

```text
DRAFT != SENT_TO_SUPPLIER
```

Do not create duplicate status concepts if the current database already has suitable statuses.

---

# PHASE 5 — "SEND TO SUPPLIER" ACTION

The PR Officer PO interface must contain an explicit:

```text
Send to Supplier
```

action.

Workflow:

```text
Create PO
    ↓
Save PO as DRAFT
    ↓
PR Officer reviews PO
    ↓
Click "Send to Supplier"
    ↓
Validate PO
    ↓
Update PO status to SENT_TO_SUPPLIER
    ↓
Confirm database update
    ↓
Send supplier notification email
```

After the PO has been sent, the action must no longer behave like an unsent draft action.

Use an appropriate disabled/changed state such as:

```text
Sent to Supplier
```

Do not send duplicate notifications from repeated clicks.

---

# PHASE 6 — SUPPLIER PO VISIBILITY

Supplier-side PO queries must only expose POs that have actually been sent to the supplier.

Do not simply query by supplier ID.

The query must also respect the PO lifecycle status.

Conceptually:

```sql
WHERE supplier_id = current_supplier_id
AND status IN (
  'SENT_TO_SUPPLIER',
  'ACCEPTED',
  'REJECTED',
  'PARTIALLY_DISPATCHED',
  'DISPATCHED',
  'COMPLETED'
)
```

Do not show `DRAFT` POs to suppliers.

Apply this rule consistently to:

- supplier dashboard
- supplier PO list
- accepted PO list
- pending PO list
- PO details
- supplier search/filter
- supplier notifications

A supplier must not be able to access a draft PO by navigating directly to a known PO ID.

---

# PHASE 7 — SUPPLIER PO EMAIL

The supplier receives a PO email only when the PR Officer clicks:

```text
Send to Supplier
```

The email should contain relevant information such as:

```text
PO ID
Supplier
PO status
Quantity
Relevant delivery information
Shipment information if available
```

Do not send this email merely because the PO was created.

Correct:

```text
PO created → no email

PO sent to supplier → email
```

---

# PHASE 8 — DATABASE-FIRST TRANSACTION SAFETY

The database is the source of truth.

EmailJS is only the notification mechanism.

For sending a PO:

```text
Validate PO
    ↓
Update PO state in database
    ↓
Confirm successful database update
    ↓
Send EmailJS notification
```

If the database update succeeds but EmailJS fails:

DO NOT revert the PO unnecessarily.

Instead show:

```text
PO sent successfully, but notification email failed.
```

Provide a retry mechanism where appropriate.

The PO must remain:

```text
SENT_TO_SUPPLIER
```

because the business action succeeded even though notification delivery failed.

Likewise, an email failure must never create or duplicate a PO.

---

# PHASE 9 — PR OFFICER EMAIL #1: SUPPLIER RESPONSE

When the supplier responds to the PO in the application, notify the PR Officer by email.

For this iteration:

- informational notification only
- do not implement Accept/Reject buttons inside the email
- do not implement email-based approval/rejection links

The application-side supplier response remains the source of truth.

Email should include:

```text
PO ID
Supplier
Response/status
Relevant message
```

---

# PHASE 10 — PR OFFICER EMAIL #2: DISPATCH

When the supplier dispatches goods:

```text
Supplier dispatches
        ↓
Shipment status updated
        ↓
PR Officer receives email
```

Include where available:

```text
PO ID
Shipment ID
Supplier
Quantity dispatched
Dispatch date/time
ASN number
Shipment status
```

The email must only be sent after the dispatch/shipment update succeeds.

---

# PHASE 11 — PR OFFICER EMAIL #3: FINANCE EXCEPTION

When Finance raises an exception:

```text
Finance raises exception
        ↓
Exception stored in database
        ↓
PR Officer receives email
```

Email should include:

```text
PO ID
Invoice ID
Supplier
Exception type
Exception reason
Current status
```

The database exception must be created successfully before sending the notification.

---

# PHASE 12 — SUPPLIER INVOICE EMAIL

The supplier creates and submits invoices through the existing application.

Finance does NOT create the supplier invoice.

The supplier invoice workflow remains:

```text
Supplier
    ↓
Create Invoice
    ↓
Submit Invoice
    ↓
Invoice stored in database
    ↓
Finance can process it
```

Additionally, provide an OPTIONAL email feature.

The supplier should be able to enter an email address manually.

Example UI:

```text
Invoice Recipient Email
[____________________________]

[Send Invoice Email]
```

The email field is optional.

If the supplier does not enter an email:

```text
Invoice submission still works normally.
```

If the supplier enters an email and chooses to send:

```text
Invoice saved
    ↓
Supplier chooses Send Invoice Email
    ↓
EmailJS sends invoice notification
```

Do not make invoice email mandatory.

---

# PHASE 13 — INVOICE EMAIL CONTENT

The invoice email should include as much useful information as available.

At minimum:

```text
Invoice ID
Invoice Number
PO ID
Shipment ID
Supplier
Invoice Amount
Invoice Date
Recipient
```

If the invoice document is already stored in Supabase Storage, do not unnecessarily duplicate the file.

Use the existing document-storage architecture where possible.

---

# PHASE 14 — FINANCE INVOICE WORKFLOW

The intended workflow is:

```text
Supplier creates invoice
        ↓
Invoice stored in Supply Sync
        ↓
Optional invoice email
        ↓
Finance receives/loads invoice
        ↓
Finance selects invoice / PO
        ↓
Run Three-Way Match
        ↓
PO
GRN
Invoice
        ↓
Matched?
   ┌────┴────┐
  YES        NO
   ↓          ↓
Payment    Exception
              ↓
        PR Officer email
```

Do not create a "Create Invoice" workflow in Finance if one exists incorrectly.

Finance receives and processes supplier invoices.

---

# PHASE 15 — CENTRAL EMAIL SERVICE

All email sending should go through a centralized service/helper.

Suggested structure:

```text
src/
  services/
    emailService.js
```

Adapt to the project's existing structure if a service layer already exists.

Suggested functions:

```text
sendEmail()
sendPONotification()
sendSupplierPONotification()
sendDispatchNotification()
sendFinanceExceptionNotification()
sendInvoiceEmail()
```

Avoid duplicating EmailJS initialization and request logic across multiple UI components.

---

# PHASE 16 — EMAIL RECIPIENTS

Do not hardcode recipient emails.

PR Officer email must come from the appropriate user/profile record.

Supplier email must come from the supplier/user record.

Invoice recipient email must come from the supplier's manually entered invoice recipient email.

Do not hardcode:

```text
supplier@gmail.com
finance@gmail.com
pr@gmail.com
```

The database/user records are the source of recipient information.

---

# PHASE 17 — OPTIONAL EMAIL NOTIFICATION LOG

If an existing notification/email log table exists, reuse it.

If there is no suitable existing structure, add a minimal non-destructive notification log.

Suggested fields:

```text
id
event_type
recipient_email
recipient_role
po_id
shipment_id
invoice_id
status
error_message
sent_at
```

Suggested status values:

```text
PENDING
SENT
FAILED
```

This is for observability and debugging.

Do not duplicate business records merely to send emails.

---

# PHASE 18 — ERROR HANDLING

Email failure must never silently break business operations.

Example:

```text
PO update succeeds
        ↓
EmailJS fails
        ↓
PO remains SENT_TO_SUPPLIER
        ↓
UI:
"PO sent successfully, but notification email failed."
        ↓
Allow email retry
```

Invoice example:

```text
Invoice saved
        ↓
EmailJS fails
        ↓
Invoice remains saved
        ↓
UI:
"Invoice saved, but email could not be sent."
```

Do not delete/revert successfully completed database actions because an external email service failed.

---

# PHASE 19 — EMAILJS DEBUGGING

If EmailJS is currently not working, inspect and fix the actual cause.

Verify:

1. `VITE_EMAILJS_PUBLIC_KEY` exists.
2. `VITE_EMAILJS_SERVICE_ID` exists.
3. `VITE_EMAILJS_NOTIFICATION_TEMPLATE_ID` exists.
4. `VITE_EMAILJS_PO_ACTION_TEMPLATE_ID` exists.
5. The Vite server was restarted after `.env` changes.
6. The Gmail EmailJS service is connected.
7. The EmailJS template IDs exactly match the `.env`.
8. Template variables exactly match application parameters.
9. The browser console does not contain an EmailJS error.
10. Network requests to EmailJS are actually being made.

Do not hide the error.

Use browser console/network diagnostics during development.

---

# PHASE 20 — ENVIRONMENT VARIABLES

Do not modify or expose existing secrets unnecessarily.

Use:

```env
VITE_EMAILJS_PUBLIC_KEY=...
VITE_EMAILJS_SERVICE_ID=...
VITE_EMAILJS_NOTIFICATION_TEMPLATE_ID=...
VITE_EMAILJS_PO_ACTION_TEMPLATE_ID=...
```

Do not put secret/private credentials into source code.

Do not commit `.env` to GitHub.

If the project already has `.gitignore`, ensure `.env` is ignored.

---

# PHASE 21 — SEARCH AND FILTER

Preserve the previously requested search/filter behavior.

For large datasets, relevant list views should support:

```text
Filter
+
Search
+
Optional dropdown
```

PO search:

```text
PO ID
Supplier
Status
Date
```

Shipment search:

```text
Shipment ID
PO ID
Supplier
Driver
ASN
Status
```

Invoice search:

```text
Invoice ID
Invoice Number
PO ID
Supplier
Status
```

Do not remove existing search/filter functionality while implementing the email work.

---

# PHASE 22 — RELATIONAL DATABASE INTEGRITY

Do not break the existing relational model.

Important relationships must remain connected:

```text
PR ID
  ↓
PO ID
  ↓
Supplier ID
  ↓
Shipment ID
  ↓
Driver ID

PO ID
  ↓
GRN ID

PO ID
  ↓
Invoice ID

PO ID
  ↓
Traceability
```

Do not create duplicate PO/shipment/invoice records merely for email notifications.

Use existing foreign keys and relationships.

---

# PHASE 23 — NON-DESTRUCTIVE DATABASE RULE

DO NOT:

- drop tables
- truncate tables
- delete existing business data
- recreate the entire schema
- remove foreign keys
- remove existing relationships
- rename columns blindly

If a database change is necessary:

1. Inspect the current schema.
2. Identify the exact issue.
3. Make the smallest possible migration.
4. Preserve existing records.
5. Preserve foreign-key relationships.
6. Verify existing features after migration.

---

# PHASE 24 — ACCEPT/REJECT EMAIL ACTIONS ARE OUT OF SCOPE

Do NOT implement these now:

```text
Accept button in email
Reject button in email
Email action URLs
One-click approval from email
One-click rejection from email
```

These will be implemented in a later iteration.

For now:

```text
Email = notification only
Application = business action
Database = source of truth
```

---

# PHASE 25 — FINAL END-TO-END WORKFLOW

## PO Creation

```text
PR Officer
    ↓
Create PO
    ↓
PO = DRAFT
    ↓
Supplier sees nothing
    ↓
Supplier receives no email
```

## Send PO

```text
PR Officer
    ↓
Review PO
    ↓
Click "Send to Supplier"
    ↓
PO = SENT_TO_SUPPLIER
    ↓
Supplier can see PO
    ↓
Supplier receives PO email
```

## Supplier Response

```text
Supplier responds in application
    ↓
Database updated
    ↓
PR Officer receives notification email
```

## Supplier Dispatch

```text
Supplier dispatches
    ↓
Shipment updated
    ↓
PR Officer receives dispatch email
```

## Supplier Invoice

```text
Supplier creates invoice
    ↓
Invoice stored
    ↓
Optional email address entered
    ↓
Supplier chooses to send invoice email
    ↓
EmailJS sends invoice notification
    ↓
Finance processes invoice
```

## Finance Exception

```text
Finance
    ↓
Three-Way Match
    ↓
Mismatch
    ↓
Exception created
    ↓
PR Officer receives exception email
```

---

# PHASE 26 — ACCEPTANCE CRITERIA

## EmailJS

- [ ] EmailJS initializes correctly.
- [ ] Test email works.
- [ ] PO notification email works.
- [ ] Dispatch notification email works.
- [ ] Finance exception email works.
- [ ] Optional invoice email works.
- [ ] Email failures are visible.
- [ ] Email credentials are not hardcoded.
- [ ] Environment variables are loaded correctly.

## PO

- [ ] Newly created PO is DRAFT.
- [ ] Supplier cannot see DRAFT PO.
- [ ] Supplier receives no email for DRAFT PO.
- [ ] PR Officer has "Send to Supplier".
- [ ] Sending changes PO state to SENT_TO_SUPPLIER.
- [ ] Supplier can see PO only after sending.
- [ ] Supplier receives PO notification only after sending.
- [ ] Repeated clicks do not create duplicate notifications.

## PR Officer notifications

- [ ] Supplier response notification works.
- [ ] Dispatch notification works.
- [ ] Finance exception notification works.

## Invoice

- [ ] Supplier creates invoice.
- [ ] Invoice is stored normally.
- [ ] Supplier can optionally enter recipient email.
- [ ] Invoice submission works without an email address.
- [ ] Supplier can optionally send invoice email.
- [ ] Finance can continue using the existing invoice workflow.

## Database

- [ ] No destructive schema changes.
- [ ] Existing data is preserved.
- [ ] PO relationships remain intact.
- [ ] Shipment relationships remain intact.
- [ ] Invoice relationships remain intact.
- [ ] Supplier relationships remain intact.
- [ ] Driver relationships remain intact.

---

# IMPLEMENTATION ORDER — DO NOT CHANGE

Execute in this exact order:

### 1.
Fix and independently verify EmailJS sending.

### 2.
Create/verify the centralized email service.

### 3.
Fix PO visibility and status handling.

### 4.
Implement "Send to Supplier".

### 5.
Connect supplier PO notification email.

### 6.
Connect PR Officer supplier-response email.

### 7.
Connect PR Officer dispatch email.

### 8.
Connect Finance exception email.

### 9.
Add optional supplier invoice-email functionality.

### 10.
Run end-to-end tests.

Do not jump to Accept/Reject email actions.

---

# FINAL ARCHITECTURE RULE

The database is the source of truth.

EmailJS is only the notification layer.

Never make business state dependent on successful email delivery.

Use:

```text
DATABASE
    ↓
Business State
    ↓
EmailJS
    ↓
Notification
```

Not:

```text
EmailJS
    ↓
Business State
```

The application must remain functional even if EmailJS is temporarily unavailable.
