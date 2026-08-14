import React, { useEffect, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Truck,
  RefreshCw,
  Search,
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  Building2,
  FileCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { getAiSupplierRecommendation, SupplierAiRecommendation } from '../services/ai/supplierRecommendationService';
import { routeNotification } from '../services/notifications/notificationRouter';

export const PurchaseOrders: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar, addAlert, canApprovePO, canSendPO, logAuditAction } = useApp();

  const [pos, setPos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create PO Modal state
  const [openCreate, setOpenCreate] = useState(false);
  const [aiRec, setAiRec] = useState<SupplierAiRecommendation | null>(null);
  const [runningAiRec, setRunningAiRec] = useState(false);
  const [newPo, setNewPo] = useState({
    supplier_id: '',
    warehouse_id: '',
    product_id: '',
    quantity: 100,
    unit_price: 50,
    payment_terms: 'NET 30',
    po_number_override: '',
  });

  // Dispatch Shipment Modal
  const [selectedPoForShipment, setSelectedPoForShipment] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        { data: poData },
        { data: supData },
        { data: prodData },
        { data: whData },
      ] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select(`
            *,
            suppliers(supplier_name, email, city),
            warehouses(warehouse_name, city),
            po_items(
              *,
              products(product_name, unit_of_measure)
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*'),
        supabase.from('products').select('*'),
        supabase.from('warehouses').select('*'),
      ]);

      setPos(poData || []);
      setSuppliers(supData || []);
      setProducts(prodData || []);
      setWarehouses(whData || []);

      if (supData?.length && whData?.length && prodData?.length && !newPo.supplier_id) {
        setNewPo({
          supplier_id: supData[0].supplier_id,
          warehouse_id: whData[0].warehouse_id,
          product_id: prodData[0].product_id,
          quantity: 100,
          unit_price: Number(prodData[0].unit_price) || 50,
          payment_terms: 'NET 30',
          po_number_override: '',
        });
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAiSupplierSelect = async () => {
    try {
      setRunningAiRec(true);
      const candidates = suppliers.slice(0, 5).map((s, idx) => ({
        supplier_id: s.supplier_id,
        supplier_name: s.supplier_name,
        city: s.city,
        quality_score: 90 + idx,
        delivery_score: 88 + idx * 2,
        overall_score: 91 + idx,
        unit_price: (newPo.unit_price || 50) + (idx === 0 ? 0 : idx * 2),
        lead_time_days: 2 + idx,
        exception_count: idx,
        capacity_units: 5000,
      }));

      const res = await getAiSupplierRecommendation(
        'PR-DEMO',
        newPo.product_id || 'PROD',
        newPo.quantity,
        candidates
      );

      setAiRec(res);
      setNewPo((prev) => ({ ...prev, supplier_id: res.recommended_supplier_id }));
      showSnackbar(`AI recommended: ${res.recommended_supplier_name} (${res.confidence}% confidence)`, 'success');
    } catch (err: any) {
      showSnackbar('AI Supplier Recommendation failed: ' + err.message, 'error');
    } finally {
      setRunningAiRec(false);
    }
  };

  const handleCreatePo = async () => {
    if (!canApprovePO()) {
      showSnackbar('Permission Denied: Only Procurement Managers can issue/approve Purchase Orders.', 'error');
      return;
    }

    try {
      if (!newPo.supplier_id || !newPo.warehouse_id || !newPo.product_id) {
        showSnackbar('Please complete all PO fields', 'error');
        return;
      }

      const suffix = Math.floor(1000 + Math.random() * 9000);
      const poNumber = newPo.po_number_override?.trim() || `PO-2026-${suffix}`;
      const subtotal = newPo.quantity * newPo.unit_price;
      const tax = subtotal * 0.18;
      const totalAmount = subtotal + tax;

      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert([
          {
            po_number: poNumber,
            supplier_id: newPo.supplier_id,
            warehouse_id: newPo.warehouse_id,
            subtotal,
            tax_amount: tax,
            total_amount: totalAmount,
            status: 'CONFIRMED',
            payment_terms: newPo.payment_terms,
            order_date: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (poErr) throw poErr;

      await supabase.from('po_items').insert([
        {
          po_id: po.po_id,
          product_id: newPo.product_id,
          ordered_quantity: newPo.quantity,
          unit_price: newPo.unit_price,
          tax_rate: 18,
          line_total: totalAmount,
        },
      ]);

      await logAuditAction('PO_ISSUED', 'purchase_orders', po.po_id, {
        po_number: poNumber,
        total_amount: totalAmount,
      });

      showSnackbar(`Purchase Order #${poNumber} issued for ₹${totalAmount.toLocaleString()}!`, 'success');
      setOpenCreate(false);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleDispatchShipment = async () => {
    try {
      if (!selectedPoForShipment) return;

      const suffix = Math.floor(1000 + Math.random() * 9000);
      const shpNumber = `SHP-2026-${suffix}`;
      const truckNumber = `MH-12-TR-${suffix}`;

      const { data: truck } = await supabase
        .from('trucks')
        .insert([
          {
            vehicle_number: truckNumber,
            driver_name: 'Rajesh Sharma',
            driver_phone: '+91 9823456789',
            status: 'IN_TRANSIT',
            capacity: 2000,
          },
        ])
        .select()
        .single();

      const { data: shp, error: shpErr } = await supabase
        .from('shipments')
        .insert([
          {
            shipment_number: shpNumber,
            po_id: selectedPoForShipment.po_id,
            destination_warehouse_id: selectedPoForShipment.warehouse_id,
            origin: selectedPoForShipment.suppliers?.city || 'Mumbai Hub',
            dispatch_date: new Date().toISOString(),
            status: 'IN_TRANSIT',
            total_quantity: selectedPoForShipment.po_items?.[0]?.ordered_quantity || 100,
          },
        ])
        .select()
        .single();

      if (shpErr) throw shpErr;

      if (truck && shp) {
        await supabase.from('truck_locations').insert([
          {
            truck_id: truck.truck_id,
            shipment_id: shp.shipment_id,
            location_name: 'Vashi Toll Plaza (Highway Dispatch)',
            latitude: 19.0657,
            longitude: 72.9984,
            speed: 60,
            status: 'ON_TIME',
            timestamp: new Date().toISOString(),
          },
        ]);
      }

      await supabase
        .from('purchase_orders')
        .update({ status: 'DISPATCHED' })
        .eq('po_id', selectedPoForShipment.po_id);

      addAlert({
        title: `Shipment Dispatched: ${shpNumber}`,
        message: `Truck ${truckNumber} dispatched for ${selectedPoForShipment.po_number}. Live GPS tracking initiated.`,
        severity: 'info',
        link: '/shipments',
      });

      showSnackbar(`Shipment #${shpNumber} dispatched with live GPS tracking!`, 'success');
      setSelectedPoForShipment(null);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleConfirmDraftPo = async (poId: string, poNumber: string) => {
    if (!canApprovePO()) {
      showSnackbar('Permission Denied: Only Procurement can review and confirm POs.', 'error');
      return;
    }
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'READY_TO_SEND' })
        .eq('po_id', poId);
      if (error) throw error;

      await logAuditAction('PO_CONFIRMED_READY_TO_SEND', 'purchase_orders', poId, { po_number: poNumber });
      showSnackbar(`PO #${poNumber} reviewed and confirmed. Ready to send to supplier.`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleSendPoToSupplier = async (po: any) => {
    if (!canSendPO()) {
      showSnackbar('Permission Denied: Only authorized Procurement Officers can send POs.', 'error');
      return;
    }
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'SENT_TO_SUPPLIER' })
        .eq('po_id', po.po_id);
      if (error) throw error;

      await logAuditAction('PO_SENT_TO_SUPPLIER', 'purchase_orders', po.po_id, {
        po_number: po.po_number,
        supplier: po.suppliers?.supplier_name,
        amount: po.total_amount,
      });

      await routeNotification({
        event_type: 'PO_AWAITING_ACCEPTANCE',
        title: `PO #${po.po_number} Issued & Transmitted`,
        message: `Purchase Order #${po.po_number} has been dispatched to ${po.suppliers?.supplier_name} for order acknowledgment.`,
        severity: 'INFO',
        supplier_id: po.supplier_id,
        supplier_email: po.suppliers?.email,
        entity_type: 'purchase_orders',
        entity_number: po.po_number,
        action_link: '/supplier',
      });

      showSnackbar(`PO #${po.po_number} sent to ${po.suppliers?.supplier_name || 'supplier'}! Awaiting acceptance.`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const filteredPos = pos.filter((p) => {
    const matchSearch =
      !searchQuery ||
      p.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.suppliers?.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchSearch;
  });

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Purchase Orders (PO)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Contract commitments, supplier transmissions, and inbound delivery milestones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerRefresh()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setOpenCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Issue Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by PO#, Supplier name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Total Commitments: <strong className="text-slate-900">{filteredPos.length} POs</strong>
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier Partner</th>
                <th className="py-3 px-4">Delivery Warehouse</th>
                <th className="py-3 px-4">Line Items & Rates</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading Purchase Orders...
                  </td>
                </tr>
              ) : filteredPos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No purchase orders recorded. Click "Issue Purchase Order" to generate one.
                  </td>
                </tr>
              ) : (
                filteredPos.map((po) => {
                  const item = po.po_items?.[0];
                  return (
                    <tr key={po.po_id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-blue-600">
                        {po.po_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {po.suppliers?.supplier_name || 'Acme Corp'}
                        </div>
                        <div className="text-[11px] text-slate-400">{po.suppliers?.city || 'Mumbai'}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-900 font-semibold">
                          {po.warehouses?.warehouse_name || 'Central Hub'}
                        </div>
                        <div className="text-[11px] text-slate-400">{po.warehouses?.city}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-900 font-semibold">
                          {item?.products?.product_name || 'Industrial Material'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item?.ordered_quantity || 100} @ ₹{item?.unit_price || 50}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        ₹{Number(po.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={po.status || 'CONFIRMED'} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {po.status === 'DRAFT_AUTO_GENERATED' ? (
                          <button
                            onClick={() => handleConfirmDraftPo(po.po_id, po.po_number)}
                            className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold text-xs transition-colors inline-flex items-center gap-1 border border-amber-200 cursor-pointer"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>Confirm Draft</span>
                          </button>
                        ) : po.status === 'READY_TO_SEND' ? (
                          <button
                            onClick={() => handleSendPoToSupplier(po)}
                            className="px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>SEND TO SUPPLIER</span>
                          </button>
                        ) : po.status === 'SENT_TO_SUPPLIER' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Clock className="w-3 h-3" />
                            <span>Awaiting Acceptance</span>
                          </span>
                        ) : po.status === 'CONFIRMED' ? (
                          <button
                            onClick={() => setSelectedPoForShipment(po)}
                            className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors inline-flex items-center gap-1 border border-blue-200 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Dispatch Shipment</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Dispatched / Active
                          </span>
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

      {/* Issue PO Modal (100% Manual - OCR Removed from PO as per Section 19) */}
      <Modal
        isOpen={openCreate}
        onClose={() => { setOpenCreate(false); setAiRec(null); }}
        title="Issue Contractual Purchase Order"
        subtitle="Specify commercial terms, product quantities, and destination warehouse"
        maxWidth="xl"
        footer={
          <>
            <button
              onClick={() => { setOpenCreate(false); setAiRec(null); }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePo}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Confirm & Issue PO
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {aiRec && (
            <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-indigo-900 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>AI Recommended Supplier: {aiRec.recommended_supplier_name}</span>
                </div>
                <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                  {aiRec.confidence}% Match
                </span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-indigo-800 space-y-0.5">
                {aiRec.reasons.slice(0, 2).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">PO Reference Number</label>
              <input
                type="text"
                value={newPo.po_number_override}
                onChange={(e) => setNewPo({ ...newPo, po_number_override: e.target.value })}
                placeholder="Auto-generated (e.g. PO-2026-1001)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium text-slate-800"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-700">Vendor / Supplier</label>
                <button
                  type="button"
                  onClick={handleRunAiSupplierSelect}
                  disabled={runningAiRec}
                  className="text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded font-bold border border-indigo-200 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  <span>{runningAiRec ? 'Evaluating...' : 'AI Best Supplier'}</span>
                </button>
              </div>
              <select
                value={newPo.supplier_id}
                onChange={(e) => setNewPo({ ...newPo, supplier_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              >
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name} ({s.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Destination Warehouse</label>
              <select
                value={newPo.warehouse_id}
                onChange={(e) => setNewPo({ ...newPo, warehouse_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              >
                {warehouses.map((w) => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>
                    {w.warehouse_name} ({w.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Payment Terms</label>
              <select
                value={newPo.payment_terms}
                onChange={(e) => setNewPo({ ...newPo, payment_terms: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              >
                <option value="NET 30">NET 30</option>
                <option value="NET 15">NET 15</option>
                <option value="NET 60">NET 60</option>
                <option value="IMMEDIATE">IMMEDIATE</option>
                <option value="ADVANCE">ADVANCE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">Select Product SKU</label>
            <select
              value={newPo.product_id}
              onChange={(e) => {
                const prod = products.find((p) => p.product_id === e.target.value);
                setNewPo({ ...newPo, product_id: e.target.value, unit_price: Number(prod?.unit_price) || 50 });
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} (Base: ₹{p.unit_price})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Ordered Quantity</label>
              <input
                type="number"
                value={newPo.quantity}
                onChange={(e) => setNewPo({ ...newPo, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">Contract Unit Price (INR)</label>
              <input
                type="number"
                value={newPo.unit_price}
                onChange={(e) => setNewPo({ ...newPo, unit_price: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Tax Calculation Box */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-900">₹{(newPo.quantity * newPo.unit_price).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST (18%):</span>
              <span className="font-semibold text-slate-900">₹{(newPo.quantity * newPo.unit_price * 0.18).toLocaleString()}</span>
            </div>
            <div className="h-px bg-slate-200 my-1" />
            <div className="flex justify-between text-sm font-bold text-slate-900">
              <span>Total Contract Commitment:</span>
              <span className="text-blue-600">₹{(newPo.quantity * newPo.unit_price * 1.18).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Dispatch Logistics Modal */}
      <Modal
        isOpen={Boolean(selectedPoForShipment)}
        onClose={() => setSelectedPoForShipment(null)}
        title="Dispatch Inbound Logistics Carrier"
        subtitle={`Assign fleet carrier and generate live GPS telemetry for ${selectedPoForShipment?.po_number}`}
        maxWidth="sm"
        footer={
          <>
            <button
              onClick={() => setSelectedPoForShipment(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDispatchShipment}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Dispatch Now</span>
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="text-slate-600">
            Dispatch truck carrier for <strong>{selectedPoForShipment?.po_number}</strong> with origin at{' '}
            <strong>{selectedPoForShipment?.suppliers?.city || 'Mumbai Hub'}</strong>.
          </p>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-slate-600">
            <div>Carrier: <strong className="text-slate-900">BlueDart Heavy Freight</strong></div>
            <div>Vehicle: <strong className="text-slate-900">MH-12-TR (GPS Enabled)</strong></div>
            <div>Driver: <strong className="text-slate-900">Rajesh Sharma (+91 9823456789)</strong></div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PurchaseOrders;
