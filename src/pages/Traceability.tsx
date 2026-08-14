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
      {/* Header (Section 28) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <GitFork className="w-5 h-5 text-blue-600" />
            End-to-End Visual Traceability Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete audit pipeline from Demand Requisition ➔ PO Contract ➔ Live GPS Shipment ➔ Dock Intake (GRN) ➔ 3-Way Match ➔ Final Settlement.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              triggerRefresh();
              showSnackbar('Traceability relations refreshed from Supabase', 'info');
            }}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
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
        <div className="space-y-5">
          {filteredChains.map((chain, index) => {
            const pr = chain.purchase_requisitions;
            const shp = chain.shipments?.[0];
            const grn = chain.goods_receipts?.[0];
            const inv = chain.invoices?.[0];
            const pay = inv?.payments?.[0];
            const exc = chain.exceptions?.[0];

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
                      {chain.suppliers?.supplier_name || 'Acme Corp'}
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
                      className="text-xs font-semibold text-slate-600 hover:text-blue-600 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Audit Details
                    </button>
                  </div>
                </div>

                {/* 6-Node Visual Relational Pipeline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* Node 1: PR */}
                  <div
                    onClick={() =>
                      setSelectedNode({
                        type: 'PR',
                        title: `Purchase Requisition: ${pr?.pr_number || 'N/A'}`,
                        data: pr,
                        tab: 'overview',
                      })
                    }
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-amber-400 cursor-pointer transition-all shadow-2xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-amber-600 font-bold text-[10px] uppercase mb-1">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          <span>1. Requisition</span>
                        </span>
                        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-amber-500 transition-colors" />
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {pr?.pr_number || 'PR-2026-001'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {pr?.reason || 'Monthly replenishment'}
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-slate-600">{pr?.priority || 'MEDIUM'}</span>
                      <StatusBadge status={pr?.status || 'APPROVED'} size="sm" />
                    </div>
                  </div>

                  {/* Node 2: PO */}
                  <div
                    onClick={() =>
                      setSelectedNode({
                        type: 'PO',
                        title: `Purchase Order: ${chain.po_number}`,
                        data: chain,
                        tab: 'overview',
                      })
                    }
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-400 cursor-pointer transition-all shadow-2xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-blue-600 font-bold text-[10px] uppercase mb-1">
                        <span className="flex items-center gap-1">
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>2. Purchase Order</span>
                        </span>
                        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {chain.po_number}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        ₹{Number(chain.total_amount).toLocaleString()} (incl. 18% GST)
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-slate-600">Net 30</span>
                      <StatusBadge status={chain.status || 'CONFIRMED'} size="sm" />
                    </div>
                  </div>

                  {/* Node 3: Shipment GPS */}
                  <div
                    onClick={() => {
                      if (shp) setTrackingModalShipment(shp);
                    }}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-400 cursor-pointer transition-all shadow-2xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-blue-600 font-bold text-[10px] uppercase mb-1">
                        <span className="flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5" />
                          <span>3. Shipment GPS</span>
                        </span>
                        <MapPin className="w-3 h-3 text-rose-500 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {shp?.shipment_number || 'SHP-2026-9901'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {shp?.origin || 'Mumbai'} ➔ Pune DC
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="text-blue-600 font-bold hover:underline">View Map</span>
                      <StatusBadge status={shp?.status || 'IN_TRANSIT'} size="sm" />
                    </div>
                  </div>

                  {/* Node 4: GRN Receiving */}
                  <div
                    onClick={() =>
                      setSelectedNode({
                        type: 'GRN',
                        title: `Goods Receipt Note: ${grn?.grn_number || 'Pending'}`,
                        data: grn,
                        tab: 'overview',
                      })
                    }
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-purple-400 cursor-pointer transition-all shadow-2xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-purple-600 font-bold text-[10px] uppercase mb-1">
                        <span className="flex items-center gap-1">
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>4. Receiving (GRN)</span>
                        </span>
                        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-purple-500 transition-colors" />
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {grn?.grn_number || 'GRN-Pending'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        QA Intake Verified
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-slate-600">QA Pass</span>
                      <StatusBadge status={grn?.status || 'COMPLETED'} size="sm" />
                    </div>
                  </div>

                  {/* Node 5: Invoice & OCR */}
                  <div
                    onClick={() =>
                      setSelectedNode({
                        type: 'INVOICE',
                        title: `Invoice OCR & Match: ${inv?.invoice_number || 'Pending'}`,
                        data: inv,
                        tab: 'overview',
                      })
                    }
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-400 cursor-pointer transition-all shadow-2xs group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-blue-600 font-bold text-[10px] uppercase mb-1">
                        <span className="flex items-center gap-1">
                          <Receipt className="w-3.5 h-3.5" />
                          <span>5. Invoice & OCR</span>
                        </span>
                        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {inv?.invoice_number || 'INV-2026'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        ₹{Number(inv?.total_amount || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">OCR: 100%</span>
                      <StatusBadge status={inv?.match_status || 'MATCHED'} size="sm" />
                    </div>
                  </div>

                  {/* Node 6: Payment Settlement */}
                  <div
                    onClick={() =>
                      setSelectedNode({
                        type: 'PAYMENT',
                        title: `Banking Settlement: ${pay?.transaction_reference || 'Pending'}`,
                        data: pay,
                        tab: 'overview',
                      })
                    }
                    className={`p-3 rounded-xl border cursor-pointer transition-all shadow-2xs group flex flex-col justify-between ${
                      exc && exc.status === 'OPEN'
                        ? 'border-rose-300 bg-rose-50/50 hover:bg-rose-50'
                        : pay
                        ? 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className={`flex items-center justify-between font-bold text-[10px] uppercase mb-1 ${exc ? 'text-rose-600' : 'text-emerald-600'}`}>
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>6. Settlement</span>
                        </span>
                        <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {exc && exc.status === 'OPEN' ? 'PAYMENT HOLD' : pay ? 'PAID (NEFT)' : 'Awaiting Match'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {pay?.transaction_reference || (exc ? 'Dispute Active' : 'Hold')}
                      </div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-slate-600">{pay?.payment_method || 'NEFT'}</span>
                      <StatusBadge status={exc && exc.status === 'OPEN' ? 'ON_HOLD' : pay?.status || 'UNPAID'} size="sm" />
                    </div>
                  </div>
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
              className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
                selectedNode.tab === 'overview' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Summary Overview
            </button>
            <button
              onClick={() => setSelectedNode({ ...selectedNode, tab: 'raw' })}
              className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${
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
