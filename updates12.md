# SUPPLY SYNC --- UPDATES 12

## EmailJS Notifications + PO Email Actions + Dispatch/Invoice Routing + Universal Search & Filter

## 1. EMAILJS

Implement Supply Sync email notifications using EmailJS. Do not make
destructive database changes. Preserve the relational model: PR → PO →
Supplier → Shipment → Driver/Truck → ASN/Gate/Yard → GRN/QC → Invoice →
Exception → Payment.

The current EmailJS Free plan lists 200 monthly requests and 2 email
templates. Keep the implementation within those limits.

## 2. EMAILJS CONFIGURATION

Create one email service layer, e.g. `src/services/emailService.ts`.
Configure: `VITE_EMAILJS_PUBLIC_KEY`, `VITE_EMAILJS_SERVICE_ID`,
`VITE_EMAILJS_NOTIFICATION_TEMPLATE_ID`,
`VITE_EMAILJS_PO_ACTION_TEMPLATE_ID`.

The developer should tell me when these values are needed. I will
provide them. Never ask for Gmail passwords. Do not expose an EmailJS
private key in frontend code. If a private key is required server-side,
store it as a secret.

Before integration I need to create an EmailJS account, connect a mail
service such as Gmail, create the two templates, test them, then provide
Public Key, Service ID and Template IDs.

## 3. TWO PRIMARY AUTOMATED NOTIFICATION RECIPIENTS

The automated notification system has exactly two primary recipient
roles: 1. PR Officer 2. Supplier

Resolve recipient emails dynamically from the database. Never hardcode
addresses.

## 4. PR OFFICER EMAIL EVENTS

The PR Officer receives email only for these three events:

### Supplier accepts PO

Supplier accepts → PO becomes `ACCEPTED_BY_SUPPLIER` → find responsible
PR Officer → EmailJS notification. Include PO ID, PR ID, Supplier
ID/name, quantity/value, timestamp and app link.

### Supplier dispatches

Supplier dispatches → Shipment becomes `DISPATCHED` → find responsible
PR Officer → email. Include PO ID, Shipment ID, supplier, quantity,
dispatch time, driver/truck where applicable, ASN, ETA and status.

### Finance raises exception

Finance detects mismatch → Exception created/escalated → email PR
Officer. Include Exception ID, Invoice ID, PO ID, GRN ID, supplier,
mismatch type/details, amount and app link.

## 5. SUPPLIER EMAIL EVENT

The Supplier receives the PO email ONLY when the PR Officer explicitly
clicks `SEND TO SUPPLIER`.

WRONG: PO generated → automatic supplier email.

CORRECT: PR created → approved → AI generates PO → PR Officer
reviews/edits → PO approved → PO remains internal → PR Officer clicks
SEND TO SUPPLIER → PO status `SENT_TO_SUPPLIER` → Supplier gets in-app
pending PO + EmailJS notification.

## 6. SUPPLIER PO EMAIL

Include Supplier Name, PO ID, PR ID, PO Date, Product, SKU, Quantity,
Unit Price, Total Value, Delivery Location, Required Delivery Date and
permitted payment terms. Provide `[ACCEPT PO]` and `[REJECT PO]`.

## 7. ACCEPT/REJECT FROM EMAIL

Supplier may not be logged in. Email actions must update the app
securely.

Accept: `PO status = ACCEPTED_BY_SUPPLIER`, timestamp, actor. Reject:
`PO status = REJECTED_BY_SUPPLIER`, timestamp, actor and rejection
reason where required.

Do not let EmailJS directly perform unrestricted database writes. Use a
secure Supply Sync route / Supabase Edge Function with a signed,
expiring, preferably one-time token. Validate PO, Supplier, action and
current state before updating. Store token used/expiry information and
prevent replay.

## 8. SUPPLIER DISPATCH

After acceptance: accepted PO → supplier chooses full/partial quantity →
shipment → driver assignment → dispatch. When dispatched, status becomes
`DISPATCHED` and PR Officer is notified.

Dispatch/ASN/tracking information is operational data for Logistics/Gate
Post. It must not be incorrectly routed as a Finance invoice
notification.

## 9. SUPPLIER INVOICE

Supplier creates and submits the invoice after dispatch. Finance does
NOT create the supplier invoice.

Supplier → Invoice linked to PO → shipment link where applicable →
upload PDF/document → submit → Finance Invoice Queue → OCR → 3-way
match.

Finance must be able to open/download the invoice and see Invoice ID, PO
ID, Shipment ID and Supplier.

## 10. FINANCE VS GATE ROUTING

Do not mix automated notification recipients with operational queues.

Automated notification roles: PR Officer and Supplier.

Supplier invoice workflow: Supplier → Finance Invoice Queue.

Dispatch/ASN/tracking workflow: Supplier → Shipment database →
Logistics/Gate Post.

If Finance or Gate Post later needs email alerts, implement them as
separate business events; do not change the primary two-recipient rule
in this iteration.

## 11. EMAIL HISTORY

Add or reuse an email event table without destroying existing schema:

``` text
email_notifications
notification_id
event_type
recipient_user_id
recipient_email
entity_type
entity_id
po_id
shipment_id
invoice_id
status
emailjs_template_id
sent_at
error_message
created_at
```

Statuses: `PENDING`, `SENT`, `FAILED`, `RETRYING`. A failed email must
not roll back a successful business transaction.

## 12. EMAIL TEMPLATE DESIGN

Because the Free plan has two templates, use:

Template 1: General Supply Sync Notification --- PO accepted, shipment
dispatched, finance exception and PO sent.

Template 2: Supplier PO Action --- accept/reject buttons.

Use dynamic variables such as `{{recipient_name}}`, `{{event_type}}`,
`{{po_id}}`, `{{pr_id}}`, `{{supplier_name}}`, `{{shipment_id}}`,
`{{invoice_id}}`, `{{asn}}`, `{{quantity}}`, `{{amount}}`, `{{status}}`,
`{{event_time}}`, `{{action_url}}`, `{{message}}`.

## 13. UNIVERSAL FILTER + SEARCH

Wherever users select/find an existing database entity or large dataset,
provide BOTH Filter and Search. Preferred order:

`FILTER` → `SEARCH` → optional dropdown/results.

Do not add meaningless search controls to fields such as quantity,
password, notes or ordinary dates.

Create a reusable entity selector such as `EntitySearchSelect` with
Filter + Search + results + selection + related-data auto-fetch.

## 14. PO SEARCH

Search: PO ID, PR ID, Supplier Name/ID, Product SKU, Status. Filter:
Supplier, Status, Priority, PO Date, Delivery Date, PR ID.

Selecting a PO must trigger the existing auto-fetch workflow: fetch PO →
fetch related data → auto-fill relevant fields → user reviews/edits →
user manually submits.

## 15. SUPPLIER SEARCH

Search Supplier ID, Supplier Name, Email, permitted phone. Filter
Status, Rating, Location and category where applicable. Only show
authorized suppliers.

## 16. SHIPMENT SEARCH

Search Shipment ID, PO ID, ASN, Truck Number, Driver ID, Supplier.
Filter Status, Supplier, ETA, Priority, Origin, Destination, Date, Yard,
Dock and Parking.

## 17. DRIVER SEARCH

Search Driver ID, Driver Name, permitted phone, Truck Number. Filter
Availability, Supplier, Driver Status and Vehicle Type. Only show
drivers the current Supplier is authorized to request.

## 18. TRUCK SEARCH

Search Truck ID, Registration Number, Driver ID, Shipment ID. Filter
Status, Supplier, Vehicle Type, Availability and Location.

## 19. INVOICE SEARCH

Search Invoice ID, Invoice Number, PO ID, Supplier, Shipment ID. Filter
Status, Supplier, Invoice Date, Due Date, Amount Range and Exception
Status.

## 20. GRN SEARCH

Search GRN ID, PO ID, Shipment ID, Supplier. Filter Date, Supplier,
Receiving Facility, Status and Mismatch Status.

## 21. EXCEPTION SEARCH

Search Exception ID, PO ID, Invoice ID, GRN ID, Supplier. Filter Status,
Priority, Type, Assigned Person and Date.

## 22. PAYMENT SEARCH

Search Payment ID, Invoice ID, PO ID, Supplier. Filter Payment Status,
Supplier, Date, Amount and Exception Status.

## 23. SEARCH BEHAVIOR

Search should support partial/case-insensitive matching where
appropriate, use real Supabase data, return quickly, preserve
selections, and not reset unexpectedly. For large datasets use
server-side search/pagination where practical.

## 24. FILTER BEHAVIOR

Filters must be combinable. Example: Supplier = ABC + Status =
IN_TRANSIT + Priority = HIGH + Date = TODAY. Include `Clear Filters`.

## 25. DATABASE INDEXING

Add only useful indexes for common queries, especially `po_id`, `pr_id`,
`supplier_id`, `shipment_id`, `driver_id`, `truck_id`, `invoice_id`,
`grn_id`, `status`, `created_at`.

## 26. FINAL EMAIL FLOW

``` text
PR Officer creates/approves PO
↓
PO remains internal
↓
PR Officer clicks SEND TO SUPPLIER
↓
PO = SENT_TO_SUPPLIER
↓
Supplier gets in-app PO + EmailJS
↓
Supplier accepts/rejects
↓
Database updates
↓
If accepted → shipment workflow
↓
If dispatched → PR Officer email
↓
Supplier creates invoice
↓
Finance Invoice Queue
↓
OCR
↓
PO + GRN + Invoice 3-Way Match
↓
Matched → Payment
Mismatch → Finance Exception → PR Officer email if escalated
```

## 27. NON-DESTRUCTIVE DATABASE RULE

Never drop/recreate existing relational tables or delete existing data.
Inspect first, extend only where necessary, preserve IDs/foreign
keys/RLS and test existing workflows. Maintain:

`PR ID → PO ID → Supplier ID → Shipment ID → Driver/Truck → ASN → Gate/Yard → GRN → QC → Invoice → Exception → Payment`

No hardcoded recipient emails. No automatic supplier email on PO
generation. No isolated email records. No destructive database reset.

## 28. ACCEPTANCE TESTS

-   PO generation does not email Supplier.
-   Only SEND TO SUPPLIER triggers Supplier email.
-   Supplier sees pending PO after sending.
-   Supplier email Accept/Reject updates the correct PO.
-   Email action cannot be replayed.
-   Supplier acceptance emails PR Officer.
-   Supplier dispatch emails PR Officer.
-   Finance exception emails PR Officer.
-   Supplier invoice enters Finance queue.
-   Dispatch/ASN data is available to Gate Post/Logistics.
-   PO, shipment, supplier and invoice IDs remain linked.
-   Email failures are logged without rolling back successful
    transactions.
-   Every major entity selector has Filter + Search.
-   Search/filter uses real database data and respects RLS.
-   Selecting a PO triggers auto-fetch but never auto-submit.

# SUPPLY SYNC
