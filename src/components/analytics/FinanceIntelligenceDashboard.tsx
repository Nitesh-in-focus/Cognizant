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
  Receipt,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Search,
  ArrowUpDown,
  CreditCard,
  Building2,
  FileCheck,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  fetchFinanceAnalytics,
  FinanceDashboardData,
  SEMANTIC_COLORS,
} from '../../services/analyticsService';

export const FinanceIntelligenceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [matchStatusFilter, setMatchStatusFilter] = useState<string>('ALL');

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setIsRefreshing(true);

    try {
      const result = await fetchFinanceAnalytics();
      setData(result);
    } catch (err) {
      console.error('Error fetching finance analytics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Supabase Realtime subscriptions
    const channel = supabase
      .channel('finance_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exceptions' }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => loadData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const kpis = data?.kpis || {
    totalProcurementValue: 0,
    approvedPoValue: 0,
    invoicedValue: 0,
    pendingMatchValue: 0,
    openExceptionValue: 0,
    resolvedExceptionValue: 0,
  };

  const handleToggleMatchFilter = (status: string) => {
    setMatchStatusFilter((prev) => (prev === status ? 'ALL' : status));
  };

  const filteredInvoices = (data?.recentInvoices || []).filter((inv) => {
    const matchesStatus =
      matchStatusFilter === 'ALL' || inv.match_status === matchStatusFilter;
    if (!matchesStatus) return false;

    if (!tableSearch) return true;
    const q = tableSearch.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.purchase_orders?.po_number?.toLowerCase().includes(q) ||
      inv.suppliers?.supplier_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Finance & Settlements Intelligence
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
              3-WAY MATCH
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Accounts Payable, automated invoice reconciliations, and financial variance monitoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-[11px]">● Live</span>
            <span className="text-slate-400 text-[10px] hidden xs:inline">
              {isRefreshing ? 'Updating...' : `Updated ${data?.lastUpdated || 'just now'}`}
            </span>
          </div>

          <button
            onClick={() => loadData(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Slicers */}
      {matchStatusFilter !== 'ALL' && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-400">Active Slicer:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
            <span>Match Status: <strong>{matchStatusFilter}</strong></span>
            <button
              onClick={() => setMatchStatusFilter('ALL')}
              className="p-0.5 hover:bg-indigo-200/60 rounded text-indigo-600"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
          <button
            onClick={() => setMatchStatusFilter('ALL')}
            className="text-[11px] font-bold text-rose-600 hover:underline ml-auto"
          >
            Clear Slicer
          </button>
        </div>
      )}

      {/* KPI Cards (Section 10) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total PO Value</span>
          <strong className="text-lg font-black text-slate-900 block mt-1 truncate">
            ₹{Number(kpis.totalProcurementValue || 0).toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-slate-500 truncate">Contract spend</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Approved POs</span>
          <strong className="text-lg font-black text-emerald-600 block mt-1 truncate">
            ₹{Number(kpis.approvedPoValue || 0).toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-emerald-600 font-semibold truncate">Authorized budget</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Invoiced</span>
          <strong className="text-lg font-black text-blue-600 block mt-1 truncate">
            ₹{Number(kpis.invoicedValue || 0).toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-slate-500 truncate">Billed by vendors</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Pending Match</span>
          <strong className="text-lg font-black text-amber-600 block mt-1 truncate">
            ₹{Number(kpis.pendingMatchValue || 0).toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-amber-700 font-bold truncate">In reconciliation</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Open Variance</span>
          <strong className="text-lg font-black text-rose-600 block mt-1 truncate">
            ₹{Number(kpis.openExceptionValue || 0).toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-rose-700 font-bold truncate">Exceptions on hold</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Resolved Value</span>
          <strong className="text-lg font-black text-indigo-700 block mt-1 truncate">
            ₹{Number(kpis.resolvedExceptionValue || 0).toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-slate-500 truncate">Audited & settled</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">PO Budget vs Invoiced Billed Timeline</h2>
            <p className="text-xs text-slate-500">Real-time spend comparison across chronological milestones.</p>
          </div>
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.poVsInvoiceTrend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
                <Legend />
                <Area type="monotone" dataKey="poAmount" name="Authorized PO" stroke={SEMANTIC_COLORS.blue} fill={SEMANTIC_COLORS.blue} fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="invoiceAmount" name="Invoiced Amount" stroke={SEMANTIC_COLORS.emerald} fill={SEMANTIC_COLORS.emerald} fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3-Way Match Slicer Donut */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">3-Way Match Slicer</h2>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                Click slice
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Click slice to cross-filter invoice log.</p>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.matchStatusChart || []}
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                  onClick={(entry: any) => {
                    const raw = String(entry?.name || '').replace(/ /g, '_');
                    if (raw) handleToggleMatchFilter(raw);
                  }}
                  cursor="pointer"
                >
                  {(data?.matchStatusChart || []).map((entry, idx) => {
                    const raw = entry.name.replace(/ /g, '_');
                    const isSelected = matchStatusFilter === raw;
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-slate-100 text-xs">
            {(data?.matchStatusChart || []).map((item) => {
              const raw = item.name.replace(/ /g, '_');
              const isSelected = matchStatusFilter === raw;
              return (
                <button
                  key={item.name}
                  onClick={() => handleToggleMatchFilter(raw)}
                  className={`flex items-center gap-1.5 p-1 rounded-md text-left transition-all cursor-pointer ${
                    isSelected ? 'bg-indigo-100 text-indigo-900 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 truncate text-[11px]">{item.name}</span>
                  <span className="font-bold text-slate-900 ml-auto">{item.value}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail Invoices Table with Responsive Horizontal Scroll */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Commercial Invoices Audit Log</h2>
            <p className="text-xs text-slate-500">Live Accounts Payable data from database.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search invoice#, PO, vendor..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">PO Reference</th>
                <th className="py-3 px-4">Vendor Supplier</th>
                <th className="py-3 px-4 text-right">Invoiced Amount</th>
                <th className="py-3 px-4">3-Way Match</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                    No invoice records found in database matching filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.invoice_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">{inv.invoice_number}</td>
                    <td className="py-3 px-4 font-mono text-slate-900 whitespace-nowrap">{inv.purchase_orders?.po_number || inv.po_id || '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{inv.suppliers?.supplier_name || 'Vendor Partner'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      ₹{Number(inv.total_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        inv.match_status === 'MATCHED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : inv.match_status === 'MISMATCH'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {inv.match_status || 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-[11px] font-bold text-slate-700">{inv.payment_status || 'UNPAID'}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(inv.invoice_date || inv.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
