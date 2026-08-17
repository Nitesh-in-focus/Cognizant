import React, { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import {
  FileText,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  Filter,
  RefreshCw,
  Search,
  ArrowUpDown,
  Calendar,
  Building2,
  Package,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Radio,
  CheckCircle2,
  Clock,
  ExternalLink,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  fetchProcurementAnalytics,
  ProcurementDashboardData,
  AnalyticsFilterOptions,
  SEMANTIC_COLORS,
} from '../../services/analyticsService';

export const ProcurementIntelligenceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProcurementDashboardData | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Slicer State
  const [filters, setFilters] = useState<AnalyticsFilterOptions>({
    dateRange: 'all',
    prStatus: 'ALL',
    poStatus: 'ALL',
    exceptionType: 'ALL',
    exceptionSeverity: 'ALL',
    exceptionStatus: 'ALL',
    warehouseId: 'ALL',
    supplierId: 'ALL',
  });

  const [showFilters, setShowFilters] = useState(false);

  // Table Search & Pagination State
  const [tableSearch, setTableSearch] = useState('');
  const [tableSortField, setTableSortField] = useState<string>('created_at');
  const [tableSortAsc, setTableSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const loadData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setIsRefreshing(true);

      try {
        const result = await fetchProcurementAnalytics(filters);
        setData(result);
      } catch (err) {
        console.error('Error fetching procurement analytics:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime Supabase Subscriptions (Sections 16 & 17 of spec)
  useEffect(() => {
    const channel = supabase
      .channel('procurement_intelligence_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_requisitions' },
        () => loadData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders' },
        () => loadData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exceptions' },
        () => loadData(true)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // Slicer & Cross-Filter Toggle Handler (Part 8, 9, 10)
  const handleToggleFilter = (key: keyof AnalyticsFilterOptions, value: string) => {
    setFilters((prev) => {
      const current = prev[key];
      const isSame = current === value || (current === 'ALL' && value === 'ALL');
      return {
        ...prev,
        [key]: isSame ? 'ALL' : value,
      };
    });
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({
      dateRange: 'all',
      prStatus: 'ALL',
      poStatus: 'ALL',
      exceptionType: 'ALL',
      exceptionSeverity: 'ALL',
      exceptionStatus: 'ALL',
      warehouseId: 'ALL',
      supplierId: 'ALL',
    });
    setCurrentPage(1);
  };

  // Active filters list for chips
  const activeFilterChips: { key: keyof AnalyticsFilterOptions; label: string; value: string }[] = [];
  if (filters.dateRange && filters.dateRange !== 'all') {
    activeFilterChips.push({
      key: 'dateRange',
      label: 'Date',
      value: filters.dateRange === '7d' ? 'Last 7 Days' : filters.dateRange === '30d' ? 'Last 30 Days' : filters.dateRange === '90d' ? 'Last 90 Days' : 'Year to Date',
    });
  }
  if (filters.prStatus && filters.prStatus !== 'ALL') {
    activeFilterChips.push({ key: 'prStatus', label: 'PR Status', value: filters.prStatus });
  }
  if (filters.poStatus && filters.poStatus !== 'ALL') {
    activeFilterChips.push({ key: 'poStatus', label: 'PO Status', value: filters.poStatus });
  }
  if (filters.exceptionSeverity && filters.exceptionSeverity !== 'ALL') {
    activeFilterChips.push({ key: 'exceptionSeverity', label: 'Severity', value: filters.exceptionSeverity });
  }
  if (filters.exceptionType && filters.exceptionType !== 'ALL') {
    activeFilterChips.push({ key: 'exceptionType', label: 'Type', value: filters.exceptionType.replace(/_/g, ' ') });
  }
  if (filters.exceptionStatus && filters.exceptionStatus !== 'ALL') {
    activeFilterChips.push({ key: 'exceptionStatus', label: 'Status', value: filters.exceptionStatus });
  }
  if (filters.warehouseId && filters.warehouseId !== 'ALL') {
    const w = data?.warehouses.find((item) => item.warehouse_id === filters.warehouseId);
    activeFilterChips.push({ key: 'warehouseId', label: 'Warehouse', value: w?.warehouse_name || 'Warehouse' });
  }
  if (filters.supplierId && filters.supplierId !== 'ALL') {
    const s = data?.suppliers.find((item) => item.supplier_id === filters.supplierId);
    activeFilterChips.push({ key: 'supplierId', label: 'Supplier', value: s?.supplier_name || 'Supplier' });
  }

  // Filter & Sort Table Records
  const filteredExceptions = (data?.exceptionsTable || []).filter((exc) => {
    if (!tableSearch) return true;
    const query = tableSearch.toLowerCase();
    return (
      exc.exception_number?.toLowerCase().includes(query) ||
      exc.exception_type?.toLowerCase().includes(query) ||
      exc.description?.toLowerCase().includes(query) ||
      exc.purchase_orders?.po_number?.toLowerCase().includes(query) ||
      exc.purchase_orders?.suppliers?.supplier_name?.toLowerCase().includes(query)
    );
  });

  const sortedExceptions = [...filteredExceptions].sort((a, b) => {
    let valA = a[tableSortField];
    let valB = b[tableSortField];

    if (tableSortField === 'po_number') {
      valA = a.purchase_orders?.po_number || '';
      valB = b.purchase_orders?.po_number || '';
    }

    if (valA === valB) return 0;
    if (valA == null) return 1;
    if (valB == null) return -1;

    const res = valA < valB ? -1 : 1;
    return tableSortAsc ? res : -res;
  });

  const totalPages = Math.max(1, Math.ceil(sortedExceptions.length / pageSize));
  const paginatedExceptions = sortedExceptions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const toggleSort = (field: string) => {
    if (tableSortField === field) {
      setTableSortAsc(!tableSortAsc);
    } else {
      setTableSortField(field);
      setTableSortAsc(true);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-bold';
      case 'HIGH':
        return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200 font-medium';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
      case 'WAIVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'INVESTIGATING':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'OPEN':
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 bg-slate-200 rounded-2xl w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 bg-slate-200 rounded-2xl lg:col-span-2" />
          <div className="h-80 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalPrs: 0,
    totalPos: 0,
    totalProcurementValue: 0,
    openExceptions: 0,
    totalExceptions: 0,
    exceptionValue: 0,
    prApprovalRate: 0,
    averagePoCycleDays: 0,
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Dashboard Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Procurement Intelligence Dashboard
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                LIVE DATABASE
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time overview of procurement operations, spend commitments, and exception management.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    realtimeConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    realtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <span className="font-bold text-[11px] text-slate-700">
                {realtimeConnected ? '● Live' : 'Reconnecting...'}
              </span>
              <span className="text-slate-400 text-[10px] hidden xs:inline">
                {isRefreshing ? 'Updating...' : `Updated ${data?.lastUpdated || 'just now'}`}
              </span>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                showFilters
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Slicers</span>
              {activeFilterChips.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[9px] font-black">
                  {activeFilterChips.length}
                </span>
              )}
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Refresh live data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Active Filter Chips Strip (Part 13 & 14) ── */}
        {activeFilterChips.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">Active Slicers:</span>
            {activeFilterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold"
              >
                <span>{chip.label}: <strong className="text-blue-900">{chip.value}</strong></span>
                <button
                  onClick={() => handleToggleFilter(chip.key, 'ALL')}
                  className="p-0.5 hover:bg-blue-200/60 rounded text-blue-600 cursor-pointer"
                  title="Remove filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={handleResetFilters}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer ml-1"
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* ── Filter Drawer (Section 9 & 11) ── */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-xs">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Date Range
              </label>
              <select
                value={filters.dateRange || 'all'}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium"
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="ytd">Year to Date</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                PR Status
              </label>
              <select
                value={filters.prStatus || 'ALL'}
                onChange={(e) => setFilters({ ...filters, prStatus: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium"
              >
                <option value="ALL">All PR Status</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING_APPROVAL">Pending</option>
                <option value="CONVERTED">Converted to PO</option>
                <option value="REJECTED">Rejected</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                PO Status
              </label>
              <select
                value={filters.poStatus || 'ALL'}
                onChange={(e) => setFilters({ ...filters, poStatus: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium"
              >
                <option value="ALL">All PO Status</option>
                <option value="APPROVED">Approved</option>
                <option value="ACCEPTED_BY_SUPPLIER">Accepted</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="RECEIVED">Received</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Exception Type
              </label>
              <select
                value={filters.exceptionType || 'ALL'}
                onChange={(e) => setFilters({ ...filters, exceptionType: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium"
              >
                <option value="ALL">All Exception Types</option>
                <option value="PRICE_MISMATCH">Price Mismatch</option>
                <option value="QUANTITY_MISMATCH">Quantity Mismatch</option>
                <option value="DAMAGED_GOODS">Damaged Goods</option>
                <option value="TRANSIT_DELAY">Transit Delay</option>
                <option value="OCR_FAILURE">OCR Failure</option>
                <option value="UNAUTHORIZED_INVOICE">Unauthorized</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Severity
              </label>
              <select
                value={filters.exceptionSeverity || 'ALL'}
                onChange={(e) => setFilters({ ...filters, exceptionSeverity: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Exception Status
              </label>
              <select
                value={filters.exceptionStatus || 'ALL'}
                onChange={(e) => setFilters({ ...filters, exceptionStatus: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium"
              >
                <option value="ALL">All Status</option>
                <option value="OPEN">Open</option>
                <option value="INVESTIGATING">Investigating</option>
                <option value="RESOLVED">Resolved</option>
                <option value="WAIVED">Waived</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Warehouse
              </label>
              <select
                value={filters.warehouseId || 'ALL'}
                onChange={(e) => setFilters({ ...filters, warehouseId: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium"
              >
                <option value="ALL">All Warehouses</option>
                {data?.warehouses.map((w) => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>
                    {w.warehouse_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleResetFilters}
                className="w-full py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Reset Slicers
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 6 Dynamic KPI Cards (Responsive grid: 6 on desktop, 3x2 on tablet, 2x3 on mobile) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* KPI 1: Total PRs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Total PRs
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{kpis.totalPrs}</div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 truncate">
            <span>{kpis.prApprovalRate}% Approval Rate</span>
          </div>
        </div>

        {/* KPI 2: Total POs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Total POs
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{kpis.totalPos}</div>
          <div className="mt-1 text-[10px] font-medium text-slate-500 truncate">
            Active purchase orders
          </div>
        </div>

        {/* KPI 3: Total Procurement Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Procurement Spend
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 truncate">
            ₹{Number(kpis.totalProcurementValue || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[10px] font-medium text-slate-500 truncate">
            Total Contract Spend
          </div>
        </div>

        {/* KPI 4: Open Exceptions */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Open Exceptions
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600">{kpis.openExceptions}</div>
          <div className="mt-1 text-[10px] font-bold text-rose-700 truncate">
            Action required
          </div>
        </div>

        {/* KPI 5: Total Exceptions */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Total Exceptions
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{kpis.totalExceptions}</div>
          <div className="mt-1 text-[10px] font-medium text-slate-500 truncate">
            Recorded in database
          </div>
        </div>

        {/* KPI 6: Exception Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              Exception Value
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl font-black text-purple-950 truncate">
            ₹{Number(kpis.exceptionValue || 0).toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-[10px] font-medium text-slate-500 truncate">
            Open variance risk
          </div>
        </div>
      </div>

      {/* ── Interactive Power BI Style Charts (Part 8, 10) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Procurement Trend (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Procurement Spend & Requisition Timeline
              </h2>
              <p className="text-xs text-slate-500">
                Real-time purchase order value and requisition volume over time.
              </p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {data?.procurementTrendChart && data.procurementTrendChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.procurementTrendChart}>
                  <defs>
                    <linearGradient id="poSpendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SEMANTIC_COLORS.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={SEMANTIC_COLORS.blue} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={11}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      name === 'amount' ? `₹${Number(val).toLocaleString('en-IN')}` : val,
                      name === 'amount' ? 'PO Spend' : name === 'prs' ? 'PR Count' : 'PO Count',
                    ]}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    name="PO Spend"
                    stroke={SEMANTIC_COLORS.blue}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#poSpendGrad)"
                  />
                  <Bar dataKey="prs" name="PR Count" fill={SEMANTIC_COLORS.amber} radius={[4, 4, 0, 0]} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No procurement timeline data available for selected filters.
              </div>
            )}
          </div>
        </div>

        {/* PR Status Donut Chart with Interactive Cross-Filtering */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">PR Status Slicer</h2>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                Click to filter
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Click any slice to cross-filter dashboard.</p>
          </div>

          <div className="h-52 w-full">
            {data?.prStatusChart && data.prStatusChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.prStatusChart}
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    onClick={(entry: any) => {
                      const raw = String(entry?.name || '').replace(/ /g, '_');
                      if (raw) handleToggleFilter('prStatus', raw);
                    }}
                    cursor="pointer"
                  >
                    {data.prStatusChart.map((entry, idx) => {
                      const isSelected = filters.prStatus === entry.name.replace(/ /g, '_');
                      return (
                        <Cell
                          key={`cell-${idx}`}
                          fill={entry.color || SEMANTIC_COLORS.blue}
                          stroke={isSelected ? '#0F172A' : '#fff'}
                          strokeWidth={isSelected ? 3 : 1}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(v: any) => [`${v} Requisitions`, 'Count']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No PR records found.
              </div>
            )}
          </div>

          {/* Interactive Legend with click handlers */}
          <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-slate-100 text-xs">
            {data?.prStatusChart.map((item) => {
              const raw = item.name.replace(/ /g, '_');
              const isSelected = filters.prStatus === raw;
              return (
                <button
                  key={item.name}
                  onClick={() => handleToggleFilter('prStatus', raw)}
                  className={`flex items-center gap-1.5 p-1 rounded-md text-left transition-all cursor-pointer ${
                    isSelected ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600 truncate text-[11px]">{item.name}</span>
                  <span className="font-bold text-slate-900 ml-auto">{item.value}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 2 Charts: Exceptions Cross-Filters & Impact ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chart 1: Exceptions by Severity with Click Cross-Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Severity Cross-Filter</h2>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                Click to filter
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Click a severity to cross-filter records.</p>
          </div>

          <div className="h-48 w-full">
            {data?.exceptionsBySeverityChart && data.exceptionsBySeverityChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.exceptionsBySeverityChart}
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={(entry: any) => {
                      if (entry?.name) handleToggleFilter('exceptionSeverity', String(entry.name));
                    }}
                    cursor="pointer"
                  >
                    {data.exceptionsBySeverityChart.map((entry, idx) => {
                      const isSelected = filters.exceptionSeverity === entry.name;
                      return (
                        <Cell
                          key={`cell-${idx}`}
                          fill={entry.color}
                          stroke={isSelected ? '#0F172A' : '#fff'}
                          strokeWidth={isSelected ? 3 : 1}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No exceptions in database.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-slate-100 text-xs">
            {data?.exceptionsBySeverityChart.map((item) => {
              const isSelected = filters.exceptionSeverity === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => handleToggleFilter('exceptionSeverity', item.name)}
                  className={`flex items-center gap-1.5 p-1 rounded-md text-left transition-all cursor-pointer ${
                    isSelected ? 'bg-amber-100 text-amber-900 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600 text-[11px]">{item.name}</span>
                  <span className="font-bold text-slate-900 ml-auto">{item.value}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Exceptions by Type (Horizontal Bar) with Click Cross-Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Exceptions by Category</h2>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                Click bar
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Click a bar to filter exception table.</p>
          </div>

          <div className="h-60 w-full">
            {data?.exceptionsByTypeChart && data.exceptionsByTypeChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.exceptionsByTypeChart}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 0, bottom: 0 }}
                  onClick={(state: any) => {
                    if (state && state.activePayload && state.activePayload.length > 0) {
                      const payloadName = state.activePayload[0]?.payload?.name;
                      if (payloadName) {
                        const raw = String(payloadName).replace(/ /g, '_');
                        handleToggleFilter('exceptionType', raw);
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" stroke="#94A3B8" fontSize={10} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#475569"
                    fontSize={10}
                    width={110}
                    tickFormatter={(v) => (v.length > 15 ? `${v.slice(0, 14)}…` : v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill={SEMANTIC_COLORS.indigo}
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No exceptions logged.
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: Exception Financial Impact */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h2 className="text-sm font-bold text-slate-900">Financial Variance Impact</h2>
            <p className="text-xs text-slate-500 mt-0.5">Monetary discrepancy by issue type.</p>
          </div>

          <div className="h-60 w-full">
            {data?.exceptionFinancialImpactChart && data.exceptionFinancialImpactChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.exceptionFinancialImpactChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickFormatter={(v) => (v.length > 10 ? `${v.slice(0, 8)}…` : v)}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Variance Amount']}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="difference" fill={SEMANTIC_COLORS.rose} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No financial variance logged.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Detailed Exception Records Table with Responsive Horizontal Scroll (Section 8 & 21) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Active Procurement Exception Records
            </h2>
            <p className="text-xs text-slate-500">
              Live exceptions and discrepancy logs directly from database.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search exceptions, PO#, supplier..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Table Content with Responsive Horizontal Scroll */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                <th
                  onClick={() => toggleSort('exception_number')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Exception #</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('exception_type')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Type</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('po_number')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>PO Reference</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('severity')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Severity</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Variance Impact</th>
                <th
                  onClick={() => toggleSort('status')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('created_at')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Logged Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedExceptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    No data available for the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedExceptions.map((exc) => (
                  <tr key={exc.exception_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                      {exc.exception_number}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {(exc.exception_type || 'GENERAL').replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate block max-w-xs">
                        {exc.description}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono text-slate-900 font-bold block">
                        {exc.purchase_orders?.po_number || (exc.po_id ? `PO-${String(exc.po_id).slice(0, 6)}` : '—')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {exc.purchase_orders?.suppliers?.supplier_name || 'Vendor'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${getSeverityBadge(
                          exc.severity
                        )}`}
                      >
                        {exc.severity || 'MEDIUM'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                      {exc.difference ? `₹${Number(exc.difference).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                          exc.status
                        )}`}
                      >
                        {exc.status || 'OPEN'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(exc.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing{' '}
            <strong className="text-slate-800">
              {sortedExceptions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-800">
              {Math.min(currentPage * pageSize, sortedExceptions.length)}
            </strong>{' '}
            of <strong className="text-slate-800">{sortedExceptions.length}</strong> records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
