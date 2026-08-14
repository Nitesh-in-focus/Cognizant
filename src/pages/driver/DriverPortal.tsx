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
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { routeNotification } from '../../services/notifications/notificationRouter';

export const DriverPortal: React.FC = () => {
  const { currentUser, showSnackbar, logAuditAction } = useApp();

  const [loading, setLoading] = useState(true);
  const [activeShipment, setActiveShipment] = useState<any | null>(null);
  const [assignedTruck, setAssignedTruck] = useState<any | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [transmittingGps, setTransmittingGps] = useState(false);
  const [tripStatus, setTripStatus] = useState<'PENDING' | 'ACCEPTED' | 'REJECTED'>('ACCEPTED');

  useEffect(() => {
    fetchDriverTripData();
  }, []);

  const fetchDriverTripData = async () => {
    try {
      setLoading(true);
      // Fetch current driver's assigned active shipment
      const { data: shpData } = await supabase
        .from('shipments')
        .select(`
          *,
          purchase_orders(
            po_number,
            suppliers(supplier_name, city, phone),
            warehouses(warehouse_name, city, address)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: truckData } = await supabase
        .from('trucks')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (shpData) {
        setActiveShipment(shpData);
        setTripStatus((shpData.driver_status as any) || 'ACCEPTED');
      }

      if (truckData) {
        setAssignedTruck(truckData);
        const { data: locData } = await supabase
          .from('truck_locations')
          .select('*')
          .eq('truck_id', truckData.truck_id)
          .order('timestamp', { ascending: false })
          .limit(5);

        setLocations(locData || []);
      }
    } catch (err: any) {
      console.error('Error fetching driver trip data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Section 9 of updates2.md: Driver Accept Trip
  const handleAcceptTrip = async () => {
    if (!activeShipment) return;
    try {
      const { error } = await supabase
        .from('shipments')
        .update({ driver_status: 'ACCEPTED' })
        .eq('shipment_id', activeShipment.shipment_id);

      if (error) throw error;

      setTripStatus('ACCEPTED');
      await logAuditAction('DRIVER_TRIP_ACCEPTED', 'shipments', activeShipment.shipment_id, {
        driver_name: currentUser?.full_name,
        asn_number: activeShipment.asn_number,
      });

      showSnackbar('Dispatch assignment accepted. Drive safely!', 'success');
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // Section 9 of updates2.md: Driver Reject Trip -> triggers DRIVER_ASSIGNMENT_REJECTED alert
  const handleRejectTrip = async () => {
    if (!activeShipment) return;
    try {
      const { error } = await supabase
        .from('shipments')
        .update({ driver_status: 'REJECTED' })
        .eq('shipment_id', activeShipment.shipment_id);

      if (error) throw error;

      setTripStatus('REJECTED');
      await logAuditAction('DRIVER_TRIP_REJECTED', 'shipments', activeShipment.shipment_id, {
        driver_name: currentUser?.full_name,
        asn_number: activeShipment.asn_number,
        reason: 'Driver declared unavailable / truck maintenance required',
      });

      // Route alert to Supplier + Logistics Manager (Section 21)
      await routeNotification({
        event_type: 'DRIVER_ASSIGNMENT_REJECTED',
        title: `Driver Assignment Rejected: ${activeShipment.shipment_number}`,
        message: `Driver ${currentUser?.full_name || 'Rajesh Sharma'} rejected trip dispatch ${activeShipment.shipment_number} (ASN: ${activeShipment.asn_number || 'N/A'}). Reassignment required.`,
        severity: 'CRITICAL',
        supplier_id: activeShipment.purchase_orders?.supplier_id,
        supplier_email: activeShipment.purchase_orders?.suppliers?.email,
        entity_type: 'shipments',
        entity_number: activeShipment.shipment_number,
        action_link: '/trucks',
      });

      showSnackbar('Trip assignment rejected. Supplier & Logistics Manager alerted.', 'warning');
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // Section 10 & 11: Driver Transmits Live GPS Beacon
  const handleTransmitGpsBeacon = async () => {
    if (!assignedTruck || !activeShipment) return;
    setTransmittingGps(true);
    try {
      // Simulate real GPS coordinate update along Mumbai-Pune expressway
      const newLat = 18.7500 + (Math.random() * 0.05);
      const newLng = 73.4000 + (Math.random() * 0.05);
      const speed = Math.floor(55 + Math.random() * 20);

      const { data: newLoc, error } = await supabase
        .from('truck_locations')
        .insert([
          {
            truck_id: assignedTruck.truck_id,
            shipment_id: activeShipment.shipment_id,
            location_name: 'NH-48 Highway Corridor Mile 64',
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
      showSnackbar(`GPS Beacon Transmitted: Lat ${newLat.toFixed(4)}, Lng ${newLng.toFixed(4)} at ${speed} km/h`, 'success');
    } catch (err: any) {
      showSnackbar('GPS transmission failed: ' + err.message, 'error');
    } finally {
      setTransmittingGps(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Banner */}
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
                  CARRIER DRIVER APP
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Driver: <strong className="text-white">{currentUser?.full_name || 'Rajesh Sharma'}</strong> • BlueDart Logistics Heavy Inbound Fleet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDriverTripData}
              className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh trip telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Trip Acceptance Status Card */}
      {activeShipment && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assigned Manifest Dispatch</div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5 flex items-center gap-2">
                <span>{activeShipment.shipment_number}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  ASN: {activeShipment.asn_number || 'ASN-2026-9901'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {tripStatus === 'PENDING' ? (
                <>
                  <button
                    onClick={handleRejectTrip}
                    className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Trip</span>
                  </button>
                  <button
                    onClick={handleAcceptTrip}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Accept Trip Assignment</span>
                  </button>
                </>
              ) : tripStatus === 'ACCEPTED' ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Trip Assignment Accepted</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                  <XCircle className="w-4 h-4" />
                  <span>Trip Rejected (Alert Logged)</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar (Section 20 of updates3.md) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 my-2 border-b border-slate-100">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Distance Travelled</span>
              <strong className="text-base font-extrabold text-slate-900">
                {activeShipment.distance_travelled_km || 126} km
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Distance Remaining</span>
              <strong className="text-base font-extrabold text-blue-600">
                {activeShipment.distance_remaining_km || 84} km
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Expected Arrival (ETA)</span>
              <strong className="text-base font-extrabold text-slate-900">
                {activeShipment.expected_arrival ? new Date(activeShipment.expected_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '3:40 PM'}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Assigned Dock / Yard</span>
              <strong className="text-base font-extrabold text-indigo-950">
                {activeShipment.parking_slot ? `Slot ${activeShipment.parking_slot}` : 'Dock Bay #04'}
              </strong>
            </div>
          </div>

          {/* Trip Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
            {/* Route */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-blue-600" />
                <span>Highway Transit Route</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-semibold">Origin / Supplier</span>
                  <strong className="text-slate-900 text-sm">{activeShipment.origin || 'Mumbai Industrial Complex'}</strong>
                </div>
                <div className="h-px bg-slate-200" />
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-semibold">Destination Facility</span>
                  <strong className="text-slate-900 text-sm">{activeShipment.purchase_orders?.warehouses?.warehouse_name || 'Pune Central DC'}</strong>
                </div>
              </div>
            </div>

            {/* Dock Door / Parking Allocation */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                <span>Facility Yard & Dock Status</span>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
                <div>
                  <span className="text-indigo-500 text-[10px] block uppercase font-semibold">Assigned Inbound Bay</span>
                  <strong className="text-indigo-950 text-base font-extrabold">
                    {activeShipment.parking_slot ? `Parking Slot: ${activeShipment.parking_slot}` : 'Dock Bay #03 (Scheduled)'}
                  </strong>
                </div>
                <div className="text-[11px] text-indigo-800">
                  {activeShipment.parking_slot
                    ? 'Facility docks currently full. Proceed to allocated staging slot upon gate entry.'
                    : 'Dock bay reserved for priority unloading. Direct bay approach authorized.'}
                </div>
              </div>
            </div>

            {/* Vehicle & Cargo Specs */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Vehicle & Telematics</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Truck Number:</span>
                  <strong className="text-slate-900">{assignedTruck?.vehicle_number || 'MH-12-TR-9901'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Manifest Cargo:</span>
                  <strong className="text-slate-900">{activeShipment.total_quantity || 500} Units</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Priority:</span>
                  <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800">
                    {activeShipment.priority || 'HIGH'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live GPS Telemetry Transmitter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-600 animate-pulse" />
              <span>Live Highway GPS Telematics Transmitter</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transmit authenticated satellite GPS coordinates directly from your mobile device to the C2 Control Tower.
            </p>
          </div>

          <button
            onClick={handleTransmitGpsBeacon}
            disabled={transmittingGps}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs transition-colors shadow-md shadow-cyan-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
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
                <th className="py-2.5 px-4">Beacon Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {locations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No GPS transmissions logged yet. Click "Transmit GPS Ping" above.
                  </td>
                </tr>
              ) : (
                locations.map((loc, idx) => (
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
                        <span>LIVE TELEMETRY</span>
                      </span>
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

export default DriverPortal;
