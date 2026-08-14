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

  const roleConfigs: Record<
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
  > = {
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
          title: 'Trace 6-Stage End-to-End Audit Chains',
          desc: 'Verify continuous relational integrity across Demand Requisitions, PO Contracts, GPS Logistics, GRN QA, Invoices, and Payments.',
          actionText: 'Open Traceability Matrix',
          actionPath: '/traceability',
        },
        {
          step: 3,
          title: 'Run Disruption Simulation Scenarios',
          desc: 'Trigger highway delays, supplier price variances, or yard congestions to test automated contingency handling.',
          actionText: 'Launch Scenarios',
          actionPath: '/',
        },
        {
          step: 4,
          title: 'Analyze Executive Spend & Power BI Telemetry',
          desc: 'Inspect category spend distributions, vendor scorecards, and payment cycle trends.',
          actionText: 'View Analytics',
          actionPath: '/analytics',
        },
      ],
      authorizedData: [
        { title: 'Global Database Tables', desc: 'Full Read & Write access across all 20 Supabase operational tables.', accessLevel: 'FULL_CONTROL' },
        { title: 'Executive Financial Telemetry', desc: 'Cashflow forecasts, Power BI reports, and 3-way match audit trails.', accessLevel: 'FULL_CONTROL' },
        { title: 'Master Entity Configurations', desc: 'Manage warehouses, yard bays, supplier catalogs, and user permissions.', accessLevel: 'FULL_CONTROL' },
      ],
      pipelineStageIndex: 0,
      pipelineNotes: 'You possess full end-to-end visibility across all 7 stages of the autonomous supply chain lifecycle.',
      proTips: [
        'Use ⌘K or Ctrl+K anywhere to execute instant command search across all records.',
        'Use the Demo Scenarios button in the top navbar to inject real-time operational events.',
      ],
    },
    PROCUREMENT_MANAGER: {
      roleTitle: 'Strategic Sourcing & Procurement Lead',
      roleBadge: 'Procurement Lead',
      department: 'Strategic Sourcing & Purchasing',
      icon: ShoppingCart,
      headerColor: 'from-amber-950 via-slate-900 to-amber-950',
      accentColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      tagline: 'Manage demand requisitions, contractual purchase orders, vendor fulfillment SLAs, and master SKU rates.',
      workflowSteps: [
        {
          step: 1,
          title: 'Review Pending Purchase Requisitions (PRs)',
          desc: 'Inspect departmental material requests, required delivery dates, and priority scores.',
          actionText: 'Review Requisitions',
          actionPath: '/purchase-requisitions',
        },
        {
          step: 2,
          title: 'Generate & Issue Purchase Orders (POs)',
          desc: 'Create contractual POs with approved vendor rates, delivery deadlines, and automatic 18% GST tax breakdown.',
          actionText: 'Create Purchase Order',
          actionPath: '/purchase-orders',
        },
        {
          step: 3,
          title: 'Audit Supplier SLA Scorecards',
          desc: 'Monitor vendor fulfillment rates, lead times, quality grades, and contract rate adherence.',
          actionText: 'Suppliers Directory',
          actionPath: '/suppliers',
        },
        {
          step: 4,
          title: 'Resolve Price Mismatch Exceptions',
          desc: 'Investigate price discrepancies flagged by Finance during 3-way match invoice comparison.',
          actionText: 'Exceptions Workspace',
          actionPath: '/exceptions',
        },
      ],
      authorizedData: [
        { title: 'Purchase Requisitions (PRs)', desc: 'View, approve, and convert departmental demands into POs.', accessLevel: 'FULL_CONTROL' },
        { title: 'Purchase Orders (POs)', desc: 'Create, issue, edit, and dispatch contractual purchase orders.', accessLevel: 'FULL_CONTROL' },
        { title: 'Suppliers Directory', desc: 'Manage vendor partner profiles, contract terms, and SLA scorecards.', accessLevel: 'READ_WRITE' },
        { title: 'Product SKU Catalog', desc: 'Inspect product master data, unit prices, and category classifications.', accessLevel: 'READ_ONLY' },
      ],
      pipelineStageIndex: 1,
      pipelineNotes: 'Your role governs Stage 1 (Requisitions) and Stage 2 (Purchase Orders), initiating the supply chain pipeline.',
      proTips: [
        'Click "+ Create Purchase Order" to quickly issue new POs directly synced with live Supabase database.',
        'Check the Suppliers Directory to evaluate vendors with Grade A+ performance records before ordering.',
      ],
    },
    WAREHOUSE_MANAGER: {
      roleTitle: 'Distribution Center & Logistics Lead',
      roleBadge: 'Warehouse Manager',
      department: 'Pune Central Distribution Hub',
      icon: Boxes,
      headerColor: 'from-indigo-950 via-slate-900 to-indigo-950',
      accentColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      tagline: 'Track approaching carrier GPS telematics, schedule DC dock unloading bays, and manage yard dwell times.',
      workflowSteps: [
        {
          step: 1,
          title: 'Monitor Inbound Highway GPS Telematics',
          desc: 'Track approaching carrier trucks on Google Maps, check speed and cargo cold-chain temperature (21°C).',
          actionText: 'Live Shipments Map',
          actionPath: '/shipments',
        },
        {
          step: 2,
          title: 'Schedule & Allocate Dock Bays (D01-D06)',
          desc: 'Assign arriving freight vehicles to available dock bays based on pallet volume and unloading priority.',
          actionText: 'Dock Bays Matrix',
          actionPath: '/yard',
        },
        {
          step: 3,
          title: 'Supervise Staging Yard & Dwell Times',
          desc: 'Maintain queue flow, ensure turnaround dwell times stay under 25 minutes, and monitor gate verified trucks.',
          actionText: 'Yard Staging Queue',
          actionPath: '/yard',
        },
        {
          step: 4,
          title: 'Oversee Goods Receipts & QA Intake',
          desc: 'Verify incoming consignment pallet counts and ensure Goods Receipt Notes (GRN) are accurately logged.',
          actionText: 'Receiving & GRN',
          actionPath: '/grn',
        },
      ],
      authorizedData: [
        { title: 'Live Inbound Shipments & GPS', desc: 'Real-time Google Maps telemetry, waypoints, and ETA calculations.', accessLevel: 'READ_WRITE' },
        { title: 'Dock Bays & Yard Management', desc: 'Full control over dock bay scheduling, yard queue, and truck assignments.', accessLevel: 'FULL_CONTROL' },
        { title: 'Fleet & Carrier Directory', desc: 'Carrier telematics, driver contacts, and vehicle container specifications.', accessLevel: 'READ_WRITE' },
      ],
      pipelineStageIndex: 3,
      pipelineNotes: 'Your role governs Stage 3 (Highway GPS Logistics) and Stage 4 (Yard & Dock Allocations).',
      proTips: [
        'Click on any shipment in the Live Shipments directory to open the 5-tab Carrier Manifest & GPS inspector.',
        'Use the Step +1 or Simulate GPS buttons on the map to test real-time waypoint progression.',
      ],
    },
    GATE_OPERATOR: {
      roleTitle: 'Inbound Gate Security Officer',
      roleBadge: 'Gate Security',
      department: 'Facility Gate Post & Security',
      icon: Radio,
      headerColor: 'from-teal-950 via-slate-900 to-teal-950',
      accentColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
      tagline: 'Validate arriving commercial freight vehicles, inspect driver credentials, and admit trucks to the staging yard.',
      workflowSteps: [
        {
          step: 1,
          title: 'Scan Inbound Vehicle License Plate',
          desc: 'Verify the approaching carrier truck registration plate against the active Purchase Order.',
          actionText: 'Gate Check-In Form',
          actionPath: '/',
        },
        {
          step: 2,
          title: 'Validate E-Way Bill & Tare Weighbridge',
          desc: 'Ensure GST compliance and check-in tare weighbridge weight certificate before gate admittance.',
          actionText: 'Verify Compliance',
          actionPath: '/shipments',
        },
        {
          step: 3,
          title: 'Admit Truck to Facility Staging Yard',
          desc: 'Timestamp the gate entry and transition vehicle status to WAITING in the yard queue.',
          actionText: 'Admit to Yard',
          actionPath: '/yard',
        },
        {
          step: 4,
          title: 'Monitor Gate Dwell & Queuing Flow',
          desc: 'Ensure checkpost dwell time stays below 15 minutes to prevent perimeter road congestion.',
          actionText: 'View Gate Queue',
          actionPath: '/yard',
        },
      ],
      authorizedData: [
        { title: 'Gate In/Out Registry', desc: 'Log vehicle check-in, driver credentials, and gate verification timestamps.', accessLevel: 'FULL_CONTROL' },
        { title: 'Yard Staging Queue', desc: 'Admit vehicles and update gate-verified status in the staging yard.', accessLevel: 'READ_WRITE' },
        { title: 'Live Inbound Shipments', desc: 'Inspect approaching vehicle plates and linked PO numbers.', accessLevel: 'READ_ONLY' },
      ],
      pipelineStageIndex: 3,
      pipelineNotes: 'Your role operates at the gateway of Stage 4 (Yard & Gate Check-in), ensuring physical perimeter security.',
      proTips: [
        'Use the Quick Gate Check-In form right on your dashboard to admit trucks to the yard in 1-click.',
        'Check the waiting minutes timer in the queue table to prioritize vehicles waiting the longest.',
      ],
    },
    RECEIVING_OPERATOR: {
      roleTitle: 'Dock QA & Receiving Inspector',
      roleBadge: 'Dock QA Inspector',
      department: 'Dock Intake & Quality Assurance',
      icon: ClipboardCheck,
      headerColor: 'from-purple-950 via-slate-900 to-purple-950',
      accentColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      tagline: 'Inspect unloaded container pallets, verify physical counts against PO specs, and log Goods Receipt Notes.',
      workflowSteps: [
        {
          step: 1,
          title: 'Inspect Unloaded Container Pallets',
          desc: 'Verify physical cargo items at assigned dock bays (D01-D06) against packaging specifications.',
          actionText: 'Active Dock Bays',
          actionPath: '/yard',
        },
        {
          step: 2,
          title: 'Count Accepted vs Damaged Units',
          desc: 'Perform precise physical count verification, identifying any transit damage or carton tears.',
          actionText: 'Inspect Cargo',
          actionPath: '/grn',
        },
        {
          step: 3,
          title: 'Generate Goods Receipt Note (GRN)',
          desc: 'Submit the verified count into the Supabase database with inspection sign-off notes.',
          actionText: 'Log GRN Intake',
          actionPath: '/grn',
        },
        {
          step: 4,
          title: 'Trigger Automated 3-Way Match Verification',
          desc: 'Logging the GRN automatically feeds accepted quantities into Finance for 3-way reconciliation.',
          actionText: 'View GRN History',
          actionPath: '/grn',
        },
      ],
      authorizedData: [
        { title: 'Goods Receipt Notes (GRN)', desc: 'Create, inspect, sign-off, and manage goods receipt records.', accessLevel: 'FULL_CONTROL' },
        { title: 'Dock Bay Unloading Status', desc: 'Inspect container unloading and update bay completion status.', accessLevel: 'READ_WRITE' },
        { title: 'Product SKU Specs', desc: 'View product specifications, unit of measure, and packaging standards.', accessLevel: 'READ_ONLY' },
      ],
      pipelineStageIndex: 4,
      pipelineNotes: 'Your role governs Stage 5 (QA Intake & GRN), bridging physical warehouse receiving with financial matching.',
      proTips: [
        'Use the Quick GRN Terminal on your dashboard to auto-calculate Net Accepted Units (Received minus Damaged).',
        'Any damaged count automatically flags a quantity exception in Finance, preventing overpayment.',
      ],
    },
    FINANCE_MANAGER: {
      roleTitle: 'Financial Controller & Accounts Payable Lead',
      roleBadge: 'Financial Controller',
      department: 'Finance & Accounts Payable',
      icon: Receipt,
      headerColor: 'from-emerald-950 via-slate-900 to-emerald-950',
      accentColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      tagline: 'Control invoice OCR extraction, autonomous 3-way match verification, variance resolution, and NEFT payments.',
      workflowSteps: [
        {
          step: 1,
          title: 'Ingest & Review Invoices via AI OCR',
          desc: 'Review vendor invoice data extracted with 100% confidence, including subtotal, 18% GST, and line totals.',
          actionText: 'Invoices & OCR',
          actionPath: '/invoices',
        },
        {
          step: 2,
          title: 'Execute Autonomous 3-Way Match Matrix',
          desc: 'Verify mathematical match: Purchase Order Rate = Invoice Rate AND GRN Accepted Qty = Invoiced Qty.',
          actionText: 'Verify 3-Way Match',
          actionPath: '/invoices',
        },
        {
          step: 3,
          title: 'Investigate & Resolve Exceptions',
          desc: 'Investigate price variance or quantity mismatch alerts, and issue debit notes in 1-click.',
          actionText: 'Exceptions Workspace',
          actionPath: '/exceptions',
        },
        {
          step: 4,
          title: 'Authorize NEFT / RTGS Payment Settlement',
          desc: 'Disburse scheduled payouts to verified suppliers with bank transaction reference generation.',
          actionText: 'Disburse Payments',
          actionPath: '/payments',
        },
      ],
      authorizedData: [
        { title: 'Invoices & AI OCR Extraction', desc: 'Full control over vendor invoices, document scans, and OCR records.', accessLevel: 'FULL_CONTROL' },
        { title: '3-Way Match Exceptions', desc: 'Investigate variances, approve rate tolerances, and issue debit adjustments.', accessLevel: 'FULL_CONTROL' },
        { title: 'Payments Settlement Queue', desc: 'Authorize NEFT disbursements and manage banking transaction references.', accessLevel: 'FULL_CONTROL' },
      ],
      pipelineStageIndex: 5,
      pipelineNotes: 'Your role governs Stage 6 (Invoice & 3-Way Match) and Stage 7 (Final Payment Settlement).',
      proTips: [
        'In the Exceptions Hub (/exceptions), click "1-Click Resolve" on any price variance to auto-adjust rates and lift payment holds.',
        'Invoices that pass 3-way matching are immediately queued for 1-click NEFT bank settlement.',
      ],
    },
  };

  const config = roleConfigs[role] || roleConfigs.ADMIN;
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
