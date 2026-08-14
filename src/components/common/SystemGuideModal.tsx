import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  X,
  Layers,
  FileText,
  ShoppingCart,
  Truck,
  Boxes,
  ClipboardCheck,
  Receipt,
  CreditCard,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Radio,
  Search,
  BookOpen,
  Eye,
  Lock,
  Compass,
  AlertTriangle,
  PlayCircle,
  Building2,
} from 'lucide-react';
import { useApp, UserRole } from '../../contexts/AppContext';

interface SystemGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemGuideModal: React.FC<SystemGuideModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { role, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState<'workflow' | 'permissions' | 'pipeline' | 'actions'>('workflow');

  if (!isOpen) return null;

  const roleConfigs: Partial<
    Record<
      UserRole,
      {
        roleTitle: string;
        roleBadge: string;
        department: string;
        icon: any;
        headerColor: string;
        accentColor: string;
        tagline: string;
        workflowSteps: { step: number; title: string; desc: string; actionText: string; actionPath: string }[];
        authorizedData: { title: string; desc: string; accessLevel: 'FULL_CONTROL' | 'APPROVE_ONLY' | 'READ_WRITE' | 'READ_ONLY' }[];
        pipelineStageIndex: number; // 0 to 6
        pipelineNotes: string;
        proTips: string[];
      }
    >
  > = {
    SYSTEM_ADMIN: {
      roleTitle: 'System Security & Administration Lead',
      roleBadge: 'System Admin',
      department: 'System Architecture & Security',
      icon: Layers,
      headerColor: 'from-blue-950 via-slate-900 to-blue-950',
      accentColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      tagline: 'Oversee system security, role permissions, audit trails, and infrastructure telemetry.',
      workflowSteps: [
        {
          step: 1,
          title: 'Review Global Control Tower Telemetry',
          desc: 'Monitor live transit shipments, dock bay occupancy, open exceptions, and cashflow on hold.',
          actionText: 'Open Control Tower',
          actionPath: '/',
        },
        {
          step: 2,
          title: 'Audit System Operations & Security',
          desc: 'Verify continuous relational integrity across all database tables and track user audit logs.',
          actionText: 'Open Traceability Matrix',
          actionPath: '/traceability',
        },
      ],
      authorizedData: [
        { title: 'Global Database Tables', desc: 'Full Read & Write access across all Supabase operational tables.', accessLevel: 'FULL_CONTROL' },
        { title: 'Audit Trail Logs', desc: 'Inspect security audit logs, persona actions, and system health.', accessLevel: 'FULL_CONTROL' },
      ],
      pipelineStageIndex: 0,
      pipelineNotes: 'Full system administration authority and global operational oversight.',
      proTips: [
        'Use the persona switcher to test workflows as any of the 8 business roles.',
      ],
    },
    ADMIN: {
      roleTitle: 'Executive Operations Director',
      roleBadge: 'Executive Director',
      department: 'Executive Operations',
      icon: Layers,
      headerColor: 'from-blue-950 via-slate-900 to-blue-950',
      accentColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      tagline: 'High-level mission control across procurement, logistics, yard docks, and 3-way financial reconciliation.',
      workflowSteps: [
        {
          step: 1,
          title: 'Review Global Control Tower Telemetry',
          desc: 'Monitor live transit shipments, dock bay occupancy, open exceptions, and cashflow on hold.',
          actionText: 'Open Control Tower',
          actionPath: '/',
        },
        {
          step: 2,
          title: 'Trace 15-Stage End-to-End Audit Chains',
          desc: 'Verify continuous relational integrity across Demand Requisitions, PO Contracts, GPS Logistics, GRN QA, Invoices, and Payments.',
          actionText: 'Open Traceability Matrix',
          actionPath: '/traceability',
        },
      ],
      authorizedData: [
        { title: 'Global Database Tables', desc: 'Full Read & Write access across all Supabase operational tables.', accessLevel: 'FULL_CONTROL' },
      ],
      pipelineStageIndex: 0,
      pipelineNotes: 'Full system administration authority.',
      proTips: ['Use the top Quick Persona Switcher to test each persona flow.'],
    },
    WORKER: {
      roleTitle: 'Shop Floor Operations Worker',
      roleBadge: 'Worker',
      department: 'Shop Floor & Assembly Operations',
      icon: Sparkles,
      headerColor: 'from-indigo-950 via-slate-900 to-indigo-950',
      accentColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      tagline: 'Create natural-language Purchase Requisitions with Gemini AI NLP extraction and monitor approval status.',
      workflowSteps: [
        {
          step: 1,
          title: 'Draft PR with Natural Language NLP',
          desc: 'Speak or type your requirement in plain English. Gemini extracts product, quantity, priority, and date.',
          actionText: 'Create PR (NLP)',
          actionPath: '/purchase-requisitions',
        },
        {
          step: 2,
          title: 'Review Structured PR Parameters',
          desc: 'Verify product SKU, delivery facility, and quantity before final confirmation and submission.',
          actionText: 'My Requisitions',
          actionPath: '/purchase-requisitions',
        },
        {
          step: 3,
          title: 'Track Procurement Decision & Rejection Reasons',
          desc: 'View approved requisitions or inspect specific rejection feedback provided by Procurement.',
          actionText: 'View Requisitions',
          actionPath: '/purchase-requisitions',
        },
      ],
      authorizedData: [
        { title: 'Purchase Requisitions (PRs)', desc: 'Create, edit drafts, and view personal requisition history.', accessLevel: 'FULL_CONTROL' },
        { title: 'Product SKU Master', desc: 'Browse authorized component catalog and unit of measures.', accessLevel: 'READ_ONLY' },
      ],
      pipelineStageIndex: 0,
      pipelineNotes: 'Your role triggers Stage 1 (Demand Requisition) using AI-first natural language processing.',
      proTips: [
        'Use voice or descriptive prompts like "Need 500 safety gloves for Pune DC by next Friday" for instant extraction.',
      ],
    },
    PROCUREMENT_OFFICER: {
      roleTitle: 'Strategic Sourcing & Procurement Lead',
      roleBadge: 'Procurement Officer',
      department: 'Strategic Sourcing & Purchasing',
      icon: ShoppingCart,
      headerColor: 'from-amber-950 via-slate-900 to-amber-950',
      accentColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      tagline: 'Manage demand requisitions, contractual purchase orders, vendor fulfillment SLAs, and master SKU rates.',
      workflowSteps: [
        {
          step: 1,
          title: 'Review & Approve/Reject Purchase Requisitions',
          desc: 'Inspect worker demands, approve to trigger AI supplier selection, or reject with mandatory reasons.',
          actionText: 'Review Requisitions',
          actionPath: '/purchase-requisitions',
        },
        {
          step: 2,
          title: 'Review AI Auto-Drafted Purchase Orders (POs)',
          desc: 'Review auto-drafted POs generated by Gemini multi-criteria supplier evaluation.',
          actionText: 'Review Draft POs',
          actionPath: '/purchase-orders',
        },
        {
          step: 3,
          title: 'Manually Transmit PO to Supplier (Send to Supplier)',
          desc: 'Click "SEND TO SUPPLIER" to officially dispatch contractual commitment to the vendor.',
          actionText: 'Purchase Orders Register',
          actionPath: '/purchase-orders',
        },
        {
          step: 4,
          title: 'Monitor Supplier Responses & Full Traceability',
          desc: 'Track supplier PO confirmations, rejections, and review the end-to-end 15-stage audit matrix.',
          actionText: 'Traceability Matrix',
          actionPath: '/traceability',
        },
      ],
      authorizedData: [
        { title: 'Purchase Requisitions (PRs)', desc: 'Approve, reject, and inspect worker demand histories.', accessLevel: 'APPROVE_ONLY' },
        { title: 'Purchase Orders (POs)', desc: 'Review, edit, approve, reject, and transmit contractual POs.', accessLevel: 'FULL_CONTROL' },
        { title: 'Suppliers Directory', desc: 'Manage vendor partner profiles, contract terms, and SLA scorecards.', accessLevel: 'READ_WRITE' },
        { title: 'Traceability Matrix', desc: 'Full view of all operational stages from PR to Payment settlement.', accessLevel: 'READ_ONLY' },
      ],
      pipelineStageIndex: 1,
      pipelineNotes: 'Your role governs Stage 1 (Requisitions) and Stage 2 (Purchase Orders), initiating the supply chain pipeline.',
      proTips: [
        'POs are never sent automatically — always click SEND TO SUPPLIER after review.',
      ],
    },
    SUPPLIER: {
      roleTitle: 'Verified External Supplier Partner',
      roleBadge: 'Supplier Portal',
      department: 'Tata Industrial Solutions Ltd',
      icon: Building2,
      headerColor: 'from-orange-950 via-slate-900 to-orange-950',
      accentColor: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
      tagline: 'Acknowledge purchase orders, dispatch shipments with fleet details, upload invoices, and track performance scores.',
      workflowSteps: [
        {
          step: 1,
          title: 'Acknowledge & Confirm POs',
          desc: 'Accept customer purchase orders, request clarifications, or dispatch shipments.',
          actionText: 'Supplier Portal',
          actionPath: '/supplier',
        },
        {
          step: 2,
          title: 'Dispatch Shipments & Invoices',
          desc: 'Submit carrier vehicle information, driver details, and upload vendor invoices for 3-way matching.',
          actionText: 'Manage Dispatches',
          actionPath: '/supplier',
        },
      ],
      authorizedData: [
        { title: 'Assigned Purchase Orders', desc: 'View and acknowledge POs specifically assigned to your supplier code.', accessLevel: 'FULL_CONTROL' },
        { title: 'Invoices & Settlements', desc: 'Upload invoices and monitor 3-way match & payout status.', accessLevel: 'FULL_CONTROL' },
      ],
      pipelineStageIndex: 1,
      pipelineNotes: 'Your portal provides isolated access to your order commitments and fulfillment milestones.',
      proTips: [
        'Maintaining a high QC score (>90%) secures Tier-1 preferential purchasing allocation.',
      ],
    },
    TRUCK_DRIVER: {
      roleTitle: 'Inbound Carrier Fleet Driver',
      roleBadge: 'Driver Console',
      department: 'BlueDart Inbound Fleet',
      icon: Truck,
      headerColor: 'from-cyan-950 via-slate-900 to-cyan-950',
      accentColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      tagline: 'Accept dispatch trips, broadcast satellite GPS coordinates, and view allocated facility dock bays.',
      workflowSteps: [
        {
          step: 1,
          title: 'Acknowledge Trip Assignment',
          desc: 'Review manifest origin, destination warehouse, and confirm trip acceptance.',
          actionText: 'Driver Console',
          actionPath: '/driver',
        },
        {
          step: 2,
          title: 'Transmit Live GPS Telemetry',
          desc: 'Broadcast real-time satellite coordinates and speed along the transit highway.',
          actionText: 'Transmit Ping',
          actionPath: '/driver',
        },
      ],
      authorizedData: [
        { title: 'Assigned Shipment Manifest', desc: 'View current cargo load, origin, and destination warehouse.', accessLevel: 'READ_ONLY' },
        { title: 'Live GPS Telemetry', desc: 'Broadcast authenticated location updates.', accessLevel: 'FULL_CONTROL' },
      ],
      pipelineStageIndex: 2,
      pipelineNotes: 'Your mobile console transmits highway telematics and displays gate & dock assignments.',
      proTips: [
        'If docks are congested, your console will indicate your allocated staging yard parking slot.',
      ],
    },
    GATE_POST_OFFICER: {
      roleTitle: 'Facility Gate Post Officer & Yard Master',
      roleBadge: 'Gate Post Officer',
      department: 'Facility Gate Post, Yard & Dock Control',
      icon: Radio,
      headerColor: 'from-teal-950 via-slate-900 to-teal-950',
      accentColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      tagline: 'Verify arriving trucks, record gate check-in, allocate staging parking vs dock bays, and control live map editing.',
      workflowSteps: [
        {
          step: 1,
          title: 'Verify Inbound Carrier & Manifest Check-in',
          desc: 'Scan vehicle plate number, driver identity, PO, and ASN before opening gate barrier.',
          actionText: 'Gate Check-in',
          actionPath: '/yard',
        },
        {
          step: 2,
          title: 'Allocate Staging Parking Slot or Dock Bay (D01-D06)',
          desc: 'Evaluate AI dock recommendations and assign staging slot or direct unloading dock bay.',
          actionText: 'Yard & Docks',
          actionPath: '/yard',
        },
        {
          step: 3,
          title: 'Edit Operational Live Map & Status Overrides',
          desc: 'Only Gate Post Officer possesses manual authority to update live operational locations and status milestones.',
          actionText: 'Live Map Override',
          actionPath: '/shipments',
        },
      ],
      authorizedData: [
        { title: 'Gate Check-in Queue', desc: 'Full authority to check in vehicles and inspect credentials.', accessLevel: 'FULL_CONTROL' },
        { title: 'Yard & Dock Allocations', desc: 'Assign parking slots and dock doors.', accessLevel: 'FULL_CONTROL' },
        { title: 'Operational Location & Status', desc: 'Exclusive manual location edit permissions.', accessLevel: 'FULL_CONTROL' },
      ],
      pipelineStageIndex: 3,
      pipelineNotes: 'Only the GATE_POST_OFFICER may manually edit the live shipment map/location.',
      proTips: [
        'AI recommends Dock vs Parking based on dwell queues; Gate Post Officer has final decision authority.',
      ],
    },
    LOGISTICS: {
      roleTitle: 'Inbound Logistics & Transportation Coordinator',
      roleBadge: 'Logistics Coordinator',
      department: 'Inbound Logistics & Telematics',
      icon: Truck,
      headerColor: 'from-sky-950 via-slate-900 to-sky-950',
      accentColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
      tagline: 'Monitor active trucks, highway corridors, live ETA predictions, and coordinate driver assignments.',
      workflowSteps: [
        {
          step: 1,
          title: 'Monitor Live Inbound Fleet on Highway Corridors',
          desc: 'Track GPS satellite beacons, transit speeds, and route progression on Google Maps.',
          actionText: 'Live Shipments Map',
          actionPath: '/shipments',
        },
        {
          step: 2,
          title: 'Inspect AI Delay Predictions & Highway Bottlenecks',
          desc: 'Analyze automated delay risk probabilities and proactively alert receiving docks.',
          actionText: 'Fleet Telematics',
          actionPath: '/trucks',
        },
        {
          step: 3,
          title: 'Coordinate Driver Assignments & Rejections',
          desc: 'Resolve driver trip rejections and ensure replacement carrier dispatch.',
          actionText: 'Carrier Directory',
          actionPath: '/trucks',
        },
      ],
      authorizedData: [
        { title: 'Shipments & Fleet Telematics', desc: 'Real-time telemetry, GPS locations, and speed logs.', accessLevel: 'READ_ONLY' },
        { title: 'Transportation Alerts', desc: 'Inspect delay warnings, route deviations, and carrier rejections.', accessLevel: 'FULL_CONTROL' },
      ],
      pipelineStageIndex: 2,
      pipelineNotes: 'LOGISTICS = MONITOR + COORDINATE. Location edits are reserved for Gate Post Officer.',
      proTips: [
        'Click on any shipment row in Live Shipments to instantly switch the Google Map tracking view.',
      ],
    },
    RECEIVING_QC: {
      roleTitle: 'Dock Receiving Intake & Quality Control Lead',
      roleBadge: 'Receiving & QC',
      department: 'Dock Receiving & Quality Assurance',
      icon: ShieldCheck,
      headerColor: 'from-purple-950 via-slate-900 to-purple-950',
      accentColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      tagline: 'Supervise dockside unloading, create 100% manual GRNs, perform 5-pillar Quality Checks, and update supplier scorecards.',
      workflowSteps: [
        {
          step: 1,
          title: 'Update Unloading Status at Dock (AT_DOCK -> UNLOADED)',
          desc: 'Monitor cargo discharge, pallet counts, and update dock door turnaround status.',
          actionText: 'Yard Dock Bays',
          actionPath: '/yard',
        },
        {
          step: 2,
          title: 'Create 100% Manual Goods Receipt Note (GRN)',
          desc: 'Enter verified received, accepted, and damaged quantities manually (No OCR on GRN).',
          actionText: 'Create Manual GRN',
          actionPath: '/grn',
        },
        {
          step: 3,
          title: 'Execute 5-Pillar Quality Inspection & AI Analysis',
          desc: 'Evaluate product quality, damage, packaging, documentation, and condition to finalize QC.',
          actionText: 'Quality Check Inspection',
          actionPath: '/quality',
        },
      ],
      authorizedData: [
        { title: 'Goods Receipt Notes (GRN)', desc: 'Create and edit manual receipt records.', accessLevel: 'FULL_CONTROL' },
        { title: 'Quality Check Reports', desc: 'Perform inspections, record defect scores, and upload evidence.', accessLevel: 'FULL_CONTROL' },
        { title: 'Supplier Scorecards', desc: 'Trigger automated supplier rating updates.', accessLevel: 'READ_WRITE' },
      ],
      pipelineStageIndex: 4,
      pipelineNotes: 'Receiving and Quality Control are ONE combined role governing Stage 4 and Stage 5.',
      proTips: [
        'OCR is strictly prohibited for GRNs. All physical counts must be manually verified.',
      ],
    },
    FINANCE: {
      roleTitle: 'Financial Controller & Accounts Payable Lead',
      roleBadge: 'Financial Controller',
      department: 'Accounts Payable & Financial Audit',
      icon: CreditCard,
      headerColor: 'from-emerald-950 via-slate-900 to-emerald-950',
      accentColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      tagline: 'Perform AI OCR invoice extraction, execute PO + GRN + Invoice 3-way matching, manage holds, and release payments.',
      workflowSteps: [
        {
          step: 1,
          title: 'Intake Invoices (Manual Entry or AI OCR Upload)',
          desc: 'Upload supplier invoice PDF/images for automated OCR extraction and review.',
          actionText: 'Invoices & OCR',
          actionPath: '/invoices',
        },
        {
          step: 2,
          title: 'Execute PO + GRN + Invoice 3-Way Match',
          desc: 'Compare rates, quantities, and GST totals across PO, physical GRN, and Invoices.',
          actionText: 'Exceptions Hub',
          actionPath: '/exceptions',
        },
        {
          step: 3,
          title: 'Manage Payment Holds & Authorize NEFT Settlements',
          desc: 'Place holds on price/quantity mismatches and release verified batch settlements.',
          actionText: 'Payments Settlement',
          actionPath: '/payments',
        },
      ],
      authorizedData: [
        { title: 'Invoices & OCR Records', desc: 'Upload, review, and correct invoice extractions.', accessLevel: 'FULL_CONTROL' },
        { title: '3-Way Match & Exceptions', desc: 'Flag price/quantity variances and manage payment holds.', accessLevel: 'FULL_CONTROL' },
        { title: 'Bank Settlement & Payouts', desc: 'Authorize and execute payment disbursements.', accessLevel: 'FULL_CONTROL' },
      ],
      pipelineStageIndex: 5,
      pipelineNotes: 'Finance owns Stage 6 (3-Way Matching & Invoices) and Stage 7 (Payment Settlements).',
      proTips: [
        'OCR is exclusively permitted for Invoices (strictly prohibited for POs and GRNs).',
      ],
    },
  };

  const config = (roleConfigs[role] || roleConfigs.ADMIN || roleConfigs.SYSTEM_ADMIN)!;
  const Icon = config.icon;

  const pipelineStages = [
    { title: '1. Demand Requisition (PR)', role: 'Procurement', icon: FileText },
    { title: '2. Purchase Order (PO)', role: 'Procurement', icon: ShoppingCart },
    { title: '3. Highway Transit GPS', role: 'Logistics', icon: Truck },
    { title: '4. Yard & Gate Check-in', role: 'Gate Security', icon: Boxes },
    { title: '5. QA Intake (GRN)', role: 'Receiving QA', icon: ClipboardCheck },
    { title: '6. AI OCR & 3-Way Match', role: 'Finance', icon: Receipt },
    { title: '7. NEFT Bank Settlement', role: 'Finance', icon: CreditCard },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Personalized Header Bar */}
        <div className={`p-5 border-b border-slate-800 bg-gradient-to-r ${config.headerColor} text-white flex items-center justify-between`}>
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  {config.roleTitle} — Operational System Guide
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${config.accentColor}`}>
                  {config.roleBadge}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                Personalized guide for <strong>{currentUser?.full_name}</strong> • {config.department}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clean 4-Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 gap-1 text-xs font-bold text-slate-600 overflow-x-auto">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'workflow'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>1. Your Daily Operational Workflow</span>
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'permissions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>2. Authorized Data & Permissions</span>
          </button>

          <button
            onClick={() => setActiveTab('pipeline')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'pipeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3. How You Fit in P2P Pipeline</span>
          </button>

          <button
            onClick={() => setActiveTab('actions')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'actions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>4. Pro Tips & Direct Actions</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-700">
          {/* Tab 1: Workflow */}
          {activeTab === 'workflow' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-0.5">
                  Your Step-by-Step Daily Operational Routine
                </h3>
                <p className="text-slate-500">
                  Follow this standardized 4-step workflow to execute your duties in C2 Control Tower:
                </p>
              </div>

              <div className="space-y-3">
                {config.workflowSteps.map((wf) => (
                  <div
                    key={wf.step}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {wf.step}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{wf.title}</h4>
                        <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">{wf.desc}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        navigate(wf.actionPath);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow-2xs self-start sm:self-center"
                    >
                      <span>{wf.actionText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Permissions */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-0.5">
                  Your Authorized System Scopes & Data Boundaries
                </h3>
                <p className="text-slate-500">
                  Security and Row-Level Security (RLS) policies enforce these permissions for your profile:
                </p>
              </div>

              <div className="space-y-3">
                {config.authorizedData.map((auth, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{auth.title}</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{auth.desc}</p>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border shrink-0 ${
                        auth.accessLevel === 'FULL_CONTROL'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : auth.accessLevel === 'READ_WRITE'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {auth.accessLevel.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Pipeline */}
          {activeTab === 'pipeline' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-0.5">
                  Where Your Role Fits in the 7-Stage P2P Pipeline
                </h3>
                <p className="text-slate-500">
                  {config.pipelineNotes}
                </p>
              </div>

              <div className="space-y-2">
                {pipelineStages.map((stage, idx) => {
                  const isUserActiveStage =
                    (role === 'ADMIN') ||
                    (role === 'PROCUREMENT_MANAGER' && (idx === 0 || idx === 1)) ||
                    (role === 'WAREHOUSE_MANAGER' && (idx === 2 || idx === 3)) ||
                    (role === 'GATE_OPERATOR' && idx === 3) ||
                    (role === 'RECEIVING_OPERATOR' && idx === 4) ||
                    (role === 'FINANCE_MANAGER' && (idx === 5 || idx === 6));

                  const StageIcon = stage.icon;

                  return (
                    <div
                      key={stage.title}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                        isUserActiveStage
                          ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-100 shadow-xs'
                          : 'bg-slate-50/60 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            isUserActiveStage ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          <StageIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className={`font-bold text-xs ${isUserActiveStage ? 'text-blue-950' : 'text-slate-800'}`}>
                            {stage.title}
                          </div>
                          <div className="text-[10px] text-slate-500">Managed by: {stage.role}</div>
                        </div>
                      </div>

                      {isUserActiveStage ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white shadow-2xs">
                          ★ Your Core Responsibility
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Collaborating Unit
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 4: Pro Tips */}
          {activeTab === 'actions' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-0.5">
                  Pro Tips & High-Efficiency Best Practices
                </h3>
                <p className="text-slate-500">
                  Tips curated to help you operate with maximum productivity:
                </p>
              </div>

              <div className="space-y-2.5">
                {config.proTips.map((tip, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </div>
                ))}

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
                  <Search className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Press <strong>⌘K</strong> or <strong>Ctrl+K</strong> anywhere to search any Purchase Order, Invoice, Vehicle Number, or Supplier in milliseconds.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Active Persona: <strong className="text-slate-800">{currentUser?.full_name}</strong> ({role.replace('_', ' ')})
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>Got it, Launch Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemGuideModal;
