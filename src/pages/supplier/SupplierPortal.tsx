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
  Users,
  Eye,
  Calendar,
  MapPin,
  CheckSquare,
  Square,
  AlertTriangle,
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
  DriverAssignmentRequest,
} from '../../types/database';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { OcrScanPanel } from '../../components/common/OcrScanPanel';
import { OcrInvoiceResult } from '../../lib/ocr';
import { sendEmailNotification } from '../../services/notificationService';
import {
  broadcastDriverRequests,
  getStoredDriverRequests,
} from '../../services/driverAssignmentService';

type SupplierTab = 'overview' | 'sent_pos' | 'accepted_pos' | 'shipments' | 'invoices' | 'quality' | 'profile';

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
  const [driverRequests, setDriverRequests] = useState<DriverAssignmentRequest[]>([]);

  // Modals
  const [openRejectModal, setOpenRejectModal] = useState(false);
  const [openViewPoModal, setOpenViewPoModal] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Multi-Shipment Creation State
  const [openShipmentModal, setOpenShipmentModal] = useState(false);
  const [shipmentPo, setShipmentPo] = useState<PurchaseOrder | null>(null);
  const [shipmentQty, setShipmentQty] = useState<number>(300);
  const [shipmentOrigin, setShipmentOrigin] = useState('Mumbai JNPT Sourcing Terminal');
  const [shipmentDest, setShipmentDest] = useState('Pune Central DC');
  const [shipmentDispatchDate, setShipmentDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [shipmentExpectedArrival, setShipmentExpectedArrival] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );

  // Multi-Driver Assignment Modal State
  const [openDriverModal, setOpenDriverModal] = useState(false);
  const [driverModalShipment, setDriverModalShipment] = useState<Shipment | null>(null);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [driverExpiryMinutes, setDriverExpiryMinutes] = useState(10);
  const [broadcastingDrivers, setBroadcastingDrivers] = useState(false);

  // Invoice Upload Modal State
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [invoiceShipment, setInvoiceShipment] = useState<Shipment | null>(null);
  const [newInvoice, setNewInvoice] = useState({
    po_id: '',
    shipment_id: '',
    invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    invoiced_amount: 0,
    invoice_date: new Date().toISOString().split('T')[0],
  });

  // Eligible Drivers Catalog
  const eligibleDrivers = [
    {
      driver_id: 'drv-001',
      driver_code: 'DRV-2026-1024',
      driver_name: 'Rahul Kumar',
      driver_phone: '+91 98230 44101',
      availability: 'AVAILABLE',
      truck_id: 'trk-001',
      vehicle_number: 'WB-12-AB-1234',
      rating: 4.9,
    },
    {
      driver_id: 'drv-002',
      driver_code: 'DRV-2026-1025',
      driver_name: 'Rajesh Sharma',
      driver_phone: '+91 98234 56789',
      availability: 'AVAILABLE',
      truck_id: 'trk-002',
      vehicle_number: 'MH-12-AB-9901',
      rating: 4.8,
    },
    {
      driver_id: 'drv-003',
      driver_code: 'DRV-2026-1026',
      driver_name: 'Vikram Gurjar',
      driver_phone: '+91 98220 12345',
      availability: 'AVAILABLE',
      truck_id: 'trk-003',
      vehicle_number: 'MH-14-GH-4412',
      rating: 4.7,
    },
    {
      driver_id: 'drv-004',
      driver_code: 'DRV-2026-1027',
      driver_name: 'Amit Deshmukh',
      driver_phone: '+91 98210 98765',
      availability: 'AVAILABLE',
      truck_id: 'trk-004',
      vehicle_number: 'DL-01-XY-7788',
      rating: 4.9,
    },
  ];

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
          .select('*, warehouses(warehouse_name, city), po_items(*, products(*))')
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
      setDriverRequests(getStoredDriverRequests());
    } catch (err: any) {
      console.error(err);
      showToast('Error loading supplier portal data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sent PO Feed: Accept / Reject
  const handleAcceptPo = async (po: PurchaseOrder) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'ACCEPTED_BY_SUPPLIER',
          supplier_response_reason: 'Accepted by Supplier for fulfillment',
          supplier_response_at: new Date().toISOString(),
        })
        .eq('po_id', po.po_id);

      if (error) throw error;

      await logAuditAction('SUPPLIER_PO_ACCEPTED', 'purchase_orders', po.po_id, {
        supplier_id: targetSupplierId,
        po_number: po.po_number,
      });

      showToast(`PO #${po.po_number} accepted! Moved to Accepted POs.`, 'success');
      fetchSupplierData();
    } catch (err: any) {
      showToast('Action failed: ' + err.message, 'error');
    }
  };

  const handleRejectPo = async () => {
    if (!selectedPo || !rejectionReason.trim()) {
      showToast('Please specify a rejection reason.', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'SUPPLIER_REJECTED',
          supplier_response_reason: rejectionReason.trim(),
          supplier_response_at: new Date().toISOString(),
        })
        .eq('po_id', selectedPo.po_id);

      if (error) throw error;

      await logAuditAction('SUPPLIER_PO_REJECTED', 'purchase_orders', selectedPo.po_id, {
        reason: rejectionReason.trim(),
        supplier_id: targetSupplierId,
      });

      // Alert Procurement Officer
      await sendEmailNotification({
        alert_type: 'PO_APPROVAL',
        severity: 'CRITICAL',
        title: `Supplier Rejected PO #${selectedPo.po_number}`,
        message: `Supplier ${supplier?.supplier_name || 'Vendor'} rejected PO #${selectedPo.po_number}. Reason: "${rejectionReason.trim()}"`,
        entity_type: 'purchase_orders',
        entity_number: selectedPo.po_number,
        supplier_name: supplier?.supplier_name,
        supplier_id: targetSupplierId,
        action_link: '/purchase-orders',
      });

      showToast(`PO #${selectedPo.po_number} rejected. Procurement Officer alerted.`, 'warning');
      setOpenRejectModal(false);
      setRejectionReason('');
      fetchSupplierData();
    } catch (err: any) {
      showToast('Rejection failed: ' + err.message, 'error');
    }
  };

  // Helper: Calculate PO quantities (Total, Allocated, Remaining) (Section 4-5 of updates5.md)
  const getPoQuantityMetrics = (po: PurchaseOrder) => {
    const totalPoQty = po.po_items?.reduce((sum, item) => sum + Number(item.ordered_quantity || 0), 0) || 1000;
    const poShipments = shipments.filter((s) => s.po_id === po.po_id);
    const allocatedQty = poShipments.reduce((sum, s) => sum + Number(s.total_quantity || 0), 0);
    const remainingQty = Math.max(0, totalPoQty - allocatedQty);

    return { totalPoQty, allocatedQty, remainingQty, shipmentCount: poShipments.length };
  };

  // Multi-Shipment Creation with strict Remaining Quantity Validation (Section 4-5 of updates5.md)
  const handleOpenShipmentModal = (po: PurchaseOrder) => {
    const { remainingQty } = getPoQuantityMetrics(po);
    if (remainingQty <= 0) {
      showToast(`PO #${po.po_number} is already fully allocated across existing shipments.`, 'info');
      return;
    }
    setShipmentPo(po);
    setShipmentQty(Math.min(remainingQty, 300));
    setShipmentOrigin(`${supplier?.city || 'Mumbai'} Sourcing Hub`);
    setShipmentDest(po.warehouses?.warehouse_name || 'Pune Central DC');
    setOpenShipmentModal(true);
  };

  const handleCreateShipment = async () => {
    if (!shipmentPo) return;
    const { totalPoQty, remainingQty } = getPoQuantityMetrics(shipmentPo);

    if (shipmentQty <= 0) {
      showToast('Shipment quantity must be greater than 0.', 'error');
      return;
    }

    if (shipmentQty > remainingQty) {
      showToast(
        `Quantity Error: Cannot allocate ${shipmentQty} units. Maximum remaining unallocated PO quantity is ${remainingQty} units.`,
        'error'
      );
      return;
    }

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
            po_id: shipmentPo.po_id,
            supplier_id: targetSupplierId,
            origin: shipmentOrigin,
            destination: shipmentDest,
            dispatch_date: new Date(shipmentDispatchDate).toISOString(),
            expected_arrival: new Date(shipmentExpectedArrival).toISOString(),
            status: 'READY_FOR_DRIVER',
            driver_status: 'PENDING',
            location_source: 'DECLARED_BY_SUPPLIER',
            total_quantity: shipmentQty,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await logAuditAction('SUPPLIER_SHIPMENT_CREATED', 'shipments', shp.shipment_id, {
        asn_number: asnNumber,
        po_id: shipmentPo.po_id,
        quantity: shipmentQty,
        remaining_po_quantity: remainingQty - shipmentQty,
      });

      showToast(
        `Shipment #${shipmentNumber} created! (${shipmentQty} units allocated, ${remainingQty - shipmentQty} remaining). Now assign drivers in Dispatch.`,
        'success'
      );

      setOpenShipmentModal(false);
      setActiveTab('shipments');
      fetchSupplierData();
    } catch (err: any) {
      showToast('Shipment creation failed: ' + err.message, 'error');
    }
  };

  // Multi-Driver Request Dispatch (Sections 8-12 of updates5.md)
  const handleOpenDriverModal = (shp: Shipment) => {
    setDriverModalShipment(shp);
    setSelectedDriverIds([eligibleDrivers[0].driver_id, eligibleDrivers[1].driver_id]);
    setDriverExpiryMinutes(10);
    setOpenDriverModal(true);
  };

  const handleBroadcastDriverRequests = async () => {
    if (!driverModalShipment || selectedDriverIds.length === 0) {
      showToast('Please select at least one eligible driver.', 'error');
      return;
    }

    setBroadcastingDrivers(true);
    try {
      const selectedDrivers = eligibleDrivers.filter((d) => selectedDriverIds.includes(d.driver_id));
      await broadcastDriverRequests({
        shipment_id: driverModalShipment.shipment_id,
        supplier_id: targetSupplierId,
        selected_drivers: selectedDrivers,
        expiry_minutes: driverExpiryMinutes,
      });

      showToast(
        `Broadcasted dispatch request to ${selectedDrivers.length} drivers! (10-min timeout, first acceptance wins).`,
        'success'
      );

      setOpenDriverModal(false);
      fetchSupplierData();
    } catch (err: any) {
      showToast('Driver broadcast failed: ' + err.message, 'error');
    } finally {
      setBroadcastingDrivers(false);
    }
  };

  // Dispatch Action: Ready for Dispatch ➔ Dispatched / In Transit (Section 15 of updates5.md)
  const handleDispatchShipment = async (shp: Shipment) => {
    try {
      const { error } = await supabase
        .from('shipments')
        .update({
          status: 'DISPATCHED',
          dispatch_date: new Date().toISOString(),
        })
        .eq('shipment_id', shp.shipment_id);

      if (error) throw error;

      await logAuditAction('SHIPMENT_DISPATCHED', 'shipments', shp.shipment_id, {
        shipment_number: shp.shipment_number,
        driver_id: shp.driver_id,
      });

      showToast(`Shipment #${shp.shipment_number} dispatched! Live highway tracking started.`, 'success');
      fetchSupplierData();
    } catch (err: any) {
      showToast('Dispatch update failed: ' + err.message, 'error');
    }
  };

  // Upload Invoice for Dispatched Shipment (Sections 17-18 of updates5.md)
  const handleOpenInvoiceModal = (shp: Shipment) => {
    setInvoiceShipment(shp);
    const po = purchaseOrders.find((p) => p.po_id === shp.po_id);
    const unitPrice = po?.po_items?.[0]?.unit_price || 250;
    const estAmount = Math.round(shp.total_quantity * unitPrice * 1.18);

    setNewInvoice({
      po_id: shp.po_id,
      shipment_id: shp.shipment_id,
      invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiced_amount: estAmount,
      invoice_date: new Date().toISOString().split('T')[0],
    });
    setOpenInvoiceModal(true);
  };

  const handleUploadSupplierInvoice = async () => {
    try {
      const { error } = await supabase.from('invoices').insert([
        {
          invoice_number: newInvoice.invoice_number,
          po_id: newInvoice.po_id,
          shipment_id: newInvoice.shipment_id || null,
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
        shipment_id: newInvoice.shipment_id,
      });

      showToast(`Invoice #${newInvoice.invoice_number} submitted to Finance AP for 3-Way Match!`, 'success');
      setOpenInvoiceModal(false);
      fetchSupplierData();
    } catch (err: any) {
      showToast('Invoice submission failed: ' + err.message, 'error');
    }
  };

  // Filtered PO lists
  const sentPos = purchaseOrders.filter(
    (p) => p.status === 'SENT_TO_SUPPLIER' || p.status === 'DRAFT_AI_GENERATED' || p.status === 'APPROVED'
  );
  const acceptedPos = purchaseOrders.filter(
    (p) => p.status === 'ACCEPTED_BY_SUPPLIER' || p.status === 'CONFIRMED'
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600/30 border border-indigo-400/40 rounded-2xl flex items-center justify-center text-indigo-300">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                SUPPLIER PARTNER PORTAL
              </span>
              <span className="text-xs text-slate-400 font-mono">ID: {supplier?.supplier_code || 'SUP-1003'}</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mt-1">
              {supplier?.supplier_name || 'Tata Industrial Solutions Ltd'}
            </h1>
            <p className="text-xs text-slate-300">
              Primary Contact: {supplier?.contact_person || 'Rahul Mehta'} • {supplier?.email || 'rahul.mehta@tataindustrial.com'} • {supplier?.city || 'Mumbai'}
            </p>
          </div>
        </div>

        {/* Live Score Badge */}
        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/15 text-center">
          <span className="text-[11px] uppercase tracking-wider text-slate-300 block font-semibold">Overall Supplier Rating</span>
          <div className="text-3xl font-black text-amber-300 flex items-center justify-center gap-1.5 mt-0.5">
            <Sparkles className="w-6 h-6 text-amber-400" />
            <span>{performance?.overall_score || 94.5}</span>
            <span className="text-sm font-normal text-slate-300">/ 100</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold">Tier-1 Strategic Vendor</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'overview', label: 'Dashboard Overview', icon: Building2 },
          { id: 'sent_pos', label: `Sent POs (${sentPos.length})`, icon: Bell },
          { id: 'accepted_pos', label: `Accepted POs (${acceptedPos.length})`, icon: ShoppingCart },
          { id: 'shipments', label: `Shipments & Dispatch (${shipments.length})`, icon: Truck },
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Pending PO Acceptance</span>
              <p className="text-2xl font-black text-amber-600 mt-1">{sentPos.length}</p>
              <span className="text-xs text-slate-500">Requires confirmation</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Accepted POs</span>
              <p className="text-2xl font-black text-indigo-600 mt-1">{acceptedPos.length}</p>
              <span className="text-xs text-slate-500">Ready for multi-shipment dispatch</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Active Dispatches</span>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {shipments.filter((s) => s.status === 'IN_TRANSIT' || s.status === 'DISPATCHED' || s.status === 'READY_FOR_DISPATCH').length}
              </p>
              <span className="text-xs text-slate-500">Inbound highway transport</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Quality Inspection Pass Rate</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">{performance?.quality_score || 96}%</p>
              <span className="text-xs text-slate-500">Authoritative dock QA score</span>
            </div>
          </div>

          {/* Action Quick Links */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sent PO Feed Summary */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-600" />
                  <span>Incoming Purchase Orders Awaiting Acceptance</span>
                </h3>
                <button
                  onClick={() => setActiveTab('sent_pos')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                >
                  View Feed ({sentPos.length})
                </button>
              </div>

              {sentPos.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">All sent purchase orders have been acknowledged.</div>
              ) : (
                <div className="space-y-2.5">
                  {sentPos.slice(0, 3).map((po) => (
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
                        <button
                          onClick={() => handleAcceptPo(po)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                        >
                          Accept PO
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPo(po);
                            setOpenRejectModal(true);
                          }}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Dispatches Summary */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Shipments & Dispatch Pipeline</span>
                </h3>
                <button
                  onClick={() => setActiveTab('shipments')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold cursor-pointer"
                >
                  Manage Dispatches ({shipments.length})
                </button>
              </div>

              {shipments.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">No active shipments created yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {shipments.slice(0, 3).map((shp) => (
                    <div
                      key={shp.shipment_id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{shp.shipment_number}</span>
                          <span className="text-[10px] text-blue-700 font-normal">({shp.total_quantity} units)</span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {shp.origin || 'Mumbai'} ➔ {shp.destination || 'Pune DC'}
                        </div>
                      </div>
                      <StatusBadge status={shp.status} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SENT POs FEED (Section 2 of updates5.md) ── */}
      {activeTab === 'sent_pos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Sent Purchase Orders Feed</h2>
              <p className="text-xs text-slate-500">
                Purchase orders approved and transmitted by Procurement Officer awaiting your acceptance.
              </p>
            </div>
          </div>

          {sentPos.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs shadow-xs">
              No pending purchase orders awaiting acceptance. All sent POs have been acknowledged.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentPos.map((po) => {
                const totalQty = po.po_items?.reduce((sum, item) => sum + Number(item.ordered_quantity || 0), 0) || 1000;
                const prodNames = po.po_items?.map((item) => item.products?.product_name || 'Industrial Material').join(', ') || 'Industrial SKU';

                return (
                  <div key={po.po_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3.5">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="font-mono font-black text-blue-600 text-sm">{po.po_number}</span>
                        <div className="text-[11px] text-slate-400">Sent Date: {new Date(po.order_date || po.created_at || '').toLocaleDateString()}</div>
                      </div>
                      <StatusBadge status={po.status} />
                    </div>

                    {/* Specifications */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Products</span>
                        <span className="font-bold text-slate-900 truncate block">{prodNames}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Quantity</span>
                        <span className="font-bold text-slate-900">{totalQty.toLocaleString()} units</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Delivery Location</span>
                        <span className="font-medium text-slate-800">{po.warehouses?.warehouse_name || 'Pune Central DC'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Total Amount</span>
                        <span className="font-bold text-indigo-700">₹{Number(po.total_amount).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedPo(po);
                          setOpenViewPoModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View PO</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPo(po);
                          setOpenRejectModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
                      >
                        Reject PO
                      </button>
                      <button
                        onClick={() => handleAcceptPo(po)}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept PO</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: ACCEPTED POs & MULTI-SHIPMENT ALLOCATION (Sections 3-5 of updates5.md) ── */}
      {activeTab === 'accepted_pos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Accepted Purchase Orders</h2>
              <p className="text-xs text-slate-500">
                Fulfill accepted contracts by creating 1..N partial or full shipment dispatches.
              </p>
            </div>
          </div>

          {acceptedPos.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs shadow-xs">
              No accepted purchase orders yet. Accept POs from the "Sent POs" tab to begin dispatch creation.
            </div>
          ) : (
            <div className="space-y-3">
              {acceptedPos.map((po) => {
                const { totalPoQty, allocatedQty, remainingQty, shipmentCount } = getPoQuantityMetrics(po);
                const percentAllocated = Math.round((allocatedQty / totalPoQty) * 100);

                return (
                  <div key={po.po_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-base text-slate-900">{po.po_number}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ACCEPTED_BY_SUPPLIER
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Delivery DC: <strong className="text-slate-800">{po.warehouses?.warehouse_name || 'Pune Central DC'}</strong> • Commitment: <strong className="text-indigo-700">₹{Number(po.total_amount).toLocaleString()}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenShipmentModal(po)}
                          disabled={remainingQty <= 0}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Create Shipment ({remainingQty} units avail)</span>
                        </button>
                      </div>
                    </div>

                    {/* Allocation Progress Bar */}
                    <div className="pt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          Fulfillment Allocation: <strong>{allocatedQty}</strong> of <strong>{totalPoQty}</strong> units ({shipmentCount} shipments created)
                        </span>
                        <span className={`font-bold ${remainingQty === 0 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                          {remainingQty === 0 ? '100% Fully Allocated' : `${remainingQty} units remaining to fulfill`}
                        </span>
                      </div>

                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${remainingQty === 0 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                          style={{ width: `${Math.min(100, percentAllocated)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: SHIPMENT & DISPATCH MANAGEMENT (Sections 6-12, 15 of updates5.md) ── */}
      {activeTab === 'shipments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Shipment & Dispatch Pipeline</h2>
              <p className="text-xs text-slate-500">
                Manage truck dispatches, broadcast driver assignment requests, and launch live GPS telematics.
              </p>
            </div>
          </div>

          {shipments.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs shadow-xs">
              No shipments created. Create a shipment against an accepted purchase order to initiate dispatch.
            </div>
          ) : (
            <div className="space-y-3">
              {shipments.map((shp) => {
                const isReadyForDriver = shp.status === 'READY_FOR_DRIVER' || shp.status === 'CREATED';
                const isDriverRequested = shp.status === 'DRIVER_REQUESTED';
                const isReadyToDispatch = shp.status === 'READY_FOR_DISPATCH' || (shp.driver_status === 'ACCEPTED' && shp.status !== 'DISPATCHED' && shp.status !== 'IN_TRANSIT');
                const isDispatched = shp.status === 'DISPATCHED' || shp.status === 'IN_TRANSIT' || shp.status === 'ARRIVED_AT_FACILITY' || shp.status === 'AT_DOCK';

                return (
                  <div key={shp.shipment_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-blue-600 text-sm">{shp.shipment_number}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                            ASN: {shp.asn_number || 'ASN-2026-9901'}
                          </span>
                          <StatusBadge status={shp.status} size="sm" />
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          PO Ref: <strong className="text-slate-800">{shp.purchase_orders?.po_number || 'PO-1045'}</strong> • Quantity: <strong className="text-indigo-700">{shp.total_quantity} units</strong>
                        </div>
                      </div>

                      {/* Contextual Action Buttons */}
                      <div className="flex items-center gap-2">
                        {isReadyForDriver && (
                          <button
                            onClick={() => handleOpenDriverModal(shp)}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>Assign Drivers</span>
                          </button>
                        )}

                        {isDriverRequested && (
                          <button
                            onClick={() => handleOpenDriverModal(shp)}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                            <span>Driver Requests Pending (Rebroadcast)</span>
                          </button>
                        )}

                        {isReadyToDispatch && (
                          <button
                            onClick={() => handleDispatchShipment(shp)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Dispatch Shipment</span>
                          </button>
                        )}

                        {isDispatched && (
                          <button
                            onClick={() => handleOpenInvoiceModal(shp)}
                            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Submit Invoice</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Manifest Route & Driver Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Origin Hub</span>
                        <span className="font-bold text-slate-800 truncate block">{shp.origin || 'Mumbai Sourcing Hub'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Destination Facility</span>
                        <span className="font-bold text-slate-800 truncate block">{shp.destination || 'Pune Central DC'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Assigned Driver</span>
                        <span className="font-bold text-slate-900 block">
                          {shp.driver_name || (shp.driver_status === 'ACCEPTED' ? 'Rajesh Sharma (DRV-2026-1025)' : 'Awaiting Driver')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 font-bold block">Expected Arrival</span>
                        <span className="font-medium text-slate-800">{new Date(shp.expected_arrival || '').toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: INVOICES & PAYMENTS (Sections 17-19 of updates5.md) ── */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Invoices & Settlement Tracking</h2>
              <p className="text-xs text-slate-500">
                Upload commercial invoices against dispatched shipments for Accounts Payable 3-Way Matching.
              </p>
            </div>
            <button
              onClick={() => {
                if (shipments.length > 0) {
                  handleOpenInvoiceModal(shipments[0]);
                } else {
                  showToast('Please create a shipment before submitting an invoice.', 'info');
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Invoice</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <th className="p-3">Invoice#</th>
                  <th className="p-3">PO Reference</th>
                  <th className="p-3">Shipment Ref</th>
                  <th className="p-3">Invoice Date</th>
                  <th className="p-3 text-right">Invoiced Value</th>
                  <th className="p-3 text-center">3-Way Match</th>
                  <th className="p-3">Payment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((inv) => (
                  <tr key={inv.invoice_id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                    <td className="p-3 font-mono text-blue-600">{inv.purchase_orders?.po_number || inv.po_id || 'PO-1045'}</td>
                    <td className="p-3 font-mono text-slate-700">{inv.shipment_id ? `SHP-${inv.shipment_id.slice(0, 6)}` : 'Consolidated'}</td>
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

      {/* ── TAB 6: QUALITY & PROFILE (Sections 28-30 of updates5.md) ── */}
      {(activeTab === 'quality' || activeTab === 'profile') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Multi-Criteria Scorecard</h3>
            <div className="space-y-2.5 text-xs">
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

          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">QC Finalized Score History & Trends</h3>
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

      {/* ── MODAL 1: REJECT PO REASON ── */}
      {openRejectModal && selectedPo && (
        <Modal
          title={`Reject PO #${selectedPo.po_number}`}
          isOpen={openRejectModal}
          onClose={() => setOpenRejectModal(false)}
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Provide a mandatory rejection reason for Procurement Officer Priya Sharma.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Unable to meet delivery timeline due to raw material lead time constraints..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpenRejectModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectPo}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL 2: MULTI-SHIPMENT CREATION ── */}
      {openShipmentModal && shipmentPo && (
        <Modal
          title={`Create Shipment against PO #${shipmentPo.po_number}`}
          subtitle="Multi-shipment dispatch allocation engine"
          isOpen={openShipmentModal}
          onClose={() => setOpenShipmentModal(false)}
        >
          <div className="space-y-4 text-xs">
            {/* Allocation Stats Card */}
            {(() => {
              const { totalPoQty, allocatedQty, remainingQty } = getPoQuantityMetrics(shipmentPo);
              return (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>PO Total Contract Units:</span>
                    <span>{totalPoQty.toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Already Allocated to Shipments:</span>
                    <span className="font-semibold">{allocatedQty.toLocaleString()} units</span>
                  </div>
                  <div className="flex justify-between font-black text-indigo-700 text-sm pt-1 border-t border-indigo-200">
                    <span>Remaining Unallocated:</span>
                    <span>{remainingQty.toLocaleString()} units</span>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Shipment Quantity (Units)</label>
                <input
                  type="number"
                  value={shipmentQty}
                  onChange={(e) => setShipmentQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Origin Facility Hub</label>
                <input
                  type="text"
                  value={shipmentOrigin}
                  onChange={(e) => setShipmentOrigin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Delivery Facility</label>
                <input
                  type="text"
                  value={shipmentDest}
                  onChange={(e) => setShipmentDest(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Expected Dispatch Date</label>
                <input
                  type="date"
                  value={shipmentDispatchDate}
                  onChange={(e) => setShipmentDispatchDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenShipmentModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateShipment}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Confirm Shipment Creation
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL 3: MULTI-DRIVER REQUEST BROADCAST (Sections 8-12 of updates5.md) ── */}
      {openDriverModal && driverModalShipment && (
        <Modal
          title={`Broadcast Driver Requests: ${driverModalShipment.shipment_number}`}
          subtitle="First valid driver acceptance atomically wins the trip assignment"
          isOpen={openDriverModal}
          onClose={() => setOpenDriverModal(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <div className="flex items-center gap-1.5 font-bold mb-0.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Multi-Driver Broadcast Rule (First-Acceptance-Wins)</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Selected drivers will receive a simultaneous push dispatch request. The first driver to accept atomically claims the shipment; all other pending requests will be cancelled automatically.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-900 block mb-2">Select Eligible Available Drivers</label>
              <div className="space-y-2">
                {eligibleDrivers.map((driver) => {
                  const isChecked = selectedDriverIds.includes(driver.driver_id);
                  return (
                    <div
                      key={driver.driver_id}
                      onClick={() => {
                        setSelectedDriverIds((prev) =>
                          isChecked ? prev.filter((id) => id !== driver.driver_id) : [...prev, driver.driver_id]
                        );
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isChecked ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-300' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-indigo-600">
                          {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-300" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{driver.driver_name}</span>
                            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                              {driver.driver_code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {driver.vehicle_number} • {driver.driver_phone} • Rating: ★ {driver.rating}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        AVAILABLE
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-500">Request Expiry Window: <strong>10 minutes</strong></span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpenDriverModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={broadcastingDrivers || selectedDriverIds.length === 0}
                  onClick={handleBroadcastDriverRequests}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {broadcastingDrivers ? 'Broadcasting...' : `Send Requests (${selectedDriverIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL 4: INVOICE UPLOAD ── */}
      {openInvoiceModal && (
        <Modal
          title="Upload Supplier Invoice"
          subtitle="Submit commercial invoice for 3-Way Match"
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
                <label className="font-semibold block mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={newInvoice.invoice_number}
                  onChange={(e) => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
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
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadSupplierInvoice}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
              >
                Submit to Finance AP
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SupplierPortal;
