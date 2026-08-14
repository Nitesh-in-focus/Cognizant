import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShoppingCart,
  Truck,
  Receipt,
  ShieldCheck,
  Bell,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Package,
  Radio,
  FileText,
  CreditCard,
  Plus,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Send,
  HelpCircle,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import {
  Supplier,
  PurchaseOrder,
  Shipment,
  Invoice,
  QualityCheck,
  SupplierPerformance,
  SupplierScoreHistory,
} from '../../types/database';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { OcrScanPanel } from '../../components/common/OcrScanPanel';
import { OcrInvoiceResult } from '../../lib/ocr';
import { sendEmailNotification } from '../../services/notificationService';

type SupplierTab = 'overview' | 'purchase_orders' | 'shipments' | 'trucks' | 'invoices' | 'quality' | 'profile';

export const SupplierPortal: React.FC = () => {
  const { currentUser, role, showToast, effectiveSupplierId, logAuditAction } = useApp();
  const [activeTab, setActiveTab] = useState<SupplierTab>('overview');
  const [loading, setLoading] = useState(true);

  // Supplier isolated data
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
  const [performance, setPerformance] = useState<SupplierPerformance | null>(null);
  const [scoreHistory, setScoreHistory] = useState<SupplierScoreHistory[]>([]);

  // Modals
  const [openClarifyModal, setOpenClarifyModal] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [clarifyReason, setClarifyReason] = useState('');

  const [openShipmentModal, setOpenShipmentModal] = useState(false);
  const [newShipment, setNewShipment] = useState({
    po_id: '',
    dispatch_date: new Date().toISOString().split('T')[0],
    expected_arrival: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    vehicle_number: 'MH-12-AB-9988',
    driver_name: 'Vikram Gurjar',
    driver_phone: '+91 98220 12345',
    carrier_name: 'BlueDart Logistics',
    total_quantity: 100,
  });

  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    po_id: '',
    invoice_number: `INV-SUP-${Math.floor(1000 + Math.random() * 9000)}`,
    invoiced_amount: 0,
    invoice_date: new Date().toISOString().split('T')[0],
  });

  const targetSupplierId = effectiveSupplierId || '00000000-0000-4000-8000-000000000003';

  useEffect(() => {
    fetchSupplierData();
  }, [targetSupplierId]);

  const fetchSupplierData = async () => {
    try {
      setLoading(true);
      const [
        { data: supData },
        { data: poData },
        { data: shpData },
        { data: invData },
        { data: qcData },
        { data: perfData },
        { data: histData },
      ] = await Promise.all([
        supabase.from('suppliers').select('*').eq('supplier_id', targetSupplierId).maybeSingle(),
        supabase
          .from('purchase_orders')
          .select('*, warehouses(warehouse_name, city)')
          .eq('supplier_id', targetSupplierId)
          .order('order_date', { ascending: false }),
        supabase
          .from('shipments')
          .select('*, purchase_orders(po_number, total_amount), warehouses(warehouse_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('*')
          .eq('supplier_id', targetSupplierId)
          .order('created_at', { ascending: false }),
        supabase
          .from('quality_checks')
          .select('*, purchase_orders(po_number), products(product_name)')
          .eq('supplier_id', targetSupplierId)
          .order('inspection_date', { ascending: false }),
        supabase
          .from('supplier_performance')
          .select('*')
          .eq('supplier_id', targetSupplierId)
          .maybeSingle(),
        supabase
          .from('supplier_score_history')
          .select('*')
          .eq('supplier_id', targetSupplierId)
          .order('calculated_at', { ascending: false }),
      ]);

      setSupplier(supData || null);
      setPurchaseOrders(poData || []);
      setShipments(shpData || []);
      setInvoices(invData || []);
      setQualityChecks(qcData || []);
      setPerformance(perfData || null);
      setScoreHistory(histData || []);

      if (poData && poData.length > 0) {
        setNewShipment((prev) => ({ ...prev, po_id: poData[0].po_id }));
        setNewInvoice((prev) => ({ ...prev, po_id: poData[0].po_id, invoiced_amount: Number(poData[0].total_amount) }));
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error loading supplier portal data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Supplier Actions on PO: Accept, Request Clarification, Reject (Section 16 of updates3.md)
  const handleUpdatePoStatus = async (
    po: PurchaseOrder,
    newStatus: 'CONFIRMED' | 'CHANGE_REQUESTED' | 'SUPPLIER_REJECTED',
    reason?: string
  ) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: newStatus,
          supplier_response_reason: reason || null,
          supplier_response_at: new Date().toISOString(),
        })
        .eq('po_id', po.po_id);

      if (error) throw error;

      await logAuditAction(
        newStatus === 'CONFIRMED' ? 'SUPPLIER_PO_ACCEPTED' : newStatus === 'CHANGE_REQUESTED' ? 'SUPPLIER_PO_CLARIFY' : 'SUPPLIER_PO_REJECTED',
        'purchase_orders',
        po.po_id,
        { reason, supplier_id: targetSupplierId }
      );

      if (newStatus === 'CHANGE_REQUESTED' || newStatus === 'SUPPLIER_REJECTED') {
        await sendEmailNotification({
          alert_type: 'PO_APPROVAL',
          severity: newStatus === 'SUPPLIER_REJECTED' ? 'CRITICAL' : 'HIGH',
          title: `Supplier ${newStatus === 'SUPPLIER_REJECTED' ? 'Rejected' : 'Requested Clarification on'} PO #${po.po_number}`,
          message: `Supplier ${supplier?.supplier_name || 'Vendor'} responded: "${reason || 'No specific reason provided'}"`,
          entity_type: 'purchase_orders',
          entity_number: po.po_number,
          supplier_name: supplier?.supplier_name,
          supplier_id: targetSupplierId,
          action_link: '/purchase-orders',
        });
      }

      showToast(
        newStatus === 'CONFIRMED'
          ? `PO #${po.po_number} successfully accepted!`
          : newStatus === 'CHANGE_REQUESTED'
          ? `Clarification request sent to Procurement Officer.`
          : `PO #${po.po_number} rejected. Reason logged for Procurement Officer.`,
        newStatus === 'CONFIRMED' ? 'success' : 'info'
      );

      setOpenClarifyModal(false);
      fetchSupplierData();
    } catch (err: any) {
      showToast('Action failed: ' + err.message, 'error');
    }
  };

  // Create Shipment from Supplier Portal (Section 18 & 19 of updates3.md)
  const handleCreateShipment = async () => {
    try {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const shipmentNumber = `SHP-2026-${suffix}`;
      const asnNumber = `ASN-2026-${suffix}`;

      const { data: shp, error } = await supabase
        .from('shipments')
        .insert([
          {
            shipment_number: shipmentNumber,
            asn_number: asnNumber,
            po_id: newShipment.po_id,
            origin: `${supplier?.city || 'Mumbai'} Facility`,
            dispatch_date: new Date(newShipment.dispatch_date).toISOString(),
            expected_arrival: new Date(newShipment.expected_arrival).toISOString(),
            status: 'DISPATCHED',
            driver_status: 'PENDING',
            location_source: 'DECLARED_BY_SUPPLIER',
            total_quantity: newShipment.total_quantity,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Register truck
      await supabase.from('trucks').insert([
        {
          vehicle_number: newShipment.vehicle_number,
          driver_name: newShipment.driver_name,
          driver_phone: newShipment.driver_phone,
          carrier_name: newShipment.carrier_name,
          truck_type: 'Heavy 10-Ton Container',
          capacity: newShipment.total_quantity,
          driver_status: 'PENDING',
          status: 'IN_TRANSIT',
        },
      ]);

      await logAuditAction('SUPPLIER_SHIPMENT_CREATED', 'shipments', shp.shipment_id, {
        vehicle_number: newShipment.vehicle_number,
        asn_number: asnNumber,
        po_id: newShipment.po_id,
      });

      showToast(`Shipment #${shipmentNumber} (ASN: ${asnNumber}) dispatched! Driver assignment request sent.`, 'success');
      setOpenShipmentModal(false);
      fetchSupplierData();
    } catch (err: any) {
      showToast('Shipment creation failed: ' + err.message, 'error');
    }
  };

  // Upload Invoice from Supplier Portal
  const handleUploadSupplierInvoice = async () => {
    try {
      const { error } = await supabase.from('invoices').insert([
        {
          invoice_number: newInvoice.invoice_number,
          po_id: newInvoice.po_id,
          supplier_id: targetSupplierId,
          invoice_date: new Date(newInvoice.invoice_date).toISOString(),
          total_amount: newInvoice.invoiced_amount,
          subtotal: Math.round(newInvoice.invoiced_amount / 1.18),
          tax_amount: Math.round(newInvoice.invoiced_amount - newInvoice.invoiced_amount / 1.18),
          ocr_status: 'COMPLETED',
          match_status: 'PENDING',
          payment_status: 'UNPAID',
        },
      ]);

      if (error) throw error;

      await logAuditAction('SUPPLIER_INVOICE_UPLOADED', 'invoices', newInvoice.invoice_number, {
        amount: newInvoice.invoiced_amount,
      });

      showToast(`Invoice #${newInvoice.invoice_number} submitted to Finance AP for 3-Way Match!`, 'success');
      setOpenInvoiceModal(false);
      fetchSupplierData();
    } catch (err: any) {
      showToast('Invoice submission failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600/30 border border-indigo-400/40 rounded-2xl flex items-center justify-center text-indigo-300">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                SUPPLIER PORTAL (ISOLATED)
              </span>
              <span className="text-xs text-slate-400 font-mono">CODE: {supplier?.supplier_code || 'SUP-1003'}</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight mt-1">
              {supplier?.supplier_name || 'Tata Industrial Solutions Ltd'}
            </h1>
            <p className="text-xs text-slate-300">
              Primary Contact: {supplier?.contact_person || 'Rahul Mehta'} • {supplier?.email || 'rahul.mehta@tataindustrial.com'}
            </p>
          </div>
        </div>

        {/* Live Score Badge */}
        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/15 text-center">
          <span className="text-[11px] uppercase tracking-wider text-slate-300 block">Overall Supplier Rating</span>
          <div className="text-3xl font-black text-amber-300 flex items-center justify-center gap-1.5 mt-0.5">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <span>{performance?.overall_score || 94.5}</span>
            <span className="text-sm font-normal text-slate-300">/ 100</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">Tier-1 Strategic Partner</span>
        </div>
      </div>

      {/* Portal Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'overview', label: 'Dashboard Overview', icon: Building2 },
          { id: 'purchase_orders', label: `Purchase Orders (${purchaseOrders.length})`, icon: ShoppingCart },
          { id: 'shipments', label: `Shipments & Dispatch (${shipments.length})`, icon: Truck },
          { id: 'trucks', label: 'Fleet & Drivers', icon: Radio },
          { id: 'invoices', label: `Invoices & Payments (${invoices.length})`, icon: Receipt },
          { id: 'quality', label: `QC Reports (${qualityChecks.length})`, icon: ShieldCheck },
          { id: 'profile', label: 'Rating & Profile', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SupplierTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Pending PO Acceptance</span>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {purchaseOrders.filter((p) => p.status === 'CONFIRMED' || (p.status as any) === 'SENT_TO_SUPPLIER').length}
              </p>
              <span className="text-xs text-slate-500">Requires confirmation</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Active In-Transit Shipments</span>
              <p className="text-2xl font-bold text-indigo-600 mt-1">
                {shipments.filter((s) => s.status === 'IN_TRANSIT' || s.status === 'DISPATCHED').length}
              </p>
              <span className="text-xs text-slate-500">Approaching distribution center</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">QA Acceptance Pass Rate</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {performance?.quality_score || 96}%
              </p>
              <span className="text-xs text-slate-500">Last 30 days inspection score</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Cleared Payment Value</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                ₹{invoices.filter((i) => i.payment_status === 'PAID').reduce((acc, i) => acc + (Number(i.total_amount) || 0), 0).toLocaleString()}
              </p>
              <span className="text-xs text-slate-500">Settled via NEFT Gateway</span>
            </div>
          </div>

          {/* Actionable Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending POs */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-indigo-600" />
                  <span>Recent Purchase Orders</span>
                </h3>
                <button
                  onClick={() => setActiveTab('purchase_orders')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  View All ({purchaseOrders.length})
                </button>
              </div>

              <div className="space-y-2.5">
                {purchaseOrders.slice(0, 3).map((po) => (
                  <div
                    key={po.po_id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900">{po.po_number}</div>
                      <div className="text-slate-500">
                        {new Date(po.order_date || '').toLocaleDateString()} • ₹{Number(po.total_amount).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={po.status} />
                      <button
                        onClick={() => handleUpdatePoStatus(po, 'CONFIRMED')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inbound Quality Records */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Quality Check Inspections</span>
                </h3>
                <button
                  onClick={() => setActiveTab('quality')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
                >
                  View Quality Log
                </button>
              </div>

              <div className="space-y-2.5">
                {qualityChecks.slice(0, 3).map((qc) => (
                  <div
                    key={qc.quality_check_id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900">QC-{qc.quality_check_id.slice(0, 8)}</div>
                      <div className="text-slate-500">
                        Lot: {qc.received_quantity} units • {qc.accepted_quantity} accepted
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-indigo-700">{qc.overall_score}/100</span>
                      <StatusBadge status={qc.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PURCHASE ORDERS ── */}
      {activeTab === 'purchase_orders' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Assigned Purchase Orders</h2>
              <p className="text-xs text-slate-500">
                Acknowledge POs, request commercial clarifications, or generate shipment dispatches.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <th className="p-3">PO Number</th>
                  <th className="p-3">Order Date</th>
                  <th className="p-3">Destination Hub</th>
                  <th className="p-3 text-right">Commitment Value</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {purchaseOrders.map((po) => (
                  <tr key={po.po_id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{po.po_number}</td>
                    <td className="p-3 text-slate-600">{new Date(po.order_date || '').toLocaleDateString()}</td>
                    <td className="p-3 text-slate-800">{po.warehouses?.warehouse_name || 'Pune Central Hub'}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(po.total_amount).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      <button
                        onClick={() => handleUpdatePoStatus(po, 'CONFIRMED')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                      >
                        Accept PO
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPo(po);
                          setOpenClarifyModal(true);
                        }}
                        className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-semibold"
                      >
                        Request Change
                      </button>
                      <button
                        onClick={() => {
                          setNewShipment((prev) => ({ ...prev, po_id: po.po_id }));
                          setOpenShipmentModal(true);
                        }}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
                      >
                        Dispatch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: SHIPMENTS & DISPATCH ── */}
      {activeTab === 'shipments' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Shipment Dispatches & Corridors</h2>
              <p className="text-xs text-slate-500">Manage active truck dispatches and deliver GPS updates.</p>
            </div>
            <button
              onClick={() => setOpenShipmentModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Dispatch</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <th className="p-3">Shipment#</th>
                  <th className="p-3">Origin / Destination</th>
                  <th className="p-3">Dispatch Date</th>
                  <th className="p-3">Expected Arrival</th>
                  <th className="p-3 text-right">Units</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {shipments.map((shp) => (
                  <tr key={shp.shipment_id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{shp.shipment_number}</td>
                    <td className="p-3">
                      <div>{shp.origin || 'Mumbai Sourcing Hub'}</div>
                      <div className="text-slate-500 text-[10px]">→ {shp.warehouses?.warehouse_name || 'Pune DC'}</div>
                    </td>
                    <td className="p-3 text-slate-600">{new Date(shp.dispatch_date || '').toLocaleDateString()}</td>
                    <td className="p-3 text-slate-600">{new Date(shp.expected_arrival || '').toLocaleDateString()}</td>
                    <td className="p-3 text-right font-mono font-bold">{shp.total_quantity}</td>
                    <td className="p-3">
                      <StatusBadge status={shp.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: INVOICES & PAYMENTS ── */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Invoices & Settlement Tracking</h2>
              <p className="text-xs text-slate-500">Upload vendor invoices and monitor 3-Way Match & NEFT payout status.</p>
            </div>
            <button
              onClick={() => setOpenInvoiceModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Invoice</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <th className="p-3">Invoice Number</th>
                  <th className="p-3">Invoice Date</th>
                  <th className="p-3 text-right">Invoiced Amount</th>
                  <th className="p-3 text-center">3-Way Match</th>
                  <th className="p-3">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((inv) => (
                  <tr key={inv.invoice_id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                    <td className="p-3 text-slate-600">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(inv.total_amount).toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">
                        {inv.match_status || 'MATCHED'}
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={inv.payment_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 5: QUALITY & PROFILE ── */}
      {(activeTab === 'quality' || activeTab === 'profile') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Supplier Performance Scorecard</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Quality Compliance (35%):</span>
                <span className="font-bold text-indigo-700">{performance?.quality_score || 95}%</span>
              </div>
              <div className="flex justify-between">
                <span>On-Time Delivery (25%):</span>
                <span className="font-bold text-indigo-700">{performance?.delivery_score || 92}%</span>
              </div>
              <div className="flex justify-between">
                <span>Quantity Accuracy (15%):</span>
                <span className="font-bold text-indigo-700">{performance?.quantity_accuracy_score || 98}%</span>
              </div>
              <div className="flex justify-between">
                <span>Invoice Accuracy (10%):</span>
                <span className="font-bold text-indigo-700">{performance?.invoice_accuracy_score || 95}%</span>
              </div>
              <div className="flex justify-between">
                <span>Operational Responsiveness (10%):</span>
                <span className="font-bold text-indigo-700">{performance?.responsiveness_score || 92}%</span>
              </div>
              <div className="flex justify-between">
                <span>Historical Reliability (5%):</span>
                <span className="font-bold text-indigo-700">{performance?.reliability_score || 96}%</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Rating History & Audit Trail</h3>
            <div className="space-y-2">
              {scoreHistory.map((hist) => (
                <div
                  key={hist.history_id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-900 block">{hist.reason}</span>
                    <span className="text-slate-500">{new Date(hist.calculated_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900">{hist.new_score} pts</span>
                    <span
                      className={`text-[10px] font-bold block ${
                        hist.change >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {hist.change >= 0 ? `+${hist.change}` : hist.change} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Clarification Modal ── */}
      {openClarifyModal && selectedPo && (
        <Modal
          title={`Request Clarification on PO #${selectedPo.po_number}`}
          isOpen={openClarifyModal}
          onClose={() => setOpenClarifyModal(false)}
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              State the reason for requesting revision or clarification. An alert will be routed to the Procurement Manager.
            </p>
            <textarea
              rows={3}
              value={clarifyReason}
              onChange={(e) => setClarifyReason(e.target.value)}
              placeholder="e.g., Request 3-day lead time adjustment due to raw material processing schedule..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpenClarifyModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdatePoStatus(selectedPo, 'CHANGE_REQUESTED', clarifyReason)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold"
              >
                Submit Request
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Shipment Creation Modal ── */}
      {openShipmentModal && (
        <Modal
          title="Dispatch Inbound Shipment"
          isOpen={openShipmentModal}
          onClose={() => setOpenShipmentModal(false)}
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Target PO</label>
                <select
                  value={newShipment.po_id}
                  onChange={(e) => setNewShipment({ ...newShipment, po_id: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {purchaseOrders.map((p) => (
                    <option key={p.po_id} value={p.po_id}>
                      {p.po_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Carrier Name</label>
                <input
                  type="text"
                  value={newShipment.carrier_name}
                  onChange={(e) => setNewShipment({ ...newShipment, carrier_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Truck Vehicle Number</label>
                <input
                  type="text"
                  value={newShipment.vehicle_number}
                  onChange={(e) => setNewShipment({ ...newShipment, vehicle_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Driver Name & Phone</label>
                <input
                  type="text"
                  value={newShipment.driver_name}
                  onChange={(e) => setNewShipment({ ...newShipment, driver_name: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenShipmentModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateShipment}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Invoice Upload Modal ── */}
      {openInvoiceModal && (
        <Modal
          title="Upload Vendor Invoice for 3-Way Match"
          isOpen={openInvoiceModal}
          onClose={() => setOpenInvoiceModal(false)}
        >
          <div className="space-y-3 text-xs">
            <OcrScanPanel
              documentLabel="vendor invoice document"
              onExtracted={(r: OcrInvoiceResult) => {
                if (r.invoiceNumber) setNewInvoice((prev) => ({ ...prev, invoice_number: r.invoiceNumber! }));
                if (r.totalAmount) setNewInvoice((prev) => ({ ...prev, invoiced_amount: r.totalAmount! }));
                if (r.invoiceDate) setNewInvoice((prev) => ({ ...prev, invoice_date: r.invoiceDate! }));
                showToast('OCR extracted invoice fields successfully!', 'success');
              }}
            />

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="font-semibold block mb-1">Invoice Reference</label>
                <input
                  type="text"
                  value={newInvoice.invoice_number}
                  onChange={(e) => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Total Invoiced Amount (INR)</label>
                <input
                  type="number"
                  value={newInvoice.invoiced_amount}
                  onChange={(e) => setNewInvoice({ ...newInvoice, invoiced_amount: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenInvoiceModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadSupplierInvoice}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Submit to Accounts Payable
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
