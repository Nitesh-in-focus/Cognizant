import React, { useEffect, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Truck,
  RefreshCw,
  Search,
  Scan,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { OcrScanPanel } from '../components/common/OcrScanPanel';
import { OcrInvoiceResult } from '../lib/ocr';

export const PurchaseOrders: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar, addAlert } = useApp();

  const [pos, setPos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create PO Modal state
  const [openCreate, setOpenCreate] = useState(false);
  const [poInputMode, setPoInputMode] = useState<'manual' | 'ocr'>('manual');
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

  const handleCreatePo = async () => {
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

  const filteredPos = pos.filter(
    (p) =>
      !searchQuery ||
      p.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.suppliers?.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-12">
      {/* Header (Section 27) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            Purchase Orders (PO) Register
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Contractual purchase commitments, supplier rate agreements, and inbound shipment dispatch triggers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh POs"
          >
            <RefreshCw className="w-4 h-4" />
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

      {/* Purchase Orders Table (Sections 24, 25, 29) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier Partner</th>
                <th className="py-3 px-4">Delivery Warehouse</th>
                <th className="py-3 px-4">Line Items & Rates</th>
                <th className="py-3 px-4">Total Amount (incl. GST)</th>
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
                          {item?.products?.product_name || 'Industrial Pumps'}
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
                        {po.status === 'CONFIRMED' ? (
                          <button
                            onClick={() => setSelectedPoForShipment(po)}
                            className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors inline-flex items-center gap-1 border border-blue-200"
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

      {/* Issue PO Modal */}
      <Modal
        isOpen={openCreate}
        onClose={() => { setOpenCreate(false); setPoInputMode('manual'); }}
        title="Issue Contractual Purchase Order"
        subtitle="Generate a legal purchase order — fill manually or scan a document with OCR"
        maxWidth="xl"
        footer={
          <>
            <button
              onClick={() => { setOpenCreate(false); setPoInputMode('manual'); }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePo}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Confirm & Issue PO
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">

          {/* ── Mode Toggle ── */}
          <div className="flex rounded-xl bg-slate-100 p-1 gap-1 border border-slate-200">
            <button
              onClick={() => setPoInputMode('manual')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                poInputMode === 'manual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              Manual Entry
            </button>
            <button
              onClick={() => setPoInputMode('ocr')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                poInputMode === 'ocr' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              Scan Document (OCR)
            </button>
          </div>

          {/* ── OCR Panel ── */}
          {poInputMode === 'ocr' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-blue-900 text-xs">Tesseract.js OCR Scanner</span>
                <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-bold border border-blue-200">FREE • BROWSER-BASED</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Upload a PO document image. OCR will extract supplier name, quantity, unit price, and PO number — then auto-fill the form below.
              </p>
              <OcrScanPanel
                documentLabel="purchase order document"
                onExtracted={(r: OcrInvoiceResult) => {
                  // Map all OCR fields → PO form
                  if (r.quantity && r.quantity > 0) {
                    setNewPo((prev) => ({ ...prev, quantity: r.quantity! }));
                  }
                  if (r.unitPrice && r.unitPrice > 0) {
                    setNewPo((prev) => ({ ...prev, unit_price: r.unitPrice! }));
                  } else if (r.totalAmount && r.totalAmount > 0) {
                    const qty = r.quantity || newPo.quantity || 100;
                    const estUnitPrice = Math.round(r.totalAmount / qty / 1.18);
                    if (estUnitPrice > 0) {
                      setNewPo((prev) => ({ ...prev, unit_price: estUnitPrice }));
                    }
                  }
                  if (r.poNumber) {
                    setNewPo((prev) => ({ ...prev, po_number_override: r.poNumber! }));
                  } else if (r.invoiceNumber) {
                    setNewPo((prev) => ({ ...prev, po_number_override: r.invoiceNumber! }));
                  }
                  // Match vendor name to supplier list
                  if (r.vendorName) {
                    const matched = suppliers.find((s: any) =>
                      s.supplier_name.toLowerCase().includes(r.vendorName!.toLowerCase()) ||
                      r.vendorName!.toLowerCase().includes(s.supplier_name.toLowerCase())
                    );
                    if (matched) setNewPo((prev) => ({ ...prev, supplier_id: matched.supplier_id }));
                  }
                  // Match product SKU
                  if (r.productName) {
                    const matchedProd = products.find((p: any) =>
                      p.product_name.toLowerCase().includes(r.productName!.toLowerCase()) ||
                      r.productName!.toLowerCase().includes(p.product_name.toLowerCase())
                    );
                    if (matchedProd) setNewPo((prev) => ({ ...prev, product_id: matchedProd.product_id }));
                  }
                  if (r.paymentTerms) {
                    setNewPo((prev) => ({ ...prev, payment_terms: r.paymentTerms! }));
                  }
                  showSnackbar('OCR complete! Extracted PO fields auto-populated below.', 'success');
                }}
                onError={(msg) => showSnackbar(`OCR Error: ${msg}`, 'error')}
              />
            </div>
          )}

          {/* ── Manual Form (always visible, auto-filled after OCR) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
                <span>PO Reference Number</span>
                {newPo.po_number_override && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">OCR ✓</span>}
              </label>
              <input
                type="text"
                value={newPo.po_number_override}
                onChange={(e) => setNewPo({ ...newPo, po_number_override: e.target.value })}
                placeholder="Auto-generated (e.g. PO-2026-1001)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
                <span>Vendor / Supplier</span>
                {newPo.supplier_id && <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Auto</span>}
              </label>
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
              <label className="font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
                <span>Ordered Quantity</span>
                {newPo.quantity && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">OCR ✓</span>}
              </label>
              <input
                type="number"
                value={newPo.quantity}
                onChange={(e) => setNewPo({ ...newPo, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
                <span>Contract Unit Price (INR)</span>
                {newPo.unit_price && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">OCR ✓</span>}
              </label>
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
