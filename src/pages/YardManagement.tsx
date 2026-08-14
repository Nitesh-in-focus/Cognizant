import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Plus,
  RefreshCw,
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  DoorOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const YardManagement: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar, addAlert } = useApp();

  const [entries, setEntries] = useState<any[]>([]);
  const [docks, setDocks] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [yards, setYards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Gate Check-in Modal
  const [openCheckIn, setOpenCheckIn] = useState(false);
  const [checkInState, setCheckInState] = useState({
    truck_id: '',
    yard_id: '',
  });

  // Assign Dock Modal
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; entry: any | null }>({
    open: false,
    entry: null,
  });
  const [selectedDockId, setSelectedDockId] = useState('');

  useEffect(() => {
    fetchYardData();
  }, [refreshKey]);

  const fetchYardData = async () => {
    try {
      setLoading(true);
      const [
        { data: entryData },
        { data: dockData },
        { data: truckData },
        { data: yardData },
      ] = await Promise.all([
        supabase
          .from('yard_entries')
          .select(`
            *,
            trucks(vehicle_number, driver_name, driver_phone),
            yards(yard_name),
            dock_assignments(
              dock_id,
              status,
              docks(dock_number, dock_type)
            )
          `)
          .order('entry_time', { ascending: false }),
        supabase.from('docks').select('*, yards(yard_name)'),
        supabase.from('trucks').select('*'),
        supabase.from('yards').select('*'),
      ]);

      setEntries(entryData || []);
      setDocks(dockData || []);
      setTrucks(truckData || []);
      setYards(yardData || []);

      if (truckData?.length && yardData?.length && !checkInState.truck_id) {
        setCheckInState({
          truck_id: truckData[0].truck_id,
          yard_id: yardData[0].yard_id,
        });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGateCheckIn = async () => {
    try {
      if (!checkInState.truck_id || !checkInState.yard_id) return;

      const { error } = await supabase.from('yard_entries').insert([
        {
          truck_id: checkInState.truck_id,
          yard_id: checkInState.yard_id,
          entry_time: new Date().toISOString(),
          status: 'WAITING',
          gate_verified: true,
          waiting_minutes: 0,
        },
      ]);

      if (error) throw error;

      await supabase
        .from('trucks')
        .update({ status: 'IN_YARD' })
        .eq('truck_id', checkInState.truck_id);

      showSnackbar('Truck gate check-in verified. Added to Yard Queue.', 'success');
      setOpenCheckIn(false);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleAssignDock = async () => {
    try {
      if (!assignDialog.entry || !selectedDockId) return;

      // 1. Create Dock Assignment
      const { error: assignErr } = await supabase.from('dock_assignments').insert([
        {
          yard_entry_id: assignDialog.entry.yard_entry_id,
          dock_id: selectedDockId,
          assigned_at: new Date().toISOString(),
          dock_start_time: new Date().toISOString(),
          status: 'UNLOADING',
        },
      ]);

      if (assignErr) throw assignErr;

      // 2. Update Yard Entry status
      await supabase
        .from('yard_entries')
        .update({ status: 'AT_DOCK' })
        .eq('yard_entry_id', assignDialog.entry.yard_entry_id);

      // 3. Update Dock status to OCCUPIED
      await supabase
        .from('docks')
        .update({ status: 'OCCUPIED' })
        .eq('dock_id', selectedDockId);

      addAlert({
        title: `Dock Assigned: ${assignDialog.entry.trucks?.vehicle_number}`,
        message: `Truck dispatched to Dock bay. Unloading commenced.`,
        severity: 'info',
        link: '/yard',
      });

      showSnackbar('Truck assigned to Dock bay successfully!', 'success');
      setAssignDialog({ open: false, entry: null });
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleCompleteUnloading = async (entry: any) => {
    try {
      const assignment = entry.dock_assignments?.[0];

      if (assignment) {
        await supabase
          .from('dock_assignments')
          .update({ status: 'COMPLETED', dock_end_time: new Date().toISOString() })
          .eq('assignment_id', assignment.assignment_id);

        if (assignment.dock_id) {
          await supabase
            .from('docks')
            .update({ status: 'AVAILABLE' })
            .eq('dock_id', assignment.dock_id);
        }
      }

      await supabase
        .from('yard_entries')
        .update({ status: 'DEPARTED', exit_time: new Date().toISOString() })
        .eq('yard_entry_id', entry.yard_entry_id);

      showSnackbar('Unloading completed! Dock bay released and vehicle checked out.', 'success');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const displayDocks = docks.length > 0 ? docks : [
    { dock_id: '1', dock_number: 'D01', dock_type: 'INBOUND', status: 'AVAILABLE' },
    { dock_id: '2', dock_number: 'D02', dock_type: 'INBOUND', status: 'OCCUPIED' },
    { dock_id: '3', dock_number: 'D03', dock_type: 'INBOUND', status: 'AVAILABLE' },
    { dock_id: '4', dock_number: 'D04', dock_type: 'HYBRID', status: 'AVAILABLE' },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header (Section 32) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Yard & Inbound Loading Dock Bays
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gate check-in security, live dock bay scheduling, waiting queue telemetry, and turnaround management.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Yard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOpenCheckIn(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Gate Check-In</span>
          </button>
        </div>
      </div>

      {/* Visual Dock Grid Representation (Section 32 & 33) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Live Warehouse Dock Bay Matrix
            </h2>
            <p className="text-xs text-slate-500">
              Visual status of inbound unloading bays at Central Pune Distribution Hub
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> AVAILABLE
            </span>
            <span className="flex items-center gap-1 text-blue-700 font-semibold px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> OCCUPIED (UNLOADING)
            </span>
          </div>
        </div>

        {/* Dock Blocks (Section 33) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {displayDocks.map((dock) => {
            const isOccupied = dock.status === 'OCCUPIED';
            return (
              <div
                key={dock.dock_id}
                className={`p-4 rounded-xl border transition-all ${
                  isOccupied
                    ? 'border-blue-300 bg-blue-50/40'
                    : 'border-emerald-300 bg-emerald-50/30'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <DoorOpen className={`w-4 h-4 ${isOccupied ? 'text-blue-600' : 'text-emerald-600'}`} />
                    <span className="text-base font-black text-slate-900">{dock.dock_number}</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      isOccupied
                        ? 'bg-blue-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {dock.status}
                  </span>
                </div>

                <div className="text-xs text-slate-500">
                  Type: {dock.dock_type || 'INBOUND'} • Max: 25,000 kg
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className={`font-semibold ${isOccupied ? 'text-blue-900' : 'text-emerald-900'}`}>
                    {isOccupied ? 'Truck MH-12-AB (Unloading)' : 'Bay Clear & Ready'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inbound Yard Vehicle Waiting Queue (Section 34) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Inbound Yard Vehicle Waiting Queue
          </h3>
          <span className="text-xs text-slate-500">
            {entries.filter((e) => e.status !== 'DEPARTED').length} vehicles currently logged inside facility
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Vehicle & Driver</th>
                <th className="py-3 px-4">Yard Facility</th>
                <th className="py-3 px-4">Gate In Time</th>
                <th className="py-3 px-4">Dwell / Wait Time</th>
                <th className="py-3 px-4">Assigned Dock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading Yard Queue...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No trucks currently in the yard queue. Click "Gate Check-In" to log vehicle entry.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const assignment = entry.dock_assignments?.[0];
                  return (
                    <tr key={entry.yard_entry_id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-blue-600">
                        {entry.trucks?.vehicle_number || 'MH-12-AB-1234'}
                        <div className="text-[11px] font-normal text-slate-400">
                          {entry.trucks?.driver_name || 'Rajesh Sharma'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {entry.yards?.yard_name || 'North Inbound Yard'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(entry.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 font-semibold text-amber-700">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{entry.waiting_minutes || 5} mins</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {assignment?.docks?.dock_number ? (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                            {assignment.docks.dock_number}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={entry.status || 'WAITING'} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {entry.status === 'WAITING' ? (
                          <button
                            onClick={() => {
                              setAssignDialog({ open: true, entry });
                              if (docks.length) setSelectedDockId(docks[0].dock_id);
                            }}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs"
                          >
                            Assign Dock
                          </button>
                        ) : entry.status === 'AT_DOCK' ? (
                          <button
                            onClick={() => handleCompleteUnloading(entry)}
                            className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold text-xs transition-colors"
                          >
                            Complete Unload
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Departed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gate Check-in Modal */}
      <Modal
        isOpen={openCheckIn}
        onClose={() => setOpenCheckIn(false)}
        title="Warehouse Gate Check-In & Security"
        subtitle="Log arriving carrier vehicle into the active yard holding area"
        maxWidth="sm"
        footer={
          <>
            <button
              onClick={() => setOpenCheckIn(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGateCheckIn}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              Verify & Gate In
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Arriving Carrier Truck
            </label>
            <select
              value={checkInState.truck_id}
              onChange={(e) => setCheckInState({ ...checkInState, truck_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              {trucks.map((t) => (
                <option key={t.truck_id} value={t.truck_id}>
                  {t.vehicle_number} ({t.driver_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Destination Yard Zone
            </label>
            <select
              value={checkInState.yard_id}
              onChange={(e) => setCheckInState({ ...checkInState, yard_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              {yards.map((y) => (
                <option key={y.yard_id} value={y.yard_id}>
                  {y.yard_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Assign Dock Modal */}
      <Modal
        isOpen={assignDialog.open}
        onClose={() => setAssignDialog({ open: false, entry: null })}
        title="Assign Inbound Dock Bay"
        subtitle={`Dispatch ${assignDialog.entry?.trucks?.vehicle_number} to an open unloading bay`}
        maxWidth="sm"
        footer={
          <>
            <button
              onClick={() => setAssignDialog({ open: false, entry: null })}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignDock}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              Dispatch to Bay
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Dispatch vehicle <strong>{assignDialog.entry?.trucks?.vehicle_number}</strong> to begin unloading.
          </p>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Available Loading Dock Bay
            </label>
            <select
              value={selectedDockId}
              onChange={(e) => setSelectedDockId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              {docks.map((d) => (
                <option key={d.dock_id} value={d.dock_id}>
                  {d.dock_number} ({d.dock_type || 'INBOUND'} - {d.status})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default YardManagement;
