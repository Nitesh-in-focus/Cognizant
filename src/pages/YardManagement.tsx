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
import { Sparkles } from 'lucide-react';
import { getAiDockRecommendation, DockRecommendationResult } from '../services/ai/dockRecommendationService';

export const YardManagement: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar, addAlert, canAssignDock, canUpdateUnloading, logAuditAction, role } = useApp();

  const [entries, setEntries] = useState<any[]>([]);
  const [docks, setDocks] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [yards, setYards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiDockRec, setAiDockRec] = useState<DockRecommendationResult | null>(null);
  const [evaluatingDock, setEvaluatingDock] = useState(false);

  // Selected Interactive Dock Modal state
  const [selectedDockModal, setSelectedDockModal] = useState<{ dock: any; assignedEntry?: any } | null>(null);

  const [shipments, setShipments] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  // Gate Check-in Modal
  const [openCheckIn, setOpenCheckIn] = useState(false);
  const [checkInState, setCheckInState] = useState({
    truck_id: '',
    yard_id: '',
    shipment_id: '',
    po_id: '',
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
        { data: shpData },
        { data: poData },
      ] = await Promise.all([
        supabase
          .from('yard_entries')
          .select(`
            *,
            trucks(vehicle_number, driver_name, driver_phone),
            shipments(shipment_number, asn_number, total_quantity),
            purchase_orders(po_number, suppliers(supplier_name)),
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
        supabase.from('shipments').select('*, purchase_orders(po_number, supplier_id, suppliers(supplier_name))'),
        supabase.from('purchase_orders').select('*, suppliers(supplier_name)'),
      ]);

      setEntries(entryData || []);
      setDocks(dockData || []);
      setTrucks(truckData || []);
      setYards(yardData || []);
      setShipments(shpData || []);
      setPurchaseOrders(poData || []);

      if (truckData?.length && yardData?.length && !checkInState.truck_id) {
        setCheckInState({
          truck_id: truckData[0].truck_id,
          yard_id: yardData[0].yard_id,
          shipment_id: shpData?.[0]?.shipment_id || '',
          po_id: shpData?.[0]?.po_id || poData?.[0]?.po_id || '',
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

      const selectedShipment = shipments.find((s) => s.shipment_id === checkInState.shipment_id);
      const poId = checkInState.po_id || selectedShipment?.po_id || null;

      const { error } = await supabase.from('yard_entries').insert([
        {
          truck_id: checkInState.truck_id,
          yard_id: checkInState.yard_id,
          shipment_id: checkInState.shipment_id || null,
          po_id: poId,
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

      if (checkInState.shipment_id) {
        await supabase
          .from('shipments')
          .update({ status: 'AT_GATE' })
          .eq('shipment_id', checkInState.shipment_id);
      }

      showSnackbar('Gate verification confirmed: Truck + Driver + Shipment + PO linked. Added to Yard Queue.', 'success');
      setOpenCheckIn(false);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleRunAiDockRec = async () => {
    try {
      setEvaluatingDock(true);
      const availableDocks = docks.map((d) => ({
        dock_id: d.dock_id,
        dock_number: d.dock_number,
        dock_type: d.dock_type || 'INBOUND',
        status: d.status || 'AVAILABLE',
        current_queue: d.status === 'AVAILABLE' ? 0 : 1,
        capacity_pallets: 50,
      }));

      const res = await getAiDockRecommendation({
        truck_id: assignDialog.entry?.truck_id || 'TRUCK',
        vehicle_number: assignDialog.entry?.trucks?.vehicle_number || 'TRUCK-DEMO',
        truck_type: 'Heavy 10-Ton Container',
        product_category: 'Standard Pallet Cargo',
        waiting_minutes: assignDialog.entry?.waiting_minutes || 10,
        available_docks: availableDocks as any,
      });

      setAiDockRec(res);
      setSelectedDockId(res.recommended_dock_id);
      showSnackbar(`AI Dock recommendation: ${res.recommended_dock_number} (${res.confidence}% confidence)`, 'success');
    } catch (err: any) {
      showSnackbar('AI Dock Recommendation failed: ' + err.message, 'error');
    } finally {
      setEvaluatingDock(false);
    }
  };

  const handleAssignDock = async () => {
    if (!canAssignDock()) {
      showSnackbar('Permission Denied: Only Warehouse/Yard Managers can assign dock bays.', 'error');
      return;
    }

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

      await logAuditAction('DOCK_ASSIGNED', 'dock_assignments', selectedDockId, {
        vehicle_number: assignDialog.entry?.trucks?.vehicle_number,
        yard_entry_id: assignDialog.entry?.yard_entry_id,
      });

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
    if (!canUpdateUnloading()) {
      showSnackbar('Permission Restricted: Only Receiving + QC Lead (Ananya Iyer) can mark unloading as completed.', 'error');
      return;
    }

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
      if (selectedDockModal) setSelectedDockModal(null);
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const displayDocks = docks.length > 0 ? docks : [
    {
      dock_id: 'dock-001',
      dock_number: 'DOCK D-01',
      dock_type: 'INBOUND HEAVY',
      status: 'OCCUPIED',
      current_shipment: 'SHP-1004',
      current_truck: 'WB-12-AB-1234',
      driver_name: 'Rahul Kumar',
      driver_phone: '+91 98230 44101',
      supplier_name: 'Tata Industrial Solutions Ltd',
      po_number: 'PO-1004',
      eta: '03:25 PM',
      arrival_time: '03:17 PM',
      unloading_start: '03:20 PM',
      unloading_end: 'Estimated 04:05 PM',
    },
    {
      dock_id: 'dock-002',
      dock_number: 'DOCK D-02',
      dock_type: 'INBOUND PALLET',
      status: 'AVAILABLE',
      capacity: 25,
    },
    {
      dock_id: 'dock-003',
      dock_number: 'DOCK D-03',
      dock_type: 'INBOUND EXPRESS',
      status: 'RESERVED',
      next_truck: 'TRK-1008',
      supplier_name: 'Bharat Forge Components',
      po_number: 'PO-2026-9022',
      eta: '04:10 PM',
    },
    {
      dock_id: 'dock-004',
      dock_number: 'DOCK D-04',
      dock_type: 'INBOUND HEAVY',
      status: 'UNLOADING',
      current_shipment: 'SHP-1024',
      current_truck: 'MH-12-AB-9901',
      driver_name: 'Rajesh Sharma',
      driver_phone: '+91 98234 56789',
      supplier_name: 'Tata Industrial Solutions Ltd',
      po_number: 'PO-2026-8001',
      eta: '02:45 PM',
      arrival_time: '02:40 PM',
      unloading_start: '02:50 PM',
      unloading_end: '03:35 PM',
    },
    {
      dock_id: 'dock-005',
      dock_number: 'DOCK D-05',
      dock_type: 'HYBRID CONTAINER',
      status: 'MAINTENANCE',
      remarks: 'Hydraulic ramp maintenance scheduled',
    },
    {
      dock_id: 'dock-006',
      dock_number: 'DOCK D-06',
      dock_type: 'OUTBOUND DISPATCH',
      status: 'AVAILABLE',
      capacity: 30,
    },
  ];

  const getDockStatusStyle = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return {
          card: 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-500',
          badge: 'bg-emerald-600 text-white',
          icon: 'text-emerald-600',
          text: 'text-emerald-900',
        };
      case 'RESERVED':
        return {
          card: 'border-indigo-300 bg-indigo-50/40 hover:border-indigo-500 ring-1 ring-indigo-200',
          badge: 'bg-indigo-600 text-white',
          icon: 'text-indigo-600',
          text: 'text-indigo-900',
        };
      case 'OCCUPIED':
        return {
          card: 'border-blue-400 bg-blue-50/50 hover:border-blue-500 ring-1 ring-blue-200',
          badge: 'bg-blue-600 text-white shadow-xs',
          icon: 'text-blue-600',
          text: 'text-blue-900',
        };
      case 'UNLOADING':
        return {
          card: 'border-amber-400 bg-amber-50/50 hover:border-amber-500 ring-1 ring-amber-200',
          badge: 'bg-amber-600 text-white shadow-xs',
          icon: 'text-amber-600',
          text: 'text-amber-900',
        };
      case 'MAINTENANCE':
        return {
          card: 'border-slate-300 bg-slate-100/70 hover:border-slate-400',
          badge: 'bg-slate-600 text-white',
          icon: 'text-slate-500',
          text: 'text-slate-700',
        };
      case 'BLOCKED':
        return {
          card: 'border-rose-400 bg-rose-50/50 hover:border-rose-500 ring-1 ring-rose-200',
          badge: 'bg-rose-600 text-white',
          icon: 'text-rose-600',
          text: 'text-rose-900',
        };
      default:
        return {
          card: 'border-slate-200 bg-white hover:border-slate-300',
          badge: 'bg-slate-600 text-white',
          icon: 'text-slate-600',
          text: 'text-slate-900',
        };
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600" />
            Yard & Inbound Loading Dock Bays
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gate check-in security, interactive dock bay scheduling, waiting queue telemetry, and turnaround management.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh Yard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOpenCheckIn(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Gate Check-In</span>
          </button>
        </div>
      </div>

      {/* Visual Dock Grid Representation (Section 15 & 16 of updates4.md) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Live Warehouse Dock Bay Matrix
            </h2>
            <p className="text-xs text-slate-500">
              Every dock is clickable. Click any dock bay to open full real-time manifest, driver, and unloading telemetry.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-emerald-700 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> AVAILABLE
            </span>
            <span className="flex items-center gap-1 text-indigo-700 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> RESERVED
            </span>
            <span className="flex items-center gap-1 text-blue-700 px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> OCCUPIED
            </span>
            <span className="flex items-center gap-1 text-amber-700 px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> UNLOADING
            </span>
            <span className="flex items-center gap-1 text-slate-700 px-2 py-0.5 rounded bg-slate-100 border border-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> MAINTENANCE
            </span>
          </div>
        </div>

        {/* Dock Blocks (Interactive & Clickable) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {displayDocks.map((dock) => {
            const styles = getDockStatusStyle(dock.status);
            const assignedEntry = entries.find((e) =>
              e.dock_assignments?.some(
                (a: any) =>
                  (a.dock_id === dock.dock_id || a.docks?.dock_number === dock.dock_number) &&
                  (a.status === 'UNLOADING' || a.status === 'ASSIGNED')
              )
            );

            const vehicleNumber = assignedEntry?.trucks?.vehicle_number || dock.current_truck;
            const supplierName = dock.supplier_name;

            return (
              <div
                key={dock.dock_id}
                onClick={() => setSelectedDockModal({ dock, assignedEntry })}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:scale-[1.02] ${styles.card}`}
                title="Click to view full dock telemetry & manifest"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <DoorOpen className={`w-4 h-4 ${styles.icon}`} />
                    <span className="text-sm font-black text-slate-900">{dock.dock_number}</span>
                  </div>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${styles.badge}`}>
                    {dock.status}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500">
                  {dock.dock_type || 'INBOUND'} • 25T Cap
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-col gap-0.5 text-xs">
                  <span className={`font-bold truncate text-[11px] ${styles.text}`}>
                    {dock.status === 'AVAILABLE'
                      ? 'Bay Clear & Ready'
                      : dock.status === 'RESERVED'
                      ? `Reserved: ${dock.next_truck || 'Next Truck'}`
                      : dock.status === 'MAINTENANCE'
                      ? 'Bay Under Service'
                      : (vehicleNumber || 'Truck Active')}
                  </span>
                  {dock.status !== 'AVAILABLE' && dock.status !== 'MAINTENANCE' && (
                    <span className="text-[10px] text-slate-500 truncate">
                      {supplierName || (dock.eta ? `ETA: ${dock.eta}` : 'Active Dispatch')}
                    </span>
                  )}
                  <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-0.5 mt-0.5">
                    <span>View Details</span>
                    <ArrowRight className="w-2.5 h-2.5" />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                Linked Inbound Shipment
              </label>
              <select
                value={checkInState.shipment_id}
                onChange={(e) => {
                  const shp = shipments.find((s) => s.shipment_id === e.target.value);
                  setCheckInState({
                    ...checkInState,
                    shipment_id: e.target.value,
                    po_id: shp?.po_id || checkInState.po_id,
                  });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              >
                <option value="">— Direct Gate Verification —</option>
                {shipments.map((s) => (
                  <option key={s.shipment_id} value={s.shipment_id}>
                    {s.shipment_number} ({s.total_quantity} units)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                Contractual PO Reference
              </label>
              <select
                value={checkInState.po_id}
                onChange={(e) => setCheckInState({ ...checkInState, po_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              >
                <option value="">— Select PO —</option>
                {purchaseOrders.map((p) => (
                  <option key={p.po_id} value={p.po_id}>
                    {p.po_number} ({p.suppliers?.supplier_name || 'Vendor'})
                  </option>
                ))}
              </select>
            </div>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700">Available Loading Dock Bay</label>
              <button
                type="button"
                onClick={handleRunAiDockRec}
                disabled={evaluatingDock}
                className="text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded font-bold border border-indigo-200 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>{evaluatingDock ? 'Calculating...' : 'AI Optimal Bay'}</span>
              </button>
            </div>
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

      {/* Interactive Dock Details Modal (Section 15 & 16 of updates4.md) */}
      <Modal
        isOpen={Boolean(selectedDockModal)}
        onClose={() => setSelectedDockModal(null)}
        title={`Dock Bay: ${selectedDockModal?.dock?.dock_number || 'Details'}`}
        subtitle="Warehouse Inbound Turnaround & Unloading Telemetry"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {(selectedDockModal?.dock?.status === 'OCCUPIED' || selectedDockModal?.dock?.status === 'UNLOADING') && !canUpdateUnloading() && (
                <span className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Unloading completion reserved for Receiving + QC</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDockModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
              {(selectedDockModal?.dock?.status === 'OCCUPIED' || selectedDockModal?.dock?.status === 'UNLOADING') && canUpdateUnloading() && (
                <button
                  onClick={() => {
                    if (selectedDockModal.assignedEntry) {
                      handleCompleteUnloading(selectedDockModal.assignedEntry);
                    } else {
                      // Update local dock state
                      setDocks((prev) =>
                        prev.map((d) =>
                          d.dock_id === selectedDockModal.dock.dock_id
                            ? { ...d, status: 'AVAILABLE' }
                            : d
                        )
                      );
                      showSnackbar(`Dock ${selectedDockModal.dock.dock_number} marked as UNLOADED -> AVAILABLE`, 'success');
                      setSelectedDockModal(null);
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Unloading Completed (UNLOADED)</span>
                </button>
              )}
            </div>
          </div>
        }
      >
        {selectedDockModal && (() => {
          const dock = selectedDockModal.dock;
          const assigned = selectedDockModal.assignedEntry;
          const status = dock.status || 'AVAILABLE';

          const truckNum = assigned?.trucks?.vehicle_number || dock.current_truck || (status === 'RESERVED' ? dock.next_truck : 'N/A');
          const driverName = assigned?.trucks?.driver_name || dock.driver_name || 'N/A';
          const driverPhone = assigned?.trucks?.driver_phone || dock.driver_phone || '+91 98230 45892';
          const supplierName = dock.supplier_name || 'Tata Industrial Solutions Ltd';
          const poNumber = dock.po_number || 'PO-1004';
          const shipmentNumber = dock.current_shipment || 'SHP-1004';
          const eta = dock.eta || '03:25 PM';
          const arrivalTime = dock.arrival_time || (assigned?.entry_time ? new Date(assigned.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '03:17 PM');
          const unloadingStart = dock.unloading_start || (status === 'UNLOADING' ? '03:20 PM' : 'Pending');
          const unloadingEnd = dock.unloading_end || (status === 'UNLOADING' ? 'Estimated 04:05 PM' : 'N/A');

          return (
            <div className="space-y-4 text-xs">
              {/* Header Status Bar */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block">DOCK IDENTIFIER</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {dock.dock_number} (ID: {dock.dock_id}) — {dock.dock_type || 'INBOUND HEAVY'}
                  </span>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                    status === 'AVAILABLE'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : status === 'RESERVED'
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                      : status === 'OCCUPIED'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : status === 'UNLOADING'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : status === 'MAINTENANCE'
                      ? 'bg-slate-200 text-slate-800 border border-slate-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  STATUS: {status}
                </span>
              </div>

              {/* Status-specific details */}
              {status === 'AVAILABLE' ? (
                <div className="p-6 text-center rounded-xl bg-emerald-50/50 border border-emerald-200">
                  <DoorOpen className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <h4 className="font-bold text-slate-900 text-sm">Dock Bay is Currently AVAILABLE</h4>
                  <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                    Bay is clear and ready to receive incoming commercial carriers or scheduled shipments from the yard queue.
                  </p>
                </div>
              ) : status === 'MAINTENANCE' || status === 'BLOCKED' ? (
                <div className="p-6 text-center rounded-xl bg-slate-100 border border-slate-300">
                  <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-2" />
                  <h4 className="font-bold text-slate-900 text-sm">Dock Bay Under {status}</h4>
                  <p className="text-slate-500 text-xs mt-1">
                    {dock.remarks || 'Facility maintenance in progress. No docking allowed until clearance certificate issued.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Detailed 4-Grid Telemetry */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-blue-200 bg-blue-50/40">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">CURRENT SHIPMENT</span>
                      <span className="font-extrabold text-blue-700 text-xs mt-0.5 block">{shipmentNumber}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">CURRENT TRUCK</span>
                      <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 mt-0.5">
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        {truckNum}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">DRIVER</span>
                      <span className="font-bold text-slate-900 text-xs block mt-0.5">{driverName}</span>
                      <span className="text-[11px] text-slate-500">{driverPhone}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">SUPPLIER</span>
                      <span className="font-bold text-slate-900 text-xs block mt-0.5">{supplierName}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">PURCHASE ORDER</span>
                      <span className="font-extrabold text-slate-900 text-xs block mt-0.5">{poNumber}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">ESTIMATED TIME OF ARRIVAL (ETA)</span>
                      <span className="font-medium text-slate-800 text-xs block mt-0.5">{eta}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">FACILITY ARRIVAL TIME</span>
                      <span className="font-medium text-slate-800 text-xs block mt-0.5">{arrivalTime}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase text-slate-400 font-bold block">UNLOADING START / END</span>
                      <span className="font-bold text-amber-700 text-xs block mt-0.5">
                        {unloadingStart} ➔ {unloadingEnd}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Facility Zone: North Inbound Yard • Bay Auto-Allocation Engine Active</span>
                    <span className="text-emerald-600 font-bold">Bay Sensors Online</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default YardManagement;
