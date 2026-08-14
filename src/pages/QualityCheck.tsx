import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Camera,
  Lock,
  Eye,
  Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { QualityCheck, Supplier, PurchaseOrder, Product } from '../types/database';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { analyzeQualityInspection, QualityAnalysisResult } from '../services/ai/qualityAnalysisService';
import { sendEmailNotification } from '../services/notificationService';

export const QualityCheckPage: React.FC = () => {
  const { currentUser, role, showToast, canFinalizeQC, effectiveSupplierId, logAuditAction } = useApp();
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal States
  const [openInspectModal, setOpenInspectModal] = useState(false);
  const [openViewModal, setOpenViewModal] = useState(false);
  const [selectedQc, setSelectedQc] = useState<QualityCheck | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<QualityAnalysisResult | null>(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);

  // New Inspection Form
  const [form, setForm] = useState({
    supplier_id: '',
    po_id: '',
    product_id: '',
    expected_quantity: 100,
    received_quantity: 100,
    accepted_quantity: 98,
    rejected_quantity: 2,
    damaged_quantity: 2,
    product_quality_score: 38, // Max 40
    quantity_accuracy_score: 19, // Max 20
    packaging_score: 14, // Max 15
    documentation_score: 9.5, // Max 10
    delivery_condition_score: 14.5, // Max 15
    remarks: '',
    evidence_url: '',
    status: 'IN_PROGRESS' as QualityCheck['status'],
  });

  const isSupplierUser = role === 'SUPPLIER';

  useEffect(() => {
    fetchData();
  }, [effectiveSupplierId, role]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let qcQuery = supabase
        .from('quality_checks')
        .select(`
          *,
          suppliers(supplier_id, supplier_name, supplier_code, city),
          purchase_orders(po_id, po_number, total_amount),
          products(product_id, product_name, product_code)
        `)
        .order('inspection_date', { ascending: false });

      // Supplier Data Isolation
      if (isSupplierUser && effectiveSupplierId) {
        qcQuery = qcQuery.eq('supplier_id', effectiveSupplierId);
      }

      const [{ data: qcData }, { data: supData }, { data: poData }, { data: prodData }] = await Promise.all([
        qcQuery,
        supabase.from('suppliers').select('*').eq('status', 'ACTIVE'),
        supabase.from('purchase_orders').select('*, suppliers(supplier_name)').order('order_date', { ascending: false }),
        supabase.from('products').select('*').eq('status', 'ACTIVE'),
      ]);

      setQualityChecks(qcData || []);
      setSuppliers(supData || []);
      setPurchaseOrders(poData || []);
      setProducts(prodData || []);

      if (supData && supData.length > 0 && !form.supplier_id) {
        setForm((prev) => ({
          ...prev,
          supplier_id: supData[0].supplier_id,
          po_id: poData && poData.length > 0 ? poData[0].po_id : '',
          product_id: prodData && prodData.length > 0 ? prodData[0].product_id : '',
        }));
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error loading Quality Check data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Run Gemini AI Quality Assistant
  const handleRunAiAnalysis = async () => {
    const sup = suppliers.find((s) => s.supplier_id === form.supplier_id);
    const po = purchaseOrders.find((p) => p.po_id === form.po_id);
    const prod = products.find((p) => p.product_id === form.product_id);

    setAnalyzingAi(true);
    try {
      const result = await analyzeQualityInspection({
        po_number: po?.po_number || 'PO-2026-X',
        supplier_name: sup?.supplier_name || 'Vendor',
        product_name: prod?.product_name || 'Industrial Material',
        expected_quantity: form.expected_quantity,
        received_quantity: form.received_quantity,
        damaged_quantity: form.damaged_quantity,
        observations: form.remarks || 'Standard dockside receiving verification.',
      });

      setAiAnalysis(result);
      // Auto-populate recommended scores for human review
      setForm((prev) => ({
        ...prev,
        product_quality_score: result.recommended_quality_score,
        quantity_accuracy_score: result.recommended_quantity_score,
        packaging_score: result.recommended_packaging_score,
        documentation_score: result.recommended_docs_score,
        delivery_condition_score: result.recommended_delivery_score,
        remarks: prev.remarks ? `${prev.remarks}\n[AI Note]: ${result.inspection_summary}` : result.inspection_summary,
      }));

      showToast(`AI Quality Analysis generated (${result.confidence}% confidence). Review recommended scores below.`, 'success');
    } catch (err: any) {
      showToast('AI Quality Analysis failed: ' + err.message, 'error');
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Compute Overall Score (0-100)
  const computedOverallScore = Math.min(
    100,
    Math.round(
      (Number(form.product_quality_score) || 0) +
      (Number(form.quantity_accuracy_score) || 0) +
      (Number(form.packaging_score) || 0) +
      (Number(form.documentation_score) || 0) +
      (Number(form.delivery_condition_score) || 0)
    )
  );

  // Submit & Finalize Quality Check
  const handleSubmitQualityCheck = async (finalize: boolean) => {
    if (!canFinalizeQC()) {
      showToast('Permission Denied: Only Receiving & QC Operators can finalize Quality Checks.', 'error');
      return;
    }

    try {
      const status: QualityCheck['status'] = finalize
        ? computedOverallScore >= 85
          ? 'PASSED'
          : computedOverallScore >= 70
          ? 'PASSED_WITH_ISSUES'
          : 'FAILED'
        : 'IN_PROGRESS';

      const finalStatus = finalize ? 'FINALIZED' : status;
      const defectRate = form.received_quantity > 0
        ? Math.round((form.damaged_quantity / form.received_quantity) * 1000) / 10
        : 0;

      const targetSupplierId = form.supplier_id || (suppliers.length > 0 ? suppliers[0].supplier_id : '');
      const targetPoId = form.po_id || (purchaseOrders.length > 0 ? purchaseOrders[0].po_id : '');
      const targetProductId = form.product_id || (products.length > 0 ? products[0].product_id : '');

      if (!targetSupplierId || !targetPoId) {
        showToast('Please select a valid supplier and purchase order.', 'error');
        return;
      }

      const { data: newQc, error } = await supabase
        .from('quality_checks')
        .insert([
          {
            supplier_id: targetSupplierId,
            po_id: targetPoId,
            product_id: targetProductId || null,
            expected_quantity: form.expected_quantity,
            received_quantity: form.received_quantity,
            accepted_quantity: form.accepted_quantity,
            rejected_quantity: form.rejected_quantity,
            damaged_quantity: form.damaged_quantity,
            product_quality_score: form.product_quality_score,
            quantity_accuracy_score: form.quantity_accuracy_score,
            packaging_score: form.packaging_score,
            documentation_score: form.documentation_score,
            delivery_condition_score: form.delivery_condition_score,
            overall_score: computedOverallScore,
            defect_rate: defectRate,
            status: finalStatus,
            remarks: form.remarks,
            evidence_path: form.evidence_url || null,
            finalized_at: finalize ? new Date().toISOString() : null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      await logAuditAction(
        finalize ? 'QC_FINALIZED' : 'QC_SAVED',
        'quality_checks',
        newQc.quality_check_id,
        { overall_score: computedOverallScore, status: finalStatus }
      );

      // If finalized, update Supplier Performance Score Engine
      if (finalize) {
        await updateSupplierPerformance(form.supplier_id, computedOverallScore, newQc.quality_check_id);
      }

      showToast(
        finalize
          ? `Quality Check #${newQc.quality_check_id.slice(0, 8)} finalized with Score ${computedOverallScore}/100!`
          : `Quality Check drafted successfully!`,
        'success'
      );

      setOpenInspectModal(false);
      fetchData();
    } catch (err: any) {
      showToast('Error saving Quality Check: ' + err.message, 'error');
    }
  };

  // Recalculate Supplier Performance Engine
  const updateSupplierPerformance = async (supplierId: string, qcScore: number, qcId: string) => {
    try {
      const { data: perf } = await supabase
        .from('supplier_performance')
        .select('*')
        .eq('supplier_id', supplierId)
        .maybeSingle();

      const prevOverall = Number(perf?.overall_score) || 90;
      const prevQuality = Number(perf?.quality_score) || 90;
      const prevDelivery = Number(perf?.delivery_score) || 90;
      const prevQtyAcc = Number(perf?.quantity_accuracy_score) || 95;
      const prevInvAcc = Number(perf?.invoice_accuracy_score) || 95;
      const prevResp = Number(perf?.responsiveness_score) || 90;
      const prevRel = Number(perf?.reliability_score) || 95;

      // New weighted average for quality
      const newQuality = Math.round(((prevQuality * 0.7) + (qcScore * 0.3)) * 10) / 10;
      
      // Calculate 6-factor overall rating: Quality (35%), Delivery (25%), Quantity (15%), Invoice (10%), Responsiveness (10%), Reliability (5%)
      const newOverall = Math.round((
        (newQuality * 0.35) +
        (prevDelivery * 0.25) +
        (prevQtyAcc * 0.15) +
        (prevInvAcc * 0.10) +
        (prevResp * 0.10) +
        (prevRel * 0.05)
      ) * 10) / 10;

      const change = Math.round((newOverall - prevOverall) * 10) / 10;

      await supabase.from('supplier_performance').upsert({
        supplier_id: supplierId,
        quality_score: newQuality,
        delivery_score: prevDelivery,
        quantity_accuracy_score: prevQtyAcc,
        invoice_accuracy_score: prevInvAcc,
        responsiveness_score: prevResp,
        reliability_score: prevRel,
        overall_score: newOverall,
        sample_size: (perf?.sample_size || 1) + 1,
        calculated_at: new Date().toISOString(),
      });

      // Record in Score History
      await supabase.from('supplier_score_history').insert([
        {
          supplier_id: supplierId,
          previous_score: prevOverall,
          new_score: newOverall,
          change,
          reason: `Quality inspection completed with lot score ${qcScore}/100.`,
          source_quality_check_id: qcId,
          calculated_at: new Date().toISOString(),
        },
      ]);

      // If score drop is severe, trigger alert & email
      if (change < -3.0) {
        const sup = suppliers.find((s) => s.supplier_id === supplierId);
        await sendEmailNotification({
          alert_type: 'SUPPLIER_SCORE_DROP',
          severity: 'HIGH',
          title: `Supplier Score Drop: ${sup?.supplier_name || 'Vendor'}`,
          message: `Overall performance rating dropped from ${prevOverall} to ${newOverall} (${change} pts) following recent quality inspection.`,
          entity_type: 'supplier_performance',
          entity_number: sup?.supplier_code || 'SUP',
          supplier_name: sup?.supplier_name,
          supplier_id: supplierId,
          expected_value: prevOverall,
          current_value: newOverall,
          difference: change,
          action_link: '/quality',
        });
      }
    } catch (e) {
      console.warn('Failed to update supplier performance engine:', e);
    }
  };

  const filteredChecks = qualityChecks.filter((qc) => {
    const matchesSearch =
      (qc.suppliers?.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (qc.purchase_orders?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (qc.products?.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      qc.quality_check_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || qc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Quality Control & Inspection (QC)
              </h1>
              <p className="text-sm text-slate-500">
                Post-warehouse receipt inspection, 5-pillar defect evaluation, and automated supplier rating updates
              </p>
            </div>
          </div>
        </div>

        {!isSupplierUser && canFinalizeQC() && (
          <button
            onClick={() => {
              setAiAnalysis(null);
              setOpenInspectModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-md shadow-indigo-200 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Perform Quality Check</span>
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Inspected</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{qualityChecks.length}</p>
          <p className="text-xs text-slate-500 mt-1">Inbound shipments evaluated</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Passed Compliance</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {qualityChecks.filter((q) => q.status === 'PASSED' || q.status === 'FINALIZED').length}
          </p>
          <p className="text-xs text-slate-500 mt-1">≥85% weighted QA score</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Quality Score</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">
            {qualityChecks.length > 0
              ? Math.round(
                  qualityChecks.reduce((acc, q) => acc + (Number(q.overall_score) || 0), 0) / qualityChecks.length
                )
              : 92}
            <span className="text-sm font-normal text-slate-500"> / 100</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">5-pillar compliance index</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Flagged / Defective</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600">
            {qualityChecks.filter((q) => q.status === 'FAILED' || q.status === 'PASSED_WITH_ISSUES').length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Requiring debit note or hold</p>
        </div>
      </div>
      {/* Tabs Navigation (Section 28 & 33 of updates3.md) */}
      <div className="flex border-b border-slate-200 space-x-1 text-xs font-bold text-slate-600">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            statusFilter === 'ALL' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Quality Checks</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px]">{qualityChecks.length}</span>
        </button>

        <button
          onClick={() => setStatusFilter('PASSED')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            statusFilter === 'PASSED' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Passed Compliance</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 text-[10px]">
            {qualityChecks.filter((q) => q.status === 'PASSED' || q.status === 'FINALIZED').length}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('PASSED_WITH_ISSUES')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            statusFilter === 'PASSED_WITH_ISSUES' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Passed with Issues</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 text-[10px]">
            {qualityChecks.filter((q) => q.status === 'PASSED_WITH_ISSUES').length}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('FAILED')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            statusFilter === 'FAILED' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Failed Quality Checks</span>
          <span className="px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 text-[10px]">
            {qualityChecks.filter((q) => q.status === 'FAILED').length}
          </span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by supplier, PO, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">All Inspection Statuses</option>
            <option value="FINALIZED">FINALIZED</option>
            <option value="PASSED">PASSED</option>
            <option value="PASSED_WITH_ISSUES">PASSED WITH ISSUES</option>
            <option value="FAILED">FAILED</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
          </select>
        </div>
      </div>

      {/* QC Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <th className="p-3.5 pl-4">Inspection ID / Date</th>
                <th className="p-3.5">Supplier / Vendor</th>
                <th className="p-3.5">PO Ref & SKU</th>
                <th className="p-3.5 text-right">Received / Damaged</th>
                <th className="p-3.5 text-center">5-Pillar Score</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Loading Quality Check inspections...
                  </td>
                </tr>
              ) : filteredChecks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No Quality Check records found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredChecks.map((qc) => (
                  <tr key={qc.quality_check_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 pl-4 font-mono">
                      <div className="font-semibold text-slate-900">QC-{qc.quality_check_id.slice(0, 8)}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(qc.inspection_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{qc.suppliers?.supplier_name || 'Vendor'}</span>
                      </div>
                      <span className="text-xs text-slate-500">{qc.suppliers?.city}</span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono text-xs font-semibold text-indigo-700">
                        {qc.purchase_orders?.po_number || 'PO-2026'}
                      </div>
                      <div className="text-xs text-slate-500">{qc.products?.product_name || 'Industrial Part'}</div>
                    </td>
                    <td className="p-3.5 text-right font-mono">
                      <div>
                        {qc.received_quantity} rec / <span className="text-emerald-600">{qc.accepted_quantity} ok</span>
                      </div>
                      {Number(qc.damaged_quantity) > 0 && (
                        <div className="text-xs text-rose-600 font-semibold">{qc.damaged_quantity} damaged</div>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>{qc.overall_score}/100</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <StatusBadge status={qc.status} />
                    </td>
                    <td className="p-3.5 pr-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedQc(qc);
                          setOpenViewModal(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                      >
                        View Report
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Inspection Modal (Receiving QC Operator) ── */}
      {openInspectModal && (
        <Modal
          title="Perform Inbound Quality Inspection (QC)"
          isOpen={openInspectModal}
          onClose={() => setOpenInspectModal(false)}
        >
          <div className="space-y-4">
            {/* AI Assistant Banner */}
            <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Gemini AI Quality Assistant</h4>
                  <p className="text-[11px] text-indigo-700">
                    Predicts defect classification & recommends 5-pillar score for human operator verification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRunAiAnalysis}
                disabled={analyzingAi}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                {analyzingAi ? 'Analyzing...' : 'Run AI Analysis'}
              </button>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 text-xs block mb-1">Supplier</label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.supplier_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 text-xs block mb-1">Target PO</label>
                <select
                  value={form.po_id}
                  onChange={(e) => setForm({ ...form, po_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  {purchaseOrders.map((p) => (
                    <option key={p.po_id} value={p.po_id}>
                      {p.po_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 text-xs block mb-1">Product SKU</label>
                <select
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  {products.map((pr) => (
                    <option key={pr.product_id} value={pr.product_id}>
                      {pr.product_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quantities */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Expected Qty</label>
                <input
                  type="number"
                  value={form.expected_quantity}
                  onChange={(e) => setForm({ ...form, expected_quantity: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Received Qty</label>
                <input
                  type="number"
                  value={form.received_quantity}
                  onChange={(e) => setForm({ ...form, received_quantity: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Accepted Qty</label>
                <input
                  type="number"
                  value={form.accepted_quantity}
                  onChange={(e) => setForm({ ...form, accepted_quantity: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-emerald-600 font-bold"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium block mb-1">Damaged / Rejected</label>
                <input
                  type="number"
                  value={form.damaged_quantity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      damaged_quantity: Number(e.target.value),
                      rejected_quantity: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-rose-600 font-bold"
                />
              </div>
            </div>

            {/* 5-Pillar Score Sliders */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  5-Pillar Evaluation Matrix
                </span>
                <span className="text-sm font-bold text-indigo-700">
                  Total Score: {computedOverallScore}/100
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>1. Product Quality (Max 40 pts • 40%)</span>
                    <span className="font-bold">{form.product_quality_score} pts</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="0.5"
                    value={form.product_quality_score}
                    onChange={(e) => setForm({ ...form, product_quality_score: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>2. Quantity Accuracy (Max 20 pts • 20%)</span>
                    <span className="font-bold">{form.quantity_accuracy_score} pts</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={form.quantity_accuracy_score}
                    onChange={(e) => setForm({ ...form, quantity_accuracy_score: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>3. Packaging Integrity (Max 15 pts • 15%)</span>
                    <span className="font-bold">{form.packaging_score} pts</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="0.5"
                    value={form.packaging_score}
                    onChange={(e) => setForm({ ...form, packaging_score: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>4. Documentation & Labeling (Max 10 pts • 10%)</span>
                    <span className="font-bold">{form.documentation_score} pts</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={form.documentation_score}
                    onChange={(e) => setForm({ ...form, documentation_score: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>5. Delivery Transit Condition (Max 15 pts • 15%)</span>
                    <span className="font-bold">{form.delivery_condition_score} pts</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    step="0.5"
                    value={form.delivery_condition_score}
                    onChange={(e) => setForm({ ...form, delivery_condition_score: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 font-medium block mb-1">Inspector Remarks & Notes</label>
              <textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Record inspection findings, batch identifiers, or package notes..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenInspectModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmitQualityCheck(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSubmitQualityCheck(true)}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
              >
                Finalize QC & Update Rating
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── View Inspection Report Modal ── */}
      {openViewModal && selectedQc && (
        <Modal
          title={`Quality Inspection Report: QC-${selectedQc.quality_check_id.slice(0, 8)}`}
          isOpen={openViewModal}
          onClose={() => setOpenViewModal(false)}
        >
          <div className="space-y-4 text-sm text-slate-800">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 block">Overall Quality Score</span>
                <span className="text-2xl font-bold text-indigo-700">{selectedQc.overall_score}/100</span>
              </div>
              <StatusBadge status={selectedQc.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Supplier</span>
                <span className="font-semibold text-slate-900">{selectedQc.suppliers?.supplier_name}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">PO Reference</span>
                <span className="font-semibold text-slate-900">{selectedQc.purchase_orders?.po_number}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Received Quantity</span>
                <span className="font-semibold text-slate-900">{selectedQc.received_quantity} units</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 block">Accepted Quantity</span>
                <span className="font-semibold text-emerald-600">{selectedQc.accepted_quantity} units</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
              <span className="font-bold text-slate-700 block mb-1">5-Pillar Score Breakdown:</span>
              <div className="flex justify-between">
                <span>Product Quality (40%):</span>
                <span className="font-semibold">{selectedQc.product_quality_score} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Quantity Accuracy (20%):</span>
                <span className="font-semibold">{selectedQc.quantity_accuracy_score} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Packaging Integrity (15%):</span>
                <span className="font-semibold">{selectedQc.packaging_score} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Documentation (10%):</span>
                <span className="font-semibold">{selectedQc.documentation_score} pts</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Condition (15%):</span>
                <span className="font-semibold">{selectedQc.delivery_condition_score} pts</span>
              </div>
            </div>

            {selectedQc.remarks && (
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs">
                <span className="font-bold text-indigo-950 block mb-0.5">Inspector Remarks:</span>
                <p className="text-slate-700">{selectedQc.remarks}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setOpenViewModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
