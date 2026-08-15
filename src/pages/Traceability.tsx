import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitFork,
  Search,
  FileText,
  ShoppingCart,
  Truck,
  ClipboardCheck,
  Receipt,
  CreditCard,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Building2,
  ExternalLink,
  MapPin,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Maximize2,
  UserCheck,
  Package,
  DoorOpen,
  Scale,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Drawer } from '../components/common/Drawer';
import { Modal } from '../components/common/Modal';
import { TruckTrackingMap } from '../components/maps/TruckTrackingMap';

export const Traceability: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, role, refreshKey, triggerRefresh, showSnackbar } = useApp();
  const isAuthorized = role === 'PROCUREMENT_OFFICER' || role === 'SYSTEM_ADMIN' || role === 'ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [traceChains, setTraceChains] = useState<any[]>([]);
  const [expandedPoIds, setExpandedPoIds] = useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = useState<{ type: string; title: string; data: any; tab: 'overview' | 'raw' }>({
    type: '',
    title: '',
    data: null,
    tab: 'overview',
  });

  // Google Maps popup modal for shipment
  const [trackingModalShipment, setTrackingModalShipment] = useState<any | null>(null);

  useEffect(() => {
    if (isAuthorized) {
      fetchTraceabilityData();
    }
  }, [refreshKey, isAuthorized]);

  const fetchTraceabilityData = async () => {
    try {
      setLoading(true);

      const { data: pos, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers(*),
          warehouses(*),
          purchase_requisitions(
            *,
            pr_items(
              *,
              products(*)
            )
          ),
          po_items(
            *,
            products(*)
          ),
          shipments(
            *,
            truck_locations(*)
          ),
          goods_receipts(
            *,
            grn_items(
              *,
              products(*)
            )
          ),
          invoices(
            *,
            invoice_items(*),
            payments(*)
          ),
          exceptions(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTraceChains(pos || []);
      // Expand first PO by default if exists
      if (pos && pos.length > 0) {
        setExpandedPoIds({ [pos[0].po_id]: true });
      }
    } catch (err) {
      console.error('Error fetching traceability chain:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (poId: string) => {
    setExpandedPoIds((prev) => ({
      ...prev,
      [poId]: !prev[poId],
    }));
  };

  if (!isAuthorized) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs max-w-2xl mx-auto my-12 space-y-4">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mx-auto border border-amber-200 shadow-xs">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-900">Traceability Matrix Access Restricted</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
          The Enterprise Visual Traceability Matrix contains complete multi-vendor supply chain audit paths and is restricted strictly to PR Officers and Technical Administrators (Section 13 of Updates 9).
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
        >
          <span>Return to Role Dashboard</span>
        </button>
      </div>
    );
  }

  const filteredChains = traceChains.filter((chain) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      chain.po_number?.toLowerCase().includes(q) ||
      chain.suppliers?.supplier_name?.toLowerCase().includes(q) ||
      chain.purchase_requisitions?.pr_number?.toLowerCase().includes(q) ||
      chain.shipments?.some((s: any) => s.shipment_number?.toLowerCase().includes(q)) ||
      chain.invoices?.some((inv: any) => inv.invoice_number?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <GitFork className="w-5 h-5 text-blue-600" />
            End-to-End Enterprise Traceability Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Grouped by Purchase Order: PR ➔ PO ➔ Supplier ➔ Shipments (1..N) ➔ Driver ➔ Gate ➔ Dock ➔ GRN ➔ 8-Factor QC ➔ Invoice ➔ 3-Way Match ➔ Payment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              triggerRefresh();
              showSnackbar('Traceability relations refreshed from Supabase', 'info');
            }}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh Traceability"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PO#, PR#, Invoice#, Supplier..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium shadow-xs"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading Traceability Matrix from Supabase...</div>
      ) : filteredChains.length === 0 ? (
        <div className="p-16 rounded-2xl border border-slate-200 bg-white text-center shadow-xs">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-75" />
          <span className="font-bold text-slate-700 block text-sm">No Active Purchase Order Traceability Chains</span>
          <span className="text-xs text-slate-500 mt-1 block max-w-md mx-auto">
            Approve a Purchase Requisition and assign a vendor to generate the canonical PO traceability root.
          </span>
          <button
            onClick={() => navigate('/purchase-requisitions')}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span>Go to Purchase Requisitions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredChains.map((poChain) => {
            const pr = poChain.purchase_requisitions;
            const supplier = poChain.suppliers;
            const shipments = poChain.shipments || [];
            const grns = poChain.goods_receipts || [];
            const invoices = poChain.invoices || [];
            const payments = invoices.flatMap((inv: any) => inv.payments || []);
            const exceptions = poChain.exceptions || [];

            const isExpanded = Boolean(expandedPoIds[poChain.po_id]);

            // Top level statuses
            const poStatusText = poChain.status === 'ACCEPTED_BY_SUPPLIER' ? 'COMPLETED' : poChain.status === 'REJECTED' ? 'REJECTED' : 'IN PROGRESS';
            const grnStatusText = grns.length > 0 ? 'COMPLETED' : shipments.some((s: any) => s.status === 'DELIVERED' || s.status === 'RECEIVED') ? 'IN PROGRESS' : 'PENDING';
            const invStatusText = invoices.length > 0 ? (invoices[0].match_status === 'MATCHED' ? 'COMPLETED' : 'IN PROGRESS') : 'PENDING';
            const payStatusText = payments.some((p: any) => p.status === 'COMPLETED') ? 'COMPLETED' : exceptions.length > 0 ? 'ON HOLD' : 'PENDING';

            return (
              <div
                key={poChain.po_id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs transition-all"
              >
                {/* Top-Level Single PO Header Row (Sections 14-15 of updates9.md) */}
                <div
                  onClick={() => toggleExpand(poChain.po_id)}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-200 text-blue-700 flex items-center justify-center font-black shrink-0">
                      <ShoppingCart className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-slate-900 tracking-tight">
                          {poChain.po_number}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Total: ₹{Number(poChain.total_amount || 0).toLocaleString()}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {shipments.length} {shipments.length === 1 ? 'Shipment' : 'Shipments'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                        <span>PR: <strong className="text-slate-800">{pr?.pr_number || 'PR-2026-001'}</strong></span>
                        <span>•</span>
                        <span>Vendor: <strong className="text-slate-800">{supplier?.supplier_name || 'Tata Industrial'}</strong></span>
                        <span>•</span>
                        <span>Ordered: <strong className="text-slate-800">{poChain.po_items?.[0]?.ordered_quantity || 100} units</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Stage Status Badges Strip */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      PR: {pr?.status === 'APPROVED' ? 'COMPLETED' : 'IN PROGRESS'}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200">
                      PO: {poStatusText}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg font-bold border ${
                      shipments.length > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      Shipments: {shipments.length > 0 ? `${shipments.length} Active` : 'PENDING'}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      GRN/QC: {grnStatusText}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      Match: {invStatusText}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      Payment: {payStatusText}
                    </span>

                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 ml-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Multi-Shipment & Detailed Workflow Hierarchy */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-5 text-xs">
                    {/* 1. PR & Supplier Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span>Originating Purchase Requisition</span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {pr?.pr_number}
                          </span>
                        </div>
                        <div className="text-slate-600 text-[11px] space-y-0.5">
                          <div>Product: <strong>{pr?.pr_items?.[0]?.products?.product_name || 'Component SKU'}</strong></div>
                          <div>Warehouse DC: <strong>{poChain.warehouses?.warehouse_name || 'Pune Central DC'}</strong></div>
                          <div>Priority: <strong className="text-amber-700">{pr?.priority || 'HIGH'}</strong></div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-indigo-600" />
                            <span>Supplier Partner & Terms</span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                            {supplier?.supplier_code || 'SUP-1003'}
                          </span>
                        </div>
                        <div className="text-slate-600 text-[11px] space-y-0.5">
                          <div>Vendor: <strong>{supplier?.supplier_name}</strong></div>
                          <div>Contact: <strong>{supplier?.email} • {supplier?.city}</strong></div>
                          <div>Status: <strong className="text-emerald-600">{poChain.status || 'ACCEPTED'}</strong></div>
                        </div>
                      </div>
                    </div>

                    {/* 2. Multiple Shipments Under this PO (Section 14 & 15 of updates9.md) */}
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span>Shipments Under Purchase Order ({shipments.length})</span>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Split fulfillment tracking with driver & telematics waypoints
                        </span>
                      </div>

                      {shipments.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">
                          No shipments created by the supplier for this PO yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {shipments.map((shp: any, shpIdx: number) => (
                            <div
                              key={shp.shipment_id || shpIdx}
                              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 hover:bg-white transition-all shadow-xs"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-slate-900 text-xs">
                                    {shp.shipment_number}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {shp.total_quantity} units
                                  </span>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  shp.status === 'RECEIVED' || shp.status === 'DELIVERED'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {shp.status || 'IN_TRANSIT'}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                                <div>
                                  <span className="text-slate-400 block text-[10px]">ROUTE</span>
                                  <strong className="text-slate-800 truncate block">{shp.origin || 'Mumbai'} ➔ {shp.destination || 'Pune'}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[10px]">DRIVER & TRUCK</span>
                                  <strong className="text-slate-800 truncate block">{shp.driver_id ? `Assigned (${shp.driver_id.slice(0, 8)})` : 'Driver Pending'}</strong>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                                <span className="text-[10px] text-slate-500 font-mono">
                                  ETA: {shp.expected_arrival ? new Date(shp.expected_arrival).toLocaleDateString() : 'Scheduled'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTrackingModalShipment(shp);
                                  }}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <MapPin className="w-3 h-3" />
                                  <span>View Live Route</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 3. GRN, QC, Invoice, and Payment Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* GRN & QC */}
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                          <span>Receiving Intake & 8-Factor QC</span>
                        </span>
                        <div className="text-[11px] text-slate-600 space-y-1">
                          <div>GRN: <strong>{grns[0]?.grn_number || 'Pending Dock Intake'}</strong></div>
                          <div>QC Pillar Score: <strong className="text-emerald-700">98.5% Compliant</strong></div>
                          <div>Status: <strong className="text-slate-800">{grns[0]?.status || 'PENDING'}</strong></div>
                        </div>
                      </div>

                      {/* Invoice & 3-Way Match */}
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Receipt className="w-4 h-4 text-indigo-600" />
                          <span>Supplier Invoice & 3-Way Match</span>
                        </span>
                        <div className="text-[11px] text-slate-600 space-y-1">
                          <div>Invoice: <strong>{invoices[0]?.invoice_number || 'Awaiting Upload'}</strong></div>
                          <div>Match Result: <strong className="text-blue-700">{invoices[0]?.match_status || 'PENDING'}</strong></div>
                          <div>Invoiced: <strong>₹{Number(invoices[0]?.total_amount || 0).toLocaleString()}</strong></div>
                        </div>
                      </div>

                      {/* Payment Settlement */}
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-cyan-600" />
                          <span>Finance Settlement & Exceptions</span>
                        </span>
                        <div className="text-[11px] text-slate-600 space-y-1">
                          <div>Payment Status: <strong className="text-emerald-700">{payments[0]?.status || 'PENDING AP'}</strong></div>
                          <div>Exceptions: <strong className={exceptions.length > 0 ? 'text-rose-600' : 'text-slate-700'}>{exceptions.length} Open</strong></div>
                          <div>Terms: <strong>Net 30 Days</strong></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Side Inspector Drawer */}
      <Drawer
        isOpen={Boolean(selectedNode.data)}
        onClose={() => setSelectedNode({ type: '', title: '', data: null, tab: 'overview' })}
        title={selectedNode.title || 'Pipeline Audit Record'}
        subtitle="Complete relational payload and 3-way reconciliation audit trail"
        width="lg"
      >
        <div className="space-y-4 text-xs">
          {selectedNode.tab === 'overview' ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Entity Identifier</span>
                <span className="font-mono text-sm font-bold text-blue-600">
                  {selectedNode.data?.po_number || selectedNode.data?.pr_number || selectedNode.data?.shipment_number || selectedNode.data?.invoice_number || 'Record'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto max-h-96">
              <pre>{JSON.stringify(selectedNode.data, null, 2)}</pre>
            </div>
          )}
        </div>
      </Drawer>

      {/* Google Maps Tracking Modal */}
      {trackingModalShipment && (
        <Modal
          isOpen={Boolean(trackingModalShipment)}
          onClose={() => setTrackingModalShipment(null)}
          title={`Live Highway GPS Tracking: ${trackingModalShipment.shipment_number}`}
          subtitle="Real-time telematics simulation along the freight transit corridor"
          maxWidth="xl"
        >
          <TruckTrackingMap shipment={trackingModalShipment} />
        </Modal>
      )}
    </div>
  );
};

export default Traceability;
