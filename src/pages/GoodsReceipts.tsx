import React, { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  Plus,
  RefreshCw,
  Search,
  PenLine,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Send,
  Building2,
  FileText,
  Boxes,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { parseNlpGoodsReceipt, NlpGrnExtractedFields } from '../services/ai/grnNlpService';
import { VoiceInputButton } from '../components/ui/VoiceInputButton';

export const GoodsReceipts: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar, addAlert, canCreateGRN, canFinalizeQC, logAuditAction } = useApp();

  const [grns, setGrns] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create GRN Modal (NLP Assistant & Manual Form - Section 20 of updates4.md)
  const [openCreate, setOpenCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'nlp' | 'manual'>('nlp');
  const [nlpPrompt, setNlpPrompt] = useState('');
  const [parsingNlp, setParsingNlp] = useState(false);
  const [extractedDraft, setExtractedDraft] = useState<NlpGrnExtractedFields | null>(null);

  const [newGrn, setNewGrn] = useState({
    po_id: '',
    supplier_id: '',
    product_id: '',
    shipment_id: '',
    expected_quantity: 100,
    received_quantity: 100,
    accepted_quantity: 100,
    damaged_quantity: 0,
    missing_quantity: 0,
    rejected_quantity: 0,
    notes: 'All items verified against PO manifest and dock inspection standards.',
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
            purchase_orders(po_number, total_amount, suppliers(supplier_name, supplier_code, city), warehouses(warehouse_name)),
            shipments(shipment_number),
            grn_items(
              *,
              products(product_name, product_code, unit_of_measure, unit_price)
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('purchase_orders')
          .select('*, suppliers(supplier_id, supplier_name, supplier_code, city), warehouses(warehouse_name), purchase_requisitions(pr_number), po_items(*, products(*)), shipments(*)')
          .order('order_date', { ascending: false }),
        supabase.from('products').select('*'),
      ]);

      setGrns(grnData || []);
      setPos(poData || []);
      setProducts(prodData || []);

      if (poData?.length && !newGrn.po_id) {
        const firstPo = poData[0];
        const firstItem = (firstPo as any).po_items?.[0];
        const firstProdId = firstItem?.product_id || (prodData?.[0]?.product_id ?? '');
        const expQty = Number(firstItem?.ordered_quantity) || Number((firstPo as any).total_quantity) || 100;

        setNewGrn((prev) => ({
          ...prev,
          po_id: firstPo.po_id,
          supplier_id: firstPo.supplier_id || (firstPo.suppliers as any)?.supplier_id || '',
          product_id: firstProdId,
          shipment_id: (firstPo as any).shipments?.[0]?.shipment_id || '',
          expected_quantity: expQty,
          received_quantity: expQty,
          accepted_quantity: expQty,
          damaged_quantity: 0,
          missing_quantity: 0,
          rejected_quantity: 0,
        }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill GRN context from selected PO (Updates 11 Section 3)
  const handlePoSelect = (poId: string) => {
    const po = pos.find((p) => p.po_id === poId);
    if (!po) {
      setNewGrn((prev) => ({ ...prev, po_id: poId }));
      return;
    }

    const firstItem = (po as any).po_items?.[0];
    const targetProdId = firstItem?.product_id || (products.length > 0 ? products[0].product_id : '');
    const orderedQty = Number(firstItem?.ordered_quantity) || Number((po as any).total_quantity) || 100;
    const targetSupplierId = po.supplier_id || (po.suppliers as any)?.supplier_id || '';
    const targetShipmentId = (po as any).shipments?.[0]?.shipment_id || '';

    setNewGrn((prev) => ({
      ...prev,
      po_id: poId,
      supplier_id: targetSupplierId,
      product_id: targetProdId,
      shipment_id: targetShipmentId,
      expected_quantity: orderedQty,
      received_quantity: orderedQty,
      accepted_quantity: orderedQty,
      damaged_quantity: 0,
      missing_quantity: 0,
      rejected_quantity: 0,
    }));
  };

  const handleExtractNlp = async () => {
    if (!nlpPrompt.trim()) {
      showSnackbar('Please enter a natural language receiving statement', 'error');
      return;
    }

    setParsingNlp(true);
    try {
      const extracted = await parseNlpGoodsReceipt(nlpPrompt, pos);
      setExtractedDraft(extracted);

      const targetPo = pos.find((p) => p.po_id === extracted.po_id) || pos[0];
      const targetProdId = targetPo?.po_items?.[0]?.product_id || products[0]?.product_id;
      const expectedQty = Number(targetPo?.po_items?.[0]?.ordered_quantity) || Number(targetPo?.total_quantity) || extracted.received_quantity;

      setNewGrn({
        po_id: extracted.po_id || pos[0]?.po_id,
        supplier_id: targetPo?.supplier_id || '',
        product_id: targetProdId,
        shipment_id: targetPo?.shipments?.[0]?.shipment_id || '',
        expected_quantity: expectedQty,
        received_quantity: extracted.received_quantity,
        accepted_quantity: Math.max(0, extracted.received_quantity - extracted.damaged_quantity - extracted.missing_quantity),
        damaged_quantity: extracted.damaged_quantity,
        missing_quantity: extracted.missing_quantity,
        rejected_quantity: 0,
        notes: extracted.remarks || nlpPrompt,
      });
      showSnackbar(`AI successfully extracted receiving parameters (${extracted.confidence}% confidence)!`, 'success');
    } catch (err: any) {
      showSnackbar(`NLP Parsing Error: ${err.message}`, 'error');
    } finally {
      setParsingNlp(false);
    }
  };

  const handleCreateGrn = async () => {
    if (!canCreateGRN()) {
      showSnackbar('Permission Denied: Only Receiving + QC Lead can issue Goods Receipt Notes (GRN).', 'error');
      return;
    }

    try {
      const selectedPo = pos.find((p) => p.po_id === newGrn.po_id);
      if (!newGrn.po_id || !newGrn.product_id) {
        showSnackbar('Please select a Target Purchase Order and Product item', 'error');
        return;
      }

      const suffix = Math.floor(1000 + Math.random() * 9000);
      const grnNumber = `GRN-2026-${suffix}`;
      const acceptedQty = Math.max(0, newGrn.received_quantity - newGrn.damaged_quantity - (newGrn.rejected_quantity || 0));

      const { data: grn, error: grnErr } = await supabase
        .from('goods_receipts')
        .insert([
          {
            grn_number: grnNumber,
            po_id: newGrn.po_id,
            supplier_id: newGrn.supplier_id || selectedPo?.supplier_id || null,
            shipment_id: newGrn.shipment_id || (selectedPo?.shipments?.[0]?.shipment_id ?? null),
            received_date: new Date().toISOString(),
            status: newGrn.damaged_quantity > 0 || (newGrn.missing_quantity || 0) > 0 ? 'PENDING_INSPECTION' : 'COMPLETED',
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
          ordered_quantity: Number(newGrn.expected_quantity || newGrn.received_quantity),
          received_quantity: newGrn.received_quantity,
          damaged_quantity: newGrn.damaged_quantity,
          accepted_quantity: acceptedQty,
          inspection_status: newGrn.damaged_quantity > 0 ? 'PARTIAL' : 'ACCEPTED',
        },
      ]);

      await logAuditAction('GRN_LOGGED', 'goods_receipts', grn.grn_id, {
        grn_number: grnNumber,
        po_id: newGrn.po_id,
        supplier_id: newGrn.supplier_id,
        received_quantity: newGrn.received_quantity,
        damaged_quantity: newGrn.damaged_quantity,
        accepted_quantity: acceptedQty,
      });

      if (newGrn.damaged_quantity > 0 || newGrn.missing_quantity > 0) {
        addAlert({
          title: `Receiving Discrepancy Flagged: ${grnNumber}`,
          message: `${newGrn.damaged_quantity} damaged, ${newGrn.missing_quantity} missing during dock intake. Flagged for 3-way match.`,
          severity: 'warning',
          link: '/exceptions',
        });
      }

      showSnackbar(`Goods Receipt Note #${grnNumber} issued! Accepted: ${acceptedQty} units.`, 'success');
      setOpenCreate(false);
      setExtractedDraft(null);
      setNlpPrompt('');
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
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-75" />
                    <span className="font-bold text-slate-700 block text-sm">No Goods Receipts (GRN) logged yet</span>
                    <span className="text-xs text-slate-500 mt-0.5 block">GRNs are created upon physical dock arrival and cargo intake inspection.</span>
                    <button
                      onClick={() => setOpenCreate(true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create First GRN</span>
                    </button>
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

      {/* Create GRN Modal (NLP Assistant & Manual Entry - Section 20 of updates4.md) */}
      <Modal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Inbound Receiving & Dock Intake (GRN)"
        subtitle="Speak or type natural language receiving reports, or verify physical item counts manually"
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
              <span>Confirm & Issue GRN</span>
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setCreateMode('nlp')}
              className={`flex-1 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                createMode === 'nlp'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>AI NLP Assistant (Fastest)</span>
            </button>

            <button
              type="button"
              onClick={() => setCreateMode('manual')}
              className={`flex-1 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                createMode === 'manual'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <PenLine className="w-3.5 h-3.5 text-blue-600" />
              <span>Manual Form Entry</span>
            </button>
          </div>

          {/* NLP Assistant Mode */}
          {createMode === 'nlp' && (
            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200/80 space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Natural Language Delivery Statement</span>
                </label>
                <div className="flex items-center gap-2">
                  {/* 🎙️ Voice Input Button */}
                  <VoiceInputButton
                    onTranscriptChange={(text) => setNlpPrompt(text)}
                    existingText={nlpPrompt}
                    label="Speak Report"
                    lang="en-IN"
                  />
                  <span className="text-[10px] text-indigo-600 font-semibold">Gemini 2.5 Flash</span>
                </div>
              </div>

              {/* Textarea — voice fills this automatically */}
              <textarea
                rows={3}
                value={nlpPrompt}
                onChange={(e) => setNlpPrompt(e.target.value)}
                placeholder='Type or 🎙️ speak: "Received 950 units against PO-2026-8001, 20 units damaged in transit with broken seals and 30 units missing from Box 4."'
                className="w-full p-3 rounded-lg bg-white border border-indigo-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="font-semibold text-slate-700">Quick Prompt:</span>
                  <button
                    type="button"
                    onClick={() => setNlpPrompt(`Received 950 units against ${pos[0]?.po_number || 'PO-2026-8001'}, 20 damaged with broken packaging and 30 units missing.`)}
                    className="text-indigo-600 hover:underline cursor-pointer"
                  >
                    Load Sample Report
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleExtractNlp}
                  disabled={parsingNlp || !nlpPrompt.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{parsingNlp ? 'Extracting with AI...' : 'Parse Intake with AI'}</span>
                </button>
              </div>


              {extractedDraft && (
                <div className="p-3 rounded-lg bg-white border border-emerald-300 text-[11px] space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-emerald-800">
                    <span>AI Extracted Parameters ({extractedDraft.confidence}% Confidence)</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                      (extractedDraft as any).inspection_status === 'PASS' ? 'bg-emerald-100 text-emerald-900' :
                      (extractedDraft as any).inspection_status === 'FAIL' ? 'bg-rose-100 text-rose-900' :
                      'bg-amber-100 text-amber-900'
                    }`}>
                      {(extractedDraft as any).inspection_status || 'PARTIAL'}
                    </span>
                  </div>
                  <div className="text-slate-600 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                    <div>PO: <strong>{extractedDraft.po_number || 'Auto-Matched'}</strong></div>
                    <div>Received: <strong className="text-slate-900">{extractedDraft.received_quantity}</strong> units</div>
                    <div>Accepted: <strong className="text-emerald-700">{extractedDraft.accepted_quantity}</strong> units</div>
                    <div>Damaged: <strong className="text-rose-600">{extractedDraft.damaged_quantity}</strong> units</div>
                    <div>Missing: <strong className="text-amber-600">{extractedDraft.missing_quantity}</strong> units</div>
                    {(extractedDraft as any).defect_type && (extractedDraft as any).defect_type !== 'None' && (
                      <div className="col-span-2 sm:col-span-3">
                        Defect: <strong className="text-rose-700">{(extractedDraft as any).defect_type}</strong>
                      </div>
                    )}
                  </div>
                  {extractedDraft.remarks && extractedDraft.remarks !== extractedDraft.raw_prompt && (
                    <div className="text-slate-500 italic text-[10px] border-t border-slate-100 pt-1">
                      <span className="font-bold not-italic text-slate-600">Remarks: </span>{extractedDraft.remarks}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* Form Fields for verification & manual editing (Updates 11 Section 3) */}
          <div className="space-y-3 pt-1">
            {(() => {
              const selectedPo = pos.find((p) => p.po_id === newGrn.po_id);
              const derivedSupplier = (selectedPo as any)?.suppliers;
              const derivedWarehouse = (selectedPo as any)?.warehouses?.warehouse_name || 'Central Distribution Center';
              const poItems = (selectedPo as any)?.po_items || [];
              const firstItem = poItems[0];

              return (
                <div className="space-y-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1 flex items-center justify-between">
                      <span>Select Target Purchase Order <strong className="text-rose-500">*</strong></span>
                      {newGrn.po_id && <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Auto-Linked</span>}
                    </label>
                    <select
                      value={newGrn.po_id}
                      onChange={(e) => handlePoSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 text-xs font-mono"
                    >
                      <option value="">-- Choose Purchase Order --</option>
                      {pos.map((p) => (
                        <option key={p.po_id} value={p.po_id}>
                          {p.po_number} — {p.suppliers?.supplier_name || 'Vendor'} (₹{Number(p.total_amount || 0).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Auto-Derived PO Summary Banner */}
                  {selectedPo && (
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Supplier Payee</span>
                        <strong className="text-slate-900 truncate block">{derivedSupplier?.supplier_name || 'Supplier'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Ordered Contract Qty</span>
                        <strong className="text-blue-700 font-mono">{firstItem?.ordered_quantity || selectedPo.total_quantity || 100} units</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Unit Contract Price</span>
                        <strong className="text-slate-900 font-mono">₹{firstItem?.unit_price || 250}/unit</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">Receiving Facility</span>
                        <strong className="text-slate-900 truncate block">{derivedWarehouse}</strong>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Received Product SKU Specification</label>
                    <select
                      value={newGrn.product_id}
                      onChange={(e) => setNewGrn({ ...newGrn, product_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 text-xs"
                    >
                      {products.map((p) => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name} ({p.product_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 font-bold block mb-1 uppercase">Received Qty</label>
                      <input
                        type="number"
                        value={newGrn.received_quantity}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setNewGrn({
                            ...newGrn,
                            received_quantity: val,
                            accepted_quantity: Math.max(0, val - newGrn.damaged_quantity - (newGrn.rejected_quantity || 0)),
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-rose-600 font-bold block mb-1 uppercase">Damaged Qty</label>
                      <input
                        type="number"
                        value={newGrn.damaged_quantity}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setNewGrn({
                            ...newGrn,
                            damaged_quantity: val,
                            accepted_quantity: Math.max(0, newGrn.received_quantity - val - (newGrn.rejected_quantity || 0)),
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-rose-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-amber-600 font-bold block mb-1 uppercase">Missing Qty</label>
                      <input
                        type="number"
                        value={newGrn.missing_quantity}
                        onChange={(e) => setNewGrn({ ...newGrn, missing_quantity: Math.max(0, Number(e.target.value)) })}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-amber-700 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-emerald-600 font-bold block mb-1 uppercase">Accepted Qty</label>
                      <input
                        type="number"
                        value={newGrn.accepted_quantity}
                        onChange={(e) => setNewGrn({ ...newGrn, accepted_quantity: Math.max(0, Number(e.target.value)) })}
                        className="w-full px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 rounded-lg font-bold text-emerald-800 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Net accepted preview */}
            <div className={`p-3 rounded-lg border flex items-center gap-3 ${
              newGrn.damaged_quantity > 0 || newGrn.missing_quantity > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
            }`}>
              {newGrn.damaged_quantity > 0 || newGrn.missing_quantity > 0
                ? <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              }
              <div>
                <div className="font-bold text-slate-900">
                  Net Accepted: <span className="text-emerald-700 font-extrabold">
                    {Math.max(0, newGrn.received_quantity - newGrn.damaged_quantity)} Units
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {newGrn.damaged_quantity > 0 || newGrn.missing_quantity > 0
                    ? 'Discrepancy recorded — exception route triggered for 3-way match.'
                    : 'Physical units match manifest. Feeds directly into 3-way match reconciliation.'}
                </div>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">QA Inspector Physical Notes</label>
              <textarea
                rows={2}
                value={newGrn.notes}
                onChange={(e) => setNewGrn({ ...newGrn, notes: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 resize-none"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GoodsReceipts;
