import React, { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  Plus,
  RefreshCw,
  Search,
  PenLine,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const GoodsReceipts: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar, addAlert, canFinalizeQC, logAuditAction } = useApp();

  const [grns, setGrns] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create GRN Modal (100% Manual Intake - Section 18 of updates2.md)
  const [openCreate, setOpenCreate] = useState(false);
  const [newGrn, setNewGrn] = useState({
    po_id: '',
    product_id: '',
    received_quantity: 100,
    damaged_quantity: 0,
    notes: 'All boxes passed visual barcode & seal inspection.',
  });

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [{ data: grnData }, { data: poData }, { data: prodData }] = await Promise.all([
        supabase
          .from('goods_receipts')
          .select(`
            *,
            purchase_orders(po_number, suppliers(supplier_name)),
            shipments(shipment_number),
            grn_items(
              *,
              products(product_name, unit_of_measure)
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('purchase_orders').select('*'),
        supabase.from('products').select('*'),
      ]);

      setGrns(grnData || []);
      setPos(poData || []);
      setProducts(prodData || []);

      if (poData?.length && prodData?.length && !newGrn.po_id) {
        setNewGrn((prev) => ({
          ...prev,
          po_id: poData[0].po_id,
          product_id: prodData[0].product_id,
        }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGrn = async () => {
    if (!canFinalizeQC()) {
      showSnackbar('Permission Denied: Only Receiving & QC Operators can log Goods Receipt Notes (GRN).', 'error');
      return;
    }

    try {
      if (!newGrn.po_id || !newGrn.product_id) {
        showSnackbar('Please select PO and Product item', 'error');
        return;
      }

      const suffix = Math.floor(1000 + Math.random() * 9000);
      const grnNumber = `GRN-2026-${suffix}`;
      const acceptedQty = Math.max(0, newGrn.received_quantity - newGrn.damaged_quantity);

      const { data: grn, error: grnErr } = await supabase
        .from('goods_receipts')
        .insert([
          {
            grn_number: grnNumber,
            po_id: newGrn.po_id,
            received_date: new Date().toISOString(),
            status: newGrn.damaged_quantity > 0 ? 'PENDING_INSPECTION' : 'COMPLETED',
            notes: newGrn.notes,
          },
        ])
        .select()
        .single();

      if (grnErr) throw grnErr;

      await supabase.from('grn_items').insert([
        {
          grn_id: grn.grn_id,
          product_id: newGrn.product_id,
          ordered_quantity: newGrn.received_quantity,
          received_quantity: newGrn.received_quantity,
          damaged_quantity: newGrn.damaged_quantity,
          accepted_quantity: acceptedQty,
          inspection_status: newGrn.damaged_quantity > 0 ? 'PARTIAL' : 'ACCEPTED',
        },
      ]);

      await logAuditAction('GRN_MANUAL_LOGGED', 'goods_receipts', grn.grn_id, {
        grn_number: grnNumber,
        received_quantity: newGrn.received_quantity,
        damaged_quantity: newGrn.damaged_quantity,
        accepted_quantity: acceptedQty,
      });

      if (newGrn.damaged_quantity > 0) {
        addAlert({
          title: `Damage Discrepancy Flagged: ${grnNumber}`,
          message: `${newGrn.damaged_quantity} units damaged during receiving. Exception route triggered.`,
          severity: 'warning',
          link: '/exceptions',
        });
      }

      showSnackbar(`Goods Receipt Note #${grnNumber} issued! Accepted: ${acceptedQty} units.`, 'success');
      setOpenCreate(false);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const filteredGrns = grns.filter(
    (g) =>
      !searchQuery ||
      g.grn_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.purchase_orders?.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.purchase_orders?.suppliers?.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            Goods Receipt Notes (GRN) & QA Intake
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Inbound dock receiving verification, QA accepted vs. damaged unit counting, and warehouse inventory logging.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh GRNs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOpenCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create GRN / Receive Inbound</span>
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
            placeholder="Search by GRN#, PO#, Supplier..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Logged Intake Receipts: <strong className="text-slate-900">{filteredGrns.length}</strong>
        </div>
      </div>

      {/* GRN Table (Sections 24, 25, 26) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">GRN Number</th>
                <th className="py-3 px-4">Purchase Order</th>
                <th className="py-3 px-4">Supplier Partner</th>
                <th className="py-3 px-4">Received / Accepted / Damaged</th>
                <th className="py-3 px-4">QA Inspection Notes</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading Goods Receipts...
                  </td>
                </tr>
              ) : filteredGrns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No goods receipts logged. Click "Create GRN" to accept arriving stock.
                  </td>
                </tr>
              ) : (
                filteredGrns.map((grn) => {
                  const item = grn.grn_items?.[0];
                  const hasDamage = Number(item?.damaged_quantity || 0) > 0;

                  return (
                    <tr key={grn.grn_id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-blue-600">
                        {grn.grn_number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {grn.purchase_orders?.po_number || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {grn.purchase_orders?.suppliers?.supplier_name || 'Acme Corp'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                            Recv: {item?.received_quantity || 100}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                            Acc: {item?.accepted_quantity || 100}
                          </span>
                          {hasDamage && (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-200">
                              Dmg: {item?.damaged_quantity}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className={`text-xs font-semibold ${hasDamage ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {hasDamage ? '⚠️ Partial Damage Recorded' : '100% Quality Passed'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {grn.notes || 'Visual check passed'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={grn.status || 'COMPLETED'} size="sm" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create GRN Modal (100% Manual Intake - Section 18 of updates2.md) */}
      <Modal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Inbound Receiving & Dock Intake"
        subtitle="Log arriving shipment counts directly verified at the unloading bay (Manual Only)"
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => setOpenCreate(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGrn}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Confirm & Log Intake
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Manual Form */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
              <span>Target Purchase Order</span>
              {newGrn.po_id && <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Matched</span>}
            </label>
            <select
              value={newGrn.po_id}
              onChange={(e) => setNewGrn({ ...newGrn, po_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              {pos.map((p) => (
                <option key={p.po_id} value={p.po_id}>
                  {p.po_number} ({p.suppliers?.supplier_name} • Val: ₹{Number(p.total_amount).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
              <span>Received Product SKU</span>
              {newGrn.product_id && <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Auto</span>}
            </label>
            <select
              value={newGrn.product_id}
              onChange={(e) => setNewGrn({ ...newGrn, product_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} ({p.product_code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                Total Received Quantity (Units)
              </label>
              <input
                type="number"
                value={newGrn.received_quantity}
                onChange={(e) => setNewGrn({ ...newGrn, received_quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
                <span>Damaged / Defective Count</span>
                {newGrn.damaged_quantity > 0 && <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">Flagged</span>}
              </label>
              <input
                type="number"
                value={newGrn.damaged_quantity}
                onChange={(e) => setNewGrn({ ...newGrn, damaged_quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Net accepted preview */}
          <div className={`p-3.5 rounded-lg border flex items-center gap-3 ${
            newGrn.damaged_quantity > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
          }`}>
            {newGrn.damaged_quantity > 0
              ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            }
            <div>
              <div className="font-bold text-slate-900">
                Net Accepted: <span className="text-emerald-700">
                  {Math.max(0, newGrn.received_quantity - newGrn.damaged_quantity)} Units
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {newGrn.damaged_quantity > 0
                  ? 'Damage recorded — exception + debit note will be auto-generated for Finance.'
                  : 'All physical units accepted. Feeds directly into 3-way match reconciliation.'}
              </div>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">QA Inspector Physical Notes</label>
            <textarea
              rows={2}
              value={newGrn.notes}
              onChange={(e) => setNewGrn({ ...newGrn, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GoodsReceipts;
