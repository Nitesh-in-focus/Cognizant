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
} from 'recharts';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  RefreshCw,
  Plus,
  X,
  SlidersHorizontal,
  AlertTriangle,
  CalendarDays,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import {
  fetchWorkerAnalytics,
  WorkerDashboardData,
  SEMANTIC_COLORS,
} from '../../services/analyticsService';

// ─── Slicer state ────────────────────────────────────────────────────────────
interface WorkerFilters {
  dateRange: 'all' | '7d' | '30d' | '90d';
  prStatus: string; // 'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CONVERTED' | 'DRAFT'
}

const DEFAULT_FILTERS: WorkerFilters = { dateRange: 'all', prStatus: 'ALL' };

// ─── Priority badge helper ────────────────────────────────────────────────────
function priorityBadge(p: string) {
  switch (p) {
    case 'URGENT':  return 'bg-rose-50 text-rose-700 border-rose-200 font-black';
    case 'HIGH':    return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    case 'MEDIUM':  return 'bg-blue-50 text-blue-700 border-blue-200';
    default:        return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

// ─── Status badge helper ──────────────────────────────────────────────────────
function statusBadge(s: string) {
  switch (s) {
    case 'APPROVED':
    case 'CONVERTED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'PENDING_APPROVAL':
    case 'PENDING':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export const WorkerIntelligenceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WorkerDashboardData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Slicer state (filters applied server-side via DB query)
  const [filters, setFilters] = useState<WorkerFilters>(DEFAULT_FILTERS);

  // Table search + pagination (client-side over the fetched page)
  const [tableSearch, setTableSearch] = useState('');
  const [tableSortField, setTableSortField] = useState<string>('created_at');
  const [tableSortAsc, setTableSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setIsRefreshing(true);

      try {
        // CRITICAL FIX: pass worker's full_name, NOT user_id
        // created_by_worker in DB stores full_name (e.g. "Ramesh Patil")
        const workerName = currentUser?.full_name || undefined;

        const result = await fetchWorkerAnalytics(
          workerName,
          filters.dateRange,
          filters.prStatus
        );
        setData(result);
      } catch (err) {
        console.error('[WorkerDashboard] load error:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUser, filters]
  );

  useEffect(() => {
    setPage(1); // reset to page 1 whenever filters change
    loadData();
  }, [loadData]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('worker_dashboard_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_requisitions' },
        () => loadData(true)
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // ── Slicer helpers ─────────────────────────────────────────────────────────
  const setStatusSlicer = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      prStatus: prev.prStatus === status ? 'ALL' : status,
    }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  // Collect active filter chips
  const activeChips: { key: keyof WorkerFilters; label: string; value: string }[] = [];
  if (filters.dateRange !== 'all') {
    const labels: Record<string, string> = {
      '7d': 'Last 7 Days', '30d': 'Last 30 Days', '90d': 'Last 90 Days',
    };
    activeChips.push({ key: 'dateRange', label: 'Date', value: labels[filters.dateRange] ?? filters.dateRange });
  }
  if (filters.prStatus !== 'ALL') {
    activeChips.push({ key: 'prStatus', label: 'Status', value: filters.prStatus.replace(/_/g, ' ') });
  }

  // ── Table search + sort + paginate ─────────────────────────────────────────
  const allPrs = data?.myRecentPrs || [];

  const searched = allPrs.filter((pr) => {
    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    return (
      pr.pr_number?.toLowerCase().includes(q) ||
      pr.reason?.toLowerCase().includes(q) ||
      pr.status?.toLowerCase().includes(q) ||
      pr.priority?.toLowerCase().includes(q)
    );
  });

  const sorted = [...searched].sort((a, b) => {
    const va = a[tableSortField] ?? '';
    const vb = b[tableSortField] ?? '';
    if (va === vb) return 0;
    const r = va < vb ? -1 : 1;
    return tableSortAsc ? r : -r;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (field: string) => {
    if (tableSortField === field) setTableSortAsc(!tableSortAsc);
    else { setTableSortField(field); setTableSortAsc(true); }
  };

  const kpis = data?.kpis ?? {
    myTotalPrs: 0, pendingPrs: 0, approvedPrs: 0, rejectedPrs: 0,
    totalRequestedItems: 0, draftPrs: 0,
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-72 bg-slate-200 rounded-2xl" />
          <div className="h-72 bg-slate-200 rounded-2xl" />
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">

      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                My Material Requisitions
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                WORKER WORKSPACE
              </span>
              {/* Who we're loading for */}
              {currentUser?.full_name && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {currentUser.full_name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Real-time view of your purchase requisitions, approval status, and requested materials from the live database.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${realtimeConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${realtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </span>
              <span className="font-bold text-slate-700 text-[11px]">{realtimeConnected ? '● Live' : 'Reconnecting...'}</span>
              <span className="text-slate-400 text-[10px] hidden xs:inline">
                {isRefreshing ? 'Updating...' : `Updated ${data?.lastUpdated || 'just now'}`}
              </span>
            </div>

            {/* Slicer toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                showFilters ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Slicers</span>
              {activeChips.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[9px] font-black">
                  {activeChips.length}
                </span>
              )}
            </button>

            {/* Refresh */}
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Create PR */}
            <button
              onClick={() => navigate('/purchase-requisitions')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New PR</span>
            </button>
          </div>
        </div>

        {/* ── Active filter chips ── */}
        {activeChips.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">Active Slicers:</span>
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold"
              >
                {chip.label}: <strong className="text-blue-900">{chip.value}</strong>
                <button
                  onClick={() => setFilters((prev) => ({ ...prev, [chip.key]: chip.key === 'dateRange' ? 'all' : 'ALL' }))}
                  className="p-0.5 hover:bg-blue-200/60 rounded text-blue-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={resetFilters}
              className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer ml-1"
            >
              Clear All
            </button>
          </div>
        )}

        {/* ── Slicer drawer ── */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Date Range */}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Date Range
              </label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateRange: e.target.value as any }))}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium"
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>

            {/* PR Status */}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                PR Status
              </label>
              <select
                value={filters.prStatus}
                onChange={(e) => setFilters((prev) => ({ ...prev, prStatus: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="CONVERTED">Converted to PO</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Reset Slicers
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Cards — 6 cols ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total PRs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Total PRs</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <strong className="text-2xl font-black text-slate-900 mt-1 block">{kpis.myTotalPrs}</strong>
          <span className="text-[10px] text-slate-500 mt-1 block truncate">My requisitions</span>
        </div>

        {/* Pending */}
        <button
          onClick={() => setStatusSlicer('PENDING_APPROVAL')}
          className={`bg-white p-4 rounded-2xl border shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between text-left cursor-pointer ${
            filters.prStatus === 'PENDING_APPROVAL' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Pending</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <strong className="text-2xl font-black text-amber-600 mt-1 block">{kpis.pendingPrs}</strong>
          <span className="text-[10px] text-amber-700 font-semibold mt-1 block truncate">
            {filters.prStatus === 'PENDING_APPROVAL' ? '● Filtering ×' : 'Click to filter'}
          </span>
        </button>

        {/* Approved */}
        <button
          onClick={() => setStatusSlicer('APPROVED')}
          className={`bg-white p-4 rounded-2xl border shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between text-left cursor-pointer ${
            filters.prStatus === 'APPROVED' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Approved</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <strong className="text-2xl font-black text-emerald-600 mt-1 block">{kpis.approvedPrs}</strong>
          <span className="text-[10px] text-emerald-700 font-semibold mt-1 block truncate">
            {filters.prStatus === 'APPROVED' ? '● Filtering ×' : 'Click to filter'}
          </span>
        </button>

        {/* Rejected */}
        <button
          onClick={() => setStatusSlicer('REJECTED')}
          className={`bg-white p-4 rounded-2xl border shadow-xs hover:border-rose-300 transition-all flex flex-col justify-between text-left cursor-pointer ${
            filters.prStatus === 'REJECTED' ? 'border-rose-400 ring-2 ring-rose-200' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Rejected</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <strong className="text-2xl font-black text-rose-600 mt-1 block">{kpis.rejectedPrs}</strong>
          <span className="text-[10px] text-rose-700 font-semibold mt-1 block truncate">
            {filters.prStatus === 'REJECTED' ? '● Filtering ×' : 'Click to filter'}
          </span>
        </button>

        {/* Draft */}
        <button
          onClick={() => setStatusSlicer('DRAFT')}
          className={`bg-white p-4 rounded-2xl border shadow-xs hover:border-slate-400 transition-all flex flex-col justify-between text-left cursor-pointer ${
            filters.prStatus === 'DRAFT' ? 'border-slate-500 ring-2 ring-slate-200' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Draft</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <strong className="text-2xl font-black text-slate-600 mt-1 block">{kpis.draftPrs}</strong>
          <span className="text-[10px] text-slate-500 mt-1 block truncate">
            {filters.prStatus === 'DRAFT' ? '● Filtering ×' : 'Click to filter'}
          </span>
        </button>

        {/* Items Requested */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">Items Requested</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <strong className="text-2xl font-black text-indigo-700 mt-1 block">{kpis.totalRequestedItems.toLocaleString()}</strong>
          <span className="text-[10px] text-slate-500 mt-1 block truncate">Total units</span>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* PR Status Donut with click cross-filter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">PR Status Slicer</h2>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                Click to filter
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Your PRs from the database — click slice to cross-filter table.</p>
          </div>

          <div className="h-48 w-full">
            {(data?.myPrStatusChart || []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data!.myPrStatusChart}
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                    onClick={(entry: any) => {
                      const raw = String(entry?.name || '').replace(/ /g, '_');
                      if (raw) setStatusSlicer(raw);
                    }}
                    cursor="pointer"
                  >
                    {data!.myPrStatusChart.map((entry, idx) => {
                      const raw = entry.name.replace(/ /g, '_');
                      const isSelected = filters.prStatus === raw;
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
                    formatter={(v: any) => [`${v} PRs`, 'Count']}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '10px', color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                <FileText className="w-8 h-8 opacity-30" />
                <span>No PR data for your account yet.</span>
                <button
                  onClick={() => navigate('/purchase-requisitions')}
                  className="text-blue-600 font-bold underline text-xs"
                >
                  Create your first PR →
                </button>
              </div>
            )}
          </div>

          {/* Interactive legend */}
          {(data?.myPrStatusChart || []).length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-slate-100 text-xs">
              {data!.myPrStatusChart.map((item) => {
                const raw = item.name.replace(/ /g, '_');
                const isSelected = filters.prStatus === raw;
                return (
                  <button
                    key={item.name}
                    onClick={() => setStatusSlicer(raw)}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg text-left transition-all cursor-pointer ${
                      isSelected ? 'bg-blue-100 text-blue-900 font-bold ring-1 ring-blue-300' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 truncate text-[11px]">{item.name}</span>
                    <span className="font-bold text-slate-900 ml-auto">{item.value}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Timeline Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Requisition Activity Timeline
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Your PR submission history over time.</p>
          </div>
          <div className="h-56 w-full">
            {(data?.activityTimeline || []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data!.activityTimeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: any) => [`${v} PR(s)`, 'Submitted']}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '10px', color: '#fff', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill={SEMANTIC_COLORS.blue} radius={[4, 4, 0, 0]} name="PRs" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No activity data for selected filters.
              </div>
            )}
          </div>
        </div>

        {/* Top Requested Products */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" />
              Top Requested Products
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Materials you request most frequently.</p>
          </div>
          <div className="h-56 w-full">
            {(data?.topProductsChart || []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data!.topProductsChart} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#475569"
                    fontSize={10}
                    width={120}
                    tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                  />
                  <Tooltip
                    formatter={(v: any) => [`${v} units`, 'Qty']}
                    contentStyle={{ backgroundColor: '#0F172A', borderRadius: '10px', color: '#fff', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill={SEMANTIC_COLORS.indigo} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No product data available.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">My Purchase Requisitions</h2>
            <p className="text-xs text-slate-500">
              Live records from database.
              {filters.prStatus !== 'ALL' && (
                <span className="ml-1 text-blue-600 font-semibold">
                  Filtered by: {filters.prStatus.replace(/_/g, ' ')}
                </span>
              )}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search PR#, reason, status..."
              value={tableSearch}
              onChange={(e) => { setTableSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                <th
                  onClick={() => toggleSort('pr_number')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    PR Number <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Reason / Purpose</th>
                <th
                  onClick={() => toggleSort('priority')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    Priority <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('status')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    Status <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Items</th>
                <th
                  onClick={() => toggleSort('created_at')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    Date <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                      <FileText className="w-8 h-8 opacity-25" />
                      {allPrs.length === 0
                        ? `No PRs found for "${currentUser?.full_name || 'your account'}". Create your first requisition.`
                        : 'No PRs match the current search / filter combination.'}
                      {allPrs.length === 0 && (
                        <button
                          onClick={() => navigate('/purchase-requisitions')}
                          className="mt-2 px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer"
                        >
                          + Create PR
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((pr) => {
                  const itemCount = Array.isArray(pr.pr_items) ? pr.pr_items.length : 0;
                  return (
                    <tr key={pr.pr_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">
                        {pr.pr_number}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-800 font-semibold block truncate max-w-xs">
                          {pr.reason || 'Material replenishment'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${priorityBadge(pr.priority || 'MEDIUM')}`}>
                          {pr.priority || 'MEDIUM'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge(pr.status)}`}>
                          {pr.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-semibold text-center">
                        {itemCount > 0 ? `${itemCount} item${itemCount > 1 ? 's' : ''}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-slate-300" />
                          {new Date(pr.created_at || pr.request_date).toLocaleDateString([], {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing{' '}
            <strong className="text-slate-800">
              {sorted.length > 0 ? (page - 1) * pageSize + 1 : 0}
            </strong>
            {' – '}
            <strong className="text-slate-800">{Math.min(page * pageSize, sorted.length)}</strong>
            {' of '}
            <strong className="text-slate-800">{sorted.length}</strong> PRs
            {filters.prStatus !== 'ALL' && (
              <span className="ml-2 text-blue-600 font-semibold">({filters.prStatus.replace(/_/g, ' ')})</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-700">Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
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
