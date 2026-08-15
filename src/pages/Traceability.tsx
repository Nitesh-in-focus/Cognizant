import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Drawer } from '../components/common/Drawer';
import { Modal } from '../components/common/Modal';
import { TruckTrackingMap } from '../components/maps/TruckTrackingMap';

export const Traceability: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [traceChains, setTraceChains] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<{ type: string; title: string; data: any; tab: 'overview' | 'raw' }>({
    type: '',
    title: '',
    data: null,
    tab: 'overview',
  });

  // Google Maps popup modal for shipment
  const [trackingModalShipment, setTrackingModalShipment] = useState<any | null>(null);

  useEffect(() => {
    fetchTraceabilityData();
  }, [refreshKey]);

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
    } catch (err) {
      console.error('Error fetching traceability chain:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredChains = traceChains.filter((chain) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      chain.po_number?.toLowerCase().includes(q) ||
      chain.suppliers?.supplier_name?.toLowerCase().includes(q) ||
      chain.purchase_requisitions?.pr_number?.toLowerCase().includes(q) ||
      chain.shipments?.[0]?.shipment_number?.toLowerCase().includes(q) ||
      chain.invoices?.[0]?.invoice_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <GitFork className="w-5 h-5 text-blue-600" />
            End-to-End Visual Traceability Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full 15-stage dynamic audit chain: PR ➔ PO ➔ Supplier ➔ Shipment ➔ ASN ➔ Truck ➔ Driver ➔ Gate Entry ➔ Dock/Yard ➔ GRN ➔ Quality Check ➔ Invoice ➔ 3-Way Match ➔ Exception ➔ Payment.
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
        <div className="py-12 text-center text-xs text-slate-400">Loading Traceability Chains from Supabase...</div>
      ) : filteredChains.length === 0 ? (
        <div className="p-8 rounded-xl border border-slate-200 bg-white text-center shadow-xs">
          <p className="text-xs text-slate-500">
            No transaction chains found matching criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredChains.map((chain, index) => {
            const pr = chain.purchase_requisitions;
            const shp = chain.shipments?.[0];
            const grn = chain.goods_receipts?.[0];
            const inv = chain.invoices?.[0];
            const pay = inv?.payments?.[0];
            const exc = chain.exceptions?.[0];

            // 15 Dynamic Stages with Strict Coherent Statuses (Sections 20-22, 37-38 of updates5.md)
            const prStatus = pr ? (pr.status === 'APPROVED' || pr.status === 'CONVERTED' ? 'COMPLETED' : pr.status === 'REJECTED' ? 'REJECTED' : 'IN_PROGRESS') : 'NOT_STARTED';
            const poStatus = chain.status === 'SUPPLIER_REJECTED' || chain.status === 'REJECTED' ? 'REJECTED' : (chain.status === 'ACCEPTED_BY_SUPPLIER' || chain.status === 'CONFIRMED' || chain.status === 'DISPATCHED' || chain.status === 'RECEIVED') ? 'COMPLETED' : 'IN_PROGRESS';
            const supplierStatus = chain.status === 'SUPPLIER_REJECTED' ? 'REJECTED' : (chain.status === 'ACCEPTED_BY_SUPPLIER' || chain.status === 'CONFIRMED' || shp) ? 'COMPLETED' : 'PENDING';
            const shipmentStatus = !shp ? (chain.status === 'ACCEPTED_BY_SUPPLIER' ? 'PENDING' : 'NOT_STARTED') : (shp.status === 'RECEIVED' || shp.status === 'UNLOADED' || shp.status === 'DELIVERED' ? 'COMPLETED' : shp.status === 'DISPATCHED' || shp.status === 'IN_TRANSIT' ? 'ACTIVE' : 'IN_PROGRESS');
            const asnStatus = shp?.asn_number ? 'COMPLETED' : shp ? 'IN_PROGRESS' : 'NOT_STARTED';
            const truckStatus = shp?.driver_status === 'ACCEPTED' || shp?.driver_id ? (shp?.status === 'RECEIVED' || shp?.status === 'UNLOADED' ? 'COMPLETED' : 'ACTIVE') : shp ? 'PENDING' : 'NOT_STARTED';
            const driverStatus = shp?.driver_status === 'ACCEPTED' ? (shp?.status === 'RECEIVED' || shp?.status === 'UNLOADED' ? 'COMPLETED' : 'ACTIVE') : shp?.status === 'DRIVER_REQUESTED' ? 'IN_PROGRESS' : 'PENDING';
            const gateStatus = grn || shp?.status === 'AT_GATE' || shp?.status === 'IN_YARD' || shp?.status === 'AT_DOCK' || shp?.status === 'UNLOADED' ? 'COMPLETED' : shp?.status === 'IN_TRANSIT' ? 'PENDING' : 'NOT_STARTED';
            const dockStatus = grn || shp?.status === 'AT_DOCK' || shp?.status === 'UNLOADED' ? 'COMPLETED' : shp?.status === 'IN_YARD' ? 'IN_PROGRESS' : 'NOT_STARTED';
            const grnStatus = grn ? (grn.status === 'COMPLETED' || grn.status === 'INSPECTED' ? 'COMPLETED' : 'IN_PROGRESS') : 'NOT_STARTED';
            const qcStatus = grn ? (grn.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS') : 'NOT_STARTED';
            const invoiceStatus = inv ? (inv.payment_status === 'PAID' ? 'COMPLETED' : 'ACTIVE') : 'NOT_STARTED';
            const matchStatus = !inv ? 'NOT_STARTED' : inv.match_status === 'MATCHED' ? 'COMPLETED' : inv.match_status === 'MISMATCH' ? 'FAILED' : 'PENDING';
            const exceptionStatus = exc ? (exc.status === 'RESOLVED' ? 'COMPLETED' : exc.status === 'OPEN' ? 'ON_HOLD' : 'IN_PROGRESS') : (inv?.match_status === 'MATCHED' ? 'COMPLETED' : 'NOT_STARTED');
            const paymentStatus = pay ? (pay.status === 'COMPLETED' ? 'COMPLETED' : pay.status === 'FAILED' ? 'FAILED' : 'IN_PROGRESS') : exc?.status === 'OPEN' ? 'ON_HOLD' : (inv?.match_status === 'MATCHED' ? 'PENDING' : 'NOT_STARTED');

            const stages = [
              {
                id: 'pr',
                num: 1,
                label: 'PR',
                title: 'Purchase Requisition',
                code: pr?.pr_number || 'PR-2026-001',
                active: Boolean(pr),
                status: prStatus,
                icon: FileText,
                color: prStatus === 'COMPLETED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : prStatus === 'REJECTED' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200',
                data: pr,
              },
              {
                id: 'po',
                num: 2,
                label: 'PO',
                title: 'Purchase Order',
                code: chain.po_number,
                active: Boolean(chain.po_number),
                status: poStatus,
                icon: ShoppingCart,
                color: poStatus === 'COMPLETED' ? 'text-blue-700 bg-blue-50 border-blue-200' : poStatus === 'REJECTED' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200',
                data: chain,
              },
              {
                id: 'supplier',
                num: 3,
                label: 'SUPPLIER',
                title: 'Supplier Partner',
                code: chain.suppliers?.supplier_name || 'Tata Industrial',
                active: Boolean(chain.suppliers),
                status: supplierStatus,
                icon: Building2,
                color: supplierStatus === 'REJECTED' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-indigo-700 bg-indigo-50 border-indigo-200',
                data: chain.suppliers,
              },
              {
                id: 'shipment',
                num: 4,
                label: 'SHIPMENT',
                title: 'Shipment Dispatch',
                code: shp?.shipment_number || 'SHP-2026-9901',
                active: Boolean(shp),
                status: shipmentStatus,
                icon: Truck,
                color: shipmentStatus === 'COMPLETED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-blue-700 bg-blue-50 border-blue-200',
                data: shp,
              },
              {
                id: 'asn',
                num: 5,
                label: 'ASN',
                title: 'Advance Ship Notice',
                code: shp?.asn_number || 'ASN-2026-042',
                active: Boolean(shp?.asn_number || shp),
                status: asnStatus,
                icon: Package,
                color: 'text-cyan-700 bg-cyan-50 border-cyan-200',
                data: { asn_number: shp?.asn_number || 'ASN-2026-042', shipment: shp },
              },
              {
                id: 'truck',
                num: 6,
                label: 'TRUCK',
                title: 'Commercial Carrier',
                code: shp?.vehicle_number || 'MH-12-AB-9901',
                active: Boolean(shp),
                status: truckStatus,
                icon: Truck,
                color: 'text-blue-700 bg-blue-50 border-blue-200',
                data: { vehicle_number: shp?.vehicle_number || 'MH-12-AB-9901', type: 'Tata Signa Heavy 10-Ton' },
              },
              {
                id: 'driver',
                num: 7,
                label: 'DRIVER',
                title: 'Assigned Driver',
                code: shp?.driver_name || 'Rajesh Sharma (DRV-2026-1025)',
                active: Boolean(shp),
                status: driverStatus,
                icon: UserCheck,
                color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                data: { driver_name: shp?.driver_name || 'Rajesh Sharma', driver_code: shp?.driver_code || 'DRV-2026-1025', phone: '+91 98234 56789' },
              },
              {
                id: 'gate',
                num: 8,
                label: 'GATE ENTRY',
                title: 'Gate Security Check-In',
                code: 'GATE-01 (Verified)',
                active: Boolean(grn || shp?.status === 'DELIVERED'),
                status: gateStatus,
                icon: ShieldCheck,
                color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                data: { gate: 'North Inbound Gate 01', gate_operator: 'Prakash Rao' },
              },
              {
                id: 'dock',
                num: 9,
                label: 'DOCK/YARD',
                title: 'Dock Bay Allocation',
                code: 'DOCK D-01 (Inbound)',
                active: Boolean(grn),
                status: dockStatus,
                icon: DoorOpen,
                color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
                data: { dock_number: 'DOCK D-01', yard: 'North Inbound Yard' },
              },
              {
                id: 'grn',
                num: 10,
                label: 'GRN',
                title: 'Goods Receipt Note',
                code: grn?.grn_number || 'GRN-2026-001',
                active: Boolean(grn),
                status: grnStatus,
                icon: ClipboardCheck,
                color: 'text-purple-700 bg-purple-50 border-purple-200',
                data: grn,
              },
              {
                id: 'qc',
                num: 11,
                label: 'QUALITY CHECK',
                title: 'QC Inspection',
                code: 'QC-Pass (Score: 94/100)',
                active: Boolean(grn),
                status: qcStatus,
                icon: CheckCircle2,
                color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                data: { qc_score: 94, inspector: 'Ananya Iyer', status: 'PASSED' },
              },
              {
                id: 'invoice',
                num: 12,
                label: 'INVOICE',
                title: 'Vendor Invoice & OCR',
                code: inv?.invoice_number || 'INV-2026-7891',
                active: Boolean(inv),
                status: invoiceStatus,
                icon: Receipt,
                color: 'text-blue-700 bg-blue-50 border-blue-200',
                data: inv,
              },
              {
                id: 'match',
                num: 13,
                label: '3-WAY MATCH',
                title: 'Reconciliation Engine',
                code: inv?.match_status || 'MATCHED',
                active: Boolean(inv),
                status: matchStatus,
                icon: Scale,
                color: matchStatus === 'FAILED' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200',
                data: { po: chain.po_number, grn: grn?.grn_number, invoice: inv?.invoice_number, variance: 0 },
              },
              {
                id: 'exception',
                num: 14,
                label: 'EXCEPTION',
                title: 'Exception & Hold',
                code: exc && exc.status === 'OPEN' ? `Variance: ${exc.exception_type}` : 'No Discrepancies',
                active: Boolean(exc && exc.status === 'OPEN'),
                status: exceptionStatus,
                icon: AlertTriangle,
                color: exceptionStatus === 'ON_HOLD' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-slate-600 bg-slate-50 border-slate-200',
                data: exc,
              },
              {
                id: 'payment',
                num: 15,
                label: 'PAYMENT',
                title: 'Payment Settlement',
                code: pay?.transaction_reference || (pay?.status === 'COMPLETED' ? 'Settled (NEFT)' : 'Scheduled'),
                active: Boolean(pay),
                status: paymentStatus,
                icon: CreditCard,
                color: paymentStatus === 'COMPLETED' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-700 bg-slate-50 border-slate-200',
                data: pay,
              },
            ];

            return (
              <div
                key={chain.po_id || index}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs transition-all hover:border-slate-300"
              >
                {/* Chain Overview Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-blue-600">
                      Pipeline #{chain.po_number}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {chain.suppliers?.supplier_name || 'Tata Industrial Solutions Ltd'}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      ₹{Number(chain.total_amount || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {exc && exc.status === 'OPEN' ? (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>3-Way Exception: {exc.exception_type}</span>
                      </span>
                    ) : pay?.status === 'COMPLETED' ? (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Fully Settled via NEFT</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                        <span>Inbound Fulfillment Active</span>
                      </span>
                    )}

                    <button
                      onClick={() =>
                        setSelectedNode({
                          type: 'PO_CHAIN',
                          title: `Transaction Chain Audit Trail: ${chain.po_number}`,
                          data: chain,
                          tab: 'overview',
                        })
                      }
                      className="text-xs font-semibold text-slate-600 hover:text-blue-600 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      Audit Details
                    </button>
                  </div>
                </div>

                {/* 15-Stage Full Dynamic Relational Chain */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                  {stages.map((stage, sIdx) => {
                    const Icon = stage.icon;
                    return (
                      <React.Fragment key={stage.id}>
                        <div
                          onClick={() => {
                            if (stage.id === 'shipment' && shp) {
                              setTrackingModalShipment(shp);
                            } else {
                              setSelectedNode({
                                type: stage.id.toUpperCase(),
                                title: `${stage.title}: ${stage.code}`,
                                data: stage.data,
                                tab: 'overview',
                              });
                            }
                          }}
                          className={`shrink-0 w-32 p-2.5 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:scale-105 ${stage.color} flex flex-col justify-between`}
                          title={`Stage ${stage.num}: ${stage.title} (Click for audit inspection)`}
                        >
                          <div>
                            <div className="flex items-center justify-between text-[10px] font-black uppercase mb-1">
                              <span className="flex items-center gap-1">
                                <Icon className="w-3 h-3" />
                                <span>{stage.num}. {stage.label}</span>
                              </span>
                            </div>
                            <div className="font-bold text-[11px] text-slate-900 truncate">
                              {stage.code}
                            </div>
                          </div>
                          <div className="mt-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[9px]">
                            <span className="font-semibold text-slate-600 truncate">{stage.status}</span>
                            <ChevronRight className="w-2.5 h-2.5 text-slate-400" />
                          </div>
                        </div>

                        {sIdx < stages.length - 1 && (
                          <div className="shrink-0 text-slate-300">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
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
          {/* Tab Selector */}
          <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setSelectedNode({ ...selectedNode, tab: 'overview' })}
              className={`flex-1 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                selectedNode.tab === 'overview' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Summary Overview
            </button>
            <button
              onClick={() => setSelectedNode({ ...selectedNode, tab: 'raw' })}
              className={`flex-1 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                selectedNode.tab === 'raw' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Raw JSON Payload
            </button>
          </div>

          {selectedNode.tab === 'overview' ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Entity Identifier</span>
                <span className="font-mono text-sm font-bold text-blue-600">
                  {selectedNode.data?.po_number || selectedNode.data?.pr_number || selectedNode.data?.shipment_number || selectedNode.data?.invoice_number || 'Record'}
                </span>
              </div>

              {selectedNode.data?.suppliers && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Vendor Partner</span>
                  <div className="font-bold text-slate-900">{selectedNode.data.suppliers.supplier_name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{selectedNode.data.suppliers.email} • {selectedNode.data.suppliers.city}</div>
                </div>
              )}

              {selectedNode.data?.total_amount && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Financial Commitment</span>
                  <div className="font-bold text-slate-900 text-sm">
                    ₹{Number(selectedNode.data.total_amount).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Subtotal: ₹{Number(selectedNode.data.subtotal || 0).toLocaleString()} • Tax (18%): ₹{Number(selectedNode.data.tax_amount || 0).toLocaleString()}
                  </div>
                </div>
              )}
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
          subtitle="Real-time telematics simulation along the Mumbai-Pune freight transit corridor"
          maxWidth="xl"
        >
          <TruckTrackingMap shipment={trackingModalShipment} />
        </Modal>
      )}
    </div>
  );
};

export default Traceability;
