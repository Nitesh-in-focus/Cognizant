import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  ArrowRight,
  ExternalLink,
  ShoppingCart,
  Star,
  Mail,
  MapPin,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { parseNlpPurchaseRequisition, NlpPrExtractedFields } from '../services/ai/prNlpService';
import { getAiSupplierRecommendation } from '../services/ai/supplierRecommendationService';
import { sendPrRequestedNotification } from '../services/emailService';

export const PurchaseRequisitions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, role, refreshKey, triggerRefresh, showSnackbar, canApprovePR, canCreatePR, logAuditAction, logStatusHistory, addAlert } = useApp();

  const [prs, setPrs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'ALL' | 'MY_PRS' | 'APPROVED' | 'REJECTED' | 'REMAINING'>('ALL');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('pr') || '');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [approvingQty, setApprovingQty] = useState<number | null>(null);

  // Helper to compute PR fulfillment metrics across all linked POs (Updates 10 Section 6)
  const getPrFulfillmentMetrics = (pr: any) => {
    const requestedQty = pr.pr_items?.reduce((sum: number, item: any) => sum + (Number(item.requested_quantity) || 0), 0) || 500;
    const linkedPos = pr.purchase_orders || [];
    const allocatedQty = linkedPos.reduce((sum: number, po: any) => sum + (Number(po.total_quantity || po.ordered_quantity) || 0), 0);
    const remainingQty = Math.max(0, requestedQty - allocatedQty);
    return { requestedQty, allocatedQty, remainingQty, poCount: linkedPos.length, linkedPos };
  };

  useEffect(() => {
    const prParam = searchParams.get('pr');
    if (prParam) {
      setSearchQuery(prParam);
    }
  }, [searchParams]);

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
            ),
            purchase_orders(po_id, po_number, status, total_amount, suppliers(supplier_name))
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

      // Section 3 of updates6.md: Log worker corrections to improve NLP extraction model
      if (createMode === 'nlp' && extractedDraft) {
        const corrections: Record<string, { ai: any; human: any }> = {};
        if (extractedDraft.quantity !== newPr.quantity) {
          corrections['quantity'] = { ai: extractedDraft.quantity, human: newPr.quantity };
        }
        if (extractedDraft.product_id !== newPr.product_id) {
          corrections['product_id'] = { ai: extractedDraft.product_id, human: newPr.product_id };
        }
        if (extractedDraft.required_date !== newPr.required_date) {
          corrections['required_date'] = { ai: extractedDraft.required_date, human: newPr.required_date };
        }
        if (extractedDraft.priority !== newPr.priority) {
          corrections['priority'] = { ai: extractedDraft.priority, human: newPr.priority };
        }

        try {
          await supabase.from('nlp_extraction_logs').insert([
            {
              raw_prompt: nlpPrompt,
              extracted_product_name: extractedDraft.product_name,
              extracted_quantity: extractedDraft.quantity,
              extracted_required_date: extractedDraft.required_date,
              extracted_priority: extractedDraft.priority,
              priority_reason: extractedDraft.priority_reason,
              confidence: extractedDraft.confidence,
              user_corrected: Object.keys(corrections).length > 0,
              corrected_values: Object.keys(corrections).length > 0 ? corrections : null,
              created_at: new Date().toISOString(),
            },
          ]);
        } catch (logErr) {
          console.warn('NLP extraction log save note:', logErr);
        }
      }

      await logStatusHistory(
        'purchase_requisitions',
        pr.pr_id,
        'DRAFT',
        'PENDING_APPROVAL',
        'Worker confirmed and submitted Purchase Requisition for Procurement Review',
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

      // Dispatch EmailJS Notification to all PR Officers in system (User Request)
      const targetProduct = products.find((p) => p.product_id === newPr.product_id);
      const targetWarehouse = warehouses.find((w) => w.warehouse_id === newPr.warehouse_id);

      const emailResult = await sendPrRequestedNotification({
        prId: pr.pr_id,
        prNumber: prNumber,
        requestedByWorker: currentUser?.full_name || 'Worker',
        productName: targetProduct?.product_name || 'Component Units',
        quantity: newPr.quantity,
        priority: newPr.priority || 'MEDIUM',
        warehouseName: targetWarehouse?.warehouse_name || 'Central Logistics DC',
        requiredDate: newPr.required_date,
        reason: newPr.reason || (createMode === 'nlp' ? nlpPrompt : undefined),
      });

      if (emailResult.totalSent > 0) {
        showSnackbar(`Requisition #${prNumber} submitted and notification email dispatched to Procurement Officers!`, 'success');
      } else {
        showSnackbar(`Requisition #${prNumber} confirmed and submitted for Procurement review!`, 'success');
      }

      setOpenCreate(false);
      setExtractedDraft(null);
      setNlpPrompt('');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  // Approve & Supplier Selection Modal State (AI vs Manual vs Multi-Supplier Split - Sections 16-17 of updates9.md)
  const [openApproveModal, setOpenApproveModal] = useState(false);
  const [approvingPr, setApprovingPr] = useState<any | null>(null);
  const [supplierSelectionMode, setSupplierSelectionMode] = useState<'AI' | 'MANUAL' | 'SPLIT'>('AI');
  const [registeredSuppliers, setRegisteredSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [splitAllocations, setSplitAllocations] = useState<Array<{ supplier_id: string; quantity: number }>>([]);
  const [aiRecommendation, setAiRecommendation] = useState<any | null>(null);
  const [runningAi, setRunningAi] = useState(false);

  // Open Approve Modal & Compute Initial AI / Manual Selection
  const handleOpenApproveModal = async (pr: any, customQty?: number) => {
    if (!canApprovePR()) {
      showSnackbar('Permission Denied: Only Procurement Officers can approve Requisitions.', 'error');
      return;
    }

    setApprovingPr(pr);
    const totalQty = customQty || pr.pr_items?.[0]?.requested_quantity || 500;
    setApprovingQty(totalQty);
    setOpenApproveModal(true);
    setRunningAi(true);

    try {
      const { data: sups } = await supabase.from('suppliers').select('*').neq('status', 'INACTIVE').order('supplier_name');
      const validSups = sups || [];
      setRegisteredSuppliers(validSups);

      if (validSups.length > 0) {
        setSelectedSupplierId(validSups[0].supplier_id);

        // Initial split distribution preset if multiple suppliers exist
        if (validSups.length >= 2) {
          const qty1 = Math.round(totalQty * 0.6);
          const qty2 = totalQty - qty1;
          setSplitAllocations([
            { supplier_id: validSups[0].supplier_id, quantity: qty1 },
            { supplier_id: validSups[1].supplier_id, quantity: qty2 },
          ]);
        } else {
          setSplitAllocations([{ supplier_id: validSups[0].supplier_id, quantity: totalQty }]);
        }

        // Run Gemini AI Recommendation
        const { data: perfData } = await supabase.from('supplier_performance').select('*');
        const candidates = validSups.map((s) => {
          const perf = perfData?.find((p) => p.supplier_id === s.supplier_id);
          return {
            supplier_id: s.supplier_id,
            supplier_name: s.supplier_name,
            city: s.city || 'India',
            quality_score: Number(perf?.quality_score) || (s.rating ? s.rating * 20 : 94),
            delivery_score: Number(perf?.delivery_score) || 92,
            overall_score: Number(perf?.overall_score) || (s.rating ? s.rating * 20 : 93),
            unit_price: pr.pr_items?.[0]?.products?.unit_price || 50,
            lead_time_days: 3,
            exception_count: 0,
            capacity_units: 5000,
          };
        });

        const targetProductId = pr.pr_items?.[0]?.product_id || '';
        const rec = await getAiSupplierRecommendation(pr.pr_id, targetProductId, totalQty, candidates);
        setAiRecommendation(rec);
        if (rec?.recommended_supplier_id) {
          setSelectedSupplierId(rec.recommended_supplier_id);
        }
      } else {
        setAiRecommendation(null);
        setSelectedSupplierId('');
        setSplitAllocations([]);
      }
    } catch (err: any) {
      console.error('AI Recommendation Error:', err);
    } finally {
      setRunningAi(false);
    }
  };

  // Confirm Approval & Execute PO Generation (Supports Multi-PO Distribution - Section 16 of updates9.md)
  const handleExecuteApprovalAndCreatePo = async () => {
    if (!approvingPr) return;

    const prId = approvingPr.pr_id;
    const targetPr = approvingPr;
    const item = targetPr.pr_items?.[0];
    const requestedQty = approvingQty || item?.requested_quantity || 100;
    const unitPrice = item?.products?.unit_price || 50.00;

    try {
      if (supplierSelectionMode === 'SPLIT') {
        // Multi-Supplier PO Distribution validation
        const totalAllocated = splitAllocations.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
        if (totalAllocated !== requestedQty) {
          showSnackbar(
            `Distribution Mismatch: Total allocated (${totalAllocated} units) must equal requested PR quantity (${requestedQty} units).`,
            'error'
          );
          return;
        }

        const validAllocations = splitAllocations.filter((a) => a.supplier_id && Number(a.quantity) > 0);
        if (validAllocations.length === 0) {
          showSnackbar('Please allocate quantity to at least one valid supplier.', 'error');
          return;
        }

        // 1. Update PR to APPROVED
        const { error: prUpdateErr } = await supabase
          .from('purchase_requisitions')
          .update({
            status: 'APPROVED',
            approved_at: new Date().toISOString(),
          })
          .eq('pr_id', prId);

        if (prUpdateErr) throw prUpdateErr;

        // 2. Generate separate PO for each distributed supplier
        const createdPoNumbers: string[] = [];
        for (const alloc of validAllocations) {
          const allocSupplier = registeredSuppliers.find((s) => s.supplier_id === alloc.supplier_id);
          const allocQty = Number(alloc.quantity);
          const subtotal = allocQty * unitPrice;
          const taxAmount = subtotal * 0.18;
          const totalAmount = subtotal + taxAmount;
          const poSuffix = Math.floor(1000 + Math.random() * 9000);
          const poNumber = `PO-2026-${poSuffix}`;

          const { data: newPo, error: poErr } = await supabase
            .from('purchase_orders')
            .insert([
              {
                po_number: poNumber,
                pr_id: prId,
                supplier_id: alloc.supplier_id,
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

          // Insert PO line item
          if (item?.product_id) {
            await supabase.from('po_items').insert([
              {
                po_id: newPo.po_id,
                product_id: item.product_id,
                ordered_quantity: allocQty,
                unit_price: unitPrice,
                tax_rate: 18,
                line_total: subtotal,
              },
            ]);
          }

          createdPoNumbers.push(`${poNumber} (${allocQty} units to ${allocSupplier?.supplier_name || 'Vendor'})`);

          await logStatusHistory(
            'purchase_orders',
            newPo.po_id,
            null,
            'DRAFT_AI_GENERATED',
            `PO Distributed from PR #${targetPr.pr_number} (${allocQty} units to ${allocSupplier?.supplier_name || 'Vendor'})`
          );
        }

        await logStatusHistory(
          'purchase_requisitions',
          prId,
          'PENDING_APPROVAL',
          'APPROVED',
          `Procurement distributed ${requestedQty} units across ${validAllocations.length} suppliers`
        );

        showSnackbar(
          `PR #${targetPr.pr_number} Approved! Distributed into ${validAllocations.length} Purchase Orders: ${createdPoNumbers.join(', ')}`,
          'success'
        );
      } else {
        // Single Supplier Mode (AI or Manual)
        if (!selectedSupplierId) {
          showSnackbar('Please select or register a valid Supplier Partner for this Purchase Order.', 'error');
          return;
        }

        const targetSupplier = registeredSuppliers.find((s) => s.supplier_id === selectedSupplierId);

        // 1. Update PR to APPROVED
        const { error: prUpdateErr } = await supabase
          .from('purchase_requisitions')
          .update({
            status: 'APPROVED',
            approved_at: new Date().toISOString(),
          })
          .eq('pr_id', prId);

        if (prUpdateErr) throw prUpdateErr;

        await logStatusHistory(
          'purchase_requisitions',
          prId,
          'PENDING_APPROVAL',
          'APPROVED',
          `Procurement approved PR and assigned supplier ${targetSupplier?.supplier_name || selectedSupplierId} via ${supplierSelectionMode} mode`
        );

        // 2. Insert PO
        const subtotal = requestedQty * unitPrice;
        const taxAmount = subtotal * 0.18;
        const totalAmount = subtotal + taxAmount;
        const poSuffix = Math.floor(1000 + Math.random() * 9000);
        const poNumber = `PO-2026-${poSuffix}`;

        const { data: newPo, error: poErr } = await supabase
          .from('purchase_orders')
          .insert([
            {
              po_number: poNumber,
              pr_id: prId,
              supplier_id: selectedSupplierId,
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

        // 3. Insert PO Item
        if (item?.product_id) {
          await supabase.from('po_items').insert([
            {
              po_id: newPo.po_id,
              product_id: item.product_id,
              ordered_quantity: requestedQty,
              unit_price: unitPrice,
              tax_rate: 18,
              line_total: subtotal,
            },
          ]);
        }

        await logStatusHistory(
          'purchase_orders',
          newPo.po_id,
          null,
          'DRAFT_AI_GENERATED',
          `PO Generated for ${targetSupplier?.supplier_name || 'Vendor'} via ${supplierSelectionMode === 'AI' ? 'Gemini AI Automatic Quality Ranking' : 'Manual Procurement Choice'}`
        );

        showSnackbar(
          `PR #${targetPr.pr_number} Approved! Purchase Order #${poNumber} generated for ${targetSupplier?.supplier_name || 'Vendor'}.`,
          'success'
        );
      }

      setOpenApproveModal(false);
      setApprovingPr(null);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar('Approval failed: ' + err.message, 'error');
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
    if (activeTab === 'REMAINING') {
      const metrics = getPrFulfillmentMetrics(p);
      return matchSearch && matchPriority && metrics.remainingQty > 0;
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
      <div className="flex border-b border-slate-200 space-x-1 text-xs font-bold text-slate-600 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
            activeTab === 'ALL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Requisitions</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px]">{prs.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('MY_PRS')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
            activeTab === 'MY_PRS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>My Requisitions</span>
        </button>

        <button
          onClick={() => setActiveTab('REMAINING')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
            activeTab === 'REMAINING' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Remaining Requirements</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 text-[10px]">
            {prs.filter((p) => {
              const metrics = getPrFulfillmentMetrics(p);
              return metrics.remainingQty > 0;
            }).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('APPROVED')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
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
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all whitespace-nowrap ${
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
                  <td colSpan={activeTab === 'REJECTED' ? 8 : 7} className="py-16 text-center text-slate-400">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-75" />
                    <span className="font-bold text-slate-700 block text-sm">No Purchase Requisitions yet</span>
                    <span className="text-xs text-slate-500 mt-0.5 block">Create the first PR with Gemini AI NLP to begin the Supply Sync workflow.</span>
                    <button
                      onClick={() => {
                        setOpenCreate(true);
                        setCreateMode('nlp');
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Create First PR</span>
                    </button>
                  </td>
                </tr>
              ) : (
                filteredPrs.map((pr) => {
                  const item = pr.pr_items?.[0];
                  const isPending = pr.status === 'PENDING' || pr.status === 'PENDING_APPROVAL';
                  const isRejected = pr.status === 'REJECTED';
                  const metrics = getPrFulfillmentMetrics(pr);

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
                        <span className="text-slate-500 text-[11px] block">
                          Total: <strong>{metrics.requestedQty.toLocaleString()}</strong> {item?.products?.unit_of_measure || 'units'}
                        </span>
                        {metrics.allocatedQty > 0 && (
                          <span className="text-[10px] text-indigo-600 font-bold block">
                            Fulfilled: {metrics.allocatedQty} • Remaining: {metrics.remainingQty}
                          </span>
                        )}
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
                        {(() => {
                          const linkedPos = Array.isArray(pr.purchase_orders) ? pr.purchase_orders : (pr.purchase_orders ? [pr.purchase_orders] : []);
                          if (linkedPos.length === 0) return null;
                          return (
                            <div className="flex flex-col gap-1 mt-1.5">
                              {linkedPos.map((po: any) => (
                                <button
                                  key={po.po_id}
                                  onClick={() => navigate(`/purchase-orders?po=${po.po_number || po.po_id}`)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-bold transition-colors cursor-pointer"
                                  title="Jump to Linked Purchase Order"
                                >
                                  <ShoppingCart className="w-2.5 h-2.5" />
                                  <span>{po.po_number || 'PO'}</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              ))}
                            </div>
                          );
                        })()}
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
                              onClick={() => handleOpenApproveModal(pr)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                              title="Approve & Generate AI PO"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          </div>
                        ) : !isRejected && metrics.remainingQty > 0 && canApprovePR() ? (
                          <button
                            onClick={() => handleOpenApproveModal(pr, metrics.remainingQty)}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1 ml-auto"
                            title="Assign remaining unfulfilled PR requirement to another supplier"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Fulfill Balance ({metrics.remainingQty})</span>
                          </button>
                        ) : isRejected ? (
                          <span className="text-[11px] font-bold text-rose-600">Rejection Recorded</span>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-600">Fully Processed</span>
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
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-bold border border-blue-200">
                    Extracted Date: {extractedDraft.date_source_text} ➔ {extractedDraft.required_date}
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                    AI Parsed • {extractedDraft.confidence}% Confidence
                  </span>
                </div>
              )}
            </div>

            {/* Priority Reason Alert (Section 33 of updates5.md) */}
            {extractedDraft?.priority_reason && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Priority ({extractedDraft.priority}):</strong> {extractedDraft.priority_reason}
                </span>
              </div>
            )}

            {/* Missing Fields Warning (Section 34 of updates5.md) */}
            {extractedDraft?.missing_fields && extractedDraft.missing_fields.length > 0 && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                <strong>Attention:</strong> Some fields ({extractedDraft.missing_fields.join(', ')}) could not be extracted with high confidence. Please verify before submitting.
              </div>
            )}

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

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* Approve PR & Supplier Selection Modal (AI vs Manual)           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {approvingPr && (
        <Modal
          isOpen={openApproveModal}
          onClose={() => {
            setOpenApproveModal(false);
            setApprovingPr(null);
            setAiRecommendation(null);
          }}
          title={`Approve PR & Select Supplier: ${approvingPr?.pr_number}`}
          subtitle="Assign a registered supplier partner — choose AI-recommended or manually select"
          maxWidth="xl"
          footer={
            <>
              <button
                onClick={() => {
                  setOpenApproveModal(false);
                  setApprovingPr(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteApprovalAndCreatePo}
                disabled={!selectedSupplierId || registeredSuppliers.length === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve PR & Generate PO</span>
              </button>
            </>
          }
        >
          <div className="space-y-5 text-xs">
            {/* PR Summary Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">PURCHASE REQUISITION</div>
              <div className="font-extrabold text-slate-900 text-sm">{approvingPr.pr_number}</div>
              <div className="grid grid-cols-3 gap-3 mt-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Product</span>
                  <strong className="text-slate-800">{approvingPr.pr_items?.[0]?.products?.product_name || 'Component'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Quantity</span>
                  <strong className="text-slate-800">{approvingPr.pr_items?.[0]?.requested_quantity?.toLocaleString() || 100} units</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Warehouse</span>
                  <strong className="text-slate-800">{approvingPr.warehouses?.warehouse_name || 'Facility'}</strong>
                </div>
              </div>
            </div>

            {/* AI vs Manual vs Multi-Supplier Split Toggle (Section 16 of updates9.md) */}
            <div className="flex rounded-xl bg-slate-100 p-1 gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setSupplierSelectionMode('AI')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  supplierSelectionMode === 'AI' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Auto-Select</span>
              </button>
              <button
                type="button"
                onClick={() => setSupplierSelectionMode('MANUAL')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  supplierSelectionMode === 'MANUAL' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Single Supplier</span>
              </button>
              <button
                type="button"
                onClick={() => setSupplierSelectionMode('SPLIT')}
                className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  supplierSelectionMode === 'SPLIT' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Split Across Multiple POs</span>
              </button>
            </div>

            {/* No Suppliers Warning */}
            {registeredSuppliers.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>No Registered Suppliers Found</span>
                </div>
                <p className="text-[11px] text-amber-700">
                  Please register certified vendors in the <strong>Suppliers & Vendor Register</strong> before approving Purchase Requisitions.
                  Only suppliers added by authorized Procurement Officers will appear here.
                </p>
              </div>
            ) : (
              <>
                {/* AI Recommendation Panel */}
                {supplierSelectionMode === 'AI' && (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-indigo-950 flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-indigo-600" />
                        <span>Gemini AI Supplier Recommendation</span>
                      </label>
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                        MULTI-CRITERIA SOURCING ENGINE
                      </span>
                    </div>

                    {runningAi ? (
                      <div className="flex items-center gap-2 py-4 justify-center">
                        <Sparkles className="w-5 h-5 text-indigo-600 animate-spin" />
                        <span className="text-indigo-700 font-bold">Evaluating supplier QC scores, delivery history & pricing...</span>
                      </div>
                    ) : aiRecommendation ? (
                      <div className="space-y-3">
                        {/* Recommended Supplier */}
                        <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              <strong className="text-emerald-900">AI Recommended Supplier</strong>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                              {aiRecommendation.confidence}% Confidence
                            </span>
                          </div>
                          <div className="font-extrabold text-slate-900 text-sm">
                            {aiRecommendation.recommended_supplier_name}
                          </div>
                          {(() => {
                            const recSup = registeredSuppliers.find((s: any) => s.supplier_id === aiRecommendation.recommended_supplier_id);
                            if (!recSup) return null;
                            return (
                              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-600">
                                <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-blue-500" />{recSup.email}</span>
                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-rose-500" />{recSup.city || 'India'}</span>
                                <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-500 fill-amber-500" />{Number(recSup.rating || 4.8).toFixed(1)}</span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* AI Reasons */}
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-indigo-600">AI Reasoning</span>
                          <ul className="space-y-1">
                            {aiRecommendation.reasons?.map((r: string, idx: number) => (
                              <li key={idx} className="text-[11px] text-slate-700 flex items-start gap-1.5">
                                <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Risk Factors */}
                        {aiRecommendation.risk_factors?.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-amber-600">Risk Factors</span>
                            <ul className="space-y-1">
                              {aiRecommendation.risk_factors.map((r: string, idx: number) => (
                                <li key={idx} className="text-[11px] text-amber-800 flex items-start gap-1.5">
                                  <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Alternative Suppliers */}
                        {aiRecommendation.alternative_suppliers?.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-500">Alternative Candidates</span>
                            <div className="flex flex-wrap gap-2">
                              {aiRecommendation.alternative_suppliers.map((alt: any, idx: number) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedSupplierId(alt.supplier_id)}
                                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                                    selectedSupplierId === alt.supplier_id
                                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  {alt.supplier_name} ({alt.score}%)
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-4 text-center text-indigo-700 font-bold text-[11px]">
                        AI evaluation will run automatically when the modal opens.
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Supplier Dropdown */}
                {supplierSelectionMode === 'MANUAL' && (
                  <div className="space-y-2">
                    <label className="font-bold text-slate-800 block">
                      Select Supplier Partner Manually <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="" disabled>— Choose a Registered Supplier —</option>
                      {registeredSuppliers.map((s: any) => (
                        <option key={s.supplier_id} value={s.supplier_id}>
                          {s.supplier_name} ({s.supplier_code || s.supplier_id}) — {s.email} ({s.city || 'India'})
                        </option>
                      ))}
                    </select>

                    {/* Selected Supplier Details Card */}
                    {(() => {
                      const selSup = registeredSuppliers.find((s: any) => s.supplier_id === selectedSupplierId);
                      if (!selSup) return null;
                      return (
                        <div className="mt-1.5 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-[11px] text-slate-700">
                          <span>ID: <strong className="text-blue-700">{selSup.supplier_code || selSup.supplier_id}</strong></span>
                          <span>Email: <strong className="text-slate-900">{selSup.email}</strong></span>
                          <span>Location: <strong className="text-slate-800">{selSup.city || 'India'}</strong></span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <strong>{Number(selSup.rating || 4.8).toFixed(1)}</strong>
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Multi-Supplier Distribution Panel (Sections 16-17 of updates9.md) */}
                {supplierSelectionMode === 'SPLIT' && (
                  <div className="space-y-3 p-4 bg-emerald-50/40 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-emerald-950 text-xs block">
                          Distribute Requisition Across Multiple Vendors
                        </span>
                        <span className="text-[11px] text-emerald-700">
                          Total PR Quantity: <strong>{approvingPr.pr_items?.[0]?.requested_quantity || 100} units</strong>
                        </span>
                      </div>
                      {(() => {
                        const totalReq = approvingPr.pr_items?.[0]?.requested_quantity || 100;
                        const allocated = splitAllocations.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
                        const diff = totalReq - allocated;
                        return (
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                              diff === 0
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            {diff === 0
                              ? '✓ 100% Balanced'
                              : diff > 0
                              ? `${diff} units unallocated`
                              : `${Math.abs(diff)} units over-allocated`}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="space-y-2">
                      {splitAllocations.map((alloc, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                          <div className="flex-1">
                            <select
                              value={alloc.supplier_id}
                              onChange={(e) => {
                                const copy = [...splitAllocations];
                                copy[idx].supplier_id = e.target.value;
                                setSplitAllocations(copy);
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                            >
                              <option value="" disabled>Select Vendor</option>
                              {registeredSuppliers.map((s) => (
                                <option key={s.supplier_id} value={s.supplier_id}>
                                  {s.supplier_name} ({s.supplier_code})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="w-28">
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                placeholder="Qty"
                                value={alloc.quantity}
                                onChange={(e) => {
                                  const copy = [...splitAllocations];
                                  copy[idx].quantity = Number(e.target.value) || 0;
                                  setSplitAllocations(copy);
                                }}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right pr-6"
                              />
                              <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-medium">units</span>
                            </div>
                          </div>

                          {splitAllocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSplitAllocations(splitAllocations.filter((_, i) => i !== idx));
                              }}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove supplier line"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}

                      {splitAllocations.length < registeredSuppliers.length && (
                        <button
                          type="button"
                          onClick={() => {
                            const unusedSup = registeredSuppliers.find(
                              (s) => !splitAllocations.some((a) => a.supplier_id === s.supplier_id)
                            );
                            setSplitAllocations([
                              ...splitAllocations,
                              { supplier_id: unusedSup?.supplier_id || registeredSuppliers[0].supplier_id, quantity: 100 },
                            ]);
                          }}
                          className="px-3 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100/60 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Another Vendor to Split Distribution</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Selection Mode Footer */}
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>
                    Selection Mode: <strong className="text-slate-900">{supplierSelectionMode === 'AI' ? 'Gemini AI Automatic Quality Ranking' : 'Manual Procurement Officer Choice'}</strong>
                    {selectedSupplierId && (
                      <> — Selected: <strong className="text-blue-700">{registeredSuppliers.find((s: any) => s.supplier_id === selectedSupplierId)?.supplier_name || selectedSupplierId}</strong></>
                    )}
                  </span>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

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
