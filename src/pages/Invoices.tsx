import React, { useEffect, useState } from 'react';
import {
  Receipt,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  CreditCard,
  Eye,
  ArrowRight,
  ShieldCheck,
  Filter,
  Check,
  XCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Zap,
  CheckCheck,
  DollarSign,
  AlertOctagon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { triggerFinanceExceptionNotification } from '../services/emailService';
import {
  executeThreeWayMatchAndSync,
  executeInvoicePayout,
  ThreeWayMatchResult,
} from '../services/matchingService';

export const Invoices: React.FC = () => {
  const {
    refreshKey,
    triggerRefresh,
    showSnackbar,
    addAlert,
    canApproveInvoice,
    canReleasePayment,
    logAuditAction,
    currentUser,
    role,
  } = useApp();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [batchMatching, setBatchMatching] = useState(false);

  // 3-Way Match Modal state
  const [openMatchModal, setOpenMatchModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [matchResult, setMatchResult] = useState<ThreeWayMatchResult | null>(null);
  const [loadingMatchData, setLoadingMatchData] = useState(false);
  const [payoutProcessing, setPayoutProcessing] = useState(false);
  const [payoutPaymentMethod, setPayoutPaymentMethod] = useState('NEFT');
  const [payoutCompletedTxRef, setPayoutCompletedTxRef] = useState<string | null>(null);

  // Resolution / Escalation inputs
  const [overrideNotes, setOverrideNotes] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [showEscalateInput, setShowEscalateInput] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, [refreshKey]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          purchase_orders(
            po_id,
            po_number,
            total_amount,
            order_date,
            status,
            warehouses(warehouse_name),
            po_items(*, products(*))
          ),
          suppliers(supplier_id, supplier_name, supplier_code, city, email),
          shipments(shipment_id, shipment_number, total_quantity, status, po_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err: any) {
      console.error('Fetch invoices error:', err);
      showSnackbar('Error loading invoice inbox: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Open & Execute 3-Way Match Review Modal for a specific invoice
  const handleOpen3WayMatch = async (inv: any) => {
    setSelectedInvoice(inv);
    setShowOverrideInput(false);
    setShowEscalateInput(false);
    setOverrideNotes('');
    setEscalationReason('');
    setPayoutCompletedTxRef(null);
    setOpenMatchModal(true);
    setLoadingMatchData(true);

    try {
      // Execute 3-Way Match engine: autofetches PO + GRN + Invoice, evaluates variance, syncs database & exceptions
      const result = await executeThreeWayMatchAndSync(inv, {
        userName: currentUser?.full_name,
        userRole: role,
      });

      setMatchResult(result);
      setSelectedInvoice(result.invoice);

      if (result.isFullyMatched) {
        showSnackbar(`3-Way Match PASSED for ${inv.invoice_number}! PO, GRN & Invoice 100% aligned.`, 'success');
      } else {
        showSnackbar(`3-Way Match Discrepancy on ${inv.invoice_number}: ${result.mismatchDetails}`, 'warning');
      }

      // Re-fetch inbox so table reflects updated match_status / payment_status
      fetchInvoices();
    } catch (err: any) {
      console.error('Error executing 3-way match:', err);
      showSnackbar('Error loading matching records: ' + err.message, 'error');
    } finally {
      setLoadingMatchData(false);
    }
  };

  // Run Batch 3-Way Matching for all pending/unmatched invoices
  const handleRunAll3WayMatches = async () => {
    try {
      setBatchMatching(true);
      const pendingInvoices = invoices.filter((i) => i.payment_status !== 'PAID');
      if (pendingInvoices.length === 0) {
        showSnackbar('All invoices in queue are already processed and paid.', 'info');
        return;
      }

      let matchedCount = 0;
      let mismatchCount = 0;

      for (const inv of pendingInvoices) {
        try {
          const res = await executeThreeWayMatchAndSync(inv, {
            userName: currentUser?.full_name,
            userRole: role,
          });
          if (res.isFullyMatched) matchedCount++;
          else mismatchCount++;
        } catch (e) {
          console.error('Error matching invoice ' + inv.invoice_number, e);
        }
      }

      showSnackbar(
        `Batch 3-Way Match Completed: ${matchedCount} matched & approved, ${mismatchCount} exceptions flagged.`,
        matchedCount > 0 ? 'success' : 'warning'
      );
      fetchInvoices();
      triggerRefresh();
    } catch (err: any) {
      showSnackbar('Batch match error: ' + err.message, 'error');
    } finally {
      setBatchMatching(false);
    }
  };

  // Action: Execute Immediate Payout / Banking Settlement
  const handleExecutePayoutDirect = async () => {
    if (!canReleasePayment()) {
      showSnackbar('Permission Denied: Only Financial Controllers can disburse payments.', 'error');
      return;
    }
    if (!selectedInvoice) return;

    try {
      setPayoutProcessing(true);
      const res = await executeInvoicePayout({
        invoice: selectedInvoice,
        paymentMethod: payoutPaymentMethod,
        userName: currentUser?.full_name,
      });

      setPayoutCompletedTxRef(res.transactionReference);

      await logAuditAction('PAYMENT_DISBURSED', 'payments', selectedInvoice.invoice_id, {
        transaction_reference: res.transactionReference,
        amount: selectedInvoice.total_amount,
        payment_method: payoutPaymentMethod,
      });

      addAlert({
        title: `Payment Disbursed: ${res.transactionReference}`,
        message: `₹${Number(selectedInvoice.total_amount).toLocaleString()} disbursed to ${
          selectedInvoice.suppliers?.supplier_name || 'Vendor'
        } via ${payoutPaymentMethod}.`,
        severity: 'success',
        link: '/payments',
      });

      showSnackbar(
        `Payout of ₹${Number(selectedInvoice.total_amount).toLocaleString()} successfully settled (Txn: ${
          res.transactionReference
        })!`,
        'success'
      );

      fetchInvoices();
      triggerRefresh();
    } catch (err: any) {
      console.error('Payout failed:', err);
      showSnackbar('Payout execution failed: ' + err.message, 'error');
    } finally {
      setPayoutProcessing(false);
    }
  };

  // Action: Finance Override / Resolve Exception
  const handleResolveException = async () => {
    if (!canApproveInvoice()) {
      showSnackbar('Permission Denied: Only Financial Controllers can override exceptions.', 'error');
      return;
    }
    if (!overrideNotes.trim()) {
      showSnackbar('Please enter resolution explanation notes.', 'error');
      return;
    }

    try {
      setIsSubmittingAction(true);
      const { error } = await supabase
        .from('invoices')
        .update({
          match_status: 'MANUAL_OVERRIDE',
          payment_status: 'APPROVED_FOR_PAYMENT',
          notes: selectedInvoice.notes
            ? `${selectedInvoice.notes} | [Finance Override]: ${overrideNotes}`
            : `[Finance Override]: ${overrideNotes}`,
          updated_at: new Date().toISOString(),
        })
        .eq('invoice_id', selectedInvoice.invoice_id);

      if (error) throw error;

      // Also resolve any open exception record
      if (matchResult?.existingException?.exception_id) {
        await supabase
          .from('exceptions')
          .update({
            status: 'RESOLVED',
            resolved_at: new Date().toISOString(),
            description: `${matchResult.existingException.description} [Finance Override: ${overrideNotes}]`,
          })
          .eq('exception_id', matchResult.existingException.exception_id);
      }

      await logAuditAction('INVOICE_EXCEPTION_RESOLVED', 'invoices', selectedInvoice.invoice_id, {
        notes: overrideNotes,
        invoice_number: selectedInvoice.invoice_number,
      });

      showSnackbar(
        `Exception overridden & approved for Invoice #${selectedInvoice.invoice_number}. Ready for immediate payout.`,
        'success'
      );

      setShowOverrideInput(false);
      fetchInvoices();
      triggerRefresh();

      // Refresh modal state
      if (matchResult) {
        setMatchResult({
          ...matchResult,
          isFullyMatched: true,
          invoice: {
            ...matchResult.invoice,
            match_status: 'MANUAL_OVERRIDE',
            payment_status: 'APPROVED_FOR_PAYMENT',
          },
        });
      }
    } catch (err: any) {
      showSnackbar('Resolution failed: ' + err.message, 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Action: Escalate to PR Officer
  const handleEscalateToPrOfficer = async () => {
    if (!escalationReason.trim()) {
      showSnackbar('Please specify the escalation reason for the PR Officer.', 'error');
      return;
    }

    try {
      setIsSubmittingAction(true);
      const diff = Math.abs(matchResult?.totalDiff || matchResult?.priceVariance || 0);
      const excNumber = `EXC-ESC-${Math.floor(1000 + Math.random() * 9000)}`;

      const isValidUuid = (val?: string) => Boolean(val && val.length === 36 && val.includes('-'));
      const validPoId = isValidUuid(selectedInvoice.po_id) ? selectedInvoice.po_id : null;
      const validInvoiceId = isValidUuid(selectedInvoice.invoice_id) ? selectedInvoice.invoice_id : null;
      const validShipmentId = isValidUuid(selectedInvoice.shipment_id)
        ? selectedInvoice.shipment_id
        : isValidUuid(matchResult?.shipment?.shipment_id)
        ? matchResult?.shipment.shipment_id
        : null;
      const validGrnId = isValidUuid(matchResult?.grn?.grn_id) ? matchResult?.grn.grn_id : null;

      // 1. Create exception record in database
      const { error: excErr } = await supabase.from('exceptions').insert([
        {
          exception_number: excNumber,
          po_id: validPoId,
          invoice_id: validInvoiceId,
          grn_id: validGrnId,
          shipment_id: validShipmentId,
          exception_type: matchResult?.discrepancyType || 'PRICE_MISMATCH',
          expected_value: matchResult?.expectedPayable || matchResult?.poContractTotal || 0,
          actual_value: selectedInvoice.total_amount,
          difference: diff,
          severity: 'HIGH',
          status: 'OPEN',
          description: `Finance Escalation: ${escalationReason} (Invoice #${selectedInvoice.invoice_number} on Hold)`,
        },
      ]);

      if (excErr) throw excErr;

      // 2. Put invoice on hold
      await supabase
        .from('invoices')
        .update({
          match_status: 'MISMATCH',
          payment_status: 'ON_HOLD',
          notes: selectedInvoice.notes
            ? `${selectedInvoice.notes} | [Escalated to PR Officer]: ${escalationReason}`
            : `[Escalated to PR Officer]: ${escalationReason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('invoice_id', selectedInvoice.invoice_id);

      await logAuditAction('INVOICE_ESCALATED_TO_PR', 'invoices', selectedInvoice.invoice_id, {
        escalation_reason: escalationReason,
        exception_number: excNumber,
      });

      // 3. Dispatch Email Notification to PR Officer
      await triggerFinanceExceptionNotification({
        exceptionId: excNumber,
        invoiceId: selectedInvoice.invoice_id,
        invoiceNumber: selectedInvoice.invoice_number,
        poId: selectedInvoice.po_id,
        poNumber: matchResult?.poNumber || selectedInvoice.purchase_orders?.po_number,
        shipmentId: selectedInvoice.shipment_id,
        shipmentNumber: matchResult?.shipment?.shipment_number || selectedInvoice.shipments?.shipment_number,
        supplierName: selectedInvoice.suppliers?.supplier_name || 'Vendor Partner',
        mismatchType: matchResult?.discrepancyType || 'PRICE_OR_QUANTITY_MISMATCH',
        mismatchDetails: escalationReason,
        amount: diff,
      });

      addAlert({
        title: `Invoice Escalated to PR Officer: ${excNumber}`,
        message: `Discrepancy on ${selectedInvoice.invoice_number} routed to Procurement Officer for investigation.`,
        severity: 'warning',
        link: '/exceptions',
      });

      showSnackbar(`Discrepancy ticket #${excNumber} created and escalated to PR Officer!`, 'success');
      setShowEscalateInput(false);
      setOpenMatchModal(false);
      fetchInvoices();
      triggerRefresh();
    } catch (err: any) {
      showSnackbar('Escalation failed: ' + err.message, 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      !searchQuery ||
      inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.purchase_orders?.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.suppliers?.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || inv.match_status === statusFilter;
    const matchesPayment = paymentFilter === 'ALL' || inv.payment_status === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  const totalInvoices = invoices.length;
  const pendingMatchCount = invoices.filter((i) => i.match_status === 'PENDING' || !i.match_status).length;
  const approvedCount = invoices.filter(
    (i) => i.payment_status === 'APPROVED_FOR_PAYMENT' || (i.match_status === 'MATCHED' && i.payment_status !== 'PAID')
  ).length;
  const onHoldCount = invoices.filter((i) => i.payment_status === 'ON_HOLD' || i.match_status === 'MISMATCH').length;
  const paidCount = invoices.filter((i) => i.payment_status === 'PAID').length;

  const comp = matchResult;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            Finance Invoice Inbox & Automated 3-Way Matching
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated 3-Way Matching (PO ↔ Dock GRN ↔ Supplier Invoice), exception containment, and 1-click banking payouts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAll3WayMatches}
            disabled={batchMatching || loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Automatically run 3-way match on all pending invoices"
          >
            <Zap className={`w-3.5 h-3.5 ${batchMatching ? 'animate-bounce' : ''}`} />
            <span>{batchMatching ? 'Running Match Engine...' : 'Run All 3-Way Matches'}</span>
          </button>

          <button
            onClick={() => {
              fetchInvoices();
              triggerRefresh();
            }}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh Invoices"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Received Invoices</span>
          <div className="text-xl font-black text-slate-900 mt-0.5">{totalInvoices}</div>
          <span className="text-[11px] text-slate-500">{paidCount} settled via banking rail</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[10px] text-amber-500 font-bold uppercase block">Pending 3-Way Match</span>
          <div className="text-xl font-black text-amber-600 mt-0.5">{pendingMatchCount}</div>
          <span className="text-[11px] text-slate-500">Awaiting PO ↔ GRN auto-check</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[10px] text-emerald-500 font-bold uppercase block">Approved for Payout</span>
          <div className="text-xl font-black text-emerald-600 mt-0.5">{approvedCount}</div>
          <span className="text-[11px] text-slate-500">100% matched & ready for payout</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[10px] text-rose-500 font-bold uppercase block">Exceptions on Hold</span>
          <div className="text-xl font-black text-rose-600 mt-0.5">{onHoldCount}</div>
          <span className="text-[11px] text-slate-500">Price/quantity mismatch</span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoice#, PO#, vendor name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px]">Match:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
            >
              <option value="ALL">All Match States</option>
              <option value="PENDING">PENDING</option>
              <option value="MATCHED">MATCHED</option>
              <option value="MISMATCH">MISMATCH</option>
              <option value="MANUAL_OVERRIDE">MANUAL_OVERRIDE</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px]">Payment:</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
            >
              <option value="ALL">All Payments</option>
              <option value="UNPAID">UNPAID</option>
              <option value="APPROVED_FOR_PAYMENT">APPROVED_FOR_PAYMENT</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="PAID">PAID</option>
              <option value="ON_HOLD">ON_HOLD</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Inbox Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Supplier Payee</th>
                <th className="py-3 px-4">Target PO #</th>
                <th className="py-3 px-4">Shipment Ref</th>
                <th className="py-3 px-4">Billed Amount</th>
                <th className="py-3 px-4">OCR Status</th>
                <th className="py-3 px-4">3-Way Match</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4 text-right">3-Way Match Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading Invoice Inbox & Reconciliation Queue...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Receipt className="w-8 h-8 opacity-30" />
                      <span className="text-sm font-medium">No invoices found in queue</span>
                      <span className="text-xs">Supplier invoices submitted via the Supplier Portal will appear here for review.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isMatched = inv.match_status === 'MATCHED' || inv.match_status === 'MANUAL_OVERRIDE';
                  const isPaid = inv.payment_status === 'PAID';
                  const isHold = inv.payment_status === 'ON_HOLD' || inv.match_status === 'MISMATCH';

                  return (
                    <tr key={inv.invoice_id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-blue-600 font-mono">
                        {inv.invoice_number}
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{inv.suppliers?.supplier_name || 'Vendor'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {inv.suppliers?.supplier_code || inv.supplier_id?.slice(0, 8)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {inv.purchase_orders?.po_number || 'N/A'}
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          Contract: ₹{Number(inv.purchase_orders?.total_amount || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {inv.shipments?.shipment_number || (inv.shipment_id ? `SHP-${inv.shipment_id.slice(0, 6)}` : 'Full Contract')}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                        ₹{Number(inv.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold border text-[10px] ${
                            inv.ocr_status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {inv.ocr_status || 'MANUAL'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={inv.match_status || 'PENDING'} size="sm" />
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={inv.payment_status || 'UNPAID'} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpen3WayMatch(inv)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer border inline-flex items-center gap-1.5 ${
                            isPaid
                              ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              : isMatched
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : isHold
                              ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Settled / Paid</span>
                            </>
                          ) : isMatched ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Matched ➔ Payout</span>
                            </>
                          ) : isHold ? (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Exception View</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                              <span>Run 3-Way Match</span>
                            </>
                          )}
                        </button>
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
      {/* 3-Way Match & Reconciliation Modal                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {openMatchModal && selectedInvoice && (
        <Modal
          isOpen={openMatchModal}
          onClose={() => setOpenMatchModal(false)}
          title="Automated 3-Way Match Reconciliation"
          subtitle={`Reconciling PO ↔ Dock GRN Intake ↔ Supplier Invoice #${selectedInvoice.invoice_number}`}
          maxWidth="2xl"
          footer={
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
              <button
                onClick={() => setOpenMatchModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer w-full sm:w-auto"
              >
                Close
              </button>

              <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                {/* 1-Click Payout (when Matched or Approved and not yet paid) */}
                {comp?.isFullyMatched && selectedInvoice.payment_status !== 'PAID' && !payoutCompletedTxRef && (
                  <div className="flex items-center gap-2">
                    <select
                      value={payoutPaymentMethod}
                      onChange={(e) => setPayoutPaymentMethod(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
                    >
                      <option value="NEFT">NEFT (Direct Bank)</option>
                      <option value="RTGS">RTGS (High Value)</option>
                      <option value="IMPS">IMPS (Instant)</option>
                      <option value="ACH">ACH Direct</option>
                      <option value="WIRE">Intl Wire</option>
                    </select>

                    <button
                      onClick={handleExecutePayoutDirect}
                      disabled={payoutProcessing}
                      className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>
                        {payoutProcessing
                          ? 'Settling Banking Rail...'
                          : `Execute ${payoutPaymentMethod} Payout (₹${Number(selectedInvoice.total_amount).toLocaleString()})`}
                      </span>
                    </button>
                  </div>
                )}

                {/* If Discrepancy / Unmatched */}
                {!comp?.isFullyMatched && selectedInvoice.payment_status !== 'PAID' && !payoutCompletedTxRef && (
                  <>
                    <button
                      onClick={() => {
                        setShowEscalateInput(!showEscalateInput);
                        setShowOverrideInput(false);
                      }}
                      className="px-3.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Escalate to PR Officer</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowOverrideInput(!showOverrideInput);
                        setShowEscalateInput(false);
                      }}
                      className="px-3.5 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                      <span>Finance Override & Resolve</span>
                    </button>
                  </>
                )}

                {/* If already Paid */}
                {(selectedInvoice.payment_status === 'PAID' || payoutCompletedTxRef) && (
                  <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                    <CheckCheck className="w-4 h-4 text-emerald-600" />
                    <span>Settled & Paid</span>
                  </div>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Loading Indicator */}
            {loadingMatchData && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5 text-blue-800">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                <span className="font-semibold">
                  Autofetching linked PO items, dock GRN intake manifests, and running algorithmic 3-way match...
                </span>
              </div>
            )}

            {/* Payout Success Receipt Banner */}
            {payoutCompletedTxRef && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 space-y-1 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Banking Settlement Disbursed Successfully!</span>
                </div>
                <p className="text-xs text-emerald-700">
                  Transaction Reference: <strong className="font-mono">{payoutCompletedTxRef}</strong> • Amount: ₹
                  {Number(selectedInvoice.total_amount).toLocaleString()} via {payoutPaymentMethod}.
                </p>
              </div>
            )}

            {/* Match Status Banner */}
            {comp && (
              <div
                className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                  comp.isFullyMatched
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {comp.isFullyMatched ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <span>
                        {comp.isFullyMatched
                          ? '3-Way Match Verification PASSED'
                          : '3-Way Match Discrepancy Detected — Payment on Hold'}
                      </span>
                      {comp.discrepancyType && (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                          {comp.discrepancyType}
                        </span>
                      )}
                    </h4>
                    <p className="text-xs opacity-90 mt-1">
                      {comp.isFullyMatched
                        ? 'Purchase Order contract rate, warehouse GRN accepted quantity, and invoiced total are 100% verified.'
                        : comp.mismatchDetails}
                    </p>
                    {comp.existingException && (
                      <div className="mt-2 text-[11px] font-mono font-bold text-rose-700 flex items-center gap-1.5">
                        <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                        <span>Tracked Exception Ticket: #{comp.existingException.exception_number} ({comp.existingException.status})</span>
                      </div>
                    )}
                  </div>
                </div>

                <StatusBadge status={comp.isFullyMatched ? 'MATCHED' : 'MISMATCH'} size="md" />
              </div>
            )}

            {/* 3 Pillars Comparison Grid (PO ↔ GRN ↔ Invoice) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Purchase Order */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">1. Purchase Order</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
                    {comp?.poNumber}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contract Qty:</span>
                    <strong className="font-mono text-slate-800">{comp?.poQty} Units</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contract Rate:</span>
                    <strong className="font-mono text-slate-800">₹{comp?.poUnitPrice}/unit</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Authorized:</span>
                    <strong className="font-mono text-blue-700">₹{comp?.poContractTotal?.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* 2. Goods Receipt Note (GRN) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">2. Warehouse Intake (GRN)</span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                      comp?.hasGrn ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {comp?.grnNumber}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dock Received:</span>
                    <strong className="font-mono text-slate-800">{comp?.grnReceivedQty} Units</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Damaged / Defect:</span>
                    <strong className={`font-mono ${comp?.grnDamagedQty ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                      {comp?.grnDamagedQty} Units
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Net Accepted:</span>
                    <strong className="font-mono text-emerald-700">{comp?.grnAcceptedQty} Units</strong>
                  </div>
                </div>
              </div>

              {/* 3. Supplier Invoice */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">3. Supplier Invoice</span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-[10px] font-bold">
                    {comp?.invNumber}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11px] pt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoiced Qty:</span>
                    <strong className="font-mono text-slate-800">{comp?.invQty} Units</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoiced Rate:</span>
                    <strong className={`font-mono ${comp?.priceVariance ? 'text-rose-600 font-bold' : 'text-slate-800'}`}>
                      ₹{comp?.invUnitPrice}/unit
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Billed:</span>
                    <strong className="font-mono text-purple-700">₹{comp?.invTotal?.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Reconciliation Comparison Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3.5">Reconciliation Factor</th>
                    <th className="py-2.5 px-3.5">Contract PO</th>
                    <th className="py-2.5 px-3.5">Dock GRN Accepted</th>
                    <th className="py-2.5 px-3.5">Supplier Billed</th>
                    <th className="py-2.5 px-3.5">Variance</th>
                    <th className="py-2.5 px-3.5 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  <tr>
                    <td className="py-2.5 px-3.5 font-bold text-slate-900">Unit Rate (Excl. Tax)</td>
                    <td className="py-2.5 px-3.5 font-mono">₹{comp?.poUnitPrice}</td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-400">—</td>
                    <td className="py-2.5 px-3.5 font-mono">₹{comp?.invUnitPrice}</td>
                    <td className="py-2.5 px-3.5 font-mono font-bold">
                      {comp?.priceVariance === 0 ? (
                        <span className="text-slate-500">₹0</span>
                      ) : (
                        <span className="text-rose-600">+₹{comp?.priceVariance}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      {comp?.isPriceMatched ? (
                        <span className="text-emerald-700 font-bold flex items-center justify-end gap-1">
                          <Check className="w-3.5 h-3.5" /> MATCH
                        </span>
                      ) : (
                        <span className="text-rose-700 font-bold flex items-center justify-end gap-1">
                          <XCircle className="w-3.5 h-3.5" /> MISMATCH
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 px-3.5 font-bold text-slate-900">Quantity Alignment</td>
                    <td className="py-2.5 px-3.5 font-mono">{comp?.poQty} Units</td>
                    <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-700">{comp?.grnAcceptedQty} Units</td>
                    <td className="py-2.5 px-3.5 font-mono">{comp?.invQty} Units</td>
                    <td className="py-2.5 px-3.5 font-mono font-bold">
                      {comp?.qtyVariance === 0 ? (
                        <span className="text-slate-500">0</span>
                      ) : (
                        <span className="text-rose-600">+{comp?.qtyVariance} Units</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      {comp?.isQtyMatched ? (
                        <span className="text-emerald-700 font-bold flex items-center justify-end gap-1">
                          <Check className="w-3.5 h-3.5" /> MATCH
                        </span>
                      ) : (
                        <span className="text-rose-700 font-bold flex items-center justify-end gap-1">
                          <XCircle className="w-3.5 h-3.5" /> OVER-BILLED
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="bg-slate-50/50 font-bold">
                    <td className="py-2.5 px-3.5 text-slate-900">Total Payable Amount</td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-500">₹{comp?.poContractTotal?.toLocaleString()}</td>
                    <td className="py-2.5 px-3.5 font-mono text-emerald-800">₹{comp?.expectedPayable?.toLocaleString()}</td>
                    <td className="py-2.5 px-3.5 font-mono text-purple-800">₹{comp?.invTotal?.toLocaleString()}</td>
                    <td className="py-2.5 px-3.5 font-mono">
                      {comp?.totalDiff === 0 ? (
                        <span className="text-slate-500">₹0</span>
                      ) : (
                        <span className="text-rose-600">+₹{comp?.totalDiff?.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      {comp?.isTotalMatched ? (
                        <span className="text-emerald-700 font-bold flex items-center justify-end gap-1">
                          <Check className="w-3.5 h-3.5" /> MATCH
                        </span>
                      ) : (
                        <span className="text-rose-700 font-bold flex items-center justify-end gap-1">
                          <XCircle className="w-3.5 h-3.5" /> VARIANCE
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Escalate to PR Officer Box */}
            {showEscalateInput && (
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 animate-in fade-in">
                <label className="font-bold text-amber-950 block text-xs">
                  Escalation Reason for Procurement Officer
                </label>
                <textarea
                  rows={2}
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  placeholder="e.g., Supplier billed unit rate of ₹275 instead of authorized PO contract rate of ₹250. Requesting contract amendment or credit note."
                  className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-xs"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowEscalateInput(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-amber-100 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEscalateToPrOfficer}
                    disabled={isSubmittingAction}
                    className="px-3.5 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAction ? 'Escalating...' : 'Confirm Escalation Ticket'}
                  </button>
                </div>
              </div>
            )}

            {/* Finance Override Box */}
            {showOverrideInput && (
              <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl space-y-2 animate-in fade-in">
                <label className="font-bold text-purple-950 block text-xs">
                  Finance Override & Resolution Justification
                </label>
                <textarea
                  rows={2}
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="e.g., Approved price adjustment per emergency freight surcharge authorization #FS-449."
                  className="w-full p-2.5 bg-white border border-purple-300 rounded-lg text-xs"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowOverrideInput(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-purple-100 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResolveException}
                    disabled={isSubmittingAction}
                    className="px-3.5 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingAction ? 'Approving Override...' : 'Approve Exception Override & Authorize Payout'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Invoices;
