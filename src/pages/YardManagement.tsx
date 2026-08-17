import React, { useEffect, useState, useCallback } from 'react';
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
  Navigation,
  MapPin,
  Zap,
  Search,
  Radio,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { Sparkles } from 'lucide-react';
import { getAiDockRecommendation, DockRecommendationResult } from '../services/ai/dockRecommendationService';
import { getAiEtaPrediction, EtaPredictionResult } from '../services/ai/etaPredictionService';
import { TruckTrackingMap } from '../components/maps/TruckTrackingMap';

export const YardManagement: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar, addAlert, canAssignDock, canUpdateUnloading, logAuditAction, role } = useApp();

  const [entries, setEntries] = useState<any[]>([]);
  const [docks, setDocks] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [yards, setYards] = useState<any[]>([]);
  const [parkingSlots, setParkingSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiDockRec, setAiDockRec] = useState<DockRecommendationResult | null>(null);
  const [evaluatingDock, setEvaluatingDock] = useState(false);
  const [activeYardTab, setActiveYardTab] = useState<'queue' | 'docks' | 'parking' | 'live_map'>('queue');

  // Live tracking state
  const [truckLocations, setTruckLocations] = useState<any[]>([]);
  const [liveEtas, setLiveEtas] = useState<Record<string, EtaPredictionResult>>({});
  const [loadingEtas, setLoadingEtas] = useState(false);
  const [liveTrackingFilter, setLiveTrackingFilter] = useState('');
  const [selectedLiveShipment, setSelectedLiveShipment] = useState<any | null>(null);

  // Search
  const [queueSearch, setQueueSearch] = useState('');
  const [queueStatusFilter, setQueueStatusFilter] = useState('');
  const [shipmentSearch, setShipmentSearch] = useState('');

  // Selected Interactive Dock Modal state
  const [selectedDockModal, setSelectedDockModal] = useState<{ dock: any; assignedEntry?: any } | null>(null);

  const [shipments, setShipments] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  // Parking Assignment Modal
  const [parkingDialog, setParkingDialog] = useState<{ open: boolean; slot: any | null }>({ open: false, slot: null });
  const [parkingShipmentId, setParkingShipmentId] = useState('');
  const [parkingTruckId, setParkingTruckId] = useState('');

  // Gate Check-in Modal
  const [openCheckIn, setOpenCheckIn] = useState(false);
  const [checkInState, setCheckInState] = useState({
    truck_id: '',
    yard_id: '',
    shipment_id: '',
    notes: '',
  });
  // PO-first search for gate check-in
  const [poSearchInput, setPoSearchInput] = useState('');
  const [checkInPoSummary, setCheckInPoSummary] = useState<any | null>(null);

  // Assign Dock Modal
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; entry: any | null }>({
    open: false,
    entry: null,
  });
  const [selectedDockId, setSelectedDockId] = useState('');

  // Track which yard_entry IDs have already triggered a gate alert so we don't spam
  const alertedArrivalIds = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchYardData();

    const channelSuffix = Math.random().toString(36).slice(2, 7);
    const channel = supabase
      .channel(`yard_management_live_sync_${channelSuffix}`)
      // Granular INSERT listener: fires alert when driver marks arrived
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'yard_entries' },
        (payload) => {
          const entry = payload.new as any;
          if (entry?.status === 'ARRIVED' && !alertedArrivalIds.current.has(entry.yard_entry_id)) {
            alertedArrivalIds.current.add(entry.yard_entry_id);
            addAlert({
              title: '🚛 Truck Arrived at Security Gate',
              message: `A truck has arrived and is awaiting Gate Check-In. Open Yard Queue → Yard Management to process immediately.`,
              severity: 'warning',
              link: '/yard',
            });
          }
          fetchYardData();
        }
      )
      // UPDATE listener: also fire alert if status transitions to ARRIVED via UPDATE
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'yard_entries' },
        (payload) => {
          const entry = payload.new as any;
          const oldEntry = payload.old as any;
          if (
            entry?.status === 'ARRIVED' &&
            oldEntry?.status !== 'ARRIVED' &&
            !alertedArrivalIds.current.has(entry.yard_entry_id)
          ) {
            alertedArrivalIds.current.add(entry.yard_entry_id);
            addAlert({
              title: '🚛 Truck Arrived at Security Gate',
              message: `A truck has arrived and is awaiting Gate Check-In. Open Yard Queue → Yard Management to process immediately.`,
              severity: 'warning',
              link: '/yard',
            });
          }
          fetchYardData();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'yard_entries' },
        () => fetchYardData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments' },
        () => fetchYardData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'docks' },
        () => fetchYardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        { data: parkingData },
        { data: locData },
      ] = await Promise.all([
        supabase
          .from('yard_entries')
          .select(`
            *,
            trucks(vehicle_number, driver_name, driver_phone),
            shipments(shipment_number, asn_number, total_quantity, po_id, supplier_id),
            purchase_orders(po_number, suppliers(supplier_name)),
            suppliers(supplier_name),
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
        supabase
          .from('shipments')
          .select(`
            *,
            purchase_orders(
              po_id,
              po_number,
              total_amount,
              order_date,
              suppliers(supplier_name, city, phone)
            ),
            trucks(truck_id, vehicle_number, driver_name, driver_phone, capacity)
          `)
          .in('status', ['DISPATCHED', 'IN_TRANSIT', 'ARRIVING', 'ARRIVED', 'AT_GATE', 'WAITING', 'PARTIALLY_DISPATCHED']),
        supabase.from('purchase_orders').select('*, suppliers(supplier_name)'),
        supabase.from('parking_slots').select('*, yards(yard_name)').order('slot_code'),
        supabase
          .from('truck_locations')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(300),
      ]);

      setEntries(entryData || []);
      setDocks(dockData || []);
      setTrucks(truckData || []);
      setYards(yardData || []);
      setShipments(shpData || []);
      setPurchaseOrders(poData || []);
      setParkingSlots(parkingData || []);
      setTruckLocations(locData || []);

      if (truckData?.length && yardData?.length && !checkInState.truck_id) {
        setCheckInState({
          truck_id: truckData[0].truck_id,
          yard_id: yardData[0].yard_id,
          shipment_id: shpData?.[0]?.shipment_id || '',
          notes: '',
        });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compute AI ETA for all active IN_TRANSIT shipments using latest truck_locations
  const fetchLiveEtas = async (activeShipments: any[], locations: any[]) => {
    const inTransit = activeShipments.filter(s =>
      ['DISPATCHED', 'IN_TRANSIT', 'ARRIVING'].includes(s.status)
    );
    if (inTransit.length === 0) return;
    setLoadingEtas(true);
    const etaMap: Record<string, EtaPredictionResult> = {};
    await Promise.allSettled(
      inTransit.map(async (shp) => {
        try {
          const truckId = shp.truck_id || shp.trucks?.truck_id;
          const latestLoc = truckId
            ? locations.find(l => l.truck_id === truckId)
            : null;
          const eta = await getAiEtaPrediction({
            shipment_id: shp.shipment_id,
            vehicle_number: shp.trucks?.vehicle_number || shp.vehicle_number || 'TRUCK',
            origin: shp.purchase_orders?.suppliers?.supplier_name || shp.origin || 'Supplier',
            destination: shp.destination || 'Warehouse Hub',
            remaining_km: shp.distance_remaining_km || 120,
            current_speed_kmh: latestLoc?.speed || shp.speed || 55,
            scheduled_arrival: shp.expected_arrival,
          });
          etaMap[shp.shipment_id] = eta;
        } catch {/* skip on error */}
      })
    );
    setLiveEtas(etaMap);
    setLoadingEtas(false);
  };

  // PO-first gate check-in: when user types/selects a PO, auto-fill shipment + truck
  const handlePoSearchSelect = (poNumber: string) => {
    setPoSearchInput(poNumber);
    if (!poNumber.trim()) {
      setCheckInPoSummary(null);
      return;
    }
    const cleanSearch = poNumber.trim().toLowerCase();
    const matchedShipment = shipments.find(s =>
      s.purchase_orders?.po_number?.toLowerCase() === cleanSearch ||
      s.purchase_orders?.po_number?.toLowerCase().includes(cleanSearch) ||
      s.shipment_number?.toLowerCase().includes(cleanSearch)
    );
    if (matchedShipment) {
      setCheckInPoSummary(matchedShipment);
      setCheckInState(prev => ({
        ...prev,
        shipment_id: matchedShipment.shipment_id,
        truck_id: matchedShipment.trucks?.truck_id || matchedShipment.truck_id || prev.truck_id,
      }));
    } else {
      // Check in purchaseOrders directly
      const matchedPo = purchaseOrders.find(p =>
        p.po_number?.toLowerCase() === cleanSearch ||
        p.po_number?.toLowerCase().includes(cleanSearch)
      );
      if (matchedPo) {
        setCheckInPoSummary({
          purchase_orders: matchedPo,
          status: matchedPo.status || 'DISPATCHED',
          total_quantity: matchedPo.total_quantity || 0,
        });
      } else {
        setCheckInPoSummary(null);
      }
    }
  };

  const handleGateCheckIn = async () => {
    try {
      if (!checkInState.truck_id || !checkInState.yard_id) return;

      // Derive po_id and supplier_id from selected shipment — no manual entry
      const selectedShipment = shipments.find((s) => s.shipment_id === checkInState.shipment_id);
      const derivedPoId = selectedShipment?.po_id || null;
      const derivedSupplierId = selectedShipment?.supplier_id ||
        selectedShipment?.purchase_orders?.supplier_id || null;

      const nowIso = new Date().toISOString();

      // Check if an existing yard entry was created when the driver arrived
      let existingEntryId: string | null = null;
      if (checkInState.shipment_id) {
        const { data: existing } = await supabase
          .from('yard_entries')
          .select('yard_entry_id')
          .eq('shipment_id', checkInState.shipment_id)
          .maybeSingle();
        existingEntryId = existing?.yard_entry_id || null;
      }

      if (existingEntryId) {
        const { error } = await supabase
          .from('yard_entries')
          .update({
            truck_id: checkInState.truck_id,
            yard_id: checkInState.yard_id,
            po_id: derivedPoId,
            supplier_id: derivedSupplierId,
            gate_in_time: nowIso,
            status: 'WAITING',
            gate_verified: true,
            waiting_minutes: 0,
            notes: checkInState.notes || 'Security check-in completed at gate.',
          })
          .eq('yard_entry_id', existingEntryId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('yard_entries').insert([
          {
            truck_id: checkInState.truck_id,
            yard_id: checkInState.yard_id,
            shipment_id: checkInState.shipment_id || null,
            po_id: derivedPoId,
            supplier_id: derivedSupplierId,
            entry_time: nowIso,
            gate_in_time: nowIso,
            status: 'WAITING',
            gate_verified: true,
            waiting_minutes: 0,
            notes: checkInState.notes || 'Security check-in completed at gate.',
          },
        ]);
        if (error) throw error;
      }

      await supabase
        .from('trucks')
        .update({ status: 'IN_YARD', last_location_update: nowIso })
        .eq('truck_id', checkInState.truck_id);

      if (checkInState.shipment_id) {
        await supabase
          .from('shipments')
          .update({ status: 'AT_GATE', updated_at: nowIso })
          .eq('shipment_id', checkInState.shipment_id);
      }

      await logAuditAction('GATE_IN', 'yard_entries', checkInState.truck_id, {
        shipment_id: checkInState.shipment_id,
        po_id: derivedPoId,
        yard_id: checkInState.yard_id,
      });

      showSnackbar('Gate verified: Truck + Shipment + PO linked. Added to yard queue.', 'success');
      setOpenCheckIn(false);
      setCheckInState({ truck_id: '', yard_id: yards[0]?.yard_id || '', shipment_id: '', notes: '' });
      fetchYardData();
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleAssignParking = async () => {
    try {
      if (!parkingDialog.slot || !parkingShipmentId) return;
      const slot = parkingDialog.slot;
      if (slot.status === 'OCCUPIED') {
        showSnackbar('Slot is already occupied.', 'error');
        return;
      }
      const { error } = await supabase
        .from('parking_slots')
        .update({
          status: 'OCCUPIED',
          current_shipment_id: parkingShipmentId,
          current_truck_id: parkingTruckId || null,
          assigned_at: new Date().toISOString(),
          released_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('parking_id', slot.parking_id);
      if (error) throw error;
      await supabase.from('shipments').update({ status: 'PARKED', parking_slot: slot.slot_code }).eq('shipment_id', parkingShipmentId);
      await logAuditAction('PARKING_ASSIGNED', 'parking_slots', slot.parking_id, { slot_code: slot.slot_code, shipment_id: parkingShipmentId });
      showSnackbar(`Slot ${slot.slot_code} assigned. Shipment status → PARKED.`, 'success');
      setParkingDialog({ open: false, slot: null });
      setParkingShipmentId('');
      setParkingTruckId('');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleReleaseParking = async (slot: any) => {
    try {
      const { error } = await supabase
        .from('parking_slots')
        .update({
          status: 'AVAILABLE',
          current_shipment_id: null,
          current_truck_id: null,
          released_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('parking_id', slot.parking_id);
      if (error) throw error;
      if (slot.current_shipment_id) {
        await supabase.from('shipments').update({ status: 'WAITING_FOR_DOCK', parking_slot: null }).eq('shipment_id', slot.current_shipment_id);
      }
      await logAuditAction('PARKING_RELEASED', 'parking_slots', slot.parking_id, { slot_code: slot.slot_code });
      showSnackbar(`Slot ${slot.slot_code} released → AVAILABLE.`, 'success');
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
        vehicle_number: assignDialog.entry?.trucks?.vehicle_number || 'TRUCK-INBOUND',
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

      // 4. Update Shipment status to UNLOADING
      if (assignDialog.entry?.shipment_id) {
        await supabase
          .from('shipments')
          .update({
            status: 'UNLOADING',
            updated_at: new Date().toISOString(),
          })
          .eq('shipment_id', assignDialog.entry.shipment_id);
      }

      await logAuditAction('DOCK_ASSIGNED', 'dock_assignments', selectedDockId, {
        vehicle_number: assignDialog.entry?.trucks?.vehicle_number,
        yard_entry_id: assignDialog.entry?.yard_entry_id,
        shipment_id: assignDialog.entry?.shipment_id,
      });

      addAlert({
        title: `Dock Assigned: ${assignDialog.entry.trucks?.vehicle_number}`,
        message: `Truck dispatched to Dock bay. Unloading commenced.`,
        severity: 'info',
        link: '/yard',
      });

      showSnackbar('Truck assigned to Dock bay successfully! Unloading initiated.', 'success');
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

      if (entry.shipment_id) {
        await supabase
          .from('shipments')
          .update({
            status: 'UNLOADED',
            updated_at: new Date().toISOString(),
          })
          .eq('shipment_id', entry.shipment_id);
      }

      if (entry.truck_id) {
        await supabase
          .from('trucks')
          .update({ status: 'AVAILABLE' })
          .eq('truck_id', entry.truck_id);
      }

      showSnackbar('Unloading completed! Dock bay released and shipment queued for QC & GRN generation.', 'success');
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
            Yard, Dock & Parking Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gate check-in, dock assignment, parking management, and live yard queue.
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

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit overflow-x-auto">
        {(['queue', 'docks', 'parking', 'live_map'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setActiveYardTab(t);
              if (t === 'live_map') {
                fetchLiveEtas(shipments, truckLocations);
              }
            }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors ${
              activeYardTab === t ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'queue' && <><Boxes className="w-3.5 h-3.5" /><span>Yard Queue</span></>}
            {t === 'docks' && <><DoorOpen className="w-3.5 h-3.5" /><span>Dock Bays</span></>}
            {t === 'parking' && <><Truck className="w-3.5 h-3.5" /><span>Parking Slots</span></>}
            {t === 'live_map' && (
              <>
                <Navigation className="w-3.5 h-3.5 text-cyan-600" />
                <span className="text-cyan-700">Live Tracking</span>
                {shipments.filter(s => ['DISPATCHED','IN_TRANSIT','ARRIVING'].includes(s.status)).length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-600 text-white text-[9px] font-extrabold">
                    {shipments.filter(s => ['DISPATCHED','IN_TRANSIT','ARRIVING'].includes(s.status)).length}
                  </span>
                )}
              </>
            )}
          </button>
        ))}
      </div>

      {/* ─── DOCK BAYS TAB ─── */}
      {activeYardTab === 'docks' && (
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
      )}

      {/* ─── PARKING SLOTS TAB ─── */}
      {activeYardTab === 'parking' && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Parking Slot Management</h3>
            <p className="text-xs text-slate-500">Assign incoming trucks to available slots. Release when moving to a dock.</p>
          </div>
          <div className="flex gap-2 text-[11px] font-bold">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
              {parkingSlots.filter(s => s.status === 'AVAILABLE').length} Available
            </span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
              {parkingSlots.filter(s => s.status === 'OCCUPIED').length} Occupied
            </span>
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {parkingSlots.length === 0 ? (
            <div className="col-span-5 py-8 text-center text-slate-400 text-xs">No parking slots found. Check if yards exist.</div>
          ) : parkingSlots.map((slot) => (
            <div
              key={slot.parking_id}
              className={`p-3.5 rounded-xl border transition-all ${
                slot.status === 'AVAILABLE'
                  ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400 cursor-pointer'
                  : slot.status === 'OCCUPIED'
                  ? 'border-blue-300 bg-blue-50/50'
                  : 'border-amber-200 bg-amber-50/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-black text-slate-900">{slot.slot_code}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  slot.status === 'AVAILABLE' ? 'bg-emerald-600 text-white' :
                  slot.status === 'OCCUPIED' ? 'bg-blue-600 text-white' :
                  'bg-amber-600 text-white'
                }`}>{slot.status}</span>
              </div>
              <div className="text-[11px] text-slate-500 mb-2">{slot.yards?.yard_name || 'Yard'}</div>
              {slot.status === 'OCCUPIED' && (
                <div className="text-[11px] text-blue-700 font-semibold mb-2 truncate">
                  Shipment assigned
                </div>
              )}
              {slot.status === 'AVAILABLE' ? (
                <button
                  onClick={() => { setParkingDialog({ open: true, slot }); setParkingShipmentId(''); setParkingTruckId(''); }}
                  className="w-full text-center text-[11px] font-bold text-emerald-700 hover:text-emerald-900 border border-emerald-300 rounded py-1 bg-white hover:bg-emerald-50 transition-colors"
                >
                  Assign
                </button>
              ) : slot.status === 'OCCUPIED' ? (
                <button
                  onClick={() => handleReleaseParking(slot)}
                  className="w-full text-center text-[11px] font-bold text-amber-700 hover:text-amber-900 border border-amber-300 rounded py-1 bg-white hover:bg-amber-50 transition-colors"
                >
                  Release
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ─── YARD QUEUE TAB ─── */}
      {activeYardTab === 'queue' && (
      <div className="space-y-4">
      {/* Arriving Trucks Alert Banner */}
      {(() => {
        const arrivingCount = entries.filter(e => e.status === 'ARRIVED' && !e.gate_verified).length;
        return arrivingCount > 0 ? (
          <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-amber-400 bg-amber-50 shadow-md animate-pulse">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600 flex-shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="font-extrabold text-amber-900 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                {arrivingCount} Truck{arrivingCount > 1 ? 's' : ''} Awaiting Gate Check-In
              </div>
              <p className="text-xs text-amber-700 mt-0.5">
                Driver{arrivingCount > 1 ? 's have' : ' has'} marked arrival. Process Gate Check-In immediately to assign dock.
              </p>
            </div>
            <button
              onClick={() => setQueueStatusFilter('ARRIVED')}
              className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs transition-colors shadow-xs flex-shrink-0"
            >
              Show Arrivals
            </button>
          </div>
        ) : null;
      })()}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Inbound Yard Vehicle Queue
              </h3>
              <span className="text-xs text-slate-500">
                {entries.filter((e) => e.status !== 'DEPARTED').length} vehicles currently logged inside facility
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Search truck, driver, shipment, PO..."
                value={queueSearch}
                onChange={e => setQueueSearch(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 w-56 focus:outline-none focus:border-blue-400"
              />
              <select
                value={queueStatusFilter}
                onChange={e => setQueueStatusFilter(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50"
              >
                <option value="">All Status</option>
                {['ARRIVED','WAITING','AT_DOCK','PARKED','DEPARTED'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Vehicle & Driver</th>
                <th className="py-3 px-4">Shipment / PO</th>
                <th className="py-3 px-4">Yard Facility</th>
                <th className="py-3 px-4">Gate In Time</th>
                <th className="py-3 px-4">Wait</th>
                <th className="py-3 px-4">Assigned Dock</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading Yard Queue...</td></tr>
              ) : entries
                .filter((entry) => {
                  const q = queueSearch.toLowerCase();
                  const matchSearch = !q ||
                    entry.trucks?.vehicle_number?.toLowerCase().includes(q) ||
                    entry.trucks?.driver_name?.toLowerCase().includes(q) ||
                    entry.shipments?.shipment_number?.toLowerCase().includes(q) ||
                    entry.purchase_orders?.po_number?.toLowerCase().includes(q) ||
                    entry.suppliers?.supplier_name?.toLowerCase().includes(q);
                  const matchStatus = !queueStatusFilter || entry.status === queueStatusFilter;
                  return matchSearch && matchStatus;
                })
                .length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">No vehicles match. Click "Gate Check-In" to log entry.</td></tr>
              ) : (
                entries
                  .filter((entry) => {
                    const q = queueSearch.toLowerCase();
                    const matchSearch = !q ||
                      entry.trucks?.vehicle_number?.toLowerCase().includes(q) ||
                      entry.trucks?.driver_name?.toLowerCase().includes(q) ||
                      entry.shipments?.shipment_number?.toLowerCase().includes(q) ||
                      entry.purchase_orders?.po_number?.toLowerCase().includes(q) ||
                      entry.suppliers?.supplier_name?.toLowerCase().includes(q);
                    const matchStatus = !queueStatusFilter || entry.status === queueStatusFilter;
                    return matchSearch && matchStatus;
                  })
                  .map((entry) => {
                  const assignment = entry.dock_assignments?.[0];
                  return (
                    <tr
                      key={entry.yard_entry_id}
                      className={`hover:bg-slate-50/75 transition-colors ${
                        entry.status === 'ARRIVED'
                          ? 'bg-amber-50/70 border-l-4 border-amber-400'
                          : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-blue-600">
                        {entry.trucks?.vehicle_number || '—'}
                        <div className="text-[11px] font-normal text-slate-400">{entry.trucks?.driver_name || '—'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-semibold text-slate-800">{entry.shipments?.shipment_number || '—'}</div>
                        <div className="text-[11px] text-slate-400">{entry.purchase_orders?.po_number || (entry.po_id ? `PO: ${String(entry.po_id).slice(0,8)}…` : '—')}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {entry.yards?.yard_name || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {entry.gate_in_time || entry.entry_time
                          ? new Date(entry.gate_in_time || entry.entry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 font-semibold text-amber-700">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{entry.waiting_minutes || 0} mins</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {assignment?.docks?.dock_number ? (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">{assignment.docks.dock_number}</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={entry.status || 'WAITING'} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {entry.status === 'ARRIVED' ? (
                          <button
                            onClick={() => {
                              setCheckInState({
                                truck_id: entry.truck_id,
                                yard_id: entry.yard_id || yards[0]?.yard_id || '',
                                shipment_id: entry.shipment_id || '',
                                notes: 'Checked in from Arrival queue',
                              });
                              setOpenCheckIn(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-xs flex items-center gap-1.5 ml-auto animate-pulse"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Gate Check-In</span>
                          </button>
                        ) : entry.status === 'WAITING' ? (
                          <button
                            onClick={() => { setAssignDialog({ open: true, entry }); if (docks.length) setSelectedDockId(docks[0].dock_id); }}
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
      </div>
      )}

      {/* ─── LIVE TRACKING TAB ─── */}
      {activeYardTab === 'live_map' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-600" />
                Live Inbound Truck Tracking
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time truck locations from GPS telemetry, linked by PO number. AI ETA computed per shipment.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by PO, truck, shipment..."
                  value={liveTrackingFilter}
                  onChange={e => setLiveTrackingFilter(e.target.value)}
                  className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white w-52 focus:outline-none focus:border-cyan-400"
                />
              </div>
              <button
                onClick={() => fetchLiveEtas(shipments, truckLocations)}
                disabled={loadingEtas}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-colors disabled:opacity-60"
              >
                <Sparkles className={`w-3.5 h-3.5 ${loadingEtas ? 'animate-spin' : ''}`} />
                {loadingEtas ? 'Computing ETA...' : 'Refresh AI ETAs'}
              </button>
            </div>
          </div>

          {/* Active shipments — no trucks in transit */}
          {shipments.filter(s => ['DISPATCHED','IN_TRANSIT','ARRIVING','ARRIVED'].includes(s.status)).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
              <Navigation className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-600">No Active Inbound Trucks</p>
              <p className="text-xs text-slate-400 mt-1">Trucks will appear here once suppliers dispatch shipments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              {/* Left: Truck Cards with ETA */}
              <div className="xl:col-span-1 space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {shipments
                  .filter(s => ['DISPATCHED','IN_TRANSIT','ARRIVING','ARRIVED'].includes(s.status))
                  .filter(s => !liveTrackingFilter ||
                    s.shipment_number?.toLowerCase().includes(liveTrackingFilter.toLowerCase()) ||
                    s.purchase_orders?.po_number?.toLowerCase().includes(liveTrackingFilter.toLowerCase()) ||
                    s.trucks?.vehicle_number?.toLowerCase().includes(liveTrackingFilter.toLowerCase()) ||
                    s.purchase_orders?.suppliers?.supplier_name?.toLowerCase().includes(liveTrackingFilter.toLowerCase())
                  )
                  .map((shp) => {
                    const truckId = shp.truck_id || shp.trucks?.truck_id;
                    const latestLoc = truckId ? truckLocations.find(l => l.truck_id === truckId) : null;
                    const eta = liveEtas[shp.shipment_id];
                    const isSelected = selectedLiveShipment?.shipment_id === shp.shipment_id;
                    const statusColor = shp.status === 'ARRIVED' ? 'border-emerald-400 bg-emerald-50/60'
                      : shp.status === 'ARRIVING' ? 'border-amber-400 bg-amber-50/60'
                      : 'border-cyan-300 bg-cyan-50/40';

                    return (
                      <div
                        key={shp.shipment_id}
                        onClick={() => setSelectedLiveShipment(shp)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                          isSelected ? 'ring-2 ring-cyan-500 ' + statusColor : 'border-slate-200 bg-white hover:border-cyan-300'
                        }`}
                      >
                        {/* PO + Shipment Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Linked PO</div>
                            <div className="font-extrabold text-sm text-blue-700 font-mono">
                              {shp.purchase_orders?.po_number || shp.po_id || '—'}
                            </div>
                          </div>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                            shp.status === 'ARRIVED' ? 'bg-emerald-600 text-white'
                            : shp.status === 'ARRIVING' ? 'bg-amber-500 text-white animate-pulse'
                            : 'bg-cyan-600 text-white'
                          }`}>
                            {shp.status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-3 h-3 text-slate-400" />
                            <span className="font-bold text-slate-800">{shp.trucks?.vehicle_number || shp.vehicle_number || '—'}</span>
                            <span className="text-slate-400">— {shp.trucks?.driver_name || shp.driver_name || 'Driver'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{latestLoc?.location_name || shp.current_location || 'Location updating...'}</span>
                          </div>
                          {latestLoc?.speed && (
                            <div className="flex items-center gap-1.5">
                              <Radio className="w-3 h-3 text-cyan-500" />
                              <span className="text-cyan-700 font-semibold">{latestLoc.speed} km/h</span>
                              <span className="text-slate-400 text-[10px]">
                                {latestLoc?.timestamp ? new Date(latestLoc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Supplier row */}
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                          <span>Supplier: <strong className="text-slate-700">{shp.purchase_orders?.suppliers?.supplier_name || '—'}</strong></span>
                          <span>Qty: <strong className="text-slate-700">{shp.total_quantity || '—'}</strong></span>
                        </div>

                        {/* AI ETA Block */}
                        {eta ? (
                          <div className="mt-2.5 p-2.5 rounded-lg bg-indigo-50 border border-indigo-200">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Sparkles className="w-3 h-3 text-indigo-600" />
                              <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wide">AI ETA (Gemini)</span>
                              <span className="ml-auto text-[10px] font-bold text-indigo-600">{eta.confidence}% conf</span>
                            </div>
                            <div className="text-base font-extrabold text-indigo-950">
                              {eta.predicted_eta_formatted || new Date(eta.predicted_eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {eta.delay_minutes > 0 && (
                              <div className="text-[10px] text-amber-700 font-semibold mt-0.5 flex items-center gap-1">
                                <TrendingUp className="w-3 h-3" />
                                {eta.delay_minutes}m delay risk ({eta.delay_probability}% probability)
                              </div>
                            )}
                            <div className="text-[10px] text-indigo-600 mt-1 leading-relaxed">{eta.recommended_action}</div>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); fetchLiveEtas([shp], truckLocations); }}
                            className="mt-2.5 w-full py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
                          >
                            <Zap className="w-3 h-3" />
                            Compute AI ETA
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Right: Live Map for selected shipment */}
              <div className="xl:col-span-2">
                {selectedLiveShipment ? (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                          <Navigation className="w-3.5 h-3.5 text-cyan-600" />
                          Live Route — {selectedLiveShipment.trucks?.vehicle_number || 'Truck'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          PO: <strong className="text-blue-700">{selectedLiveShipment.purchase_orders?.po_number || '—'}</strong>
                          {' · '}
                          Shipment: <strong>{selectedLiveShipment.shipment_number}</strong>
                          {' · '}
                          Supplier: <strong>{selectedLiveShipment.purchase_orders?.suppliers?.supplier_name || '—'}</strong>
                        </div>
                      </div>
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        selectedLiveShipment.status === 'ARRIVED' ? 'bg-emerald-600 text-white'
                        : selectedLiveShipment.status === 'ARRIVING' ? 'bg-amber-500 text-white animate-pulse'
                        : 'bg-cyan-600 text-white'
                      }`}>{selectedLiveShipment.status}</span>
                    </div>
                    <div className="h-96">
                      <TruckTrackingMap shipment={selectedLiveShipment} compact={false} />
                    </div>
                    {/* PO Details Grid */}
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 text-xs">
                      <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-100">
                        <div className="text-[10px] font-bold text-indigo-500 uppercase mb-0.5">PO Number</div>
                        <div className="font-extrabold text-indigo-900 font-mono">{selectedLiveShipment.purchase_orders?.po_number || '—'}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">PO Value</div>
                        <div className="font-extrabold text-slate-900">₹{Number(selectedLiveShipment.purchase_orders?.total_amount || 0).toLocaleString('en-IN')}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Supplier City</div>
                        <div className="font-extrabold text-slate-900">{selectedLiveShipment.purchase_orders?.suppliers?.city || '—'}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Cargo Qty</div>
                        <div className="font-extrabold text-slate-900">{selectedLiveShipment.total_quantity || '—'} units</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 h-96 flex flex-col items-center justify-center text-slate-400 shadow-xs">
                    <Navigation className="w-10 h-10 mb-3 text-slate-300" />
                    <p className="text-sm font-bold">Select a truck to view live route</p>
                    <p className="text-xs mt-1">Click any truck card on the left to see its GPS map</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
              Verify &amp; Gate In
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* 1. PO-FIRST SEARCH — Primary way to link a truck to a PO */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
            <label className="font-extrabold text-blue-800 block mb-2 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Search by PO Number (Quick Auto-Fill)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Type PO number e.g. PO-2026-001"
                value={poSearchInput}
                onChange={e => handlePoSearchSelect(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            {/* Quick Pick Dispatched POs */}
            {shipments.filter(s => ['DISPATCHED', 'IN_TRANSIT', 'ARRIVING', 'ARRIVED'].includes(s.status)).length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-500">Dispatched POs:</span>
                {shipments
                  .filter(s => ['DISPATCHED', 'IN_TRANSIT', 'ARRIVING', 'ARRIVED'].includes(s.status))
                  .slice(0, 6)
                  .map((s) => {
                    const poNum = s.purchase_orders?.po_number || s.po_id;
                    if (!poNum) return null;
                    return (
                      <button
                        key={s.shipment_id}
                        type="button"
                        onClick={() => handlePoSearchSelect(poNum)}
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold border transition-all cursor-pointer ${
                          poSearchInput === poNum
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                        }`}
                      >
                        {poNum} {s.status === 'ARRIVED' ? '🟢' : '🚚'}
                      </button>
                    );
                  })}
              </div>
            )}
            {/* PO Summary Card — auto-populated */}
            {checkInPoSummary && (
              <div className="mt-2.5 p-3 rounded-lg bg-white border border-blue-300 space-y-2">
                <div className="font-extrabold text-blue-900 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  PO Found — All fields auto-filled
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">PO Number</span>
                    <span className="font-extrabold text-blue-700 font-mono">{checkInPoSummary.purchase_orders?.po_number || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Supplier</span>
                    <span className="font-bold text-slate-800">{checkInPoSummary.purchase_orders?.suppliers?.supplier_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Truck</span>
                    <span className="font-bold text-slate-800">{checkInPoSummary.trucks?.vehicle_number || trucks.find(t => t.truck_id === checkInState.truck_id)?.vehicle_number || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Driver</span>
                    <span className="font-bold text-slate-800">{checkInPoSummary.trucks?.driver_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Shipment</span>
                    <span className="font-mono font-bold text-slate-800">{checkInPoSummary.shipment_number || checkInPoSummary.shipment_id?.slice(0, 12) || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Status</span>
                    <span className={`font-extrabold ${
                      checkInPoSummary.status === 'ARRIVED' ? 'text-emerald-700' : 'text-amber-700'
                    }`}>{checkInPoSummary.status}</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">PO Value: <strong className="text-slate-700">₹{Number(checkInPoSummary.purchase_orders?.total_amount || 0).toLocaleString('en-IN')}</strong></div>
              </div>
            )}
            {poSearchInput && !checkInPoSummary && (
              <div className="mt-2 text-[11px] text-amber-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                No matching PO found. Try selecting shipment manually below.
              </div>
            )}
          </div>

          <div className="text-[10px] text-center text-slate-400 font-semibold">── OR select manually below ──</div>

          {/* Shipment / general search */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Search Shipment / Truck / Supplier</label>
            <input
              type="text"
              placeholder="Type shipment number, truck, driver or supplier..."
              value={shipmentSearch}
              onChange={e => setShipmentSearch(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Truck */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Arriving Carrier Truck</label>
            <select
              value={checkInState.truck_id}
              onChange={(e) => setCheckInState({ ...checkInState, truck_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              <option value="">— Select Truck —</option>
              {trucks
                .filter(t => t.status !== 'IN_YARD' && t.status !== 'AT_DOCK')
                .filter(t => !shipmentSearch ||
                  t.vehicle_number?.toLowerCase().includes(shipmentSearch.toLowerCase()) ||
                  t.driver_name?.toLowerCase().includes(shipmentSearch.toLowerCase())
                )
                .map((t) => (
                  <option key={t.truck_id} value={t.truck_id}>
                    {t.vehicle_number} — {t.driver_name}
                  </option>
              ))}
            </select>
          </div>

          {/* Linked Shipment */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Linked Inbound Shipment &amp; PO</label>
            <select
              value={checkInState.shipment_id}
              onChange={(e) => {
                const selectedShp = shipments.find((s) => s.shipment_id === e.target.value);
                setCheckInPoSummary(selectedShp || null);
                setPoSearchInput(selectedShp?.purchase_orders?.po_number || '');
                setCheckInState({
                  ...checkInState,
                  shipment_id: e.target.value,
                  truck_id: selectedShp?.trucks?.truck_id || selectedShp?.truck_id || checkInState.truck_id,
                });
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              <option value="">— Direct Gate Verification (No Shipment) —</option>
              {shipments
                .filter(s =>
                  s.status !== 'UNLOADED' &&
                  s.status !== 'COMPLETED' &&
                  s.status !== 'DEPARTED' &&
                  s.status !== 'CANCELLED'
                )
                .filter(s => !shipmentSearch ||
                  s.shipment_number?.toLowerCase().includes(shipmentSearch.toLowerCase()) ||
                  s.purchase_orders?.po_number?.toLowerCase().includes(shipmentSearch.toLowerCase()) ||
                  s.purchase_orders?.suppliers?.supplier_name?.toLowerCase().includes(shipmentSearch.toLowerCase()) ||
                  s.trucks?.vehicle_number?.toLowerCase().includes(shipmentSearch.toLowerCase())
                )
                .map((s) => (
                  <option key={s.shipment_id} value={s.shipment_id}>
                    {s.status === 'ARRIVED' ? '🟢 [ARRIVED AT GATE] ' : ''}Shipment: {s.shipment_number} | PO: {s.purchase_orders?.po_number || s.po_id || 'N/A'} — {s.purchase_orders?.suppliers?.supplier_name || 'Vendor'} ({s.status})
                  </option>
              ))}
            </select>
          </div>

          {/* Yard */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Destination Yard Zone</label>
            <select
              value={checkInState.yard_id}
              onChange={(e) => setCheckInState({ ...checkInState, yard_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              {yards.map((y) => (
                <option key={y.yard_id} value={y.yard_id}>{y.yard_name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Gate Notes (Optional)</label>
            <textarea
              value={checkInState.notes}
              onChange={e => setCheckInState({ ...checkInState, notes: e.target.value })}
              placeholder="Seal number, condition notes, security remarks..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 resize-none focus:outline-none focus:border-blue-400"
            />
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

      {/* Parking Assignment Modal */}
      <Modal
        isOpen={parkingDialog.open}
        onClose={() => setParkingDialog({ open: false, slot: null })}
        title={`Assign Parking Slot: ${parkingDialog.slot?.slot_code}`}
        subtitle={`Yard: ${parkingDialog.slot?.yards?.yard_name || ''}`}
        maxWidth="sm"
        footer={
          <>
            <button onClick={() => setParkingDialog({ open: false, slot: null })} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleAssignParking} className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs">Assign Slot</button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Select Shipment to Park</label>
            <select
              value={parkingShipmentId}
              onChange={e => setParkingShipmentId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              <option value="">— Select Shipment —</option>
              {shipments.map(s => (
                <option key={s.shipment_id} value={s.shipment_id}>
                  {s.shipment_number} — {s.total_quantity} units
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Truck (Optional)</label>
            <select
              value={parkingTruckId}
              onChange={e => setParkingTruckId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              <option value="">— Select Truck (Optional) —</option>
              {trucks.map(t => (
                <option key={t.truck_id} value={t.truck_id}>{t.vehicle_number} — {t.driver_name}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default YardManagement;
