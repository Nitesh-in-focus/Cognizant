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
  Truck,
  Boxes,
  Clock,
  AlertTriangle,
  RefreshCw,
  DoorOpen,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  fetchLogisticsAnalytics,
  LogisticsDashboardData,
  SEMANTIC_COLORS,
} from '../../services/analyticsService';

export const LogisticsIntelligenceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LogisticsDashboardData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedYardStatus, setSelectedYardStatus] = useState<string>('ALL');

  const loadData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setIsRefreshing(true);

    try {
      const result = await fetchLogisticsAnalytics();
      setData(result);
    } catch (err) {
      console.error('Error loading logistics analytics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('logistics_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'yard_entries' }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docks' }, () => loadData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const kpis = data?.kpis || {
    activeShipments: 0,
    trucksInYard: 0,
    docksOccupied: 0,
    gateWaitMinutes: 0,
    yardExceptions: 0,
  };

  const handleToggleStatus = (status: string) => {
    setSelectedYardStatus((prev) => (prev === status ? 'ALL' : status));
  };

  const filteredQueue = (data?.recentGateQueue || []).filter((entry) => {
    if (selectedYardStatus === 'ALL') return true;
    return entry.status === selectedYardStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Logistics & Gate Post Operations
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-50 text-cyan-700 border border-cyan-200">
              YARD & FLEET
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time yard vehicle queue, dock bay assignments, and gate check-in telemetry directly from database.
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
      {selectedYardStatus !== 'ALL' && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-400">Active Slicer:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 font-semibold">
            <span>Status: <strong>{selectedYardStatus}</strong></span>
            <button
              onClick={() => setSelectedYardStatus('ALL')}
              className="p-0.5 hover:bg-cyan-200/60 rounded text-cyan-600"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
          <button
            onClick={() => setSelectedYardStatus('ALL')}
            className="text-[11px] font-bold text-rose-600 hover:underline ml-auto"
          >
            Clear Slicer
          </button>
        </div>
      )}

      {/* KPI Cards (Section 13) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Active In Transit</span>
          <strong className="text-2xl font-black text-blue-600 block mt-1">{kpis.activeShipments}</strong>
          <span className="text-[10px] text-slate-500 truncate">Highway fleet</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Trucks in Yard</span>
          <strong className="text-2xl font-black text-slate-900 block mt-1">{kpis.trucksInYard}</strong>
          <span className="text-[10px] text-slate-500 truncate">Gate verified</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Docks Occupied</span>
          <strong className="text-2xl font-black text-indigo-700 block mt-1">{kpis.docksOccupied}</strong>
          <span className="text-[10px] text-slate-500 truncate">Unloading bays</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Avg Gate Wait</span>
          <strong className="text-2xl font-black text-amber-600 block mt-1">{kpis.gateWaitMinutes}m</strong>
          <span className="text-[10px] text-amber-700 font-medium truncate">Turnaround time</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Yard Exceptions</span>
          <strong className="text-2xl font-black text-rose-600 block mt-1">{kpis.yardExceptions}</strong>
          <span className="text-[10px] text-rose-700 font-medium truncate">Delays / Bottlenecks</span>
        </div>
      </div>

      {/* Charts with Click Slicer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Yard Status Slicer</h2>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                Click slice
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Click slice to cross-filter yard vehicle queue.</p>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.yardStatusChart || []}
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
                  {(data?.yardStatusChart || []).map((entry, idx) => {
                    const raw = entry.name.replace(/ /g, '_');
                    const isSelected = selectedYardStatus === raw;
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
            {(data?.yardStatusChart || []).map((item) => {
              const raw = item.name.replace(/ /g, '_');
              const isSelected = selectedYardStatus === raw;
              return (
                <button
                  key={item.name}
                  onClick={() => handleToggleStatus(raw)}
                  className={`flex items-center gap-1.5 p-1 rounded-md text-left transition-all cursor-pointer ${
                    isSelected ? 'bg-cyan-100 text-cyan-900 font-bold' : 'hover:bg-slate-50'
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
            <h2 className="text-sm font-bold text-slate-900">Dock Bay Status</h2>
            <p className="text-xs text-slate-500">Live loading/unloading bay utilization.</p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.dockOccupancyChart || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill={SEMANTIC_COLORS.cyan} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Gate Queue with Responsive Horizontal Scroll */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Live Yard Vehicle Queue</h2>
          <p className="text-xs text-slate-500">Vehicles currently admitted in facility.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[550px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <th className="py-3 px-4">Truck / Driver</th>
                <th className="py-3 px-4">Shipment Ref</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Wait Time</th>
                <th className="py-3 px-4">Gate-In Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    No vehicles found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredQueue.map((entry) => (
                  <tr key={entry.yard_entry_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-blue-600 whitespace-nowrap">
                      {entry.trucks?.vehicle_number || 'Truck'}
                      <div className="text-[11px] font-normal text-slate-400">{entry.trucks?.driver_name || 'Driver'}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800 whitespace-nowrap">{entry.shipments?.shipment_number || '—'}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-amber-700 font-bold whitespace-nowrap">{entry.waiting_minutes || 0} mins</td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(entry.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
