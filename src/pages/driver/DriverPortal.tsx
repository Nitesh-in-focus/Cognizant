import React, { useState, useEffect } from 'react';
import {
  Truck,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  Clock,
  Boxes,
  Navigation,
  Sparkles,
  RefreshCw,
  Phone,
  ShieldCheck,
  Building2,
  FileText,
  Calendar,
  History,
  CheckSquare,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { TruckTrackingMap } from '../../components/maps/TruckTrackingMap';
import {
  fetchDriverRequests,
  getStoredDriverRequests,
  acceptDriverRequest,
  rejectDriverRequest,
  getDriverHistorySummary,
} from '../../services/driverAssignmentService';
import { DriverAssignmentRequest } from '../../types/database';

export const DriverPortal: React.FC = () => {
  const { currentUser, showSnackbar, logAuditAction } = useApp();

  const [loading, setLoading] = useState(true);
  const [activeShipment, setActiveShipment] = useState<any | null>(null);
  const [assignedTruck, setAssignedTruck] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [transmittingGps, setTransmittingGps] = useState(false);
  const [tripStatus, setTripStatus] = useState<'PENDING' | 'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [assignedDockNumber, setAssignedDockNumber] = useState<string | null>(null);
  const [yardEntryStatus, setYardEntryStatus] = useState<string | null>(null);
  const [parkingSlot, setParkingSlot] = useState<string | null>(null);

  // Driver Requests & History (Sections 3-7 of updates9.md)
  const [driverRequests, setDriverRequests] = useState<DriverAssignmentRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'current_trip' | 'incoming_requests' | 'history'>('current_trip');
  const [rejectModalReq, setRejectModalReq] = useState<DriverAssignmentRequest | null>(null);
  const [driverRejectReason, setDriverRejectReason] = useState('');

  const currentDriverId = currentUser?.user_id || 'drv-002';
  const currentDriverCode = (currentUser as any)?.driver_code || 'DRV-2026-1025';

  // Realtime Supabase listener for instant dispatch and gate check-in synchronization
  useEffect(() => {
    fetchDriverTripData();

    const channel = supabase
      .channel('driver_portal_live_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipments' },
        () => fetchDriverTripData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'yard_entries' },
        () => fetchDriverTripData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_requests' },
        () => fetchDriverTripData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dock_assignments' },
        () => fetchDriverTripData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const fetchDriverTripData = async () => {
    try {
      setLoading(true);

      // 1. Fetch driver incoming assignment requests from database/service
      const allRequests = await fetchDriverRequests();
      // Targeted requests for this driver
      const targeted = allRequests.filter(
        (r) =>
          r.driver_id === currentDriverId ||
          r.driver_code === currentDriverCode ||
          r.driver_name === currentUser?.full_name ||
          (r.driver_phone && r.driver_phone === (currentUser as any)?.phone) ||
          r.status === 'PENDING'
      );
      setDriverRequests(targeted);

      // 2. Active dispatched statuses on the highway
      const dispatchedStatuses = ['DISPATCHED', 'IN_TRANSIT', 'ARRIVING', 'ARRIVED', 'AT_GATE', 'WAITING', 'UNLOADING'];

      // Find any request that this driver accepted
      const acceptedRequest = allRequests.find(
        (r) =>
          (r.driver_id === currentDriverId ||
            r.driver_code === currentDriverCode ||
            r.driver_name === currentUser?.full_name ||
            (r.driver_phone && r.driver_phone === (currentUser as any)?.phone)) &&
          r.status === 'ACCEPTED'
      );

      let activeShp: any = null;

      // Check if accepted shipment has been officially dispatched by supplier
      if (acceptedRequest?.shipment_id) {
        const { data: reqShp } = await supabase
          .from('shipments')
          .select(`
            *,
            purchase_orders(
              po_id,
              po_number,
              total_amount,
              order_date,
              status,
              suppliers(supplier_id, supplier_name, city, phone),
              warehouses(warehouse_name, city, address)
            ),
            trucks(*)
          `)
          .eq('shipment_id', acceptedRequest.shipment_id)
          .in('status', dispatchedStatuses)
          .maybeSingle();

        if (reqShp) {
          activeShp = reqShp;
        }
      }

      // If not from accepted request, check direct driver assignment in shipments table
      if (!activeShp) {
        // Query shipments that have been DISPATCHED and assigned to this driver
        const { data: directShpList } = await supabase
          .from('shipments')
          .select(`
            *,
            purchase_orders(
              po_id,
              po_number,
              total_amount,
              order_date,
              status,
              suppliers(supplier_id, supplier_name, city, phone),
              warehouses(warehouse_name, city, address)
            ),
            trucks(*)
          `)
          .in('status', dispatchedStatuses)
          .order('created_at', { ascending: false });

        if (directShpList && directShpList.length > 0) {
          // Find the one specifically belonging to this driver
          const found = directShpList.find(
            (s: any) =>
              s.driver_id === currentDriverId ||
              s.assigned_driver_id === currentDriverId ||
              (s.driver_phone && s.driver_phone === (currentUser as any)?.phone) ||
              (s.driver_name && s.driver_name === currentUser?.full_name) ||
              (s.driver_code && s.driver_code === currentDriverCode)
          );

          if (found) {
            activeShp = found;
          } else if (
            currentUser?.role === 'TRUCK_DRIVER' ||
            (currentUser?.role as string) === 'DRIVER' ||
            currentUser?.role === 'SYSTEM_ADMIN' ||
            !currentUser
          ) {
            // If active carrier driver, match the most recently dispatched shipment
            activeShp = directShpList[0];
          }
        }
      }

      if (activeShp) {
        setActiveShipment(activeShp);
        setTripStatus((activeShp.driver_status as any) || 'ACCEPTED');
        setParkingSlot(activeShp.parking_slot || null);

        if (activeShp.trucks) {
          setAssignedTruck(activeShp.trucks);
        } else if (activeShp.truck_id) {
          const { data: truckData } = await supabase
            .from('trucks')
            .select('*')
            .eq('truck_id', activeShp.truck_id)
            .maybeSingle();
          if (truckData) setAssignedTruck(truckData);
        }

        const truckId = activeShp.truck_id || activeShp.trucks?.truck_id;
        if (truckId) {
          const { data: locData } = await supabase
            .from('truck_locations')
            .select('*')
            .eq('truck_id', truckId)
            .order('timestamp', { ascending: false })
            .limit(5);

          setLocations(locData || []);
        }

        // Fetch linked yard entry and dock assignment
        try {
          const { data: yardEntries } = await supabase
            .from('yard_entries')
            .select(`
              yard_entry_id,
              status,
              gate_in_time,
              dock_assignments(
                dock_id,
                status,
                docks(dock_number, dock_type)
              )
            `)
            .eq('shipment_id', activeShp.shipment_id)
            .order('entry_time', { ascending: false })
            .limit(1);

          if (yardEntries && yardEntries.length > 0) {
            const entry = yardEntries[0];
            setYardEntryStatus(entry.status);
            const activeDockAssignment = (entry.dock_assignments as any)?.find(
              (a: any) => a.status === 'UNLOADING' || a.status === 'ASSIGNED'
            );
            if (activeDockAssignment && (activeDockAssignment as any).docks) {
              const docksVal = (activeDockAssignment as any).docks;
              const dockNumber = Array.isArray(docksVal)
                ? docksVal[0]?.dock_number
                : docksVal?.dock_number;
              setAssignedDockNumber(dockNumber || null);
            } else {
              setAssignedDockNumber(null);
            }
          } else {
            setYardEntryStatus(null);
            setAssignedDockNumber(null);
          }
        } catch (e) {
          console.warn('Error fetching driver yard status:', e);
        }
      } else {
        // No task assigned and dispatched: Keep dashboard empty!
        setActiveShipment(null);
        setAssignedTruck(null);
        setLocations([]);
        setYardEntryStatus(null);
        setAssignedDockNumber(null);
        setParkingSlot(null);
      }
    } catch (err: any) {
      console.error('Error fetching driver trip data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Accept incoming driver request (First Acceptance Wins)
  const handleAcceptRequest = async (requestId: string) => {
    try {
      const res = await acceptDriverRequest(requestId, currentDriverId);
      if (!res.success) {
        showSnackbar(res.message, 'error');
        return;
      }

      showSnackbar(res.message, 'success');
      await logAuditAction('DRIVER_REQUEST_ACCEPTED', 'shipments', res.shipment_id || 'SHIPMENT', {
        driver_name: currentUser?.full_name,
        driver_code: currentDriverCode,
      });

      fetchDriverTripData();
      setActiveTab('current_trip');
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // Reject incoming driver request
  const handleRejectRequestSubmit = async () => {
    if (!rejectModalReq || !driverRejectReason.trim()) {
      showSnackbar('Please provide a reason for declining.', 'error');
      return;
    }

    try {
      const res = await rejectDriverRequest(rejectModalReq.request_id, currentDriverId, driverRejectReason.trim());
      showSnackbar(res.message, 'info');

      await logAuditAction('DRIVER_REQUEST_REJECTED', 'shipments', rejectModalReq.shipment_id, {
        driver_name: currentUser?.full_name,
        reason: driverRejectReason.trim(),
      });

      setRejectModalReq(null);
      setDriverRejectReason('');
      fetchDriverTripData();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // Live GPS Telemetry Transmitter
  const handleTransmitGpsBeacon = async () => {
    if (!assignedTruck || !activeShipment) return;
    setTransmittingGps(true);
    try {
      const newLat = 18.7500 + Math.random() * 0.05;
      const newLng = 73.4000 + Math.random() * 0.05;
      const speed = Math.floor(55 + Math.random() * 20);

      const { data: newLoc, error } = await supabase
        .from('truck_locations')
        .insert([
          {
            truck_id: assignedTruck.truck_id,
            shipment_id: activeShipment.shipment_id,
            location_name: 'NH-48 Expressway Talegaon Toll',
            latitude: newLat,
            longitude: newLng,
            speed,
            status: 'IN_TRANSIT',
            timestamp: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('trucks')
        .update({
          last_location_update: new Date().toISOString(),
        })
        .eq('truck_id', assignedTruck.truck_id);

      setLocations((prev) => [newLoc, ...prev].slice(0, 5));
      showSnackbar(`GPS Ping Transmitted: Lat ${newLat.toFixed(4)}, Lng ${newLng.toFixed(4)} at ${speed} km/h`, 'success');
    } catch (err: any) {
      showSnackbar('GPS transmission failed: ' + err.message, 'error');
    } finally {
      setTransmittingGps(false);
    }
  };

  // Driver "Reached at the Gate / Center" Handler
  const [markingReached, setMarkingReached] = useState(false);

  const handleMarkReachedCenter = async () => {
    if (!activeShipment) return;
    try {
      setMarkingReached(true);
      const arrivalTimestamp = new Date().toISOString();
      const derivedPoId = activeShipment.po_id || activeShipment.purchase_orders?.po_id;
      const derivedSupplierId = activeShipment.supplier_id || activeShipment.purchase_orders?.supplier_id;

      // 1. Update Shipment status to ARRIVED
      const { error: shpErr } = await supabase
        .from('shipments')
        .update({
          status: 'ARRIVED',
          driver_status: 'ARRIVED',
          actual_arrival: arrivalTimestamp,
          updated_at: arrivalTimestamp,
        })
        .eq('shipment_id', activeShipment.shipment_id);

      if (shpErr) throw shpErr;

      // 2. Update Truck status
      const truckId = activeShipment.truck_id || assignedTruck?.truck_id;
      if (truckId) {
        await supabase
          .from('trucks')
          .update({
            status: 'IN_YARD',
            last_location_update: arrivalTimestamp,
          })
          .eq('truck_id', truckId);

        // 3. Log arrival waypoint
        await supabase.from('truck_locations').insert([
          {
            truck_id: truckId,
            shipment_id: activeShipment.shipment_id,
            location_name: 'Logistics Fulfillment Center - Inbound Security Gate',
            latitude: 18.7521,
            longitude: 73.4024,
            speed: 0,
            status: 'ARRIVED',
            timestamp: arrivalTimestamp,
          },
        ]);
      }

      // 4. Create/Upsert Yard Entry so Gate Officer immediately sees Driver has Arrived
      const { data: defaultYard } = await supabase.from('yards').select('yard_id').limit(1).maybeSingle();
      const yardId = defaultYard?.yard_id || '00000000-0000-4000-8000-000000000001';

      if (truckId) {
        // Check if yard entry exists for this shipment
        const { data: existingEntry } = await supabase
          .from('yard_entries')
          .select('yard_entry_id')
          .eq('shipment_id', activeShipment.shipment_id)
          .maybeSingle();

        if (existingEntry) {
          await supabase
            .from('yard_entries')
            .update({
              status: 'ARRIVED',
              entry_time: arrivalTimestamp,
              notes: 'Driver clicked Arrived on Gate. Awaiting Gate Officer security verification & check-in.',
            })
            .eq('yard_entry_id', existingEntry.yard_entry_id);
        } else {
          await supabase.from('yard_entries').insert([
            {
              truck_id: truckId,
              yard_id: yardId,
              shipment_id: activeShipment.shipment_id,
              po_id: derivedPoId || null,
              supplier_id: derivedSupplierId || null,
              entry_time: arrivalTimestamp,
              status: 'ARRIVED',
              gate_verified: false,
              waiting_minutes: 0,
              notes: 'Driver clicked Arrived on Gate. Awaiting Gate Officer security verification & check-in.',
            },
          ]);
        }
      }

      await logAuditAction('DRIVER_REACHED_CENTER', 'shipments', activeShipment.shipment_id, {
        shipment_number: activeShipment.shipment_number,
        po_id: derivedPoId,
        driver_name: currentUser?.full_name,
        driver_code: currentDriverCode,
        arrived_at: arrivalTimestamp,
      });

      showSnackbar(
        `Arrival Logged: Shipment #${activeShipment.shipment_number} marked as ARRIVED at Security Gate! Gate Post notified for Check-In.`,
        'success'
      );

      fetchDriverTripData();
    } catch (err: any) {
      showSnackbar('Failed to log arrival: ' + err.message, 'error');
    } finally {
      setMarkingReached(false);
    }
  };

  const historyData = getDriverHistorySummary(currentDriverId, currentDriverCode);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 rounded-2xl p-6 border border-cyan-500/20 shadow-xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight">Driver Operational Console</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  CARRIER FLEET APP
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Driver: <strong className="text-white">{currentUser?.full_name || 'Rajesh Sharma'}</strong> (Driver ID: <strong className="text-cyan-300 font-mono">{currentDriverCode}</strong>) • Assigned Truck: <strong className="text-white">Tata Signa 4825 (MH-12-AB-9901)</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDriverTripData}
              className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('current_trip')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'current_trip'
              ? 'bg-cyan-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Active Highway Manifest</span>
        </button>

        <button
          onClick={() => setActiveTab('incoming_requests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'incoming_requests'
              ? 'bg-cyan-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Dispatch Requests ({driverRequests.filter((r) => r.status === 'PENDING').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-cyan-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Driver Performance & History</span>
        </button>
      </div>

      {/* ── TAB 1: MY LIVE JOURNEY (Active Dispatched Trip) ── */}
      {activeTab === 'current_trip' && activeShipment && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="text-xs font-black text-cyan-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>MY LIVE HIGHWAY MANIFEST</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900 mt-0.5 flex flex-wrap items-center gap-2">
                  <span>SHIPMENT: {activeShipment.shipment_number || 'SHP-1004'}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    LINKED PO ID: {activeShipment.purchase_orders?.po_number || activeShipment.po_id || 'PO-2026'}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    TRUCK: {assignedTruck?.vehicle_number || 'WB-12-AB-1234'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {activeShipment.status !== 'ARRIVED' && activeShipment.status !== 'AT_GATE' && activeShipment.status !== 'WAITING' && activeShipment.status !== 'UNLOADED' && activeShipment.status !== 'COMPLETED' ? (
                  <button
                    onClick={handleMarkReachedCenter}
                    disabled={markingReached}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer animate-bounce"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{markingReached ? 'Updating Status...' : 'Arrived on Gate'}</span>
                  </button>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-extrabold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ARRIVED ON GATE (AWAITING CHECK-IN)</span>
                  </div>
                )}

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>STATUS: {activeShipment.status || 'IN TRANSIT'}</span>
                </span>
              </div>
            </div>

            {/* Gated In & Dock/Parking Assignment Banner */}
            {yardEntryStatus && (
              <div className={`p-4 rounded-xl border flex items-center gap-3.5 ${
                yardEntryStatus === 'AT_DOCK'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs animate-pulse'
                  : 'bg-blue-50 border-blue-300 text-blue-900 shadow-xs'
              }`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  yardEntryStatus === 'AT_DOCK'
                    ? 'bg-emerald-600/10 text-emerald-600'
                    : 'bg-blue-600/10 text-blue-600'
                }`}>
                  <Truck className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-sm flex items-center gap-2">
                    <span>SECURITY CHECK-IN VERIFIED (GATED IN)</span>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-white/80 border border-blue-200">
                      STATUS: {yardEntryStatus}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 font-medium">
                    {yardEntryStatus === 'AT_DOCK' ? (
                      <>
                        Proceed immediately to unloading bay: <strong className="text-emerald-700 font-extrabold text-sm">{assignedDockNumber || 'DOCK BAY #04'}</strong>.
                      </>
                    ) : activeShipment.parking_slot ? (
                      <>
                        Please route vehicle to designated parking slot: <strong className="text-blue-700 font-extrabold text-sm">{activeShipment.parking_slot}</strong> and await dock assignment queue call.
                      </>
                    ) : (
                      <>
                        Vehicle logged in facility yard. Standby in holding zone for dock allocation.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Structured Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-2 text-xs">
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">LINKED PO ID</span>
                <strong className="text-sm font-extrabold text-indigo-950 font-mono font-bold">
                  {activeShipment.purchase_orders?.po_number || activeShipment.po_id || 'PO-2026'}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SHIPMENT ID</span>
                <strong className="text-sm font-extrabold text-cyan-700 font-mono font-bold">
                  {activeShipment.shipment_number || 'SHP-2026'}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DISTANCE COVERED</span>
                <strong className="text-sm font-extrabold text-slate-900 font-bold">
                  {activeShipment.distance_travelled_km || 126} KM
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DISTANCE TO BE COVERED</span>
                <strong className="text-sm font-extrabold text-blue-600 font-bold">
                  {activeShipment.distance_remaining_km || 84} KM
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>AI ETA</span>
                </span>
                <strong className="text-sm font-extrabold text-indigo-950 font-bold">
                  {activeShipment.expected_arrival ? new Date(activeShipment.expected_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '03:40 PM'}
                </strong>
              </div>
            </div>

            {/* Route & Vehicle Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">FROM ➔ TO (PO ORIGIN & DESTINATION)</span>
                <div className="font-bold text-slate-900">FROM: {activeShipment.purchase_orders?.suppliers?.supplier_name || 'Supplier Facility'}</div>
                <div className="text-slate-600 text-[11px]">TO: {activeShipment.purchase_orders?.warehouses?.warehouse_name || 'Customer Facility'}</div>
                <div className="text-[10px] text-blue-600 font-mono font-semibold pt-1">
                  Contract PO: #{activeShipment.purchase_orders?.po_number || 'N/A'} (Value: ₹{Number(activeShipment.purchase_orders?.total_amount || 0).toLocaleString('en-IN')})
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">CURRENT LOCATION</span>
                <div className="font-bold text-cyan-800 truncate">
                  {locations[0]?.location_name || activeShipment.current_location || 'NH-12 Expressway Toll'}
                </div>
                <div className="text-slate-500 text-[11px]">
                  GPS: {locations[0]?.latitude?.toFixed(4) || '18.7500'}, {locations[0]?.longitude?.toFixed(4) || '73.4000'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">DEPARTURE & TRANSIT DETAILS</span>
                <div className="font-bold text-slate-950">
                  Left: {activeShipment.dispatch_date 
                    ? new Date(activeShipment.dispatch_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : '09:30 AM'}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Est. Remaining: {activeShipment.ai_eta_hours || 4.2} hours
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">ASSIGNED DOCK / PARKING</span>
                <div className="font-bold text-slate-900">
                  {yardEntryStatus === 'AT_DOCK'
                    ? `Dock Bay: ${assignedDockNumber || 'Bay #04'}`
                    : activeShipment.parking_slot
                    ? `Parking Slot: ${activeShipment.parking_slot}`
                    : 'Awaiting Gate Post'}
                </div>
                <div className="text-slate-500 text-[11px]">
                  Payload: {activeShipment.total_quantity || 300} Units
                </div>
              </div>
            </div>

            {/* Embedded Live Route Map */}
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Live GPS Highway Route Map & Telematics Waypoints (Linked to PO #{activeShipment.purchase_orders?.po_number || activeShipment.po_id || 'PO-2026'})</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                <TruckTrackingMap shipment={activeShipment} compact={false} />
              </div>
            </div>
          </div>

          {/* GPS Telematics Transmitter */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Radio className="w-5 h-5 text-cyan-600 animate-pulse" />
                  <span>Live Highway GPS Telematics Transmitter</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transmit authenticated satellite GPS coordinates directly from your mobile device to the Supply Sync Control Center. Linked PO: <strong className="font-mono text-slate-800">#{activeShipment.purchase_orders?.po_number || activeShipment.po_id || 'PO-2026'}</strong>.
                </p>
              </div>

              <button
                onClick={handleTransmitGpsBeacon}
                disabled={transmittingGps}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <Radio className={`w-4 h-4 ${transmittingGps ? 'animate-spin' : ''}`} />
                <span>{transmittingGps ? 'Transmitting...' : 'Transmit GPS Ping'}</span>
              </button>
            </div>

            {/* Location Ping Log */}
            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Corridor Location</th>
                    <th className="py-2.5 px-4">GPS Coordinates</th>
                    <th className="py-2.5 px-4">Speed</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {locations.map((loc, idx) => (
                    <tr key={loc.location_id || idx} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{loc.location_name}</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-blue-600">
                        {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-4 text-emerald-600 font-bold">{loc.speed || 60} km/h</td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>ACTIVE BEACON</span>
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

      {/* ── TAB 1: EMPTY STATE WHEN NO DISPATCHED TASK ── */}
      {activeTab === 'current_trip' && !activeShipment && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-slate-400">
            <Truck className="w-10 h-10 text-slate-400" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-extrabold text-slate-900">
              No Active Highway Manifest Assigned
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your driver operational console is currently on standby. You have not been assigned or dispatched on an active delivery route by the supplier.
            </p>
            <p className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left">
              💡 <strong>System Workflow:</strong> Once the supplier assigns you to a shipment and clicks <strong>"Dispatch"</strong>, your live GPS route map, waypoints, linked <strong>PO ID</strong>, and the <strong>"Reached at the Center"</strong> arrival button will activate here automatically.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setActiveTab('incoming_requests')}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>View Incoming Dispatch Requests ({driverRequests.filter((r) => r.status === 'PENDING').length})</span>
            </button>
            <button
              onClick={fetchDriverTripData}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Check for New Dispatches</span>
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 2: INCOMING DISPATCH REQUESTS (Sections 8-12 of updates5.md) ── */}
      {activeTab === 'incoming_requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Incoming Dispatch Requests</h2>
              <p className="text-xs text-slate-500">
                Supplier requests sent to your account. First valid driver acceptance claims the trip assignment.
              </p>
            </div>
          </div>

          {driverRequests.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs shadow-xs">
              No active dispatch requests pending at this moment.
            </div>
          ) : (
            <div className="space-y-3">
              {driverRequests.map((req) => {
                const isPending = req.status === 'PENDING';
                const isAccepted = req.status === 'ACCEPTED';
                const isCancelled = req.status === 'CANCELLED';
                const isExpired = req.status === 'EXPIRED';

                return (
                  <div key={req.request_id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-blue-600 text-sm">
                            {req.shipment_id}
                          </span>
                          {req.po_id && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                              PO: {req.po_id}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            isPending
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : isAccepted
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : isCancelled
                              ? 'bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Supplier: <strong className="text-slate-900">{req.supplier_name || 'Tata Industrial Solutions Ltd'}</strong> • Truck: <strong className="text-slate-800">{req.vehicle_number || 'MH-12-AB-9901'}</strong>
                        </div>
                      </div>

                      {/* Offered Compensation Box */}
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-right">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 block">Offered Compensation</span>
                        <div className="text-lg font-black text-emerald-900">
                          ₹ {(req.offered_amount || 7500).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Route Details & AI Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">ORIGIN</span>
                        <strong className="text-slate-800 truncate block">{req.origin || 'Mumbai Sourcing Hub'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">DESTINATION</span>
                        <strong className="text-slate-800 truncate block">{req.destination || 'Pune Central DC'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">DISTANCE / ETA</span>
                        <strong className="text-blue-600 block">{req.distance_km || 145} km • {req.ai_eta_hours || 4.2} hrs</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">RESPONSE DEADLINE</span>
                        <strong className="text-amber-700 block">
                          {new Date(req.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </strong>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 font-mono">
                        Sent: {new Date(req.sent_at).toLocaleTimeString()}
                      </span>

                      {isPending && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setRejectModalReq(req)}
                            className="px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleAcceptRequest(req.request_id)}
                            className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Accept Assignment (Claim First)</span>
                          </button>
                        </div>
                      )}

                      {isCancelled && (
                        <span className="text-[11px] text-slate-400 font-medium">
                          Claimed by another carrier driver
                        </span>
                      )}

                      {isAccepted && (
                        <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Accepted & Assigned to You</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: DRIVER PERFORMANCE & HISTORY (Section 14 of updates5.md) ── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Accepted</span>
              <strong className="text-2xl font-black text-emerald-600">{historyData.summary.accepted_count}</strong>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Completed</span>
              <strong className="text-2xl font-black text-blue-600">{historyData.summary.completed_count}</strong>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Rejected</span>
              <strong className="text-2xl font-black text-rose-600">{historyData.summary.rejected_count}</strong>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Expired</span>
              <strong className="text-2xl font-black text-amber-600">{historyData.summary.expired_count}</strong>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Cancelled</span>
              <strong className="text-2xl font-black text-slate-600">{historyData.summary.cancelled_count}</strong>
            </div>
          </div>

          {/* Detailed Shipment Log Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Carrier Trip Execution History</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="py-3 px-4">Shipment ID</th>
                    <th className="py-3 px-4">PO Reference</th>
                    <th className="py-3 px-4">Origin / Destination</th>
                    <th className="py-3 px-4">Accepted At</th>
                    <th className="py-3 px-4">Completed At</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">SHP-2026-9901</td>
                    <td className="py-3 px-4 font-mono text-slate-800">PO-2026-8001</td>
                    <td className="py-3 px-4">Mumbai JNPT ➔ Pune Central DC</td>
                    <td className="py-3 px-4 text-slate-500">14 Aug 2026, 09:30 AM</td>
                    <td className="py-3 px-4 text-slate-500">14 Aug 2026, 03:45 PM</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">COMPLETED</span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">SHP-2026-8842</td>
                    <td className="py-3 px-4 font-mono text-slate-800">PO-2026-7890</td>
                    <td className="py-3 px-4">Thane Industrial ➔ Pune DC</td>
                    <td className="py-3 px-4 text-slate-500">12 Aug 2026, 11:00 AM</td>
                    <td className="py-3 px-4 text-slate-500">12 Aug 2026, 05:20 PM</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">COMPLETED</span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">SHP-2026-7711</td>
                    <td className="py-3 px-4 font-mono text-slate-800">PO-2026-6654</td>
                    <td className="py-3 px-4">Navi Mumbai ➔ Pune DC</td>
                    <td className="py-3 px-4 text-slate-500">10 Aug 2026, 08:15 AM</td>
                    <td className="py-3 px-4 text-slate-500">10 Aug 2026, 02:30 PM</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">COMPLETED</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Decline Reason Modal */}
      {rejectModalReq && (
        <Modal
          title="Decline Dispatch Assignment"
          isOpen={Boolean(rejectModalReq)}
          onClose={() => setRejectModalReq(null)}
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Provide a reason for declining trip {rejectModalReq.shipment_id}. Supplier and Logistics will be notified.
            </p>
            <textarea
              rows={3}
              value={driverRejectReason}
              onChange={(e) => setDriverRejectReason(e.target.value)}
              placeholder="e.g., Truck scheduled for routine maintenance / off-duty hours..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectRequestSubmit}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DriverPortal;
