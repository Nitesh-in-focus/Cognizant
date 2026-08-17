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
  ShieldCheck,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Boxes,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  fetchReceivingQcAnalytics,
  ReceivingQcDashboardData,
  SEMANTIC_COLORS,
} from '../../services/analyticsService';

export const ReceivingQcIntelligenceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReceivingQcDashboardData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedGrnStatus, setSelectedGrnStatus] = useState<string>('ALL');

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setIsRefreshing(true);

    try {
      const result = await fetchReceivingQcAnalytics();
      setData(result);
    } catch (err) {
      console.error('Error loading receiving QC analytics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('receiving_qc_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goods_receipts' }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exceptions' }, () => loadData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const kpis = data?.kpis || {
    pendingInspections: 0,
    completedGrns: 0,
    acceptedUnits: 0,
    damagedUnits: 0,
    passRatePercentage: 0,
    qcExceptionsCount: 0,
  };

  const handleToggleStatus = (status: string) => {
    setSelectedGrnStatus((prev) => (prev === status ? 'ALL' : status));
  };

  const filteredInspections = (data?.recentInspections || []).filter((grn) => {
    if (selectedGrnStatus === 'ALL') return true;
    return grn.status === selectedGrnStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Dock Receiving & Quality Assurance
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
              8-FACTOR QA
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Goods Receipt Notes (GRN), intake inspections, and material defect classification directly from database.
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
      {selectedGrnStatus !== 'ALL' && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-400">Active Slicer:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
            <span>Status: <strong>{selectedGrnStatus}</strong></span>
            <button
              onClick={() => setSelectedGrnStatus('ALL')}
              className="p-0.5 hover:bg-indigo-200/60 rounded text-indigo-600"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
          <button
            onClick={() => setSelectedGrnStatus('ALL')}
            className="text-[11px] font-bold text-rose-600 hover:underline ml-auto"
          >
            Clear Slicer
          </button>
        </div>
      )}

      {/* KPI Cards (Section 14) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Pending QC</span>
          <strong className="text-2xl font-black text-amber-600 block mt-1">{kpis.pendingInspections}</strong>
          <span className="text-[10px] text-amber-700 font-medium truncate">Awaiting audit</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Completed GRNs</span>
          <strong className="text-2xl font-black text-slate-900 block mt-1">{kpis.completedGrns}</strong>
          <span className="text-[10px] text-slate-500 truncate">Intake receipts</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Accepted Units</span>
          <strong className="text-2xl font-black text-emerald-600 block mt-1">{kpis.acceptedUnits.toLocaleString()}</strong>
          <span className="text-[10px] text-emerald-700 font-medium truncate">Passed inspection</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Damaged Units</span>
          <strong className="text-2xl font-black text-rose-600 block mt-1">{kpis.damagedUnits}</strong>
          <span className="text-[10px] text-rose-700 font-bold truncate">Rejected / Defect</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">QA Pass Rate</span>
          <strong className="text-2xl font-black text-blue-600 block mt-1">{kpis.passRatePercentage}%</strong>
          <span className="text-[10px] text-blue-700 font-bold truncate">Acceptance index</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">QC Exceptions</span>
          <strong className="text-2xl font-black text-purple-700 block mt-1">{kpis.qcExceptionsCount}</strong>
          <span className="text-[10px] text-slate-500 truncate">Variance logged</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Inspection Verdict Ratio</h2>
            <p className="text-xs text-slate-500">Accepted clean vs damaged defect units ratio.</p>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data?.verdictDistribution || []} innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {(data?.verdictDistribution || []).map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
            {(data?.verdictDistribution || []).map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 text-[11px] truncate">{item.name}</span>
                <span className="font-bold text-slate-900 ml-auto">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-900">Defect Classification</h2>
            <p className="text-xs text-slate-500">Root cause taxonomy of QA variances.</p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.defectClassification || []} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#475569" fontSize={10} width={130} />
                <Tooltip />
                <Bar dataKey="value" fill={SEMANTIC_COLORS.rose} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent GRNs Table with Responsive Horizontal Scroll */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Goods Receipt Notes (GRN)</h2>
            <p className="text-xs text-slate-500">Live intake audits directly from database.</p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => handleToggleStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedGrnStatus === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleToggleStatus('COMPLETED')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedGrnStatus === 'COMPLETED' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => handleToggleStatus('PENDING_INSPECTION')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedGrnStatus === 'PENDING_INSPECTION' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Pending
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <th className="py-3 px-4">GRN #</th>
                <th className="py-3 px-4">PO Reference</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Audit Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredInspections.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                    No GRN records found matching current status filter.
                  </td>
                </tr>
              ) : (
                filteredInspections.map((grn) => (
                  <tr key={grn.grn_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 whitespace-nowrap">{grn.grn_number}</td>
                    <td className="py-3 px-4 font-mono text-slate-900 whitespace-nowrap">{grn.purchase_orders?.po_number || grn.po_id || '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        grn.status === 'COMPLETED' || grn.status === 'INSPECTED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {grn.status || 'COMPLETED'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(grn.received_date || grn.created_at).toLocaleDateString()}
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
