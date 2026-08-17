# SUPPLY SYNC — UPDATES 11
## PO Auto-Fetch, GRN Auto-Fill, QC Auto-Fill, Supplier Invoice Submission, Finance 3-Way Match & NLP

## 1. GLOBAL PO LOOKUP

Wherever a PO is required, replace a plain manual field with a reusable PO search/dropdown.

Support:
- Search by PO ID
- Dropdown selection
- Filter by Supplier, PO Status, PO Date, Delivery Facility, Priority and PR ID

Flow:

```text
Select/Search PO
↓
Fetch linked database data
↓
Auto-fill relevant fields
↓
User reviews/edits permitted fields
↓
User manually submits
```

**Auto-fill is NOT auto-submit.** Never submit merely because a PO was selected.

## 2. PO AUTO-FETCH DATA

Depending on the module, fetch:

```text
PO ID
PR ID
Supplier ID
Supplier Name
Supplier Contact where permitted
Product SKU
Product Name
Description
Ordered Quantity
Unit Price
Total Contract Value
Currency
Origin
Destination / Receiving Facility
Expected Delivery Date
PO Date
Priority
Payment Terms
Delivery Terms
Shipment references where available
```

Only expose fields authorized for the current role.

## 3. GRN — AUTO-FILL FROM PO

When Receiving & QC Lead creates a GRN:

```text
Search/Select PO
↓
Fetch PO data
↓
Auto-fill GRN context
↓
User verifies
↓
Enter actual received data
↓
Submit GRN
```

Auto-fill:

```text
PO ID
PR ID
Supplier ID
Supplier Name
Product SKU
Product Name
Ordered/Expected Quantity
Unit Price
Receiving Facility
Expected Delivery
Shipment references where available
```

Manual fields:

```text
Received Quantity
Missing Quantity
Damaged Quantity
Rejected Quantity
Accepted Quantity
Actual Arrival Date/Time
Actual Unloading Date/Time
Receiving Notes
```

Validate quantities and never overwrite original PO quantity.

## 4. QUALITY CHECK — AUTO-FILL FROM PO

When Receiving & QC Lead opens QC:

```text
Search/Select PO
↓
Fetch PO
↓
Fetch Supplier
↓
Fetch Product
↓
Fetch Shipment / GRN when available
↓
Auto-fill inspection context
↓
QC Lead performs inspection
↓
Enter 8-factor ratings
↓
AI calculates score/recommendation
↓
Submit QC
```

The Supplier Name must be visible and must be derived from the selected PO. Do not require manual supplier selection when the PO already determines it.

Auto-fill:

```text
PO ID
PR ID
Supplier ID
Supplier Name
Product SKU
Product Name
Ordered Quantity
Expected Quantity
Shipment ID
GRN ID if available
Receiving Date
```

The user manually enters inspection results. Keep the existing 8-factor, 1–10 QC model.

## 5. FIX CURRENT QC ERROR

Current UI shows:

```text
Please select a valid supplier and purchase order.
```

Fix the underlying relationship/RLS/backend issue, not merely the message.

After valid PO selection:
1. Derive supplier from the PO.
2. Populate supplier ID internally.
3. Display supplier name.
4. Submit QC using the canonical supplier ID.
5. Ensure authorized Receiving & QC Lead can create/update QC under RLS.
6. Do not pass a fake or independently entered supplier ID from the frontend.

## 6. AI QUALITY SCORING

Gemini may assist with:

```text
Quality score calculation
Defect interpretation
Quality recommendations
Supplier performance recommendations
```

Store raw QC inputs separately from AI output. AI must not silently modify inspection facts.

Flow:

```text
Raw QC Inputs
↓
Weighted Calculation
↓
Gemini Recommendation
↓
Final QC Result
↓
Supplier Rating Update
```

## 7. INVOICE RESPONSIBILITY

**Finance does NOT create supplier invoices.**

Correct workflow:

```text
Supplier
↓
Create/Upload Invoice
↓
Link Invoice to PO
↓
Submit Invoice
↓
Finance Invoice Queue
↓
Finance Notification
↓
3-Way Match
↓
Payment or Exception
```

Remove Finance-side "Create Invoice" functionality. Finance receives, reviews, matches, resolves/escalates and processes payment.

## 8. SUPPLIER INVOICE SECTION

Supplier must have a clear `Invoice Submission` section.

Flow:

```text
Select PO
↓
Auto-fetch PO data
↓
Enter invoice-specific data
↓
Upload PDF/image
↓
OCR if applicable
↓
Review extracted values
↓
Correct if needed
↓
Submit Invoice
```

Invoice fields should include:

```text
Invoice ID / Number
PO ID
Supplier ID / Name
Invoice Date
Due Date
Currency
Subtotal
Tax
Discount
Freight / Shipping Charges
Other Charges
Total Invoice Amount
Payment Terms
Shipment ID
GRN reference where available
Notes
Invoice Document
```

Where appropriate also support billing/tax information and line items:

```text
SKU
Description
Quantity
Unit Price
Tax Rate
Line Total
```

Do not force users to re-enter information already available from the PO.

## 9. INVOICE AUTO-FILL

Selecting a PO should populate:

```text
PO ID
Supplier ID
Supplier Name
Customer
Product/SKU
PO Quantity
Unit Price
Contract Value
Destination
Payment Terms
```

Supplier enters invoice-specific values. Invoice values must not overwrite the source PO.

## 10. INVOICE SUBMISSION

There must be an obvious:

`Submit Invoice`

button.

Statuses:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
MATCHED
MISMATCH
EXCEPTION
APPROVED_FOR_PAYMENT
PAID
REJECTED
```

After submission, create/persist a unique invoice ID and send it to the Finance queue.

## 11. INVOICE IDENTIFIERS

Every invoice must have:

```text
invoice_id
invoice_number
PO ID
Supplier ID
Shipment ID where applicable
GRN ID where applicable
```

Example:

```text
PO-2026-2001
INV-2026-1531
SHP-2026-XXXX
GRN-2026-XXXX
```

## 12. FINANCE INVOICE QUEUE

After Supplier submits:

```text
Supplier
↓
Submit Invoice
↓
Database
↓
Finance Invoice Queue
↓
Finance notification
```

All authorized Finance Controller users should be able to see submitted invoices according to RLS.

Finance should be able to search/filter by:

```text
Invoice ID
PO ID
Supplier
Status
Invoice Date
Amount
```

## 13. FINANCE INVOICE DETAIL

Finance can view:

```text
Invoice ID
Invoice Number
Supplier
Supplier ID
PO ID
PR ID
Shipment ID
GRN ID
Invoice Date
Due Date
Line Items
Subtotal
Tax
Discount
Freight
Total
Uploaded Document
OCR Extracted Data
Supplier-entered Data
Current Status
```

## 14. THREE-WAY MATCH

Finance must have:

`Run 3-Way Match`

for each submitted invoice.

Matching chain:

```text
PO
↓
GRN
↓
Invoice
```

The simulation must show the three documents side-by-side and compare at minimum:

```text
PO reference
Supplier
Product/SKU
Quantity
Price
Tax where applicable
Total
```

Example:

```text
PO           GRN          Invoice
1000 units   950 units    950 units
₹100/unit    received     ₹100/unit
₹100,000     950          ₹95,000
```

## 15. MATCH RESULT

If required checks pass:

```text
MATCHED
↓
Finance Approval
↓
APPROVED_FOR_PAYMENT
↓
Payment Processing
↓
PAID
```

If any blocking check fails:

```text
MISMATCH
↓
EXCEPTION
↓
PAYMENT ON HOLD
```

Show the exact mismatch, e.g.:

```text
Quantity: PO 1000 / GRN 950 / Invoice 950
Price: PO ₹100 / Invoice ₹110
```

## 16. FINANCE EXCEPTION HANDLING

Finance gets first-level control:

```text
Review
Resolve where authorized
Request clarification
Hold Payment
Escalate to PR Officer
```

If Finance cannot resolve:

```text
Finance
↓
PR Officer
↓
Inspection/Resolution
↓
Finance
↓
Re-run 3-Way Match
```

Do not allow payment approval while a blocking exception remains unresolved.

## 17. PAYMENT

Only after successful matching/resolution:

```text
Finance
↓
Approve Payment
↓
Payment Record
↓
PROCESSING
↓
PAID
```

Payment should reference:

```text
payment_id
invoice_id
po_id
supplier_id
amount
payment_date
status
approved_by
```

## 18. OCR

Supplier may upload PDF/image. OCR extracts:

```text
Invoice Number
Invoice Date
PO Number
Supplier
Line Items
Quantity
Unit Price
Tax
Total
```

Then:

```text
OCR Extracted Data
↓
Supplier Review
↓
Manual Correction if needed
↓
Submit Invoice
```

Store both the original document and extracted data. OCR never auto-submits.

If OCR PO number differs from selected PO, show a warning and require correction/confirmation.

## 19. NLP ON FORMS

Wherever substantial text is entered, provide NLP assistance, including:

```text
PR creation
Invoice notes
QC observations
Exception explanations
Supplier notes
Shipment notes
Receiving notes
```

Example:

`Need 500 steel bearings at Central Hub by 25 August.`

Extract:

```text
Quantity = 500
Product = Steel Bearings
Destination = Central Hub
Required Date = 25 August
```

## 20. NLP EXACT-VALUE RULE

NLP must preserve exact user-provided values.

Flow:

```text
User Input
↓
NLP Extraction
↓
Extracted Fields
↓
User Review
↓
Manual Edit
↓
Submit
```

Never silently change quantities, dates, products or destinations. If a date is ambiguous, ask for clarification. Normalize dates consistently in the database.

## 21. AUTO-FILL VS AUTO-SUBMIT

**AUTO-FILL:** allowed.

```text
PO selected
↓
Fetch database data
↓
Populate fields
```

**AUTO-SUBMIT:** not allowed merely because PO/NLP/OCR data was fetched.

User must retain control of submission for GRN, QC, Invoice, exception actions and payment approval where applicable.

## 22. DATABASE RELATIONSHIPS

Maintain one interconnected source of truth:

```text
PR
↓
PO
↓
Supplier
↓
Shipment
↓
Gate-In
↓
GRN
↓
QC
↓
Invoice
↓
3-Way Match
↓
Exception if needed
↓
Payment
```

Canonical relationships should include:

```text
purchase_orders.po_id → grns.po_id
purchase_orders.po_id → invoices.po_id
purchase_orders.po_id → shipments.po_id
shipments.shipment_id → grns.shipment_id
shipments.shipment_id → invoices.shipment_id where applicable
grn.grn_id → invoices.grn_id where applicable
invoices.invoice_id → payments.invoice_id
suppliers.supplier_id → purchase_orders.supplier_id
suppliers.supplier_id → shipments.supplier_id
suppliers.supplier_id → grns.supplier_id
suppliers.supplier_id → invoices.supplier_id
suppliers.supplier_id → payments.supplier_id
```

Use canonical foreign keys. Avoid unnecessary duplicated business data.

## 23. TRACEABILITY

From any invoice, Finance should be able to navigate:

```text
Invoice
↓
PO
↓
PR
↓
Supplier
↓
Shipment
↓
Truck / Driver
↓
Gate-In
↓
Dock / Parking
↓
GRN
↓
QC
↓
Payment
```

Each stage should show:

```text
Completed
Pending
On Hold
Exception
Rejected
```

with timestamps/history.

## 24. AUDIT HISTORY

Log:

```text
Invoice Created
Invoice Submitted
OCR Executed
OCR Corrected
Invoice Reviewed
3-Way Match Executed
Mismatch Detected
Exception Created
Exception Resolved
Exception Escalated
Payment Approved
Payment Completed
```

Store actor, role, action, entity type/id, timestamp and old/new values or reason where applicable.

## 25. ROLE RESPONSIBILITIES

### Supplier
- Select accepted PO
- Create shipments
- Choose dispatch quantity
- Create/upload invoice
- Enter invoice information
- Run/review OCR
- Correct OCR values
- Submit invoice
- View invoice status

### Receiving & QC Lead
- Search/select PO
- Create GRN
- Enter actual receipt quantities
- Record missing/damaged/rejected quantities
- Perform QC
- Rate supplier
- Submit QC

### Finance Controller
- Receive supplier invoices
- Review documents
- Run 3-way match
- Manage finance-level exceptions
- Escalate to PR Officer
- Approve payment after successful resolution/matching
- View payment history

### PR Officer
- Handle escalated procurement exceptions
- Inspect PR/PO/supplier relationships
- Resolve procurement-side issues according to existing permissions

## 26. CURRENT SCREEN FIXES

### Quality Screen
The current QC screen must correctly show:

```text
Supplier
Target PO
Product SKU
```

Supplier must auto-populate after valid PO selection.

### Finance Screen
Remove the incorrect Finance-side `Create Invoice` workflow.

Finance needs:

`Invoice Inbox / Received Invoices`

Supplier owns invoice creation/submission.

## 27. ACCEPTANCE TESTS

### PO Auto-Fetch
- Search works.
- Dropdown works.
- Supplier filtering works.
- Selecting PO auto-fills relevant fields.
- User can edit only authorized fields.
- No automatic submission.
- Data comes from Supabase, not hardcoded values.

### GRN
- PO selection works.
- Supplier auto-populates.
- Product/SKU auto-populates.
- Expected quantity auto-populates.
- Actual receipt quantities are manually entered.
- Quantity validation works.
- GRN submits successfully.
- GRN links to PO/Supplier/Shipment.

### QC
- PO selection works.
- Supplier appears automatically.
- Product data appears.
- GRN/shipment data appears when available.
- QC inputs can be entered.
- AI score works.
- QC saves correctly.
- Supplier rating updates after final QC.
- RLS does not block authorized QC submission.

### Supplier Invoice
- Supplier selects PO.
- PO data auto-fills.
- Invoice-specific fields remain editable.
- Document uploads.
- OCR works.
- Supplier can review/correct OCR.
- Submit Invoice works.
- Unique Invoice ID is created.
- Invoice enters Finance queue.

### Finance
- Finance sees submitted invoices.
- Search/filter works.
- Invoice details open.
- 3-way matching works.
- PO/GRN/Invoice are shown together.
- MATCHED appears only when required checks pass.
- MISMATCH shows exact issue.
- Finance can resolve authorized exceptions.
- Finance can escalate to PR Officer.
- Payment is blocked by unresolved blocking mismatches.
- Successful matching enables payment.

### NLP
- Natural-language input is parsed.
- Exact quantities are preserved.
- Exact dates are preserved.
- Product/destination are preserved.
- Ambiguous values require clarification.
- User can edit extracted values.
- NLP never silently submits.

## 28. NON-NEGOTIABLE RULES

1. PO selection means **auto-fetch, not auto-submit**.
2. Supplier creates/submits supplier invoices; Finance receives/processes them.
3. Every invoice has a unique Invoice ID.
4. Every invoice retains PO ID and Supplier ID.
5. GRN retains PO/Supplier/Shipment relationships.
6. QC derives Supplier from the selected PO.
7. Finance has an Invoice Inbox, not Create Invoice.
8. 3-way match = PO + GRN + Invoice.
9. Blocking mismatches place payment on hold.
10. Finance can escalate unresolved exceptions to PR Officer.
11. Payment occurs only after required matching/resolution.
12. NLP preserves exact user-provided values.
13. OCR output is reviewable before submission.
14. No frontend-only fake relationships.
15. No hardcoded production supplier/PO/invoice data.
16. All records remain dynamically linked through Supabase.

# SUPPLY SYNC
