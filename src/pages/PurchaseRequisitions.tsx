import React, { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  RefreshCw,
  Check,
  X,
  Search,
  Filter,
  Sparkles,
  Building2,
  Calendar,
  AlertTriangle,
  Send,
  PenLine,
  Layers,
  User,
  History,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { parseNlpPurchaseRequisition, NlpPrExtractedFields } from '../services/ai/prNlpService';
import { getAiSupplierRecommendation } from '../services/ai/supplierRecommendationService';

export const PurchaseRequisitions: React.FC = () => {
  const { currentUser, role, refreshKey, triggerRefresh, showSnackbar, canApprovePR, canCreatePR, logAuditAction, logStatusHistory, addAlert } = useApp();

  const [prs, setPrs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'ALL' | 'MY_PRS' | 'APPROVED' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');

  // PR Creation Modal (AI-First NLP & Manual Fallback - Section 11 of updates3.md)
  const [openCreate, setOpenCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'nlp' | 'manual'>('nlp');
  const [nlpPrompt, setNlpPrompt] = useState('');
  const [parsingNlp, setParsingNlp] = useState(false);
  const [extractedDraft, setExtractedDraft] = useState<NlpPrExtractedFields | null>(null);

  const [newPr, setNewPr] = useState({
    warehouse_id: '',
    product_id: '',
    quantity: 500,
    priority: 'HIGH' as 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW',
    reason: '',
    required_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  });

  // Rejection Modal
  const [openRejectModal, setOpenRejectModal] = useState(false);
  const [rejectingPrId, setRejectingPrId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        { data: prData },
        { data: prodData },
        { data: whData },
      ] = await Promise.all([
        supabase
          .from('purchase_requisitions')
          .select(`
            *,
            warehouses(warehouse_name, city),
            pr_items(
              *,
              products(product_name, unit_price, unit_of_measure)
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('warehouses').select('*'),
      ]);

      setPrs(prData || []);
      setProducts(prodData || []);
      setWarehouses(whData || []);

      if (whData?.length && !newPr.warehouse_id) {
        setNewPr((prev) => ({
          ...prev,
          warehouse_id: whData[0].warehouse_id,
          product_id: prodData?.[0]?.product_id || '',
        }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 1. NLP Extraction Handler
  const handleExtractNlp = async () => {
    if (!nlpPrompt.trim()) {
      showSnackbar('Please enter a natural language requisition requirement', 'error');
      return;
    }

    setParsingNlp(true);
    try {
      const extracted = await parseNlpPurchaseRequisition(nlpPrompt, products, warehouses);
      setExtractedDraft(extracted);
      setNewPr({
        warehouse_id: extracted.warehouse_id || warehouses[0]?.warehouse_id,
        product_id: extracted.product_id || products[0]?.product_id,
        quantity: extracted.quantity || 100,
        priority: extracted.priority || 'HIGH',
        reason: extracted.reason || nlpPrompt,
        required_date: extracted.required_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      });
      showSnackbar(`AI successfully extracted requisition parameters (${extracted.confidence}% confidence)!`, 'success');
    } catch (err: any) {
      showSnackbar(`NLP Parsing Error: ${err.message}`, 'error');
    } finally {
      setParsingNlp(false);
    }
  };

  // 2. Submit PR Handler
  const handleSubmitPr = async () => {
    try {
      if (!newPr.warehouse_id || !newPr.product_id || newPr.quantity <= 0) {
        showSnackbar('Please complete all required requisition fields', 'error');
        return;
      }

      const suffix = Math.floor(1000 + Math.random() * 9000);
      const prNumber = `PR-2026-${suffix}`;

      const { data: pr, error: prErr } = await supabase
        .from('purchase_requisitions')
        .insert([
          {
            pr_number: prNumber,
            warehouse_id: newPr.warehouse_id,
            priority: newPr.priority,
            status: 'PENDING_APPROVAL',
            reason: newPr.reason || 'Component inventory replenishment',
            natural_language_prompt: createMode === 'nlp' ? nlpPrompt : null,
            created_by_worker: currentUser?.full_name || 'Ramesh Patil',
            request_date: new Date().toISOString(),
            required_date: newPr.required_date,
          },
        ])
        .select()
        .single();

      if (prErr) throw prErr;

      await supabase.from('pr_items').insert([
        {
          pr_id: pr.pr_id,
          product_id: newPr.product_id,
          requested_quantity: newPr.quantity,
        },
      ]);

      await logStatusHistory(
        'purchase_requisitions',
        pr.pr_id,
        'DRAFT',
        'PENDING_APPROVAL',
        'Worker submitted Purchase Requisition for Procurement Review',
        {
          nlp_used: createMode === 'nlp',
          prompt: nlpPrompt,
          quantity: newPr.quantity,
        }
      );

      addAlert({
        title: `New PR Awaiting Approval: ${prNumber}`,
        message: `${currentUser?.full_name || 'Worker'} submitted ${prNumber} for ${newPr.quantity} units.`,
        severity: 'info',
        recipient_role: 'PROCUREMENT_OFFICER',
        link: '/purchase-requisitions',
      });

      showSnackbar(`Requisition #${prNumber} submitted for Procurement approval!`, 'success');
      setOpenCreate(false);
      setExtractedDraft(null);
      setNlpPrompt('');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // 3. Approve PR Handler -> Triggers AI Supplier Recommendation & Creates DRAFT_AI_GENERATED PO
  const handleApprovePr = async (prId: string) => {
    if (!canApprovePR()) {
      showSnackbar('Permission Denied: Only Procurement Officers can approve Requisitions.', 'error');
      return;
    }

    try {
      const targetPr = prs.find((p) => p.pr_id === prId);

      const { error } = await supabase
        .from('purchase_requisitions')
        .update({
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
        })
        .eq('pr_id', prId);

      if (error) throw error;

      await logStatusHistory(
        'purchase_requisitions',
        prId,
        'PENDING_APPROVAL',
        'APPROVED',
        'Procurement Officer approved Requisition and initiated AI Supplier Selection'
      );

      // Trigger Gemini Supplier Selection & Generate Draft PO in status DRAFT_AI_GENERATED (Section 14 of updates3.md)
      if (targetPr) {
        try {
          const { data: suppliersData } = await supabase.from('suppliers').select('*');
          const { data: perfData } = await supabase.from('supplier_performance').select('*');

          const candidates = (suppliersData || []).map((s) => {
            const perf = perfData?.find((p) => p.supplier_id === s.supplier_id);
            return {
              supplier_id: s.supplier_id,
              supplier_name: s.supplier_name,
              city: s.city || 'India',
              quality_score: Number(perf?.quality_score) || 94,
              delivery_score: Number(perf?.delivery_score) || 92,
              overall_score: Number(perf?.overall_score) || 93,
              unit_price: 50,
              lead_time_days: 3,
              exception_count: 0,
              capacity_units: 5000,
            };
          });

          if (candidates.length > 0) {
            const requestedQty = targetPr.pr_items?.[0]?.requested_quantity || 500;
            const targetProductId = targetPr.pr_items?.[0]?.product_id || '';
            const rec = await getAiSupplierRecommendation(prId, targetProductId, requestedQty, candidates);

            const poSuffix = Math.floor(1000 + Math.random() * 9000);
            const poNumber = `PO-2026-${poSuffix}`;
            const unitPrice = 50.00;
            const subtotal = requestedQty * unitPrice;
            const taxAmount = subtotal * 0.18;
            const totalAmount = subtotal + taxAmount;

            const { data: newPo, error: poErr } = await supabase
              .from('purchase_orders')
              .insert([
                {
                  po_number: poNumber,
                  pr_id: prId,
                  supplier_id: rec.recommended_supplier_id,
                  warehouse_id: targetPr.warehouse_id,
                  status: 'DRAFT_AI_GENERATED',
                  subtotal,
                  tax_amount: taxAmount,
                  total_amount: totalAmount,
                  order_date: new Date().toISOString(),
                  expected_delivery_date: targetPr.required_date || new Date(Date.now() + 5 * 86400000).toISOString(),
                },
              ])
              .select()
              .single();

            if (poErr) throw poErr;

            await supabase.from('po_items').insert([
              {
                po_id: newPo.po_id,
                product_id: targetProductId,
                ordered_quantity: requestedQty,
                unit_price: unitPrice,
                tax_rate: 18,
                line_total: subtotal,
              },
            ]);

            await logStatusHistory(
              'purchase_orders',
              newPo.po_id,
              null,
              'DRAFT_AI_GENERATED',
              `AI Auto-Drafted PO for ${rec.recommended_supplier_name} based on Gemini supplier selection`
            );

            showSnackbar(`PR Approved! Auto-generated PO #${poNumber} (Draft AI) for ${rec.recommended_supplier_name}.`, 'success');
          }
        } catch (aiErr: any) {
          console.warn('AI PO generation note:', aiErr);
        }
      }

      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // 4. Reject PR Handler
  const handleConfirmRejectPr = async () => {
    if (!rejectingPrId || !rejectionReason.trim()) {
      showSnackbar('Please provide a specific rejection reason', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('purchase_requisitions')
        .update({
          status: 'REJECTED',
          rejection_reason: rejectionReason.trim(),
          rejected_by: currentUser?.full_name || 'Procurement Officer',
          rejected_at: new Date().toISOString(),
        })
        .eq('pr_id', rejectingPrId);

      if (error) throw error;

      await logStatusHistory(
        'purchase_requisitions',
        rejectingPrId,
        'PENDING_APPROVAL',
        'REJECTED',
        rejectionReason.trim(),
        { rejected_by: currentUser?.full_name }
      );

      showSnackbar('Requisition rejected. Reason recorded for Worker review.', 'warning');
      setOpenRejectModal(false);
      setRejectingPrId(null);
      setRejectionReason('');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const filteredPrs = prs.filter((p) => {
    const matchSearch =
      !searchQuery ||
      p.pr_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.created_by_worker?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchPriority = filterPriority === 'ALL' || p.priority === filterPriority;

    if (activeTab === 'MY_PRS') {
      return matchSearch && matchPriority && p.created_by_worker === currentUser?.full_name;
    }
    if (activeTab === 'APPROVED') {
      return matchSearch && matchPriority && (p.status === 'APPROVED' || p.status === 'CONVERTED');
    }
    if (activeTab === 'REJECTED') {
      return matchSearch && matchPriority && p.status === 'REJECTED';
    }
    return matchSearch && matchPriority;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Purchase Requisitions (PR)</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              AI-FIRST WORKFLOW
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Workers create natural-language requisitions; Procurement Officers review, approve, and auto-generate AI Purchase Orders.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs cursor-pointer"
            title="Refresh Requisitions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setOpenCreate(true);
              setCreateMode('nlp');
              setExtractedDraft(null);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Create PR (AI-NLP)</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation (Section 12 & 33) */}
      <div className="flex border-b border-slate-200 space-x-1 text-xs font-bold text-slate-600">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            activeTab === 'ALL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Requisitions</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px]">{prs.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('MY_PRS')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            activeTab === 'MY_PRS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>My Requisitions</span>
        </button>

        <button
          onClick={() => setActiveTab('APPROVED')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            activeTab === 'APPROVED' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>Approved PRs</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 text-[10px]">
            {prs.filter((p) => p.status === 'APPROVED' || p.status === 'CONVERTED').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('REJECTED')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            activeTab === 'REJECTED' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <X className="w-3.5 h-3.5 text-rose-600" />
          <span>Rejected PRs</span>
          <span className="px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 text-[10px]">
            {prs.filter((p) => p.status === 'REJECTED').length}
          </span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PR #, worker name, justification..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Requisitions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase">
                <th className="py-3.5 px-4">PR Reference</th>
                <th className="py-3.5 px-4">Created By Worker</th>
                <th className="py-3.5 px-4">Item & Quantity</th>
                <th className="py-3.5 px-4">Target Facility</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                {activeTab === 'REJECTED' && <th className="py-3.5 px-4 text-rose-700">Rejection Reason & Date</th>}
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredPrs.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'REJECTED' ? 8 : 7} className="py-12 text-center text-slate-400">
                    No purchase requisitions found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredPrs.map((pr) => {
                  const item = pr.pr_items?.[0];
                  const isPending = pr.status === 'PENDING' || pr.status === 'PENDING_APPROVAL';
                  const isRejected = pr.status === 'REJECTED';

                  return (
                    <tr key={pr.pr_id} className={`hover:bg-slate-50/70 transition-colors ${isRejected ? 'bg-rose-50/20' : ''}`}>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-900 block">{pr.pr_number}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(pr.created_at || pr.request_date).toLocaleDateString()}
                        </span>
                        {pr.natural_language_prompt && (
                          <div className="text-[10px] text-indigo-600 flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>NLP Created</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {pr.created_by_worker || 'Ramesh Patil'}
                      </td>

                      <td className="py-3.5 px-4">
                        <strong className="text-slate-900 block">{item?.products?.product_name || 'Industrial Component'}</strong>
                        <span className="text-slate-500 text-[11px]">
                          Qty: <strong>{item?.requested_quantity?.toLocaleString() || 100}</strong> {item?.products?.unit_of_measure || 'units'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800 block">{pr.warehouses?.warehouse_name || 'Pune Central DC'}</span>
                        <span className="text-[10px] text-slate-400">{pr.warehouses?.city || 'Pune'}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            pr.priority === 'URGENT'
                              ? 'bg-rose-100 text-rose-800'
                              : pr.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {pr.priority}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={pr.status} />
                      </td>

                      {activeTab === 'REJECTED' && (
                        <td className="py-3.5 px-4">
                          <div className="text-xs text-rose-700 font-bold">{pr.rejection_reason || 'Administrative rejection'}</div>
                          <div className="text-[10px] text-slate-400">
                            By {pr.rejected_by || 'Procurement'} • {pr.rejected_at ? new Date(pr.rejected_at).toLocaleDateString() : ''}
                          </div>
                        </td>
                      )}

                      <td className="py-3.5 px-4 text-right">
                        {isPending && canApprovePR() ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setRejectingPrId(pr.pr_id);
                                setOpenRejectModal(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="Reject Requisition"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>

                            <button
                              onClick={() => handleApprovePr(pr.pr_id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                              title="Approve & Generate AI PO"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          </div>
                        ) : isRejected ? (
                          <span className="text-[11px] font-bold text-rose-600">Rejection Recorded</span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600">Processed</span>
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

      {/* AI-First NLP PR Creation Modal */}
      <Modal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Create Purchase Requisition (AI-First)"
        subtitle="Speak or type natural language requisition requests — Gemini will extract structured fields for review"
        maxWidth="2xl"
        footer={
          <>
            <button
              onClick={() => setOpenCreate(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitPr}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Confirm & Submit PR</span>
            </button>
          </>
        }
      >
        <div className="space-y-5 text-xs">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setCreateMode('nlp')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                createMode === 'nlp' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Natural Language (Gemini AI)</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateMode('manual')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                createMode === 'manual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Manual Structured Form</span>
            </button>
          </div>

          {/* NLP Input Panel */}
          {createMode === 'nlp' && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Enter Natural Language Requirement</span>
                </label>
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                  GEMINI NLP EXTRACTOR
                </span>
              </div>

              <textarea
                rows={3}
                placeholder="Example: We need 500 units of industrial safety gloves for Warehouse A by 25 August 2026. Priority is high."
                value={nlpPrompt}
                onChange={(e) => setNlpPrompt(e.target.value)}
                className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 shadow-inner"
              />

              {/* Sample Prompt Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'We need 500 units of industrial safety gloves for Pune DC by 25 August 2026. Priority is high.',
                  'Order 250 brake calipers urgently for Pune DC due to sudden assembly line surge.',
                  'Restock 1000 standard hex bolts by next Friday for ongoing fabrication.',
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setNlpPrompt(chip);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-[10px] font-medium transition-colors cursor-pointer"
                  >
                    "{chip.substring(0, 45)}..."
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleExtractNlp}
                disabled={parsingNlp || !nlpPrompt.trim()}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 text-amber-300 ${parsingNlp ? 'animate-spin' : ''}`} />
                <span>{parsingNlp ? 'Extracting with Gemini AI...' : 'Extract Structured PR Parameters'}</span>
              </button>
            </div>
          )}

          {/* Structured PR Preview & Editing Form */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div className="text-xs font-extrabold text-slate-900 flex items-center justify-between border-b border-slate-200 pb-2">
              <span>Structured PR Parameters (Review & Edit)</span>
              {extractedDraft && (
                <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                  AI Parsed • {extractedDraft.confidence}% Confidence
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target Product SKU</label>
                <select
                  value={newPr.product_id}
                  onChange={(e) => setNewPr({ ...newPr, product_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                >
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {p.product_name} ({p.product_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Delivery Warehouse</label>
                <select
                  value={newPr.warehouse_id}
                  onChange={(e) => setNewPr({ ...newPr, warehouse_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                >
                  {warehouses.map((w) => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>
                      {w.warehouse_name} ({w.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Quantity (Units)</label>
                <input
                  type="number"
                  value={newPr.quantity}
                  onChange={(e) => setNewPr({ ...newPr, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Priority Level</label>
                <select
                  value={newPr.priority}
                  onChange={(e) => setNewPr({ ...newPr, priority: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                >
                  <option value="URGENT">URGENT</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Required Delivery Date</label>
                <input
                  type="date"
                  value={newPr.required_date}
                  onChange={(e) => setNewPr({ ...newPr, required_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Business Justification / Reason</label>
              <textarea
                rows={2}
                value={newPr.reason}
                onChange={(e) => setNewPr({ ...newPr, reason: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 resize-none"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Rejection Modal with Mandatory Reason (Section 12 & 33) */}
      <Modal
        isOpen={openRejectModal}
        onClose={() => setOpenRejectModal(false)}
        title="Reject Purchase Requisition"
        subtitle="Provide a mandatory reason for requisition rejection to record in status history and notify the worker"
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setOpenRejectModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmRejectPr}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-md shadow-rose-600/20 cursor-pointer"
            >
              Confirm Rejection
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <label className="font-bold text-slate-800 block">Rejection Reason / Feedback *</label>
          <textarea
            rows={3}
            placeholder="e.g. Existing stock buffer is sufficient for next 3 weeks; excessive quantity requested..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-rose-500"
          />
        </div>
      </Modal>
    </div>
  );
};

export default PurchaseRequisitions;
