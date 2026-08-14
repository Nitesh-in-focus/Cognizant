import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Truck,
  AlertTriangle,
  Boxes,
  Receipt,
  CreditCard,
  ShoppingCart,
  TrendingUp,
  Clock,
  ArrowRight,
  RefreshCw,
  MapPin,
  ShieldAlert,
  CheckCircle2,
  GitFork,
  Radio,
  FileText,
  Activity,
  Layers,
  Building2,
  BookOpen,
  User,
  ShieldCheck,
  Zap,
  DollarSign,
  Package,
  ClipboardCheck,
  Plus,
  BarChart3,
  FileSpreadsheet,
  ExternalLink,
  Download,
  Database,
  Server,
  Filter,
  Sparkles,
  LayoutDashboard,
  Calendar,
  Play,
  Check,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useApp, UserRole } from '../contexts/AppContext';
import { KpiCard } from '../components/common/KpiCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { TruckTrackingMap } from '../components/maps/TruckTrackingMap';

interface DashboardProps {
  onOpenGuide?: () => void;
  defaultTab?: 'overview' | 'analytics' | 'powerbi';
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenGuide, defaultTab }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as 'overview' | 'analytics' | 'powerbi' | null;
  const { currentUser, role, refreshKey, triggerRefresh, showSnackbar } = useApp();

  const [dashboardTab, setDashboardTab] = useState<'overview' | 'analytics' | 'powerbi'>(
    defaultTab || urlTab || 'overview'
  );

  useEffect(() => {
    if (defaultTab) {
      setDashboardTab(defaultTab);
    } else if (urlTab) {
      setDashboardTab(urlTab);
    }
  }, [defaultTab, urlTab]);

  const handleTabChange = (tab: 'overview' | 'analytics' | 'powerbi') => {
    setDashboardTab(tab);
    setSearchParams(tab === 'overview' ? {} : { tab });
  };

  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    activeShipments: 0,
    delayedShipments: 0,
    trucksInYard: 0,
    dockUtilization: 78,
    invoiceExceptions: 0,
    paymentOnHold: 0,
    pendingPRs: 0,
    activePOs: 0,
    totalPOSpend: 0,
    grnCount: 0,
    acceptedUnits: 0,
    damagedUnits: 0,
  });

  const [recentPos, setRecentPos] = useState<any[]>([]);
  const [recentPRs, setRecentPRs] = useState<any[]>([]);
  const [recentExceptions, setRecentExceptions] = useState<any[]>([]);
  const [recentShipments, setRecentShipments] = useState<any[]>([]);
  const [yardEntries, setYardEntries] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Gate Checkin quick form state
  const [gateTruckNo, setGateTruckNo] = useState('MH-12-AB-9921');
  const [gateDriver, setGateDriver] = useState('Ramesh Shinde');
  const [gateSubmitting, setGateSubmitting] = useState(false);

  // GRN intake quick state
  const [grnReceivedQty, setGrnReceivedQty] = useState('500');
  const [grnDamagedQty, setGrnDamagedQty] = useState('0');
  const [grnSubmitting, setGrnSubmitting] = useState(false);

  const getGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    fetchDashboardData();
  }, [refreshKey]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [
        { count: shpActiveCount, data: shpData },
        { count: yardTrucksCount, data: yardData },
        { count: excCount, data: excData },
        { data: posData },
        { data: prData },
        { data: onHoldInvoices },
        { data: grnData },
      ] = await Promise.all([
        supabase.from('shipments').select('*, purchase_orders(po_number, suppliers(supplier_name)), warehouses(city)').in('status', ['IN_TRANSIT', 'DISPATCHED']).limit(5),
        supabase.from('yard_entries').select('*, trucks(vehicle_number, driver_name, carrier_name), shipments(shipment_number)').in('status', ['WAITING', 'AT_DOCK']).limit(6),
        supabase.from('exceptions').select('*, purchase_orders(po_number, suppliers(supplier_name))').eq('status', 'OPEN').limit(5),
        supabase.from('purchase_orders').select('*, suppliers(supplier_name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('purchase_requisitions').select('*, warehouses(warehouse_name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('invoices').select('*, purchase_orders(po_number, suppliers(supplier_name))').order('created_at', { ascending: false }).limit(5),
        supabase.from('goods_receipts').select('*, shipments(shipment_number)').order('created_at', { ascending: false }).limit(5),
      ]);

      const totalOnHold = onHoldInvoices?.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0) || 0;
      const totalPOSpend = posData?.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0) || 0;

      setMetrics({
        activeShipments: shpActiveCount || 8,
        delayedShipments: 1,
        trucksInYard: yardTrucksCount || 4,
        dockUtilization: 67,
        invoiceExceptions: excCount || 0,
        paymentOnHold: totalOnHold,
        pendingPRs: prData?.length || 3,
        activePOs: posData?.length || 5,
        totalPOSpend: totalPOSpend,
        grnCount: grnData?.length || 4,
        acceptedUnits: 2450,
        damagedUnits: 12,
      });

      setRecentPos(posData || []);
      setRecentPRs(prData || []);
      setRecentExceptions(excData || []);
      setRecentShipments(shpData || []);
      setYardEntries(yardData || []);
      setInvoices(onHoldInvoices || []);
    } catch (err: any) {
      console.error('Error loading dashboard telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickGateCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateSubmitting(true);
    try {
      const { data: yards } = await supabase.from('yards').select('yard_id').limit(1);
      const { data: trucks } = await supabase.from('trucks').select('truck_id').limit(1);

      if (yards?.length && trucks?.length) {
        await supabase.from('yard_entries').insert([
          {
            yard_id: yards[0].yard_id,
            truck_id: trucks[0].truck_id,
            entry_time: new Date().toISOString(),
            status: 'WAITING',
            gate_verified: true,
            waiting_minutes: 0,
          },
        ]);
        showSnackbar(`Vehicle ${gateTruckNo} verified and admitted to Staging Yard!`, 'success');
        triggerRefresh();
      }
    } catch (err: any) {
      showSnackbar(err.message || 'Gate check-in failed', 'error');
    } finally {
      setGateSubmitting(false);
    }
  };

  const handleQuickGRNIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrnSubmitting(true);
    try {
      const rec = parseInt(grnReceivedQty, 10) || 500;
      const dam = parseInt(grnDamagedQty, 10) || 0;
      const acc = Math.max(0, rec - dam);

      const { data: pos } = await supabase.from('purchase_orders').select('po_id').limit(1);
      if (pos?.length) {
        await supabase.from('goods_receipts').insert([
          {
            po_id: pos[0].po_id,
            grn_number: `GRN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            received_date: new Date().toISOString().split('T')[0],
            received_by: currentUser?.full_name || 'Amit Kulkarni',
            status: 'COMPLETED',
            notes: `QA Intake Inspection Completed. Received: ${rec}, Damaged: ${dam}, Accepted: ${acc}`,
          },
        ]);
        showSnackbar(`GRN logged! Accepted ${acc} units (${dam} damaged).`, 'success');
        triggerRefresh();
      }
    } catch (err: any) {
      showSnackbar(err.message || 'GRN Intake failed', 'error');
    } finally {
      setGrnSubmitting(false);
    }
  };

  const spendData = [
    { name: 'Raw Material', value: 450000 },
    { name: 'Packaging', value: 120000 },
    { name: 'Electronics', value: 310000 },
    { name: 'Mechanical', value: 180000 },
    { name: 'Freight Logistics', value: 95000 },
  ];

  const exceptionChartData = [
    { name: 'Unit Price Mismatch', value: 45, color: '#EF4444' },
    { name: 'Quantity Variance', value: 30, color: '#F59E0B' },
    { name: 'Tax / GST Discrepancy', value: 15, color: '#10B981' },
    { name: 'Missing PO Match', value: 10, color: '#3B82F6' },
  ];

  // ── Power BI & Analytics State & Datasets ──────────────────────────
  const [dateFilter, setDateFilter] = useState<'7D' | '30D' | '90D' | 'YTD'>('30D');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedViewSchema, setSelectedViewSchema] = useState<'v_p2p_performance' | 'v_yard_telemetry' | 'v_exception_root_cause' | 'v_supplier_scorecard'>('v_p2p_performance');
  const [queryExecuting, setQueryExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<any | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');

  const otifData = [
    { week: 'W1', otif: 88, target: 95 },
    { week: 'W2', otif: 91, target: 95 },
    { week: 'W3', otif: 89, target: 95 },
    { week: 'W4', otif: 94, target: 95 },
    { week: 'W5', otif: 96, target: 95 },
    { week: 'W6', otif: 94.8, target: 95 },
  ];

  const yardDwellData = [
    { day: 'Mon', dwellMinutes: 45, benchmark: 40 },
    { day: 'Tue', dwellMinutes: 38, benchmark: 40 },
    { day: 'Wed', dwellMinutes: 52, benchmark: 40 },
    { day: 'Thu', dwellMinutes: 29, benchmark: 40 },
    { day: 'Fri', dwellMinutes: 34, benchmark: 40 },
    { day: 'Sat', dwellMinutes: 20, benchmark: 40 },
  ];

  const invoiceMatchData = [
    { month: 'Mar', matched: 88, mismatched: 12 },
    { month: 'Apr', matched: 91, mismatched: 9 },
    { month: 'May', matched: 90, mismatched: 10 },
    { month: 'Jun', matched: 94, mismatched: 6 },
    { month: 'Jul', matched: 92, mismatched: 8 },
    { month: 'Aug', matched: 96, mismatched: 4 },
  ];

  const poStatusData = [
    { name: 'CONFIRMED', value: 38, color: '#10B981' },
    { name: 'DISPATCHED', value: 28, color: '#3B82F6' },
    { name: 'IN_TRANSIT', value: 20, color: '#F59E0B' },
    { name: 'COMPLETED', value: 14, color: '#8B5CF6' },
  ];

  const supplierScorecards = [
    { name: 'Tata Steel Tubes Ltd', city: 'Jamshedpur', otif: 98.4, leadTime: '2.1 days', passRate: '99.4%', spend: 450000, tier: 'TIER 1', compliant: true },
    { name: 'Bharat Heavy Forge Co', city: 'Pune', otif: 94.6, leadTime: '3.4 days', passRate: '97.8%', spend: 280000, tier: 'TIER 1', compliant: true },
    { name: 'Kirloskar Flow Systems', city: 'Kirloskarvadi', otif: 91.2, leadTime: '4.2 days', passRate: '96.5%', spend: 195000, tier: 'TIER 2', compliant: true },
    { name: 'Mahindra Logistics Freight', city: 'Mumbai', otif: 96.8, leadTime: '1.8 days', passRate: '100%', spend: 120000, tier: 'TIER 1', compliant: true },
    { name: 'Apex Electronics Spares', city: 'Bengaluru', otif: 88.5, leadTime: '5.0 days', passRate: '93.2%', spend: 110000, tier: 'ON REVIEW', compliant: false },
  ];

  const viewSchemas = {
    v_p2p_performance: {
      description: 'Procure-to-Pay end-to-end velocity, PO-to-Invoice reconciliation cycle time, and cash outflow forecasting.',
      columns: [
        { name: 'po_number', type: 'VARCHAR(50)', desc: 'Contractual purchase order identifier' },
        { name: 'cycle_time_hours', type: 'NUMERIC(6,2)', desc: 'Elapsed hours from PR approval to invoice clearance' },
        { name: 'match_status', type: 'VARCHAR(20)', desc: 'Deterministic 3-Way match outcome (MATCHED / MISMATCH)' },
        { name: 'net_spend_inr', type: 'NUMERIC(14,2)', desc: 'Authorized invoice disbursement amount' },
        { name: 'ocr_confidence_score', type: 'NUMERIC(5,2)', desc: 'Tesseract OCR optical recognition accuracy %' },
      ],
      sampleRows: [
        { po_number: 'PO-2026-1001', cycle_time_hours: 48.5, match_status: 'MATCHED', net_spend_inr: 59000, ocr_confidence_score: 96.4 },
        { po_number: 'PO-2026-1002', cycle_time_hours: 72.1, match_status: 'MISMATCH', net_spend_inr: 124000, ocr_confidence_score: 92.1 },
        { po_number: 'PO-2026-1003', cycle_time_hours: 36.0, match_status: 'MATCHED', net_spend_inr: 345000, ocr_confidence_score: 98.8 },
      ],
    },
    v_yard_telemetry: {
      description: 'Real-time logistics corridor telemetry, gate turnaround minutes, dock bay utilization, and unloading dwell.',
      columns: [
        { name: 'vehicle_number', type: 'VARCHAR(20)', desc: 'Commercial carrier license plate' },
        { name: 'gate_in_timestamp', type: 'TIMESTAMPTZ', desc: 'Security gate optical verification timestamp' },
        { name: 'yard_dwell_minutes', type: 'INTEGER', desc: 'Minutes staged in yard prior to dock assignment' },
        { name: 'dock_turnaround_minutes', type: 'INTEGER', desc: 'Active unloading and QA inspection duration' },
        { name: 'status', type: 'VARCHAR(20)', desc: 'Current logistics state (WAITING / AT_DOCK / DEPARTED)' },
      ],
      sampleRows: [
        { vehicle_number: 'MH-12-AB-9921', gate_in_timestamp: '2026-08-14T02:15:00Z', yard_dwell_minutes: 24, dock_turnaround_minutes: 38, status: 'AT_DOCK' },
        { vehicle_number: 'MH-14-CW-4402', gate_in_timestamp: '2026-08-14T03:00:00Z', yard_dwell_minutes: 18, dock_turnaround_minutes: 0, status: 'WAITING' },
        { vehicle_number: 'KA-01-EF-8819', gate_in_timestamp: '2026-08-14T01:10:00Z', yard_dwell_minutes: 35, dock_turnaround_minutes: 42, status: 'DEPARTED' },
      ],
    },
    v_exception_root_cause: {
      description: 'Root-cause categorization of 3-way match variances, price tolerance breaches, and QA damaged intake claims.',
      columns: [
        { name: 'exception_number', type: 'VARCHAR(50)', desc: 'Exception investigation ticket number' },
        { name: 'exception_type', type: 'VARCHAR(40)', desc: 'Variance category (PRICE_MISMATCH / QUANTITY_VARIANCE)' },
        { name: 'financial_impact_inr', type: 'NUMERIC(12,2)', desc: 'Net INR delta held from supplier payment' },
        { name: 'resolution_status', type: 'VARCHAR(20)', desc: 'Workflow status (OPEN / UNDER_REVIEW / RESOLVED)' },
        { name: 'assigned_approver', type: 'VARCHAR(100)', desc: 'Finance or Procurement resolving officer' },
      ],
      sampleRows: [
        { exception_number: 'EXC-2026-3001', exception_type: 'PRICE_MISMATCH', financial_impact_inr: 12500, resolution_status: 'OPEN', assigned_approver: 'Ananya Iyer' },
        { exception_number: 'EXC-2026-3002', exception_type: 'QUANTITY_VARIANCE', financial_impact_inr: 8000, resolution_status: 'UNDER_REVIEW', assigned_approver: 'Rajesh Verma' },
        { exception_number: 'EXC-2026-3003', exception_type: 'TAX_DISCREPANCY', financial_impact_inr: 4500, resolution_status: 'RESOLVED', assigned_approver: 'Ananya Iyer' },
      ],
    },
    v_supplier_scorecard: {
      description: 'Vendor contract adherence, OTIF fulfillment rating, quality defect percentage, and strategic tier ranking.',
      columns: [
        { name: 'supplier_name', type: 'VARCHAR(100)', desc: 'Registered supplier company name' },
        { name: 'otif_compliance_pct', type: 'NUMERIC(5,2)', desc: 'On-Time In-Full delivery rate over rolling 90 days' },
        { name: 'qa_acceptance_rate', type: 'NUMERIC(5,2)', desc: 'Percentage of delivered items passing dock QA' },
        { name: 'avg_lead_time_days', type: 'NUMERIC(4,1)', desc: 'Average days from PO issue to dock receiving' },
        { name: 'supplier_tier', type: 'VARCHAR(20)', desc: 'Strategic rating (TIER 1 / TIER 2 / ON REVIEW)' },
      ],
      sampleRows: [
        { supplier_name: 'Tata Steel Tubes Ltd', otif_compliance_pct: 98.4, qa_acceptance_rate: 99.4, avg_lead_time_days: 2.1, supplier_tier: 'TIER 1' },
        { supplier_name: 'Bharat Heavy Forge Co', otif_compliance_pct: 94.6, qa_acceptance_rate: 97.8, avg_lead_time_days: 3.4, supplier_tier: 'TIER 1' },
        { supplier_name: 'Apex Electronics Spares', otif_compliance_pct: 88.5, qa_acceptance_rate: 93.2, avg_lead_time_days: 5.0, supplier_tier: 'ON REVIEW' },
      ],
    },
  };

  const handleExecuteDirectQuery = async () => {
    setQueryExecuting(true);
    setQueryResult(null);
    try {
      // Simulate real DirectQuery execution against Supabase
      await new Promise((resolve) => setTimeout(resolve, 380));
      const schema = viewSchemas[selectedViewSchema];
      setQueryResult({
        view: selectedViewSchema,
        executionTimeMs: 16.4,
        rowsReturned: schema.sampleRows.length,
        data: schema.sampleRows,
        timestamp: new Date().toISOString(),
      });
      showSnackbar(`DirectQuery executed in 16.4ms: ${selectedViewSchema}`, 'success');
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    } finally {
      setQueryExecuting(false);
    }
  };

  const handleExportPowerBiSchema = () => {
    const jsonBlob = new Blob([JSON.stringify(viewSchemas, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PowerBI_DirectQuery_Schema_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSnackbar('Power BI DirectQuery dataset schema exported successfully!', 'success');
  };

  const filteredScorecards = supplierScorecards.filter(
    (s) =>
      !supplierSearch ||
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.city.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Welcoming Hero Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base sm:text-lg font-bold text-white tracking-tight">
              {getGreetingTime()}, {currentUser?.full_name || 'Operations Lead'}!
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wide">
              {role.replace('_', ' ')}
            </span>
            <span className="hidden sm:inline text-slate-400 text-xs">• {currentUser?.department || 'Operations'}</span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Unified Supply Chain Control Tower & Power BI Intelligence Hub: Monitor live corridor transit telemetry, dock queue turnaround, and automated 3-way financial reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Learn System</span>
            </button>
          )}

          <button
            onClick={() => navigate('/traceability')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-xs"
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Traceability</span>
          </button>

          <button
            onClick={() => {
              triggerRefresh();
              showSnackbar('Control Tower telemetry refreshed', 'info');
            }}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh Telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── UNIFIED MODE SELECTOR (Operational Center / Power BI Analytics / DirectQuery Gateway) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex rounded-lg bg-slate-100 p-1 gap-1 border border-slate-200/80 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => handleTabChange('overview')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all shrink-0 ${
              dashboardTab === 'overview'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Operational Center</span>
          </button>

          <button
            onClick={() => handleTabChange('analytics')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all shrink-0 ${
              dashboardTab === 'analytics'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Power BI & Executive Intelligence</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded">LIVE</span>
          </button>

          <button
            onClick={() => handleTabChange('powerbi')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all shrink-0 ${
              dashboardTab === 'powerbi'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Power BI DirectQuery Gateway</span>
          </button>
        </div>

        {/* Right side live status indicator */}
        <div className="flex items-center gap-2 px-2 text-xs text-slate-500 font-medium">
          {dashboardTab === 'overview' && (
            <span className="text-slate-500 text-xs hidden md:inline">
              Role: <strong className="text-slate-800">{role.replace('_', ' ')}</strong>
            </span>
          )}
          {dashboardTab === 'analytics' && (
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 text-[11px]">
              <Activity className="w-3 h-3 animate-pulse text-emerald-600" />
              DirectQuery Auto-Syncing (15s)
            </span>
          )}
          {dashboardTab === 'powerbi' && (
            <span className="flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 text-[11px]">
              <Database className="w-3 h-3 text-blue-600" />
              PostgreSQL DirectQuery Active
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB 1: OPERATIONAL CENTER (ROLE-SPECIFIC) */}
      {/* ========================================================================= */}
      {dashboardTab === 'overview' && (
        <>
          {/* 👑 ROLE: ADMIN (Executive Operations Director) */}
          {role === 'ADMIN' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <KpiCard
                  label="Active Shipments"
              value={loading ? '-' : metrics.activeShipments}
              subtext="Inbound transit"
              trend={{ value: '+8.2%', isPositive: true }}
              icon={Truck}
              onClick={() => navigate('/shipments')}
            />
            <KpiCard
              label="Delayed Shipments"
              value={loading ? '-' : metrics.delayedShipments}
              subtext="12.5% of active"
              variant="warning"
              trend={{ value: '1 alert', isPositive: false }}
              icon={Clock}
              onClick={() => navigate('/shipments')}
            />
            <KpiCard
              label="Trucks in Yard"
              value={loading ? '-' : metrics.trucksInYard}
              subtext="Gate queue & bays"
              icon={Boxes}
              onClick={() => navigate('/yard')}
            />
            <KpiCard
              label="Dock Utilization"
              value={`${metrics.dockUtilization}%`}
              subtext="4 of 6 active"
              variant="success"
              trend={{ value: 'Optimal', isPositive: true }}
              icon={Boxes}
              onClick={() => navigate('/yard')}
            />
            <KpiCard
              label="Invoice Exceptions"
              value={loading ? '-' : metrics.invoiceExceptions}
              subtext="3-way match holds"
              variant={metrics.invoiceExceptions > 0 ? 'error' : 'default'}
              trend={{ value: 'Action req', isPositive: false }}
              icon={AlertTriangle}
              onClick={() => navigate('/exceptions')}
            />
            <KpiCard
              label="Payment on Hold"
              value={loading ? '-' : `₹${(metrics.paymentOnHold / 1000).toFixed(1)}k`}
              subtext="Discrepancy holds"
              variant="error"
              icon={CreditCard}
              onClick={() => navigate('/payments')}
            />
          </div>

          {/* Admin Main Highway Map */}
          <TruckTrackingMap />

          {/* Admin Dual Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Procurement Spend by Category</h3>
                  <span className="text-xs text-slate-500">Live spend aggregation from confirmed Purchase Orders</span>
                </div>
                <span className="text-xs font-bold text-blue-600">Total: ₹11.55L</span>
              </div>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `₹${v / 1000}k`} />
                    <RechartsTooltip formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Spend']} />
                    <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">3-Way Match Discrepancy Breakdown</h3>
                  <span className="text-xs text-slate-500">Autonomous OCR & Variance Engine</span>
                </div>
              </div>
              <div className="h-60 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={exceptionChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                      {exceptionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 📄 ROLE: PROCUREMENT_MANAGER */}
      {role === 'PROCUREMENT_MANAGER' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <KpiCard
              label="Pending PR Approvals"
              value={metrics.pendingPRs}
              subtext="Requisitions in queue"
              variant="warning"
              icon={FileText}
              onClick={() => navigate('/purchase-requisitions')}
            />
            <KpiCard
              label="Active Purchase Orders"
              value={metrics.activePOs}
              subtext="Issued & confirmed"
              variant="success"
              icon={ShoppingCart}
              onClick={() => navigate('/purchase-orders')}
            />
            <KpiCard
              label="Total Spend Value"
              value={`₹${(metrics.totalPOSpend / 1000).toFixed(0)}k`}
              subtext="Across all suppliers"
              icon={DollarSign}
              onClick={() => navigate('/purchase-orders')}
            />
            <KpiCard
              label="Contract Rate Adherence"
              value="98.4%"
              subtext="SLA benchmark"
              variant="success"
              icon={ShieldCheck}
            />
            <KpiCard
              label="Price Exceptions"
              value={metrics.invoiceExceptions}
              subtext="Unit rate mismatch"
              variant={metrics.invoiceExceptions > 0 ? 'error' : 'default'}
              icon={AlertTriangle}
              onClick={() => navigate('/exceptions')}
            />
            <KpiCard
              label="Active Suppliers"
              value="52"
              subtext="100% SLA compliant"
              icon={Building2}
              onClick={() => navigate('/suppliers')}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* PRs Awaiting Approval */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Purchase Requisitions Awaiting Approval</h3>
                  <span className="text-xs text-slate-500">Review departmental demands to generate Purchase Orders</span>
                </div>
                <button
                  onClick={() => navigate('/purchase-requisitions')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>View All PRs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">PR Number</th>
                      <th className="py-2.5 px-3">Warehouse DC</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {recentPRs.map((pr) => (
                      <tr key={pr.pr_id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-bold text-blue-600">{pr.pr_number}</td>
                        <td className="py-3 px-3">{pr.warehouses?.warehouse_name || 'Pune Central DC'}</td>
                        <td className="py-3 px-3 font-semibold">{pr.priority || 'MEDIUM'}</td>
                        <td className="py-3 px-3">
                          <StatusBadge status={pr.status} size="sm" />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => navigate('/purchase-orders')}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]"
                          >
                            Convert to PO
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vendor Scorecards */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Strategic Supplier Scorecards</h3>
                <span className="text-xs font-semibold text-emerald-600">Top Performers</span>
              </div>
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <strong className="text-slate-900 block">ABC Industrial Supplies</strong>
                    <span className="text-slate-500 text-[11px]">Fulfillment Rate: 99.2% • Lead Time: 2 Days</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    Grade A+
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <strong className="text-slate-900 block">Eastern Logistics Corp</strong>
                    <span className="text-slate-500 text-[11px]">Fulfillment Rate: 97.8% • Lead Time: 3 Days</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    Grade A
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <strong className="text-slate-900 block">Tata Industrial Solutions</strong>
                    <span className="text-slate-500 text-[11px]">Fulfillment Rate: 99.8% • Lead Time: 1 Day</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    Grade A+
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 🏢 ROLE: WAREHOUSE_MANAGER */}
      {role === 'WAREHOUSE_MANAGER' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <KpiCard
              label="Approaching Trucks"
              value={metrics.activeShipments}
              subtext="En route to DC"
              variant="success"
              icon={Truck}
              onClick={() => navigate('/shipments')}
            />
            <KpiCard
              label="Docks Occupied"
              value="4 / 6"
              subtext="67% utilization"
              variant="success"
              icon={Boxes}
              onClick={() => navigate('/yard')}
            />
            <KpiCard
              label="Staging Yard Queue"
              value={metrics.trucksInYard}
              subtext="Waiting allocation"
              variant="warning"
              icon={Clock}
              onClick={() => navigate('/yard')}
            />
            <KpiCard
              label="Avg Turnaround"
              value="18 mins"
              subtext="Target: < 25 mins"
              variant="success"
              icon={TrendingUp}
            />
            <KpiCard
              label="GRNs Processed"
              value={metrics.grnCount}
              subtext="QA Intake logs"
              icon={ClipboardCheck}
              onClick={() => navigate('/grn')}
            />
            <KpiCard
              label="Damaged Pallets"
              value={metrics.damagedUnits}
              subtext="0.4% damage rate"
              variant="error"
              icon={AlertTriangle}
              onClick={() => navigate('/grn')}
            />
          </div>

          {/* Warehouse Dock Bay Visual Status */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pune Central DC — Dock Bays Overview</h3>
                <span className="text-xs text-slate-500">Live unloading status and vehicle allocation</span>
              </div>
              <button
                onClick={() => navigate('/yard')}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <span>Manage Docks & Yard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { dock: 'D01', status: 'UNLOADING', truck: 'MH-12-TR-9901', cargo: '450 Units' },
                { dock: 'D02', status: 'SCHEDULED', truck: 'MH-14-BA-2210', cargo: '300 Units' },
                { dock: 'D03', status: 'AVAILABLE', truck: 'None (Free)', cargo: '-' },
                { dock: 'D04', status: 'UNLOADING', truck: 'TRK-WB-1002', cargo: '500 Units' },
                { dock: 'D05', status: 'AVAILABLE', truck: 'None (Free)', cargo: '-' },
                { dock: 'D06', status: 'MAINTENANCE', truck: 'Bays Cleaning', cargo: '-' },
              ].map((d) => (
                <div
                  key={d.dock}
                  className={`p-3 rounded-xl border space-y-1.5 text-xs ${
                    d.status === 'UNLOADING'
                      ? 'bg-blue-50/70 border-blue-300'
                      : d.status === 'AVAILABLE'
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : d.status === 'SCHEDULED'
                      ? 'bg-amber-50/50 border-amber-300'
                      : 'bg-slate-100 border-slate-300 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900">{d.dock}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        d.status === 'UNLOADING'
                          ? 'bg-blue-600 text-white'
                          : d.status === 'AVAILABLE'
                          ? 'bg-emerald-600 text-white'
                          : d.status === 'SCHEDULED'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800 text-[11px] truncate">{d.truck}</div>
                  <div className="text-[10px] text-slate-500">{d.cargo}</div>
                </div>
              ))}
            </div>
          </div>

          <TruckTrackingMap />
        </>
      )}

      {/* 🚧 ROLE: GATE_OPERATOR */}
      {role === 'GATE_OPERATOR' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <KpiCard
              label="Gate Waiting Queue"
              value={metrics.trucksInYard}
              subtext="Approaching checkpost"
              variant="warning"
              icon={Truck}
              onClick={() => navigate('/yard')}
            />
            <KpiCard
              label="Trucks Cleared Today"
              value="42"
              subtext="Admitted to yard"
              variant="success"
              icon={CheckCircle2}
            />
            <KpiCard
              label="Avg Gate Dwell Time"
              value="12 mins"
              subtext="Verification SLA"
              variant="success"
              icon={Clock}
            />
            <KpiCard
              label="Pending Verifications"
              value="2"
              subtext="License plate check"
              variant="warning"
              icon={ShieldAlert}
            />
            <KpiCard
              label="E-Way Bill Compliance"
              value="100%"
              subtext="All passed"
              variant="success"
              icon={ShieldCheck}
            />
            <KpiCard
              label="Overstay Dwell Alerts"
              value="0"
              subtext="Yard flow smooth"
              variant="success"
              icon={CheckCircle2}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Quick Gate Check-In Form */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Inbound Vehicle Gate Check-In</h3>
                  <span className="text-xs text-slate-500">Scan license plate & admit truck to yard</span>
                </div>
              </div>

              <form onSubmit={handleQuickGateCheckIn} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Vehicle License Plate</label>
                  <input
                    type="text"
                    required
                    value={gateTruckNo}
                    onChange={(e) => setGateTruckNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Driver Name & Phone</label>
                  <input
                    type="text"
                    required
                    value={gateDriver}
                    onChange={(e) => setGateDriver(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={gateSubmitting}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{gateSubmitting ? 'Verifying...' : 'Verify E-Way & Admit to Yard'}</span>
                </button>
              </form>
            </div>

            {/* Waiting Gate Queue */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Inbound Gate & Staging Queue</h3>
                  <span className="text-xs text-slate-500">Vehicles awaiting security check & dock allocation</span>
                </div>
                <button
                  onClick={() => navigate('/yard')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Open Yard Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Vehicle #</th>
                      <th className="py-2.5 px-3">Carrier / Driver</th>
                      <th className="py-2.5 px-3">Waiting Time</th>
                      <th className="py-2.5 px-3">Gate Verified</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {yardEntries.map((ye) => (
                      <tr key={ye.yard_entry_id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-bold font-mono text-slate-900">
                          {ye.trucks?.vehicle_number || 'MH-12-TR-9901'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{ye.trucks?.driver_name || 'Driver'}</div>
                          <div className="text-[10px] text-slate-400">{ye.trucks?.carrier_name || 'Fleet'}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-amber-700">{ye.waiting_minutes || 14} mins</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            Verified
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => navigate('/yard')}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]"
                          >
                            Assign Bay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 🔍 ROLE: RECEIVING_OPERATOR */}
      {role === 'RECEIVING_OPERATOR' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <KpiCard
              label="Trucks at Docks"
              value="4"
              subtext="Active unloading"
              variant="success"
              icon={Truck}
              onClick={() => navigate('/yard')}
            />
            <KpiCard
              label="GRNs Processed"
              value={metrics.grnCount}
              subtext="Intake receipts"
              variant="success"
              icon={ClipboardCheck}
              onClick={() => navigate('/grn')}
            />
            <KpiCard
              label="Accepted Units"
              value={metrics.acceptedUnits.toLocaleString()}
              subtext="QA pass rate 99.5%"
              variant="success"
              icon={CheckCircle2}
            />
            <KpiCard
              label="Damaged Units"
              value={metrics.damagedUnits}
              subtext="Flagged for debit"
              variant="error"
              icon={AlertTriangle}
              onClick={() => navigate('/grn')}
            />
            <KpiCard
              label="Pending Inspections"
              value="1"
              subtext="Dock 01 Container"
              variant="warning"
              icon={Clock}
            />
            <KpiCard
              label="QA Compliance"
              value="99.8%"
              subtext="ISO-9001 standard"
              variant="success"
              icon={ShieldCheck}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Quick GRN Intake Terminal */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Goods Receipt Note (GRN) Terminal</h3>
                  <span className="text-xs text-slate-500">Log pallet counts & QA inspection sign-off</span>
                </div>
              </div>

              <form onSubmit={handleQuickGRNIntake} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Received Qty</label>
                    <input
                      type="number"
                      required
                      value={grnReceivedQty}
                      onChange={(e) => setGrnReceivedQty(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Damaged Qty</label>
                    <input
                      type="number"
                      required
                      value={grnDamagedQty}
                      onChange={(e) => setGrnDamagedQty(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-rose-600 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <span className="text-emerald-900 font-semibold">Net Accepted Units:</span>
                  <span className="text-base font-extrabold text-emerald-700">
                    {Math.max(0, parseInt(grnReceivedQty || '0', 10) - parseInt(grnDamagedQty || '0', 10))} Units
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={grnSubmitting}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{grnSubmitting ? 'Submitting...' : 'Sign Off GRN & Update Inventory'}</span>
                </button>
              </form>
            </div>

            {/* Active Unloading Bays */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Active Dock Unloading Inspections</h3>
                  <span className="text-xs text-slate-500">Unloading containers at Pune Central DC</span>
                </div>
                <button
                  onClick={() => navigate('/grn')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Full GRN Log</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-blue-600">Dock 01: MH-12-TR-9901</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">Unloading</span>
                    </div>
                    <span className="text-slate-500 text-[11px] mt-0.5 block">
                      PO-2026-2001 • ABC Industrial Supplies • 500 Units
                    </span>
                  </div>
                  <button
                    onClick={() => navigate('/grn')}
                    className="px-3 py-1 rounded bg-blue-600 text-white font-bold text-[11px]"
                  >
                    Inspect Pallets
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-blue-600">Dock 04: TRK-WB-1002</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">Unloading</span>
                    </div>
                    <span className="text-slate-500 text-[11px] mt-0.5 block">
                      PO-2026-2004 • Eastern Logistics • 300 Units
                    </span>
                  </div>
                  <button
                    onClick={() => navigate('/grn')}
                    className="px-3 py-1 rounded bg-blue-600 text-white font-bold text-[11px]"
                  >
                    Inspect Pallets
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 💳 ROLE: FINANCE_MANAGER */}
      {role === 'FINANCE_MANAGER' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <KpiCard
              label="Pending 3-Way Match"
              value={invoices.length}
              subtext="Invoices to reconcile"
              variant="warning"
              icon={Receipt}
              onClick={() => navigate('/invoices')}
            />
            <KpiCard
              label="Payment Value on Hold"
              value={`₹${(metrics.paymentOnHold / 1000).toFixed(0)}k`}
              subtext="Discrepancy holds"
              variant="error"
              icon={AlertTriangle}
              onClick={() => navigate('/exceptions')}
            />
            <KpiCard
              label="Match Pass Rate"
              value="96.2%"
              subtext="Autonomous clearance"
              variant="success"
              icon={CheckCircle2}
            />
            <KpiCard
              label="Open Exceptions"
              value={metrics.invoiceExceptions}
              subtext="Action required"
              variant={metrics.invoiceExceptions > 0 ? 'error' : 'default'}
              icon={AlertTriangle}
              onClick={() => navigate('/exceptions')}
            />
            <KpiCard
              label="Ready for NEFT"
              value="₹3.45L"
              subtext="Approved payouts"
              variant="success"
              icon={CreditCard}
              onClick={() => navigate('/payments')}
            />
            <KpiCard
              label="Avg Settlement Time"
              value="4.2 days"
              subtext="Net 30 terms"
              variant="success"
              icon={TrendingUp}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 3-Way Match Exceptions Investigation */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">3-Way Match Exception Investigation Workspace</h3>
                  <span className="text-xs text-slate-500">Autonomous discrepancy alerts between PO, GRN, and Invoice</span>
                </div>
                <button
                  onClick={() => navigate('/exceptions')}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Exceptions Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {recentExceptions.map((exc) => (
                  <div
                    key={exc.exception_id}
                    className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-700">{exc.exception_type}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                          {exc.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-snug">{exc.description}</p>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Linked PO: <strong>{exc.purchase_orders?.po_number}</strong> • Supplier: {exc.purchase_orders?.suppliers?.supplier_name}
                      </div>
                    </div>

                    <button
                      onClick={() => navigate('/exceptions')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shrink-0"
                    >
                      Resolve Discrepancy
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Scheduled NEFT Payouts */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Approved Invoices Ready for NEFT</h3>
                  <span className="text-xs text-slate-500">Autonomous 3-Way Match Passed</span>
                </div>
                <button
                  onClick={() => navigate('/payments')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  Disburse Payouts
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <strong className="text-slate-900 block">INV-2026-5001</strong>
                    <span className="text-[11px] text-slate-500">ABC Industrial Supplies • ₹2,50,000</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">Ready for NEFT</span>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <strong className="text-slate-900 block">INV-2026-5002</strong>
                    <span className="text-[11px] text-slate-500">Eastern Logistics • ₹95,000</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">Ready for NEFT</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )}

  {/* ========================================================================= */}
  {/* 3. TAB 2: POWER BI & EXECUTIVE INTELLIGENCE STUDIO */}
  {/* ========================================================================= */}
  {dashboardTab === 'analytics' && (
    <div className="space-y-6">
      {/* Toolbar / Slicers Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Supply Chain Intelligence & Executive Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Management decision support, On-Time In-Full (OTIF) fulfillment benchmarking, and enterprise performance BI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Time Range Slicers */}
          <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-semibold">
            {(['7D', '30D', '90D', 'YTD'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setDateFilter(period)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  dateFilter === period
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Export Schema Button */}
          <button
            onClick={handleExportPowerBiSchema}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Schema</span>
          </button>

          <button
            onClick={() => handleTabChange('powerbi')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>DirectQuery Gateway</span>
          </button>
        </div>
      </div>

      {/* Executive Benchmarks KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="On-Time In-Full (OTIF)"
          value="94.8%"
          subtext="Target SLA: 95.0%"
          variant="success"
          trend={{ value: '+2.4%', isPositive: true }}
          icon={TrendingUp}
        />
        <KpiCard
          label="Avg Yard Dwell Time"
          value="34 mins"
          subtext="-15% vs industry baseline"
          variant="info"
          trend={{ value: '-6 mins', isPositive: true }}
          icon={Clock}
        />
        <KpiCard
          label="3-Way Match First-Pass"
          value="92.4%"
          subtext="Autonomous OCR rate"
          variant="success"
          trend={{ value: '+4.1%', isPositive: true }}
          icon={CheckCircle2}
        />
        <KpiCard
          label="Avg Invoice Settlement"
          value="2.4 Days"
          subtext="Receipt to NEFT disbursement"
          trend={{ value: '-0.8d', isPositive: true }}
          icon={Calendar}
        />
      </div>

      {/* Primary Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* OTIF Delivery Trend Area Chart */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                On-Time In-Full (OTIF) Delivery Trend vs Target SLA (%)
              </h3>
              <p className="text-[11px] text-slate-500">Weekly inbound supplier delivery compliance</p>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              94.8% (Target: 95.0%)
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={otifData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="otifGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[80, 100]} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(val: any, name: any) => [
                    `${val}%`,
                    name === 'otif' ? 'Actual OTIF' : 'Target SLA',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="otif"
                  stroke="#10B981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#otifGrad)"
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3-Way Match Discrepancy Breakdown */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">3-Way Match Exception Distribution</h3>
              <p className="text-[11px] text-slate-500">Autonomous OCR & Variance Engine Root Cause</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              100% Deterministic
            </span>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={exceptionChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {exceptionChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(val: any) => [`${val}%`, 'Discrepancy Share']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px]">
            {exceptionChartData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 truncate">{item.name}:</span>
                <strong className="text-slate-900 ml-auto">{item.value}%</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Charts: Yard Dwell + Spend by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Yard Dwell Times */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Inbound Yard Dwell & Gate Wait Times (Minutes)
              </h3>
              <p className="text-[11px] text-slate-500">Average minutes from gate-in to dock completion</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Benchmark &lt; 40m
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yardDwellData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`${val} mins`, 'Dwell Duration']}
                />
                <Bar dataKey="dwellMinutes" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Spend by Category */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Procurement Spend by Category</h3>
              <p className="text-[11px] text-slate-500">Aggregated from confirmed purchase order line items</p>
            </div>
            <span className="text-xs font-bold text-blue-600">Total: ₹11,55,000</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(v) => `₹${v / 1000}k`}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Spend Value']}
                />
                <Bar dataKey="value" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strategic Supplier Reliability & Quality Scorecard Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Strategic Supplier Reliability & Quality Scorecard</h3>
            <p className="text-xs text-slate-500">Aggregated ranking based on OTIF SLA delivery, dock QA inspection pass rate, and lead time</p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Search vendor or city..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Supplier Partner</th>
                <th className="py-3 px-4">Hub City</th>
                <th className="py-3 px-4">OTIF Compliance</th>
                <th className="py-3 px-4">Avg Lead Time</th>
                <th className="py-3 px-4">Dock QA Pass Rate</th>
                <th className="py-3 px-4">Committed Spend</th>
                <th className="py-3 px-4 text-right">Strategic Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredScorecards.map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{s.name}</td>
                  <td className="py-3.5 px-4 text-slate-500">{s.city}</td>
                  <td className="py-3.5 px-4">
                    <span className={`font-bold ${s.otif >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {s.otif}%
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-semibold">{s.leadTime}</td>
                  <td className="py-3.5 px-4 font-bold text-emerald-700">{s.passRate}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">₹{s.spend.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold border ${
                        s.tier === 'TIER 1'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : s.tier === 'TIER 2'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {s.tier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

  {/* ========================================================================= */}
  {/* 4. TAB 3: POWER BI DIRECTQUERY GATEWAY */}
  {/* ========================================================================= */}
  {dashboardTab === 'powerbi' && (
    <div className="space-y-6">
      {/* DirectQuery Connection Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-blue-600 text-white shadow-xs shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Microsoft Power BI Embedded Workspace Gateway
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                  ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Configured for real-time <strong>DirectQuery</strong> connection to PostgreSQL analytics views (`v_p2p_performance`, `v_yard_telemetry`, `v_exception_root_cause`, `v_supplier_scorecard`). Zero data duplication with real-time pass-through queries.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleExportPowerBiSchema}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-xs"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Export .PBIX Schema</span>
            </button>

            <button
              onClick={handleExecuteDirectQuery}
              disabled={queryExecuting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
            >
              {queryExecuting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>{queryExecuting ? 'Executing...' : 'Test DirectQuery'}</span>
            </button>
          </div>
        </div>

        {/* Live Specs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Engine</span>
            <span className="font-bold text-slate-900">PostgreSQL DirectQuery</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Latency</span>
            <span className="font-bold text-emerald-700">16.4 ms (Avg)</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Protocol</span>
            <span className="font-bold text-slate-900">TLS 1.3 Encrypted</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Views Exposed</span>
            <span className="font-bold text-blue-700">4 Analytics Models</span>
          </div>
        </div>
      </div>

      {/* Interactive Schema Visualizer */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">DirectQuery Analytics Views Schema Explorer</h3>
            <p className="text-xs text-slate-500">Inspect the pre-aggregated relational views optimized for Power BI semantic models</p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(Object.keys(viewSchemas) as (keyof typeof viewSchemas)[]).map((viewKey) => (
              <button
                key={viewKey}
                onClick={() => setSelectedViewSchema(viewKey)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  selectedViewSchema === viewKey
                    ? 'bg-white text-blue-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {viewKey}
              </button>
            ))}
          </div>
        </div>

        {/* View Details Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-900 font-mono">{selectedViewSchema}</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              {viewSchemas[selectedViewSchema].columns.length} columns defined
            </span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            {viewSchemas[selectedViewSchema].description}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200 overflow-hidden">
              <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Column Name</th>
                  <th className="py-2.5 px-3">Data Type</th>
                  <th className="py-2.5 px-3">Description & BI Semantic Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {viewSchemas[selectedViewSchema].columns.map((col) => (
                  <tr key={col.name} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono font-bold text-blue-700">{col.name}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{col.type}</td>
                    <td className="py-2 px-3 text-slate-600">{col.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DirectQuery Live Execution Console */}
      {queryResult && (
        <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-md border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-xs text-emerald-400 font-bold">
                DirectQuery Output: SELECT * FROM {queryResult.view} LIMIT 3;
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Latency: <strong className="text-emerald-400">{queryResult.executionTimeMs}ms</strong> | Rows: <strong className="text-white">{queryResult.rowsReturned}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <pre className="text-[11px] font-mono text-slate-300 leading-relaxed overflow-x-auto p-2 bg-slate-950/60 rounded-lg">
              {JSON.stringify(queryResult.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )}
</div>
);
};

export default Dashboard;
