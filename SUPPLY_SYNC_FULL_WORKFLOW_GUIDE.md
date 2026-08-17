# Supply Sync — End-to-End Application Workflow Guide

This document describes the complete operational lifecycle, role-based architecture, core technical components, and matching flow of **Supply Sync**—an Autonomous Inbound Supply Chain Control Tower and Power BI Intelligence Hub.

---

## 🌟 1. System Overview & Objectives
Supply Sync is an enterprise-grade Supply Chain and Procure-to-Pay (P2P) management platform. It automates and visualizes the complete inbound supply chain process—bridging the gap between corporate procurement, logistics carriers, warehouse facility yards, receiving quality control, and accounts payable.

The central value proposition is:
```
  [ Demand Sourcing ]      [ Logistics Telemetry ]       [ Yard & Unloading ]       [ Match & Reconciliation ]
Purchase Requisitions  -->  Carrier Shipments   -->  Dock Assignments & GRNs  -->  AI OCR Invoices & 3-Way Match
```

---

## 👥 2. Multi-Role Persona Architecture
The application features a granular, role-based security model across **6 primary internal dashboards** and **2 external portals**:

| Role / Portal | Primary Focus | Actions & Capabilities |
| :--- | :--- | :--- |
| **Executive Admin** | End-to-End Control Tower | Oversees global dashboards, live telemetry corridors, facility yard congestion, matching rates, and critical alert routing. |
| **Procurement Manager** | Requisitions & Vendor Management | Approves PRs, issues POs, monitors category spends, evaluates supplier scorecards, and reviews delivery compliance. |
| **Warehouse Manager** | Facility Yard & Capacity Planning | Monitors inbound ETA lists, schedules docks, assigns parking spaces, handles receiving exceptions, and measures dock utilization. |
| **Gate Security Operator** | Check-in & Vehicle Logs | Verifies incoming license plates, logs gate entry timestamps, assigns yard parking tickets, and records gate exits. |
| **Receiving & QA Operator** | Inspection & Receipt (GRN) | Unloads trailers, performs cargo count checks, logs damages/defects, and issues Goods Receipt Notes (GRN). |
| **Finance Manager** | Matching & Payment Disbursal | Runs client-side OCR on invoices, matches PO-GRN-Invoice values, resolves mismatches, and processes payments via NEFT. |
| **Driver Portal** (External) | GPS Telemetry & Transit Status | Updates real-time GPS locations, updates transit status (In-Transit, Arrived), and logs delays. |
| **Supplier Portal** (External) | Fulfillment & Invoice Dispatch | Reviews approved POs, schedules shipment dispatch dates, assigns drivers, and uploads/extracts invoices via OCR. |

---

## 🔄 3. Step-by-Step Procure-to-Pay (P2P) Pipeline
The physical and financial lifecycle of a transaction moves through **8 distinct sequential phases**:

### Phase 1: Requisition (PR)
- A local department or warehouse officer identifies a material need and files a **Purchase Requisition (PR)** inside [PurchaseRequisitions.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/PurchaseRequisitions.tsx).
- The PR moves to `PENDING_APPROVAL`. The Procurement Manager reviews, approves, or requests changes. Once approved, the status is marked `APPROVED`.

### Phase 2: Purchase Order (PO) Issuance
- Sourcing officers select a supplier and generate a **Purchase Order (PO)** from the approved PR in [PurchaseOrders.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/PurchaseOrders.tsx).
- **PO Visibility Lifecycle Fix:** To prevent suppliers from seeing draft orders, the PO flows strictly through:
  `DRAFT` ➔ `PENDING_APPROVAL` ➔ `APPROVED` ➔ `SENT` ➔ `CONFIRMED`
- Suppliers only view the PO in the [SupplierPortal.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/supplier/SupplierPortal.tsx) once it is marked `SENT`. The supplier reviews details and marks it `CONFIRMED`.

### Phase 3: Shipment Scheduling & Transit Telemetry
- The supplier schedules fulfillment, registers a new **Shipment**, and assigns a carrier vehicle/driver in [Shipments.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/Shipments.tsx).
- The vehicle starts transit, triggering the **Driver Portal** in [DriverPortal.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/driver/DriverPortal.tsx) to simulate live highway coordinates.
- Fleet telemetry tracks coordinates and updates estimated arrival times (ETA). If the truck lags behind the plan, status moves to `DELAYED` and emails/alerts are dispatched.

### Phase 4: Gate Arrival & Yard Management
- Upon facility arrival, the driver checks in. The Gate Operator verifies details (Truck#, Driver ID) in [YardManagement.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/YardManagement.tsx).
- If verified, the operator marks it `gate_verified = TRUE`. The truck enters the facility yard as `AT_YARD` or `WAITING`.
- If unloading bays (docks) are full, the truck waits in a queue. High yard dwell times trigger congestion alerts.

### Phase 5: Dock Assignment & Unloading
- When an inbound dock is available, the Warehouse Manager assigns the truck to a dock (e.g., `Dock 1`) in [YardManagement.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/YardManagement.tsx).
- The truck status transitions to `AT_DOCK` and unloading begins. Unloading start and end times are recorded to calculate cycle times.

### Phase 6: Quality Assurance & Goods Receipt (GRN)
- Unloaded items are counted and checked for defects. The QA Operator completes the receiving checklist in [GoodsReceipts.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/GoodsReceipts.tsx).
- The system generates a **Goods Receipt Note (GRN)** containing actual received, accepted, and damaged quantities.
- Short-shipments or cargo damages trigger immediate automated receiving exceptions.

### Phase 7: Invoice OCR Intake
- The supplier uploads a PDF or image invoice. To minimize operational costs, Supply Sync runs client-side AI OCR (Tesseract.js) directly in [Invoices.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/Invoices.tsx).
- The OCR engine extracts fields: Invoice Number, Subtotal, GST, Total Amount, PO Number, and Date.
- Users can manually override or correct OCR errors in case of low-resolution files.

### Phase 8: Algorithmic 3-Way Match & Settlement
- The Finance Manager initiates the **3-Way Match Engine** in [Exceptions.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/Exceptions.tsx) and [Payments.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/Payments.tsx).
- The engine mathematically verifies alignment:
  $$PO\ Quantity\ /\ Price\ \ \Longleftrightarrow\ \ GRN\ Received\ Quantity\ \ \Longleftrightarrow\ \ Invoice\ Billed\ Quantity\ /\ Price$$
- **Match Case:** The invoice is approved, status changes to `APPROVED_FOR_PAYMENT`, and the Finance Manager releases NEFT/RTGS payment.
- **Mismatch Case:** The invoice is placed on `PAYMENT_ON_HOLD` and an exception is raised (e.g., `QUANTITY_MISMATCH` or `PRICE_MISMATCH`). The Finance Manager reviews, initiates debit notes, coordinates corrections, resolves exceptions, and releases payment.

---

## 🛠️ 4. Key Engineering Modules

### 1. Fleet Telemetry Simulator
Simulates continuous highway coordinates for trucks on specified industrial transport corridors (e.g., Mumbai-Delhi corridor). Provides dynamic routing lines, status adjustments, and calculated ETA updates in [Trucks.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/Trucks.tsx) and [DriverPortal.tsx](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/pages/driver/DriverPortal.tsx).

### 2. Client-Side Tesseract.js OCR Engine
Performs client-side character recognition on invoices and packing lists. No backend OCR service fees are incurred. Standardizes dates, prices, and quantities into a JSON schema for database insertion.

### 3. Centralized 3-Way Matching Engine
Matches invoice lines with PO unit prices and GRN accepted counts. Uses configured thresholds to automatically flag variances. Handles multiple partial GRNs matched against a single PO.

### 4. Alert & Notification Router (EmailJS)
Located in [notificationRouter.ts](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/services/notifications/notificationRouter.ts). Evaluates business events and sends alerts via:
1. **In-App Alerts**: Live banners and lists displayed on dashboards.
2. **EmailJS Integration**: Reusable templates for notifications and actions, initialized safely using [emailService.ts](file:///e:/Desktop/Cognizant%20Hackathon/Website/src/services/emailService.ts).

### 5. Unified Power BI Intelligence Studio
Supplies structured analytical schemas for executive oversight. It provides views for spend category distributions, OTIF fulfillment percentages, dock turnaround durations, and exception Pareto distribution.

---

## 📊 5. Status Transition Matrix
The application is driven by cohesive state transitions. The table below represents the core system states:

| Entity | Draft / Planning | Action / Progress | Exception State | Success / Final |
| :--- | :--- | :--- | :--- | :--- |
| **Purchase Requisition** | `DRAFT` | `PENDING_APPROVAL` | `REJECTED` | `APPROVED` / `CONVERTED` |
| **Purchase Order** | `DRAFT` | `PENDING_APPROVAL` | `REJECTED` / `CANCELLED` | `APPROVED` ➔ `SENT` ➔ `CONFIRMED` |
| **Shipment** | `PLANNED` | `DISPATCHED` ➔ `IN_TRANSIT` | `DELAYED` / `CANCELLED` | `ARRIVED` ➔ `DELIVERED` |
| **Truck** | `AVAILABLE` | `ASSIGNED` ➔ `IN_TRANSIT` | `VERIFICATION_FAILED` | `AT_YARD` ➔ `AT_DOCK` ➔ `COMPLETED` |
| **Yard Entry** | - | `WAITING` ➔ `AT_DOCK` | `WAITING_TIMEOUT` | `UNLOADING` ➔ `COMPLETED` |
| **Goods Receipt** | - | `PENDING` | `PARTIAL` / `REJECTED` | `COMPLETE` |
| **Invoice** | - | `OCR_PENDING` ➔ `PROCESSING` | `OCR_FAILED` / `VALIDATION_FAILED` | `PROCESSED` |
| **3-Way Match** | - | `PENDING` | `MISMATCH` ➔ `UNDER_REVIEW` | `MATCHED` ➔ `RESOLVED` |
| **Payment** | - | `PENDING` | `ON_HOLD` / `FAILED` | `APPROVED` ➔ `PAID` |

---

## 🎬 6. End-to-End Demo Walkthrough Scenario
The ultimate showcase of the system revolves around this narrative:

1. **Procurement Manager** approves a Purchase Requisition for $10,000 worth of computer parts (1,000 units).
2. Sourcing converts the PR into PO-2026-009. The PO is approved, moving it to `SENT` status.
3. The **Supplier** receives PO-2026-009 on the Supplier Portal, marks it `CONFIRMED`, and creates Shipment SHP-402 with 1,000 units.
4. **Truck** TRK-809 starts transit. The driver simulated route goes off-track, triggering a `SHIPMENT_DELAY` alert in-app and sending an EmailJS delay alert to the Warehouse.
5. TRK-809 arrives at the gate. The **Gate Security Operator** verifies details, marks `gate_verified = TRUE`, and the truck enters the yard waiting queue.
6. The **Warehouse Manager** assigns Dock D02 to TRK-809. The truck moves to the dock and unloading starts.
7. The **Receiving & QA Operator** unloads and inspects the cargo. The count shows only 950 parts are accepted (50 parts are defective/damaged). A GRN is logged with 950 accepted and 50 damaged units.
8. The Supplier uploads an Invoice for the full 1,000 units. The **Finance Manager** scans it using the client-side OCR scanner.
9. The **3-Way Match Engine** processes the documents and flags a **QUANTITY_MISMATCH** (PO=1000, Invoice=1000, GRN=950). The invoice is put on `PAYMENT_ON_HOLD`, and an exception is logged.
10. The **Finance Manager** reviews the unified Traceability view, confirms the supplier defect error, logs an approved partial payment exception resolution, and triggers a $500 Debit Note.
11. The exception status moves to `RESOLVED`, the payment moves to `APPROVED`, and the Finance Manager releases NEFT payment for the adjusted $9,500.
12. The transaction finishes as `PAID`. All dashboards and Power BI views update, demonstrating full operational auditability.
