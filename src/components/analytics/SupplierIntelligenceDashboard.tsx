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
  Building2,
  ShoppingCart,
  Truck,
  CheckCircle2,
  Star,
  RefreshCw,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import {
  fetchSupplierAnalytics,
  SupplierAnalyticsData,
  SEMANTIC_COLORS,
} from '../../services/analyticsService';

export const SupplierIntelligenceDashboard: React.FC = () => {
  const { currentUser } = useApp();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SupplierAnalyticsData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setIsRefreshing(true);

    try {
      const result = await fetchSupplierAnalytics(currentUser?.supplier_id);
      setData(result);
    } catch (err) {
      console.error('Error loading supplier analytics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('supplier_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => loadData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const kpis = data?.kpis || {
    totalOrders: 0,
    pendingAcceptance: 0,
    dispatchedOrders: 0,
    completedOrders: 0,
    totalOrderValue: 0,
    qualityRating: 4.8,
  };

  const handleToggleStatus = (status: string) => {
    setSelectedStatusFilter((prev) => (prev === status ? 'ALL' : status));
  };

  const filteredOrders = (data?.recentOrders || []).filter((po) => {
    if (selectedStatusFilter === 'ALL') return true;
    return po.status === selectedStatusFilter;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Supplier Performance & Order Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
              VENDOR HUB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time fulfillment metrics, order acceptance, and quality scorecard directly from database.
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
      {selectedStatusFilter !== 'ALL' && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-400">Active Slicer:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
            <span>Status: <strong>{selectedStatusFilter}</strong></span>
            <button
              onClick={() => setSelectedStatusFilter('ALL')}
              className="p-0.5 hover:bg-emerald-200/60 rounded text-emerald-600"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
          <button
            onClick={() => setSelectedStatusFilter('ALL')}
            className="text-[11px] font-bold text-rose-600 hover:underline ml-auto"
          >
            Clear Slicer
          </button>
        </div>
      )}

      {/* KPI Cards (Section 12) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Orders</span>
          <strong className="text-2xl font-black text-slate-900 block mt-1">{kpis.totalOrders}</strong>
          <span className="text-[10px] text-slate-500 truncate">Assigned POs</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Pending Acceptance</span>
          <strong className="text-2xl font-black text-amber-600 block mt-1">{kpis.pendingAcceptance}</strong>
          <span className="text-[10px] text-amber-700 font-medium truncate">Needs action</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Dispatched</span>
          <strong className="text-2xl font-black text-blue-600 block mt-1">{kpis.dispatchedOrders}</strong>
          <span className="text-[10px] text-slate-500 truncate">In highway transit</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Fulfilled</span>
          <strong className="text-2xl font-black text-emerald-600 block mt-1">{kpis.completedOrders}</strong>
          <span className="text-[10px] text-emerald-700 font-medium truncate">GRN accepted</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Order Value</span>
          <strong className="text-lg font-black text-indigo-700 block mt-1 truncate">
            ₹{Number(kpis.totalOrderValue || 0).toLocaleString('en-IN')}
          </strong>
          <span className="text-[10px] text-slate-500 truncate">Contract volume</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Quality Rating</span>
          <strong className="text-2xl font-black text-emerald-600 block mt-1 flex items-center gap-1">
            <span>{kpis.qualityRating}</span>
            <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" />
          </strong>
          <span className="text-[10px] text-emerald-700 font-medium truncate">Top Tier Partner</span>
        </div>
      </div>

      {/* Charts with Slicer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">PO Status Slicer</h2>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                Click slice
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Click slice to cross-filter order feed.</p>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.orderStatusChart || []}
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                  onClick={(entry: any) => {
                    const raw = String(entry?.name || '').replace(/ /g, '_');
                    if (raw) handleToggleStatus(raw);
                  }}
                  cursor="pointer"
                >
                  {(data?.orderStatusChart || []).map((entry, idx) => {
                    const raw = entry.name.replace(/ /g, '_');
                    const isSelected = selectedStatusFilter === raw;
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
            {(data?.orderStatusChart || []).map((item) => {
              const raw = item.name.replace(/ /g, '_');
              const isSelected = selectedStatusFilter === raw;
              return (
                <button
                  key={item.name}
                  onClick={() => handleToggleStatus(raw)}
                  className={`flex items-center gap-1.5 p-1 rounded-md text-left transition-all cursor-pointer ${
                    isSelected ? 'bg-emerald-100 text-emerald-900 font-bold' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 text-[11px] truncate">{item.name}</span>
                  <span className="font-bold text-slate-900 ml-auto">{item.value}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Order Value Trend</h2>
            <p className="text-xs text-slate-500">Contract value fulfilled chronologically.</p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.revenueTrend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN')}`} />
                <Bar dataKey="value" fill={SEMANTIC_COLORS.emerald} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders Table with Responsive Horizontal Scroll */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Purchase Orders Feed</h2>
          <p className="text-xs text-slate-500">Live order records from database.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <th className="py-3 px-4">PO #</th>
                <th className="py-3 px-4">Delivery Warehouse</th>
                <th className="py-3 px-4 text-right">Order Value</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Order Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    No purchase orders found matching filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((po) => (
                  <tr key={po.po_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">{po.po_number}</td>
                    <td className="py-3 px-4 text-slate-800">{po.warehouses?.warehouse_name || 'Central Warehouse'}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      ₹{Number(po.total_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {po.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(po.order_date || po.created_at).toLocaleDateString()}
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
