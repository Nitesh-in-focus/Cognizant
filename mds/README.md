# 🚛 Autonomous Inbound Supply Chain Control Tower & Power BI Intelligence Hub

A production-grade, enterprise supply chain visibility platform and automated 3-way financial reconciliation engine built for the Cognizant Hackathon.

---

## 🌟 Key Capabilities

### 1. 👑 Multi-Role Persona Architecture
Role-tailored dashboards and secure granular access control for 6 key supply chain personas:
* **Executive Admin** — Full end-to-end control tower, live corridor telemetry, and financial clearance.
* **Procurement Manager** — Purchase Requisition approvals, PO issuance, and strategic vendor performance.
* **Warehouse Manager** — Facility yard staging, dock bay turnaround, and inbound capacity planning.
* **Gate Security Operator** — Vehicle check-in, optical license plate verification, and queue dwell monitoring.
* **Receiving & QA Operator** — Container unloading, defect recording, and Goods Receipt Note (GRN) logging.
* **Finance Manager** — 3-Way Match automated reconciliation, price variance resolution, and NEFT payment dispatch.

---

### 2. 🔍 Browser-Based AI OCR Document Intake (Tesseract.js)
Client-side optical character recognition running directly in the browser with **zero external API costs**:
* **Vendor Invoices**: Extracts Invoice#, Billed Total, Subtotal, GST (18%), Vendor Name, and Date. Auto-selects matching PO and performs instant 3-Way Match validation.
* **Purchase Orders**: Extracts PO numbers, vendor details, quantities, and contract unit rates.
* **Delivery Challans & Packing Lists**: Extracts received quantities, damaged/defective unit counts, and inspection notes.
* **Dual-Mode Intake**: Users can seamlessly toggle between **Manual Form Entry** and **Scan Document (OCR)**.

---

### 3. 🗺️ Real-Time Fleet & Logistics Corridor Telemetry
* Live GPS highway tracking with simulated truck positions across industrial logistics corridors.
* Interactive carrier selection with dynamic map centering and route telemetry popups.
* Active status monitoring (`IN_TRANSIT`, `DISPATCHED`, `WAITING_IN_YARD`, `AT_DOCK`, `COMPLETED`).

---

### 4. 📊 Unified Dashboard & Power BI Intelligence Studio
* **Executive Overview**: Live operational queues, actionable cards, and fleet telemetry.
* **Power BI & Executive Analytics**: Interactive OTIF fulfillment trends vs. 95% SLA targets, inbound yard dwell durations, spend by category, and 3-way match variance root-cause distribution.
* **Power BI DirectQuery Gateway**: Live schema visualizer for PostgreSQL views (`v_p2p_performance`, `v_yard_telemetry`, `v_exception_root_cause`, `v_supplier_scorecard`), simulated SQL DirectQuery test runner, and `.pbix` schema export.

---

### 5. 🛡️ Autonomous 3-Way Match Engine
* Deterministic mathematical reconciliation between **Purchase Order (PO)**, **Goods Receipt (GRN)**, and **Vendor Invoice**.
* Automated exception triage for price variance, quantity mismatch, and tax discrepancies with debit note triggers.

---

## 🛠️ Technology Stack

* **Frontend**: React 18, TypeScript, Vite
* **Styling**: Tailwind CSS, Lucide Icons, Glassmorphic UI Design System
* **Database & Auth**: Supabase (PostgreSQL 15+)
* **Analytics & Data Visualization**: Recharts, Microsoft Power BI DirectQuery Schema Model
* **Optical Character Recognition (OCR)**: Tesseract.js (Browser-based worker)
* **Maps & Geo-Tracking**: Google Maps API & Custom GeoJSON Layers

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd Website
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production
```bash
npm run build
```

---

## 👥 Demo Personas (Quick Switcher)

| Role | Name | Department | Primary Focus |
|---|---|---|---|
| **Admin** | Operations Lead | Global Supply Chain | Control Tower & Full Visibility |
| **Procurement** | Rajesh Verma | Sourcing & Vendor Mgmt | Requisitions & Purchase Orders |
| **Warehouse** | Vikram Singh | DC Operations | Staging Yard & Dock Scheduling |
| **Gate Security** | Suresh Patil | Inbound Logistics | Vehicle Check-In & Gate Verification |
| **Receiving / QA** | Amit Kulkarni | Quality Assurance | Unloading & Defect Logging |
| **Finance** | Ananya Iyer | Accounts Payable | AI OCR & 3-Way Match Settlement |

---

## 📄 License
MIT License. Built for the Cognizant Hackathon.
