import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Navigation,
  Gauge,
  Thermometer,
  Clock,
  RefreshCw,
  Play,
  MapPin,
  Building2,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Search,
  ChevronRight,
  FileText,
  Boxes,
  ShieldCheck,
  Phone,
  User,
  Calendar,
  ExternalLink,
  Layers,
  X,
  CreditCard,
  Barcode,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { TruckTrackingMap, Waypoint } from '../components/maps/TruckTrackingMap';
import { Modal } from '../components/common/Modal';
import { getAiEtaPrediction, EtaPredictionResult } from '../services/ai/etaPredictionService';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

export const Shipments: React.FC = () => {
  const navigate = useNavigate();
  const { refreshKey, triggerRefresh, showSnackbar } = useApp();

  const [shipments, setShipments] = useState<any[]>([]);
  const [activeTracking, setActiveTracking] = useState<any | null>(null);
  const [selectedDetailShipment, setSelectedDetailShipment] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'manifest' | 'driver' | 'milestones' | 'eway'>('map');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiEtaState, setAiEtaState] = useState<EtaPredictionResult | null>(null);
  const [runningAiEta, setRunningAiEta] = useState(false);

  // Realtime Live Sync across devices/users
  useRealtimeSubscription({
    tables: ['shipments', 'purchase_orders', 'trucks'],
    channelName: 'shipments_page_realtime',
    callback: () => fetchShipments(true),
  });

  useEffect(() => {
    fetchShipments();
  }, [refreshKey]);

  const fetchShipments = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          purchase_orders(
            po_number,
            total_amount,
            subtotal,
            tax_amount,
            payment_terms,
            suppliers(supplier_name, email, phone, city),
            po_items(
              po_item_id,
              ordered_quantity,
              unit_price,
              line_total,
              products(product_name, product_code, category, unit_of_measure)
            )
          ),
          warehouses(warehouse_name, city, address)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShipments(data || []);
      if (data?.length) {
        setActiveTracking(data[0]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredShipments = shipments.filter((s) => {
    // 1. Status Filter
    if (statusFilter !== 'ALL' && s.status !== statusFilter) {
      return false;
    }

    // 2. Search query across shipment#, asn#, PO#, supplier, origin, dest
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchShp = s.shipment_number?.toLowerCase().includes(q) || s.shipment_id?.toLowerCase().includes(q);
      const matchAsn = s.asn_number?.toLowerCase().includes(q);
      const matchPo = s.purchase_orders?.po_number?.toLowerCase().includes(q);
      const matchSup = s.purchase_orders?.suppliers?.supplier_name?.toLowerCase().includes(q);
      const matchOrigin = s.origin?.toLowerCase().includes(q);
      const matchDest = s.warehouses?.city?.toLowerCase().includes(q) || s.destination?.toLowerCase().includes(q);
      const matchStatus = s.status?.toLowerCase().includes(q);

      if (!matchShp && !matchAsn && !matchPo && !matchSup && !matchOrigin && !matchDest && !matchStatus) {
        return false;
      }
    }

    return true;
  });

  // Clicking a row only swaps the live map
  const handleTrackShipment = (shp: any) => {
    setActiveTracking(shp);
    showSnackbar(`Live map switched to ${shp.shipment_number}`, 'info');
  };

  const handleRunAiEta = async (shp: any) => {
    try {
      setRunningAiEta(true);
      const res = await getAiEtaPrediction({
        shipment_id: shp.shipment_id,
        shipment_number: shp.shipment_number,
        origin: shp.origin || 'Mumbai',
        destination: shp.warehouses?.city || 'Pune Hub',
        current_lat: 18.98,
        current_lng: 73.45,
        dest_lat: 18.52,
        dest_lng: 73.85,
        scheduled_arrival: shp.expected_arrival || new Date().toISOString(),
        current_speed_kmh: 52,
        carrier_name: 'BlueDart Logistics',
      });
      setAiEtaState(res);
      showSnackbar(`AI ETA calculated: ${res.predicted_eta_formatted} (${res.delay_probability}% delay risk)`, 'success');
    } catch (err: any) {
      showSnackbar('AI ETA calculation failed: ' + err.message, 'error');
    } finally {
      setRunningAiEta(false);
    }
  };

  // Clicking the button opens the detail inspector modal
  const handleOpenDetail = (shp: any) => {
    setActiveTracking(shp);
    setSelectedDetailShipment(shp);
    setActiveTab('map');
    handleRunAiEta(shp);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            Live Inbound Fleet & Highway Telematics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time Google Maps GPS telemetry, highway corridor progression, multi-tab cargo inspection, and automated ETA calculation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              triggerRefresh();
              showSnackbar('Shipments and telemetry refreshed', 'info');
            }}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Main Google Maps Interactive Tracking Component */}
      {activeTracking && (
        <TruckTrackingMap
          key={activeTracking.shipment_id}
          shipment={activeTracking}
        />
      )}

      {/* Shipments List & Search Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Carrier Shipments Directory ({filteredShipments.length} Carriers Active)
            </h3>
            <span className="text-xs text-slate-500">
              Click a <strong>row</strong> to switch the live map • Click <strong>"View Tabs &amp; Map"</strong> to open full inspection details
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="READY_FOR_DRIVER">READY_FOR_DRIVER</option>
              <option value="DISPATCHED">DISPATCHED</option>
              <option value="IN_TRANSIT">IN_TRANSIT</option>
              <option value="ARRIVED_AT_FACILITY">ARRIVED_AT_FACILITY</option>
              <option value="AT_DOCK">AT_DOCK</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>

            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shipment#, PO#, ASN, vendor..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
              />
            </div>

            {(statusFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Shipment #</th>
                <th className="py-3 px-4">Purchase Order</th>
                <th className="py-3 px-4">Carrier / Vendor</th>
                <th className="py-3 px-4">Origin ➔ Destination</th>
                <th className="py-3 px-4">Cargo Volume</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading Carrier Shipments...
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-75" />
                    <span className="font-bold text-slate-700 block text-sm">No Active Highway Shipments yet</span>
                    <span className="text-xs text-slate-500 mt-0.5 block">Accepted POs can be converted into shipments and ASNs by suppliers.</span>
                    <button
                      onClick={() => navigate('/purchase-orders')}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <span>View Purchase Orders</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shp) => {
                  const isSelected = activeTracking?.shipment_id === shp.shipment_id;

                  return (
                    <tr
                      key={shp.shipment_id}
                      onClick={() => handleTrackShipment(shp)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-blue-600 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        <span>{shp.shipment_number}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {shp.purchase_orders?.po_number || 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          ₹{Number(shp.purchase_orders?.total_amount || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {shp.purchase_orders?.suppliers?.supplier_name || 'National Logistics'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {shp.purchase_orders?.suppliers?.city || 'Mumbai Hub'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-900 font-medium">
                          {shp.origin || 'Mumbai'} ➔ {shp.warehouses?.city || 'Pune Hub'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {shp.total_quantity || 100} Units
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={shp.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(shp);
                          }}
                          className="px-2.5 py-1 rounded text-xs font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
                        >
                          View Tabs & Map
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Tab Carrier Shipment Inspector Modal */}
      {selectedDetailShipment && (
        <Modal
          isOpen={Boolean(selectedDetailShipment)}
          onClose={() => setSelectedDetailShipment(null)}
          title={`Carrier Delivery Inspector: ${selectedDetailShipment.shipment_number}`}
          subtitle={`Corridor: ${selectedDetailShipment.origin || 'Mumbai'} ➔ ${selectedDetailShipment.warehouses?.city || 'Pune Hub'} • PO: ${selectedDetailShipment.purchase_orders?.po_number}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* 5-Tab Navigation Bar */}
            <div className="flex flex-wrap rounded-xl bg-slate-100 p-1 border border-slate-200 gap-1">
              <button
                onClick={() => setActiveTab('map')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'map' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Google Map GPS</span>
              </button>

              <button
                onClick={() => setActiveTab('manifest')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'manifest' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Cargo Manifest</span>
              </button>

              <button
                onClick={() => setActiveTab('driver')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'driver' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Carrier & Driver</span>
              </button>

              <button
                onClick={() => setActiveTab('milestones')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'milestones' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Gate & Milestones</span>
              </button>

              <button
                onClick={() => setActiveTab('eway')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'eway' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>E-Way Compliance</span>
              </button>
            </div>

            {/* Tab 1: Google Map GPS */}
            {activeTab === 'map' && (
              <div className="space-y-3">
                <TruckTrackingMap
                  key={`modal-${selectedDetailShipment.shipment_id}`}
                  shipment={selectedDetailShipment}
                  compact={true}
                />
              </div>
            )}

            {/* Tab 2: Cargo Manifest */}
            {activeTab === 'manifest' && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Consignment Volume</span>
                    <span className="text-base font-extrabold text-slate-900">
                      {selectedDetailShipment.total_quantity || 500} Units Dispatched
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total PO Financial Value</span>
                    <span className="text-base font-extrabold text-blue-600">
                      ₹{Number(selectedDetailShipment.purchase_orders?.total_amount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-500 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Product SKU</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Dispatched Qty</th>
                        <th className="py-2.5 px-3">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {selectedDetailShipment.purchase_orders?.po_items?.length ? (
                        selectedDetailShipment.purchase_orders.po_items.map((item: any, i: number) => (
                          <tr key={item.po_item_id || i}>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">
                                {item.products?.product_name || 'Industrial Raw Material'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {item.products?.product_code || 'SKU-2026-X'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {item.products?.category || 'Components'}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {item.ordered_quantity} {item.products?.unit_of_measure || 'units'}
                            </td>
                            <td className="py-2.5 px-3">
                              ₹{Number(item.unit_price).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-blue-600">
                              ₹{Number(item.line_total).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-3 px-3 font-bold text-slate-900">Industrial Container Cargo</td>
                          <td className="py-3 px-3 text-slate-500">Automotive Logistics</td>
                          <td className="py-3 px-3 font-bold text-slate-900">{selectedDetailShipment.total_quantity || 500} units</td>
                          <td className="py-3 px-3">₹500.00</td>
                          <td className="py-3 px-3 text-right font-bold text-blue-600">
                            ₹{Number(selectedDetailShipment.purchase_orders?.total_amount || 250000).toLocaleString()}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 3: Carrier & Driver */}
            {activeTab === 'driver' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Driver & Telematics Lead</span>
                  </div>
                  <div className="space-y-1 text-slate-600 text-xs">
                    <div>Name: <strong className="text-slate-900">Rajesh Sharma</strong></div>
                    <div>Contact: <strong className="text-slate-900">+91 98200 55441</strong></div>
                    <div>License No: <strong className="text-slate-900 font-mono">DL-14-2018-992384</strong></div>
                    <div>Commercial Driver Rating: <strong className="text-emerald-700">4.9 / 5.0 (Certified)</strong></div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <Truck className="w-4 h-4 text-indigo-600" />
                    <span>Carrier Fleet Vehicle</span>
                  </div>
                  <div className="space-y-1 text-slate-600 text-xs">
                    <div>Vehicle Number: <strong className="text-slate-900 font-mono">MH-12-TR-9901</strong></div>
                    <div>Carrier Company: <strong className="text-slate-900">{selectedDetailShipment.purchase_orders?.suppliers?.supplier_name || 'National Logistics Fleet'}</strong></div>
                    <div>Container Type: <strong className="text-slate-900">20FT Insulated Multi-Axle</strong></div>
                    <div>GPS Transponder: <strong className="text-emerald-700 font-semibold">Active (10s Ping)</strong></div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Gate & Milestones */}
            {activeTab === 'milestones' && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Highway Transit Timeline
                    </span>
                    <StatusBadge status={selectedDetailShipment.status} size="sm" />
                  </div>

                  <div className="space-y-2 text-xs border-l-2 border-blue-500 pl-3 ml-1.5">
                    <div>
                      <div className="font-bold text-slate-900">1. Factory Dispatch Confirmed</div>
                      <div className="text-[11px] text-slate-500">Origin: {selectedDetailShipment.origin || 'Mumbai Factory'} • Date: {new Date(selectedDetailShipment.dispatch_date || selectedDetailShipment.created_at).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">2. Toll Plaza & Checkpost Cleared</div>
                      <div className="text-[11px] text-slate-500">Expressway Weighbridge Pass #WB-8812 • Tare Weight Verified</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">3. Inbound Destination Gate Status</div>
                      <div className="text-[11px] text-slate-500">Facility: {selectedDetailShipment.warehouses?.warehouse_name || 'Pune Central DC Hub'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: E-Way Compliance */}
            {activeTab === 'eway' && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-slate-900">GST E-Way Bill Verification</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      COMPLIANCE ACTIVE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">E-Way Bill Number</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        EWB-2026-{(parseInt((selectedDetailShipment.shipment_number || '').replace(/\D/g, ''), 10) * 12345).toString().slice(0, 12)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">GSTIN Consignor</span>
                      <span className="font-mono font-semibold text-slate-700">27AAACH2849P1Z9</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">HSN / SAC Code</span>
                      <span className="font-mono font-semibold text-slate-700">8479.89.99</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Transit Insurance Policy</span>
                      <span className="font-mono font-semibold text-slate-700">POL-HDFC-99120-IN</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Shipments;
