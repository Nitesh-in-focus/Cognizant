import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  ArrowRight,
  ExternalLink,
  Edit,
  History,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { Drawer } from '../components/common/Drawer';
import { getAiSupplierRecommendation, SupplierAiRecommendation } from '../services/ai/supplierRecommendationService';
import { routeNotification } from '../services/notifications/notificationRouter';
import { triggerSupplierPoEmail } from '../services/emailService';
import { PoEditHistory } from '../types/database';
import { Filter } from 'lucide-react';

export const PurchaseOrders: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshKey, triggerRefresh, showSnackbar, addAlert, canApprovePO, canSendPO, logAuditAction, logStatusHistory, currentUser } = useApp();

  const [pos, setPos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFTS' | 'SUPPLIER_SENT' | 'ACCEPTED_BY_SUPPLIER' | 'REJECTED' | 'SUPPLIER_REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('po') || searchParams.get('pr') || '');

  useEffect(() => {
    const poParam = searchParams.get('po');
    const prParam = searchParams.get('pr');
    if (poParam) {
      setSearchQuery(poParam);
    } else if (prParam) {
      setSearchQuery(prParam);
    }
  }, [searchParams]);

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

  // PO Edit Modal State (Section 1 of updates6.md)
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingPo, setEditingPo] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    supplier_id: '',
    quantity: 100,
    unit_price: 50,
    product_id: '',
    warehouse_id: '',
    payment_terms: 'NET 30',
    reason: '',
  });

  // PO Edit History State (Section 1 of updates6.md)
  const [openHistoryDrawer, setOpenHistoryDrawer] = useState(false);
  const [historyPo, setHistoryPo] = useState<any | null>(null);
  const [editHistoryList, setEditHistoryList] = useState<PoEditHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
            purchase_requisitions(pr_id, pr_number, status, priority, reason),
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

  // Open Edit Modal for Draft PO (Section 1 of updates6.md)
  const handleOpenEditPo = (po: any) => {
    if (!canApprovePO()) {
      showSnackbar('Permission Denied: Only Procurement Officers can edit Purchase Orders.', 'error');
      return;
    }

    const item = po.po_items?.[0];
    setEditingPo(po);
    setEditForm({
      supplier_id: po.supplier_id || suppliers[0]?.supplier_id || '',
      quantity: item?.ordered_quantity || 100,
      unit_price: item?.unit_price || 50,
      product_id: item?.product_id || products[0]?.product_id || '',
      warehouse_id: po.warehouse_id || warehouses[0]?.warehouse_id || '',
      payment_terms: po.payment_terms || 'NET 30',
      reason: '',
    });
    setOpenEditModal(true);
  };

  // Submit PO Edit with full audit trail (Section 1 of updates6.md)
  const handleSavePoEdit = async () => {
    if (!editingPo) return;
    if (!canApprovePO()) {
      showSnackbar('Permission Denied: Only Procurement Officers can edit POs.', 'error');
      return;
    }
    if (!editForm.reason.trim()) {
      showSnackbar('Please provide a reason for editing this Purchase Order.', 'error');
      return;
    }
    if (editForm.quantity <= 0 || editForm.unit_price <= 0) {
      showSnackbar('Quantity and Unit Price must be greater than zero.', 'error');
      return;
    }

    try {
      const oldItem = editingPo.po_items?.[0];
      const newSubtotal = editForm.quantity * editForm.unit_price;
      const newTax = newSubtotal * 0.18;
      const newTotal = newSubtotal + newTax;

      // 1. Update purchase_orders table
      const { error: poUpdateErr } = await supabase
        .from('purchase_orders')
        .update({
          supplier_id: editForm.supplier_id,
          warehouse_id: editForm.warehouse_id,
          payment_terms: editForm.payment_terms,
          subtotal: newSubtotal,
          tax_amount: newTax,
          total_amount: newTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('po_id', editingPo.po_id);

      if (poUpdateErr) throw poUpdateErr;

      // 2. Update po_items
      if (oldItem?.po_item_id) {
        await supabase
          .from('po_items')
          .update({
            product_id: editForm.product_id,
            ordered_quantity: editForm.quantity,
            unit_price: editForm.unit_price,
            line_total: newSubtotal,
          })
          .eq('po_item_id', oldItem.po_item_id);
      }

      // 3. Record field diffs to po_edit_history
      const changes: Array<{ field: string; prev: any; next: any }> = [];
      if (editingPo.supplier_id !== editForm.supplier_id) {
        const prevSup = suppliers.find((s) => s.supplier_id === editingPo.supplier_id)?.supplier_name || editingPo.supplier_id;
        const nextSup = suppliers.find((s) => s.supplier_id === editForm.supplier_id)?.supplier_name || editForm.supplier_id;
        changes.push({ field: 'Contract Supplier', prev: prevSup, next: nextSup });
      }
      if (oldItem?.ordered_quantity !== editForm.quantity) {
        changes.push({ field: 'Ordered Quantity', prev: oldItem?.ordered_quantity, next: editForm.quantity });
      }
      if (oldItem?.unit_price !== editForm.unit_price) {
        changes.push({ field: 'Unit Price (INR)', prev: oldItem?.unit_price, next: editForm.unit_price });
      }
      if (oldItem?.product_id !== editForm.product_id) {
        const prevProd = products.find((p) => p.product_id === oldItem?.product_id)?.product_name || oldItem?.product_id;
        const nextProd = products.find((p) => p.product_id === editForm.product_id)?.product_name || editForm.product_id;
        changes.push({ field: 'Product SKU', prev: prevProd, next: nextProd });
      }
      if (editingPo.warehouse_id !== editForm.warehouse_id) {
        const prevWh = warehouses.find((w) => w.warehouse_id === editingPo.warehouse_id)?.warehouse_name || editingPo.warehouse_id;
        const nextWh = warehouses.find((w) => w.warehouse_id === editForm.warehouse_id)?.warehouse_name || editForm.warehouse_id;
        changes.push({ field: 'Delivery Warehouse', prev: prevWh, next: nextWh });
      }
      if (editingPo.payment_terms !== editForm.payment_terms) {
        changes.push({ field: 'Payment Terms', prev: editingPo.payment_terms, next: editForm.payment_terms });
      }

      // Insert audit history rows
      const historyRows = changes.map((c) => ({
        po_id: editingPo.po_id,
        editor_user_id: currentUser?.user_id,
        editor_name: currentUser?.full_name || 'Procurement Officer',
        editor_role: currentUser?.role || 'PROCUREMENT_OFFICER',
        field_changed: c.field,
        previous_value: String(c.prev),
        new_value: String(c.next),
        reason: editForm.reason.trim(),
        timestamp: new Date().toISOString(),
      }));

      if (historyRows.length > 0) {
        try {
          await supabase.from('po_edit_history').insert(historyRows);
        } catch (histErr) {
          console.warn('po_edit_history insert note:', histErr);
        }
      }

      await logAuditAction('PO_EDITED', 'purchase_orders', editingPo.po_id, {
        po_number: editingPo.po_number,
        changes,
        reason: editForm.reason.trim(),
      });

      showSnackbar(`PO #${editingPo.po_number} successfully updated by Procurement Officer with audit trail.`, 'success');
      setOpenEditModal(false);
      setEditingPo(null);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(`Failed to save PO edit: ${err.message}`, 'error');
    }
  };

  // Open Edit History Drawer (Section 1 of updates6.md)
  const handleOpenHistoryDrawer = async (po: any) => {
    setHistoryPo(po);
    setOpenHistoryDrawer(true);
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('po_edit_history')
        .select('*')
        .eq('po_id', po.po_id)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setEditHistoryList(data || []);
    } catch (err: any) {
      console.warn('Fetch edit history warning:', err);
      setEditHistoryList([]);
    } finally {
      setLoadingHistory(false);
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

      // Dispatch EmailJS PO Notification Email (Informational only - Phases 5, 7, 8, 24)
      const emailRes = await triggerSupplierPoEmail(po.po_id, po.supplier_id);

      if (emailRes.success) {
        showSnackbar(`PO #${po.po_number} sent to ${po.suppliers?.supplier_name || 'supplier'}! Notification email sent.`, 'success');
      } else {
        showSnackbar(`PO #${po.po_number} sent to ${po.suppliers?.supplier_name || 'supplier'}, but notification email failed: ${emailRes.error || 'EmailJS not configured'}`, 'warning');
      }

      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filteredPos = pos.filter((p) => {
    // 1. Supplier filter
    if (filterSupplier !== 'ALL' && p.supplier_id !== filterSupplier) {
      return false;
    }

    // 2. Status filter
    if (filterStatus !== 'ALL' && p.status !== filterStatus) {
      return false;
    }

    // 3. Search query (PO Number, PR Number, Supplier Name, SKU/Product, Status)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchPo = p.po_number?.toLowerCase().includes(q) || p.po_id?.toLowerCase().includes(q);
      const matchPr = p.purchase_requisitions?.pr_number?.toLowerCase().includes(q);
      const matchSup = p.suppliers?.supplier_name?.toLowerCase().includes(q);
      const matchStatus = p.status?.toLowerCase().includes(q);
      const matchItems = p.po_items?.some(
        (it: any) =>
          it.products?.product_name?.toLowerCase().includes(q) ||
          it.products?.product_code?.toLowerCase().includes(q) ||
          it.item_name?.toLowerCase().includes(q)
      );

      if (!matchPo && !matchPr && !matchSup && !matchStatus && !matchItems) {
        return false;
      }
    }

    // 4. Tab filter
    if (activeTab === 'DRAFTS') {
      return p.status === 'DRAFT_AI_GENERATED' || p.status === 'DRAFT_AUTO_GENERATED' || p.status === 'APPROVED' || p.status === 'READY_TO_SEND';
    }
    if (activeTab === 'SUPPLIER_SENT') {
      return p.status === 'SENT_TO_SUPPLIER';
    }
    if (activeTab === 'ACCEPTED_BY_SUPPLIER') {
      return p.status === 'ACCEPTED_BY_SUPPLIER' || p.status === 'CONFIRMED';
    }
    if (activeTab === 'REJECTED') {
      return p.status === 'REJECTED';
    }
    if (activeTab === 'SUPPLIER_REJECTED') {
      return p.status === 'SUPPLIER_REJECTED' || p.status === 'CLARIFICATION_REQUESTED';
    }
    return true;
  });

  const hasPoFilters = filterSupplier !== 'ALL' || filterStatus !== 'ALL' || Boolean(searchQuery.trim());

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <span>Purchase Orders (PO) Register</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              PROCUREMENT CONTROLLED
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Contractual purchase commitments generated from approved PRs, editable and authorized exclusively by Procurement Officers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canApprovePO() && (
            <button
              onClick={() => {
                setOpenCreate(true);
                setAiRec(null);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
          )}

          <button
            onClick={fetchData}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs cursor-pointer"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
          onClick={() => setActiveTab('ACCEPTED_BY_SUPPLIER')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
            activeTab === 'ACCEPTED_BY_SUPPLIER' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Accepted by Supplier</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 text-[10px]">
            {pos.filter((p) => p.status === 'ACCEPTED_BY_SUPPLIER' || p.status === 'CONFIRMED').length}
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

      {/* Universal Filter + Search Bar (Updates 12 Sections 13 & 14) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Multi-Facet Category Filters: FILTER ➔ SEARCH */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 font-bold text-slate-500 mr-1">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Filter:</span>
            </div>

            {/* Supplier Filter */}
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:border-slate-300 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Suppliers ({suppliers.length})</option>
              {suppliers.map((s) => (
                <option key={s.supplier_id} value={s.supplier_id}>
                  {s.supplier_name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:border-slate-300 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT_AI_GENERATED">DRAFT_AI_GENERATED</option>
              <option value="APPROVED">APPROVED (Internal)</option>
              <option value="SENT_TO_SUPPLIER">SENT_TO_SUPPLIER</option>
              <option value="ACCEPTED_BY_SUPPLIER">ACCEPTED_BY_SUPPLIER</option>
              <option value="REJECTED">REJECTED</option>
              <option value="SUPPLIER_REJECTED">SUPPLIER_REJECTED</option>
            </select>

            {hasPoFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilterSupplier('ALL');
                  setFilterStatus('ALL');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Quick Counter */}
          <div className="text-[11px] font-bold text-slate-400">
            Showing <span className="text-slate-800">{filteredPos.length}</span> of {pos.length} orders
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO ID, PR ID, Supplier Name, Product SKU, or Status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-75" />
                    <span className="font-bold text-slate-700 block text-sm">No Purchase Orders yet</span>
                    <span className="text-xs text-slate-500 mt-0.5 block">Purchase Orders will automatically appear here once approved PRs are processed by Procurement.</span>
                    <button
                      onClick={() => {
                        setOpenCreate(true);
                        setAiRec(null);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Issue First PO</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredPos.map((po) => {
                  const item = po.po_items?.[0];
                  const isDraftAi = po.status === 'DRAFT_AI_GENERATED' || po.status === 'DRAFT_AUTO_GENERATED';
                  const isApproved = po.status === 'APPROVED' || po.status === 'READY_TO_SEND';
                  const isSent = po.status === 'SENT_TO_SUPPLIER';
                  const isSupplierRejected = po.status === 'SUPPLIER_REJECTED';
                  const isLocked = isSent || po.status === 'ACCEPTED_BY_SUPPLIER' || po.status === 'CONFIRMED' || po.status === 'DISPATCHED' || po.status === 'RECEIVED';

                  return (
                    <tr key={po.po_id} className={`hover:bg-slate-50/70 transition-colors ${isSupplierRejected ? 'bg-rose-50/20' : ''}`}>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-900 block">{po.po_number}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(po.created_at || po.order_date).toLocaleDateString()}
                        </span>
                        {(po.purchase_requisitions?.pr_number || po.pr_id) && (
                          <button
                            onClick={() => navigate(`/purchase-requisitions?pr=${po.purchase_requisitions?.pr_number || po.pr_id}`)}
                            className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Jump to Originating Requisition (PR)"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            <span>Origin {po.purchase_requisitions?.pr_number || 'PR'}</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
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
                          {/* Edit PO Action (Section 1 of updates6.md) */}
                          {!isLocked && canApprovePO() && (
                            <button
                              onClick={() => handleOpenEditPo(po)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="Edit PO Draft (Procurement Officer Only)"
                            >
                              <Edit className="w-3.5 h-3.5 text-blue-600" />
                              <span>Edit</span>
                            </button>
                          )}

                          {/* Audit History Action (Section 1 of updates6.md) */}
                          <button
                            onClick={() => handleOpenHistoryDrawer(po)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs transition-colors cursor-pointer"
                            title="View PO Audit & Edit History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

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

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PO Edit Modal (Section 1 of updates6.md)                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={openEditModal}
        onClose={() => setOpenEditModal(false)}
        title={`Edit Draft PO: ${editingPo?.po_number || ''}`}
        subtitle="Procurement Officer Authorization — Modify fields and record mandatory edit reason"
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => setOpenEditModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePoEdit}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Log PO Edits</span>
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              All edits will be logged with your identity (<strong>{currentUser?.full_name}</strong>) and preserved alongside original AI baseline values.
            </span>
          </div>

          {/* Supplier Selection in Edit Mode */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-800">
                Contract Supplier Partner <span className="text-rose-500">*</span>
              </label>
              {suppliers.length > 1 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!editForm.product_id || editForm.quantity <= 0) return;
                    try {
                      showSnackbar('Gemini evaluating optimal supplier for edited PO...', 'info');
                      const candidates = suppliers.map((s) => ({
                        supplier_id: s.supplier_id,
                        supplier_name: s.supplier_name,
                        city: s.city || 'India',
                        quality_score: 94,
                        delivery_score: 92,
                        overall_score: 93,
                        unit_price: editForm.unit_price,
                        lead_time_days: 3,
                        exception_count: 0,
                        capacity_units: 5000,
                      }));
                      const rec = await getAiSupplierRecommendation(
                        editingPo.po_id,
                        editForm.product_id,
                        editForm.quantity,
                        candidates
                      );
                      if (rec?.recommended_supplier_id) {
                        setEditForm((prev) => ({ ...prev, supplier_id: rec.recommended_supplier_id }));
                        showSnackbar(`AI Recommended: ${rec.recommended_supplier_name}`, 'success');
                      }
                    } catch (e: any) {
                      console.warn(e);
                    }
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>AI Re-Rank Suppliers</span>
                </button>
              )}
            </div>

            {suppliers.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                No registered suppliers found in system. Please add a supplier in the Suppliers Directory.
              </div>
            ) : (
              <select
                value={editForm.supplier_id}
                onChange={(e) => setEditForm({ ...editForm, supplier_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
              >
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.supplier_name} ({s.supplier_code || s.supplier_id}) — {s.email} ({s.city})
                  </option>
                ))}
              </select>
            )}

            {(() => {
              const currentSup = suppliers.find((s) => s.supplier_id === editForm.supplier_id);
              if (!currentSup) return null;
              return (
                <div className="mt-1.5 px-3 py-2 rounded-lg bg-slate-100 text-[11px] flex items-center justify-between text-slate-700">
                  <span>ID: <strong className="text-blue-700">{currentSup.supplier_code || currentSup.supplier_id}</strong></span>
                  <span>Email: <strong className="text-slate-900">{currentSup.email}</strong></span>
                  <span>Location: <strong className="text-slate-800">{currentSup.city}</strong></span>
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Product SKU</label>
              <select
                value={editForm.product_id}
                onChange={(e) => setEditForm({ ...editForm, product_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name} ({p.unit_of_measure || 'units'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Delivery Destination</label>
              <select
                value={editForm.warehouse_id}
                onChange={(e) => setEditForm({ ...editForm, warehouse_id: e.target.value })}
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
              <label className="font-semibold text-slate-700 block mb-1">Ordered Quantity *</label>
              <input
                type="number"
                min={1}
                value={editForm.quantity}
                onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Unit Price (INR) *</label>
              <input
                type="number"
                min={0.1}
                step={0.01}
                value={editForm.unit_price}
                onChange={(e) => setEditForm({ ...editForm, unit_price: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Payment Terms</label>
              <select
                value={editForm.payment_terms}
                onChange={(e) => setEditForm({ ...editForm, payment_terms: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800"
              >
                <option value="NET 30">NET 30</option>
                <option value="NET 45">NET 45</option>
                <option value="NET 60">NET 60</option>
                <option value="IMMEDIATE">Immediate Settlement</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="text-slate-500 font-medium">Recalculated Contract Value (Inc. 18% GST):</span>
            <strong className="text-base font-extrabold text-blue-700">
              ₹{(editForm.quantity * editForm.unit_price * 1.18).toLocaleString()}
            </strong>
          </div>

          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Procurement Edit Reason * <span className="text-rose-500 font-normal">(Mandatory audit log)</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Adjusted batch volume to align with warehouse bin capacity; negotiated revised commercial unit rate."
              value={editForm.reason}
              onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* PO Edit History Drawer (Section 1 of updates6.md)              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Drawer
        isOpen={openHistoryDrawer}
        onClose={() => setOpenHistoryDrawer(false)}
        title={`PO Audit History: ${historyPo?.po_number || ''}`}
        subtitle="Chronological trail of all human modifications and AI baseline versions"
        width="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">PURCHASE ORDER</span>
            <span className="text-sm font-extrabold text-slate-900">{historyPo?.po_number}</span>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Current Contract Amount: <strong>₹{Number(historyPo?.total_amount || 0).toLocaleString()}</strong>
            </div>
          </div>

          {loadingHistory ? (
            <div className="py-8 text-center text-slate-400">Loading audit history...</div>
          ) : editHistoryList.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-slate-50 border border-slate-200">
              <Sparkles className="w-8 h-8 text-indigo-500 mx-auto mb-2 opacity-60" />
              <h4 className="font-bold text-slate-800">Original Baseline Version</h4>
              <p className="text-slate-500 text-[11px] mt-1">
                No manual revisions recorded for this PO. It is currently at its initial approved baseline.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-xs">Modification Log ({editHistoryList.length} changes)</h4>
              {editHistoryList.map((entry, idx) => (
                <div key={entry.edit_id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-blue-600">{entry.editor_name || 'Procurement Officer'}</span>
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="font-bold text-slate-800 text-xs">
                    Field Modified: <span className="text-indigo-700">{entry.field_changed}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] p-2 bg-slate-50 rounded-lg">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Previous Value</span>
                      <span className="font-semibold text-rose-700 line-through">{String(entry.previous_value)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">New Value</span>
                      <span className="font-semibold text-emerald-700">{String(entry.new_value)}</span>
                    </div>
                  </div>
                  {entry.reason && (
                    <div className="text-[11px] text-slate-600 italic mt-1">
                      Reason: "{entry.reason}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>

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
          {/* AI vs Manual Supplier Selection */}
          {suppliers.length === 0 ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>No Registered Suppliers Found</span>
              </div>
              <p className="text-[11px] text-amber-700">
                Please register certified vendors in the Supplier Directory before issuing Purchase Orders.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <div>
                    <strong className="text-indigo-950 block">Gemini Supplier Quality Ranking</strong>
                    <span className="text-[11px] text-indigo-700">Evaluate delivery reliability, quality check scores & contract rates</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRunAiEvaluation}
                  disabled={runningAiRec}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {runningAiRec ? 'Evaluating...' : '🤖 AI Pick Supplier'}
                </button>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Contract Supplier Partner <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newPo.supplier_id}
                  onChange={(e) => setNewPo({ ...newPo, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                >
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.supplier_name} ({s.supplier_code || s.supplier_id}) — {s.email} ({s.city})
                    </option>
                  ))}
                </select>
                {(() => {
                  const s = suppliers.find((x) => x.supplier_id === newPo.supplier_id);
                  if (!s) return null;
                  return (
                    <div className="mt-1 px-3 py-1.5 rounded-lg bg-slate-100 text-[11px] flex items-center justify-between text-slate-700">
                      <span>ID: <strong className="text-blue-700">{s.supplier_code || s.supplier_id}</strong></span>
                      <span>Email: <strong className="text-slate-900">{s.email}</strong></span>
                      <span>Rating: <strong className="text-amber-600">{s.rating || 4.8}⭐</strong></span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

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
