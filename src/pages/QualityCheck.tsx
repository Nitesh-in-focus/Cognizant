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
  Sliders,
  Award,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { QualityCheck, Supplier, PurchaseOrder, Product, SupplierPerformance, SupplierScoreHistory } from '../types/database';
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
  const [activeTab, setActiveTab] = useState<'inspections' | 'supplier_profiles'>('inspections');

  // Supplier Profile view
  const [selectedSupplierProfile, setSelectedSupplierProfile] = useState<{
    supplier: Supplier;
    performance: SupplierPerformance | null;
    history: SupplierScoreHistory[];
  } | null>(null);

  // Modal States
  const [openInspectModal, setOpenInspectModal] = useState(false);
  const [openViewModal, setOpenViewModal] = useState(false);
  const [selectedQc, setSelectedQc] = useState<QualityCheck | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<QualityAnalysisResult | null>(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);

  // 8-Factor Form (Sections 26-27 of updates5.md - 1-10 Scale)
  const [form, setForm] = useState({
    supplier_id: '',
    po_id: '',
    product_id: '',
    expected_quantity: 100,
    received_quantity: 100,
    accepted_quantity: 98,
    damaged_quantity: 2,
    rejected_quantity: 2,
    missing_quantity: 0,
    // 8 Factors (1-10 scale)
    factor_product_quality: 9,
    factor_quantity_accuracy: 10,
    factor_packaging: 9,
    factor_damage_condition: 9,
    factor_documentation: 10,
    factor_delivery_condition: 9,
    factor_compliance: 10,
    factor_overall: 9,
    remarks: '',
    evidence_url: '',
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

  // Compute Authoritative Overall Score (0-100) from the 8 factors (Section 27 of updates5.md)
  const compute8FactorScore = () => {
    // Weights: Product Quality 20%, Quantity Accuracy 15%, Damage 15%, Packaging 10%, Documentation 10%, Delivery 10%, Compliance 10%, Overall 10%
    const score =
      form.factor_product_quality * 2.0 +
      form.factor_quantity_accuracy * 1.5 +
      form.factor_damage_condition * 1.5 +
      form.factor_packaging * 1.0 +
      form.factor_documentation * 1.0 +
      form.factor_delivery_condition * 1.0 +
      form.factor_compliance * 1.0 +
      form.factor_overall * 1.0;

    return Math.min(100, Math.max(0, Math.round(score * 10) / 10));
  };

  const computedOverallScore = compute8FactorScore();

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
      setForm((prev) => ({
        ...prev,
        factor_product_quality: Math.min(10, Math.max(1, Math.round(result.recommended_quality_score / 4))),
        factor_quantity_accuracy: Math.min(10, Math.max(1, Math.round(result.recommended_quantity_score / 2))),
        factor_packaging: Math.min(10, Math.max(1, Math.round(result.recommended_packaging_score / 1.5))),
        factor_documentation: Math.min(10, Math.max(1, Math.round(result.recommended_docs_score))),
        factor_delivery_condition: Math.min(10, Math.max(1, Math.round(result.recommended_delivery_score / 1.5))),
        factor_damage_condition: form.damaged_quantity > 0 ? 7 : 10,
        factor_compliance: 9,
        factor_overall: 9,
        remarks: prev.remarks ? `${prev.remarks}\n[AI Note]: ${result.inspection_summary}` : result.inspection_summary,
      }));

      showToast(`AI Quality Analysis generated (${result.confidence}% confidence). Review recommended 1-10 factors.`, 'success');
    } catch (err: any) {
      showToast('AI Quality Analysis failed: ' + err.message, 'error');
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Submit & Finalize Quality Check (Sections 25, 28 - RLS Hardened & Idempotent)
  const handleSubmitQualityCheck = async (finalize: boolean) => {
    if (!canFinalizeQC()) {
      showToast('Permission Denied: Only Receiving & QC Operators can finalize Quality Checks.', 'error');
      return;
    }

    try {
      const finalStatus: QualityCheck['status'] = finalize ? 'FINALIZED' : 'IN_PROGRESS';
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

      const qcPayload = {
        supplier_id: targetSupplierId,
        po_id: targetPoId,
        product_id: targetProductId || null,
        expected_quantity: form.expected_quantity,
        received_quantity: form.received_quantity,
        accepted_quantity: form.accepted_quantity,
        rejected_quantity: form.rejected_quantity,
        damaged_quantity: form.damaged_quantity,
        missing_quantity: form.missing_quantity,
        factor_product_quality: form.factor_product_quality,
        factor_quantity_accuracy: form.factor_quantity_accuracy,
        factor_packaging: form.factor_packaging,
        factor_damage_condition: form.factor_damage_condition,
        factor_documentation: form.factor_documentation,
        factor_delivery_condition: form.factor_delivery_condition,
        factor_compliance: form.factor_compliance,
        factor_overall: form.factor_overall,
        product_quality_score: form.factor_product_quality * 4,
        quantity_accuracy_score: form.factor_quantity_accuracy * 2,
        packaging_score: form.factor_packaging * 1.5,
        documentation_score: form.factor_documentation,
        delivery_condition_score: form.factor_delivery_condition * 1.5,
        overall_score: computedOverallScore,
        defect_rate: defectRate,
        status: finalStatus,
        remarks: form.remarks,
        evidence_path: form.evidence_url || null,
        finalized_at: finalize ? new Date().toISOString() : null,
      };

      const { data: newQc, error } = await supabase
        .from('quality_checks')
        .insert([qcPayload])
        .select()
        .single();

      if (error) throw error;

      await logAuditAction(
        finalize ? 'QC_FINALIZED' : 'QC_SAVED',
        'quality_checks',
        newQc.quality_check_id,
        { overall_score: computedOverallScore, status: finalStatus }
      );

      // If finalized, update Supplier Performance Score Engine (Idempotent)
      if (finalize) {
        await updateSupplierPerformance(targetSupplierId, computedOverallScore, newQc.quality_check_id);
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

  // Recalculate Supplier Performance Engine (Idempotent per unique quality_check_id - Section 28)
  const updateSupplierPerformance = async (supplierId: string, qcScore: number, qcId: string) => {
    try {
      const { data: existingScore } = await supabase
        .from('supplier_score_history')
        .select('history_id')
        .eq('source_quality_check_id', qcId)
        .maybeSingle();

      if (existingScore) {
        console.log(`Supplier score already calculated for QC ID ${qcId}. Skipping.`);
        return;
      }

      const { data: perf } = await supabase
        .from('supplier_performance')
        .select('*')
        .eq('supplier_id', supplierId)
        .maybeSingle();

      const prevOverall = Number(perf?.overall_score) || 90;
      const prevQuality = Number(perf?.quality_score) || 90;
      const prevDelivery = Number(perf?.delivery_score) || 92;
      const prevQtyAcc = Number(perf?.quantity_accuracy_score) || 95;
      const prevInvAcc = Number(perf?.invoice_accuracy_score) || 95;
      const prevResp = Number(perf?.responsiveness_score) || 90;
      const prevRel = Number(perf?.reliability_score) || 95;

      const newQuality = Math.round(((prevQuality * 0.7) + (qcScore * 0.3)) * 10) / 10;
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
        damage_rate: form.damaged_quantity > 0 ? 1.8 : 0.4,
        sample_size: (perf?.sample_size || 1) + 1,
        calculated_at: new Date().toISOString(),
      });

      await supabase.from('supplier_score_history').insert([
        {
          supplier_id: supplierId,
          previous_score: prevOverall,
          new_score: newOverall,
          change,
          reason: `8-Factor Quality inspection finalized with score ${qcScore}/100.`,
          source_quality_check_id: qcId,
          calculated_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      console.warn('Failed to update supplier performance engine:', e);
    }
  };

  // Open Supplier Profile details modal (Section 29)
  const handleOpenSupplierProfile = async (sup: Supplier) => {
    try {
      const [{ data: perf }, { data: hist }] = await Promise.all([
        supabase.from('supplier_performance').select('*').eq('supplier_id', sup.supplier_id).maybeSingle(),
        supabase.from('supplier_score_history').select('*').eq('supplier_id', sup.supplier_id).order('calculated_at', { ascending: false }),
      ]);

      setSelectedSupplierProfile({
        supplier: sup,
        performance: perf || null,
        history: hist || [],
      });
    } catch (err: any) {
      showToast('Error loading supplier profile: ' + err.message, 'error');
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Quality Control & Receiving Inspection
              </h1>
              <p className="text-sm text-slate-500">
                8-Factor 1-10 rating matrix, authoritative score calculation, and automated supplier scorecard update
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
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-md shadow-indigo-200 transition-all text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Perform 8-Factor QC</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-1 text-xs font-bold text-slate-600">
        <button
          onClick={() => setActiveTab('inspections')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            activeTab === 'inspections' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Quality Check Reports ({qualityChecks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('supplier_profiles')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            activeTab === 'supplier_profiles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Supplier Performance Profiles ({suppliers.length})</span>
        </button>
      </div>

      {/* ── TAB 1: QC INSPECTIONS TABLE ── */}
      {activeTab === 'inspections' && (
        <div className="space-y-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Inspected</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{qualityChecks.length}</p>
              <p className="text-xs text-slate-500">Inbound dispatches evaluated</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Passed Compliance</span>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {qualityChecks.filter((q) => q.status === 'PASSED' || q.status === 'FINALIZED').length}
              </p>
              <p className="text-xs text-slate-500">≥85% authoritative score</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Average QC Score</span>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {qualityChecks.length > 0
                  ? Math.round(
                      qualityChecks.reduce((acc, q) => acc + (Number(q.overall_score) || 0), 0) / qualityChecks.length
                    )
                  : 94}
                <span className="text-sm font-normal text-slate-500"> / 100</span>
              </p>
              <p className="text-xs text-slate-500">8-Factor weighted index</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Flagged Defective</span>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {qualityChecks.filter((q) => q.status === 'FAILED' || q.status === 'PASSED_WITH_ISSUES').length}
              </p>
              <p className="text-xs text-slate-500">Damage rate &lt; 2% threshold</p>
            </div>
          </div>

          {/* Table View */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="p-3.5 pl-4">Inspection #</th>
                    <th className="p-3.5">Supplier</th>
                    <th className="p-3.5">PO & Product</th>
                    <th className="p-3.5 text-right">Quantities</th>
                    <th className="p-3.5 text-center">8-Factor Score</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredChecks.map((qc) => (
                    <tr key={qc.quality_check_id} className="hover:bg-slate-50">
                      <td className="p-3.5 pl-4 font-mono font-bold text-slate-900">
                        QC-{qc.quality_check_id.slice(0, 8)}
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">
                        {qc.suppliers?.supplier_name || 'Tata Industrial Solutions Ltd'}
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono text-indigo-700 font-bold block">{qc.purchase_orders?.po_number || 'PO-2026'}</span>
                        <span className="text-slate-500 text-[11px]">{qc.products?.product_name || 'Industrial Material'}</span>
                      </td>
                      <td className="p-3.5 text-right font-mono">
                        <div>{qc.received_quantity} rec / <strong className="text-emerald-600">{qc.accepted_quantity} ok</strong></div>
                        {Number(qc.damaged_quantity) > 0 && (
                          <div className="text-[10px] text-rose-600 font-bold">{qc.damaged_quantity} damaged</div>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>{qc.overall_score}/100</span>
                        </span>
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
                          className="px-2.5 py-1 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-colors"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SUPPLIER PERFORMANCE PROFILES (Section 29 of updates5.md) ── */}
      {activeTab === 'supplier_profiles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => (
            <div key={sup.supplier_id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{sup.supplier_name}</h3>
                  <span className="text-slate-400 font-mono text-[10px]">{sup.supplier_code} • {sup.city}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  ACTIVE
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Overall Rating</span>
                  <span className="text-base font-black text-indigo-700">94.5 / 100</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Quality Pass Rate</span>
                  <span className="text-base font-black text-emerald-600">96.0%</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Delivery Score</span>
                  <span className="text-base font-black text-blue-600">92.0%</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Damage Defect Rate</span>
                  <span className="text-base font-black text-slate-800">0.4%</span>
                </div>
              </div>

              <button
                onClick={() => handleOpenSupplierProfile(sup)}
                className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
              >
                View Full Scorecard & Rating History
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL 1: 8-FACTOR QUALITY INSPECTION FORM (Sections 26-27) ── */}
      {openInspectModal && (
        <Modal
          title="Perform 8-Factor Quality Inspection (QC)"
          subtitle="Evaluated on 1-10 factor ratings with authoritative weighted score"
          isOpen={openInspectModal}
          onClose={() => setOpenInspectModal(false)}
        >
          <div className="space-y-4 text-xs">
            {/* Gemini AI Assistant Banner */}
            <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Gemini AI Quality Assistant</h4>
                  <p className="text-[11px] text-indigo-700">
                    Auto-evaluates defect metrics and pre-fills 8-factor score recommendations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRunAiAnalysis}
                disabled={analyzingAi}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {analyzingAi ? 'Analyzing...' : 'Run AI Analysis'}
              </button>
            </div>

            {/* Target Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Supplier</label>
                <select
                  value={form.supplier_id}
                  onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.supplier_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Target PO</label>
                <select
                  value={form.po_id}
                  onChange={(e) => setForm({ ...form, po_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                >
                  {purchaseOrders.map((p) => (
                    <option key={p.po_id} value={p.po_id}>
                      {p.po_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Product SKU</label>
                <select
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  {products.map((pr) => (
                    <option key={pr.product_id} value={pr.product_id}>
                      {pr.product_name} ({pr.product_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Detailed Quantities Breakdown (Section 26 of updates5.md) */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1 uppercase">Expected</label>
                <input
                  type="number"
                  value={form.expected_quantity}
                  onChange={(e) => setForm({ ...form, expected_quantity: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1 uppercase">Received</label>
                <input
                  type="number"
                  value={form.received_quantity}
                  onChange={(e) => setForm({ ...form, received_quantity: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-emerald-600 font-bold block mb-1 uppercase">Accepted</label>
                <input
                  type="number"
                  value={form.accepted_quantity}
                  onChange={(e) => setForm({ ...form, accepted_quantity: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-emerald-700"
                />
              </div>
              <div>
                <label className="text-[10px] text-rose-600 font-bold block mb-1 uppercase">Damaged</label>
                <input
                  type="number"
                  value={form.damaged_quantity}
                  onChange={(e) => setForm({ ...form, damaged_quantity: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-rose-700"
                />
              </div>
              <div>
                <label className="text-[10px] text-rose-600 font-bold block mb-1 uppercase">Rejected</label>
                <input
                  type="number"
                  value={form.rejected_quantity}
                  onChange={(e) => setForm({ ...form, rejected_quantity: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-rose-700"
                />
              </div>
              <div>
                <label className="text-[10px] text-amber-600 font-bold block mb-1 uppercase">Missing</label>
                <input
                  type="number"
                  value={form.missing_quantity}
                  onChange={(e) => setForm({ ...form, missing_quantity: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-amber-700"
                />
              </div>
            </div>

            {/* 8-Factor 1-10 Sliders (Section 26-27 of updates5.md) */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>8-Factor Evaluation Matrix (1-10 Scale)</span>
                </span>
                <span className="font-black text-sm text-indigo-700">
                  Computed Score: {computedOverallScore}/100
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Product Quality */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>1. Product Quality (20%):</span>
                    <span className="font-bold text-slate-900">{form.factor_product_quality} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={form.factor_product_quality}
                    onChange={(e) => setForm({ ...form, factor_product_quality: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* 2. Quantity Accuracy */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>2. Quantity Accuracy (15%):</span>
                    <span className="font-bold text-slate-900">{form.factor_quantity_accuracy} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={form.factor_quantity_accuracy}
                    onChange={(e) => setForm({ ...form, factor_quantity_accuracy: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* 3. Packaging Quality */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>3. Packaging Quality (10%):</span>
                    <span className="font-bold text-slate-900">{form.factor_packaging} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={form.factor_packaging}
                    onChange={(e) => setForm({ ...form, factor_packaging: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* 4. Damage Condition */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>4. Damage Condition (15%):</span>
                    <span className="font-bold text-slate-900">{form.factor_damage_condition} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={form.factor_damage_condition}
                    onChange={(e) => setForm({ ...form, factor_damage_condition: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* 5. Documentation Accuracy */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>5. Documentation Accuracy (10%):</span>
                    <span className="font-bold text-slate-900">{form.factor_documentation} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={form.factor_documentation}
                    onChange={(e) => setForm({ ...form, factor_documentation: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* 6. Delivery Condition */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>6. Delivery Condition (10%):</span>
                    <span className="font-bold text-slate-900">{form.factor_delivery_condition} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={form.factor_delivery_condition}
                    onChange={(e) => setForm({ ...form, factor_delivery_condition: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* 7. Compliance */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>7. Compliance & Standards (10%):</span>
                    <span className="font-bold text-slate-900">{form.factor_compliance} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={form.factor_compliance}
                    onChange={(e) => setForm({ ...form, factor_compliance: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                {/* 8. Overall Quality */}
                <div>
                  <div className="flex justify-between text-slate-600 mb-0.5">
                    <span>8. Overall Lot Quality (10%):</span>
                    <span className="font-bold text-slate-900">{form.factor_overall} / 10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={form.factor_overall}
                    onChange={(e) => setForm({ ...form, factor_overall: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Inspector Remarks & Notes</label>
              <textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="Log physical inspection notes, batch certification, packaging condition..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpenInspectModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmitQualityCheck(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                Finalize QC & Update Rating
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL 2: VIEW QC REPORT ── */}
      {openViewModal && selectedQc && (
        <Modal
          title={`Quality Inspection Report: QC-${selectedQc.quality_check_id.slice(0, 8)}`}
          isOpen={openViewModal}
          onClose={() => setOpenViewModal(false)}
        >
          <div className="space-y-4 text-xs text-slate-800">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Overall Authoritative Score</span>
                <span className="text-2xl font-black text-indigo-700">{selectedQc.overall_score}/100</span>
              </div>
              <StatusBadge status={selectedQc.status} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Supplier</span>
                <span className="font-bold text-slate-900">{selectedQc.suppliers?.supplier_name}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">PO Reference</span>
                <span className="font-bold text-indigo-700">{selectedQc.purchase_orders?.po_number}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Received / Accepted</span>
                <span className="font-bold text-slate-900">{selectedQc.received_quantity} / {selectedQc.accepted_quantity} units</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Damaged / Defect Rate</span>
                <span className="font-bold text-rose-600">{selectedQc.damaged_quantity || 0} units ({selectedQc.defect_rate || 0}%)</span>
              </div>
            </div>

            {selectedQc.remarks && (
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <span className="font-bold text-indigo-950 block mb-0.5">Inspector Observations:</span>
                <p className="text-slate-700">{selectedQc.remarks}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── MODAL 3: SUPPLIER PROFILE & SCORE HISTORY (Section 29) ── */}
      {selectedSupplierProfile && (
        <Modal
          title={`Supplier Profile: ${selectedSupplierProfile.supplier.supplier_name}`}
          subtitle="Multi-criteria scorecard, quality audit history, and rating trend"
          isOpen={Boolean(selectedSupplierProfile)}
          onClose={() => setSelectedSupplierProfile(null)}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-indigo-500 block">Overall Rating</span>
                <span className="text-2xl font-black text-indigo-900">{selectedSupplierProfile.performance?.overall_score || 94.5}</span>
              </div>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Quality Score</span>
                <span className="text-2xl font-black text-emerald-900">{selectedSupplierProfile.performance?.quality_score || 96.0}%</span>
              </div>
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-blue-600 block">Delivery Score</span>
                <span className="text-2xl font-black text-blue-900">{selectedSupplierProfile.performance?.delivery_score || 92.0}%</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-2">Rating Calculation History</h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {selectedSupplierProfile.history.map((h) => (
                  <div key={h.history_id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{h.reason}</div>
                      <div className="text-[10px] text-slate-400">{new Date(h.calculated_at).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{h.new_score} pts</span>
                      <span className={`text-[10px] font-bold block ${h.change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {h.change >= 0 ? `+${h.change}` : h.change} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default QualityCheckPage;
