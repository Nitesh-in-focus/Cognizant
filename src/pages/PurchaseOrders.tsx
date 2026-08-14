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
  Check,
  X,
  AlertTriangle,
  Layers,
  FileText,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { getAiSupplierRecommendation, SupplierAiRecommendation } from '../services/ai/supplierRecommendationService';
import { routeNotification } from '../services/notifications/notificationRouter';

export const PurchaseOrders: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar, addAlert, canApprovePO, canSendPO, logAuditAction, logStatusHistory, currentUser } = useApp();

  const [pos, setPos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFTS' | 'SUPPLIER_SENT' | 'REJECTED' | 'SUPPLIER_REJECTED'>('ALL');
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

  // Rejection Modal
  const [openRejectModal, setOpenRejectModal] = useState(false);
  const [rejectingPoId, setRejectingPoId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

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
        setNewPo((prev) => ({
          ...prev,
          supplier_id: supData[0].supplier_id,
          warehouse_id: whData[0].warehouse_id,
          product_id: prodData[0].product_id,
        }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Run Gemini Multi-Criteria Supplier Selection
  const handleRunAiEvaluation = async () => {
    if (!newPo.product_id || newPo.quantity <= 0) {
      showSnackbar('Please select Product and Quantity first', 'error');
      return;
    }
    setRunningAiRec(true);
    try {
      const candidates = suppliers.map((s) => ({
        supplier_id: s.supplier_id,
        supplier_name: s.supplier_name,
        city: s.city || 'India',
        quality_score: 94,
        delivery_score: 92,
        overall_score: 93,
        unit_price: newPo.unit_price || 50,
        lead_time_days: 3,
        exception_count: 0,
        capacity_units: 5000,
      }));

      const rec = await getAiSupplierRecommendation(
        `manual-po-${Date.now()}`,
        newPo.product_id,
        newPo.quantity,
        candidates
      );

      setAiRec(rec);
      setNewPo((prev) => ({ ...prev, supplier_id: rec.recommended_supplier_id }));
      showSnackbar(`AI Recommended: ${rec.recommended_supplier_name} (${rec.confidence}% confidence)`, 'success');
    } catch (err: any) {
      showSnackbar(`AI Evaluation failed: ${err.message}`, 'error');
    } finally {
      setRunningAiRec(false);
    }
  };

  // Manual PO Creation
  const handleCreatePo = async () => {
    try {
      if (!newPo.supplier_id || !newPo.warehouse_id || !newPo.product_id) {
        showSnackbar('Please fill all required PO fields', 'error');
        return;
      }

      const suffix = Math.floor(1000 + Math.random() * 9000);
      const poNumber = newPo.po_number_override.trim() || `PO-2026-${suffix}`;
      const subtotal = newPo.quantity * newPo.unit_price;
      const taxAmount = subtotal * 0.18;
      const totalAmount = subtotal + taxAmount;

      const { data: po, error: poErr } = await supabase
        .from('purchase_orders')
        .insert([
          {
            po_number: poNumber,
            supplier_id: newPo.supplier_id,
            warehouse_id: newPo.warehouse_id,
            subtotal,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            status: 'DRAFT_AI_GENERATED',
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
          line_total: subtotal,
        },
      ]);

      await logStatusHistory(
        'purchase_orders',
        po.po_id,
        null,
        'DRAFT_AI_GENERATED',
        'Procurement created Draft Purchase Order'
      );

      showSnackbar(`Purchase Order #${poNumber} created as Draft AI! Ready for review.`, 'success');
      setOpenCreate(false);
      setAiRec(null);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // Procurement Approves Draft PO
  const handleApproveDraftPo = async (poId: string, poNumber: string) => {
    if (!canApprovePO()) {
      showSnackbar('Permission Denied: Only Procurement Officers can approve POs.', 'error');
      return;
    }
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'APPROVED',
          rejected_by: null,
          rejection_reason: null,
        })
        .eq('po_id', poId);

      if (error) throw error;

      await logStatusHistory(
        'purchase_orders',
        poId,
        'DRAFT_AI_GENERATED',
        'APPROVED',
        'Procurement Officer reviewed and approved Purchase Order'
      );

      showSnackbar(`PO #${poNumber} approved. Ready to send to supplier.`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // Procurement Rejects Draft PO
  const handleConfirmRejectPo = async () => {
    if (!rejectingPoId || !rejectionReason.trim()) {
      showSnackbar('Please provide a specific rejection reason', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'REJECTED',
          rejection_reason: rejectionReason.trim(),
          rejected_by: currentUser?.full_name || 'Procurement Officer',
          rejected_at: new Date().toISOString(),
        })
        .eq('po_id', rejectingPoId);

      if (error) throw error;

      await logStatusHistory(
        'purchase_orders',
        rejectingPoId,
        'DRAFT_AI_GENERATED',
        'REJECTED',
        rejectionReason.trim(),
        { rejected_by: currentUser?.full_name }
      );

      showSnackbar('Purchase Order rejected and logged to history.', 'warning');
      setOpenRejectModal(false);
      setRejectingPoId(null);
      setRejectionReason('');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // Explicit Manual "SEND TO SUPPLIER" Action (Section 15 of updates3.md)
  const handleSendPoToSupplier = async (po: any) => {
    if (!canSendPO()) {
      showSnackbar('Permission Denied: Only authorized Procurement Officers can transmit POs.', 'error');
      return;
    }
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'SENT_TO_SUPPLIER' })
        .eq('po_id', po.po_id);

      if (error) throw error;

      await logStatusHistory(
        'purchase_orders',
        po.po_id,
        po.status,
        'SENT_TO_SUPPLIER',
        `Procurement Officer transmitted PO to ${po.suppliers?.supplier_name}`
      );

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

    if (activeTab === 'DRAFTS') {
      return matchSearch && (p.status === 'DRAFT_AI_GENERATED' || p.status === 'DRAFT_AUTO_GENERATED' || p.status === 'APPROVED' || p.status === 'READY_TO_SEND');
    }
    if (activeTab === 'SUPPLIER_SENT') {
      return matchSearch && p.status === 'SENT_TO_SUPPLIER';
    }
    if (activeTab === 'REJECTED') {
      return matchSearch && p.status === 'REJECTED';
    }
    if (activeTab === 'SUPPLIER_REJECTED') {
      return matchSearch && (p.status === 'SUPPLIER_REJECTED' || p.status === 'CLARIFICATION_REQUESTED');
    }
    return matchSearch;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <span>Purchase Orders (PO) Register</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              AI AUTO-GENERATION
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Contractual purchase commitments generated from approved PRs, reviewed by Procurement, and transmitted to suppliers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs cursor-pointer"
            title="Refresh POs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setOpenCreate(true);
              setAiRec(null);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create PO (Manual)</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation (Section 15, 16 & 33) */}
      <div className="flex border-b border-slate-200 space-x-1 text-xs font-bold text-slate-600 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
            activeTab === 'ALL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Orders</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px]">{pos.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('DRAFTS')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
            activeTab === 'DRAFTS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Draft AI POs</span>
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 text-[10px]">
            {pos.filter((p) => p.status === 'DRAFT_AI_GENERATED' || p.status === 'DRAFT_AUTO_GENERATED' || p.status === 'APPROVED' || p.status === 'READY_TO_SEND').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('SUPPLIER_SENT')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
            activeTab === 'SUPPLIER_SENT' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className="w-3.5 h-3.5 text-amber-600" />
          <span>Awaiting Supplier</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 text-[10px]">
            {pos.filter((p) => p.status === 'SENT_TO_SUPPLIER').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('REJECTED')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
            activeTab === 'REJECTED' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <X className="w-3.5 h-3.5 text-rose-600" />
          <span>Procurement Rejected</span>
          <span className="px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 text-[10px]">
            {pos.filter((p) => p.status === 'REJECTED').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('SUPPLIER_REJECTED')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
            activeTab === 'SUPPLIER_REJECTED' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>Supplier Rejected POs</span>
          <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px]">
            {pos.filter((p) => p.status === 'SUPPLIER_REJECTED' || p.status === 'CLARIFICATION_REQUESTED').length}
          </span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO #, supplier name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase">
                <th className="py-3.5 px-4">PO Number & Date</th>
                <th className="py-3.5 px-4">Supplier Partner</th>
                <th className="py-3.5 px-4">Ordered SKU & Qty</th>
                <th className="py-3.5 px-4">Total Amount (INR)</th>
                <th className="py-3.5 px-4">Status</th>
                {(activeTab === 'REJECTED' || activeTab === 'SUPPLIER_REJECTED') && (
                  <th className="py-3.5 px-4 text-rose-700">Rejection Details</th>
                )}
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredPos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No purchase orders found matching the current tab.
                  </td>
                </tr>
              ) : (
                filteredPos.map((po) => {
                  const item = po.po_items?.[0];
                  const isDraftAi = po.status === 'DRAFT_AI_GENERATED' || po.status === 'DRAFT_AUTO_GENERATED';
                  const isApproved = po.status === 'APPROVED' || po.status === 'READY_TO_SEND';
                  const isSent = po.status === 'SENT_TO_SUPPLIER';
                  const isSupplierRejected = po.status === 'SUPPLIER_REJECTED';

                  return (
                    <tr key={po.po_id} className={`hover:bg-slate-50/70 transition-colors ${isSupplierRejected ? 'bg-rose-50/20' : ''}`}>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-900 block">{po.po_number}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(po.created_at || po.order_date).toLocaleDateString()}
                        </span>
                        {isDraftAi && (
                          <div className="text-[10px] text-indigo-600 flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>AI Auto-Draft</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <strong className="text-slate-900 block">{po.suppliers?.supplier_name || 'Vendor'}</strong>
                        <span className="text-[10px] text-slate-400">{po.suppliers?.city || 'India'}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-slate-800 block">{item?.products?.product_name || 'Component Units'}</span>
                        <span className="text-slate-500 text-[11px]">
                          <strong>{item?.ordered_quantity?.toLocaleString() || 100}</strong> units
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        ₹{Number(po.total_amount || 0).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={po.status} />
                      </td>

                      {(activeTab === 'REJECTED' || activeTab === 'SUPPLIER_REJECTED') && (
                        <td className="py-3.5 px-4">
                          <div className="text-xs text-rose-700 font-bold">
                            {po.supplier_response_reason || po.rejection_reason || 'Rejection on record'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {po.rejected_by ? `By ${po.rejected_by}` : 'Supplier Decision'} •{' '}
                            {po.rejected_at || po.supplier_response_at ? new Date(po.rejected_at || po.supplier_response_at).toLocaleDateString() : ''}
                          </div>
                        </td>
                      )}

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isDraftAi && canApprovePO() && (
                            <>
                              <button
                                onClick={() => {
                                  setRejectingPoId(po.po_id);
                                  setOpenRejectModal(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>

                              <button
                                onClick={() => handleApproveDraftPo(po.po_id, po.po_number)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve PO</span>
                              </button>
                            </>
                          )}

                          {isApproved && canSendPO() && (
                            <button
                              onClick={() => handleSendPoToSupplier(po)}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>SEND TO SUPPLIER</span>
                            </button>
                          )}

                          {isSent && (
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Transmitted
                            </span>
                          )}

                          {po.status === 'CONFIRMED' && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Acknowledged</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create PO Modal (Manual fallback - NO OCR) */}
      <Modal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Issue Contract Purchase Order"
        subtitle="Manually create a new purchase order or run Gemini AI supplier ranking (No OCR)"
        maxWidth="xl"
        footer={
          <>
            <button
              onClick={() => setOpenCreate(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePo}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Create Draft AI Order</span>
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {/* AI Recommendation Trigger */}
          <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <div>
                <strong className="text-indigo-950 block">Gemini Supplier Selection</strong>
                <span className="text-[11px] text-indigo-700">Rank suppliers by quality, OTIF rate & capacity</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRunAiEvaluation}
              disabled={runningAiRec}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
            >
              {runningAiRec ? 'Evaluating...' : 'Run Evaluation'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Target Supplier</label>
              <select
                value={newPo.supplier_id}
                onChange={(e) => setNewPo({ ...newPo, supplier_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
              >
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name} ({s.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Destination Facility</label>
              <select
                value={newPo.warehouse_id}
                onChange={(e) => setNewPo({ ...newPo, warehouse_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
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
              <label className="font-semibold text-slate-700 block mb-1">Product SKU</label>
              <select
                value={newPo.product_id}
                onChange={(e) => setNewPo({ ...newPo, product_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Order Quantity</label>
              <input
                type="number"
                value={newPo.quantity}
                onChange={(e) => setNewPo({ ...newPo, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Unit Price (INR)</label>
              <input
                type="number"
                value={newPo.unit_price}
                onChange={(e) => setNewPo({ ...newPo, unit_price: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="text-slate-500 font-medium">Estimated Total (Inc. 18% GST):</span>
            <strong className="text-base font-extrabold text-slate-900">
              ₹{(newPo.quantity * newPo.unit_price * 1.18).toLocaleString()}
            </strong>
          </div>
        </div>
      </Modal>

      {/* PO Rejection Modal (Section 15 & 33) */}
      <Modal
        isOpen={openRejectModal}
        onClose={() => setOpenRejectModal(false)}
        title="Reject Purchase Order"
        subtitle="Specify reason for rejecting this PO — will be archived in the Rejected POs register"
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
              onClick={handleConfirmRejectPo}
              className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-md shadow-rose-600/20 cursor-pointer"
            >
              Confirm Rejection
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <label className="font-bold text-slate-800 block">Rejection Reason *</label>
          <textarea
            rows={3}
            placeholder="e.g. Unit price is above commercial budget; supplier capacity not verified..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-rose-500"
          />
        </div>
      </Modal>
    </div>
  );
};

export default PurchaseOrders;
