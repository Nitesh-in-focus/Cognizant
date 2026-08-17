import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  FileText,
  CreditCard,
  Building2,
  Check,
  X,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { triggerExceptionResolvedNotification } from '../services/emailService';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

export const Exceptions: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar, addAlert, currentUser, logAuditAction } = useApp();

  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  // Realtime Live Sync across devices/users
  useRealtimeSubscription({
    tables: ['exceptions', 'purchase_orders', 'invoices', 'goods_receipts'],
    channelName: 'exceptions_page_realtime',
    callback: () => fetchExceptions(true),
  });

  // Resolution Modal State
  const [resolveTarget, setResolveTarget] = useState<any | null>(null);
  const [resolutionAction, setResolutionAction] = useState('DEBIT_NOTE');
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    fetchExceptions();
  }, [refreshKey]);

  const fetchExceptions = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const { data, error } = await supabase
        .from('exceptions')
        .select(`
          *,
          purchase_orders(po_id, po_number, total_amount, suppliers(supplier_name)),
          invoices(invoice_id, invoice_number, total_amount),
          goods_receipts(grn_id, grn_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExceptions(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveException = async () => {
    if (!resolveTarget) return;

    try {
      setIsSubmittingResolution(true);
      const actorName = currentUser?.full_name || 'Procurement Officer';
      const formattedDescription = `${resolveTarget.description} [SETTLED via ${resolutionAction} by ${actorName}: ${
        resolutionNote.trim() || 'Payment Hold Lifted'
      }]`;

      // 1. Mark Exception Record as RESOLVED
      const { error: excErr } = await supabase
        .from('exceptions')
        .update({
          status: 'RESOLVED',
          resolved_at: new Date().toISOString(),
          description: formattedDescription,
          updated_at: new Date().toISOString(),
        })
        .eq('exception_id', resolveTarget.exception_id);

      if (excErr) throw excErr;

      // 2. Lift Hold and Approve Linked Invoice(s) for Immediate Finance Payout
      const noteAppend = ` | [Exception #${resolveTarget.exception_number} Settled by ${actorName} via ${resolutionAction}]: ${
        resolutionNote.trim() || 'Approved for Payout'
      }`;

      if (resolveTarget.invoice_id) {
        await supabase
          .from('invoices')
          .update({
            match_status: 'MANUAL_OVERRIDE',
            payment_status: 'APPROVED_FOR_PAYMENT',
            updated_at: new Date().toISOString(),
          })
          .eq('invoice_id', resolveTarget.invoice_id);
      }

      // Also ensure any invoices on hold for this PO are updated
      if (resolveTarget.po_id) {
        await supabase
          .from('invoices')
          .update({
            match_status: 'MANUAL_OVERRIDE',
            payment_status: 'APPROVED_FOR_PAYMENT',
            updated_at: new Date().toISOString(),
          })
          .eq('po_id', resolveTarget.po_id)
          .in('payment_status', ['ON_HOLD', 'UNPAID']);
      }

      // 3. Log Audit Trail
      await logAuditAction('EXCEPTION_RESOLVED_BY_PR', 'exceptions', resolveTarget.exception_id, {
        exception_number: resolveTarget.exception_number,
        resolution_action: resolutionAction,
        resolution_note: resolutionNote,
        resolved_by: actorName,
      });

      // 4. Send Email Notification to Finance Controller
      await triggerExceptionResolvedNotification({
        exceptionId: resolveTarget.exception_number,
        invoiceId: resolveTarget.invoice_id,
        invoiceNumber: resolveTarget.invoices?.invoice_number,
        poNumber: resolveTarget.purchase_orders?.po_number,
        supplierName: resolveTarget.purchase_orders?.suppliers?.supplier_name,
        resolutionAction: resolutionAction,
        resolutionNote: resolutionNote,
        resolvedBy: actorName,
        amount: Number(resolveTarget.difference || 0),
      });

      // 5. Global Alert & Notification
      addAlert({
        title: `Exception Settled: ${resolveTarget.exception_number}`,
        message: `Discrepancy resolved via ${resolutionAction} by ${actorName}. Invoice released for Finance payout settlement.`,
        severity: 'success',
        link: '/payments',
      });

      showSnackbar(
        `Exception #${resolveTarget.exception_number} successfully settled! Invoice released to Finance for payout.`,
        'success'
      );

      setResolveTarget(null);
      setResolutionNote('');
      fetchExceptions();
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const filteredExceptions = exceptions.filter(
    (e) =>
      !searchQuery ||
      e.exception_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.exception_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.purchase_orders?.po_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header (Section 38) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            Exceptions Investigation Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Investigation workspace for price mismatches, quantity shortages, receiving damage, and automated dispute resolution.
          </p>
        </div>

        <button
          onClick={triggerRefresh}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          title="Refresh Exceptions"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exception ticket#, type, PO#..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Open Exceptions: <strong className="text-rose-600">{filteredExceptions.filter((e) => e.status === 'OPEN').length} active</strong>
        </div>
      </div>

      {/* Exception Investigation Workspace Cards (Section 38 & 39) */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading Exceptions...</div>
      ) : filteredExceptions.length === 0 ? (
        <div className="p-8 rounded-xl border border-slate-200 bg-white text-center shadow-xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-900">Zero Active Exceptions</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            All invoices, purchase orders, and goods receipts are perfectly matched within variance tolerances.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredExceptions.map((exc) => {
            const isResolved = exc.status === 'RESOLVED';
            const diff = Number(exc.difference || 0);

            return (
              <div
                key={exc.exception_id}
                className={`p-5 rounded-xl border transition-all bg-white shadow-xs flex flex-col justify-between ${
                  isResolved
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-rose-200 hover:border-rose-300'
                }`}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isResolved ? 'text-emerald-900' : 'text-rose-950'}`}>
                          {exc.exception_number}
                        </span>
                        <StatusBadge status={exc.severity || 'HIGH'} size="sm" />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Type: <strong className="text-slate-800">{exc.exception_type}</strong> • Vendor: {exc.purchase_orders?.suppliers?.supplier_name || 'Acme Corp'}
                      </div>
                    </div>
                    <StatusBadge status={exc.status} size="sm" />
                  </div>

                  {/* Problem Description */}
                  <p className="text-xs text-slate-700 leading-relaxed mb-4">
                    {exc.description}
                  </p>

                  {/* Mathematical Comparison Box (Section 38 & 63) */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs mb-4">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">Expected Value</span>
                      <span className="font-bold text-slate-900">
                        ₹{Number(exc.expected_value || 5000).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">Actual Billed</span>
                      <span className="font-bold text-slate-900">
                        ₹{Number(exc.actual_value || 5500).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-rose-500 block font-semibold">Discrepancy</span>
                      <span className="font-black text-rose-600">
                        +₹{diff.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Relational Evidence Links */}
                  <div className="flex flex-wrap gap-1.5 text-xs mb-4">
                    {exc.purchase_orders && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        PO: {exc.purchase_orders.po_number}
                      </span>
                    )}
                    {exc.invoices && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        INV: {exc.invoices.invoice_number}
                      </span>
                    )}
                    {exc.goods_receipts && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        GRN: {exc.goods_receipts.grn_number}
                      </span>
                    )}
                  </div>
                </div>

                {/* Resolution Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Logged: {new Date(exc.created_at).toLocaleDateString()}
                  </span>

                  {!isResolved ? (
                    <button
                      onClick={() => setResolveTarget(exc)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs"
                    >
                      Resolve Exception
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Resolved on {new Date(exc.resolved_at || Date.now()).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve Exception Modal */}
      <Modal
        isOpen={Boolean(resolveTarget)}
        onClose={() => setResolveTarget(null)}
        title="Resolve 3-Way Match Exception"
        subtitle={`Select business resolution mechanism for ${resolveTarget?.exception_number}`}
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setResolveTarget(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleResolveException}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs"
            >
              Apply Resolution & Lift Hold
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Authorize an official resolution for discrepancy of <strong>₹{resolveTarget?.difference || 500}</strong> on{' '}
            <strong>{resolveTarget?.exception_number}</strong>.
          </p>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Resolution Mechanism
            </label>
            <select
              value={resolutionAction}
              onChange={(e) => setResolutionAction(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              <option value="DEBIT_NOTE">
                📄 Issue Debit Note (Deduct ₹{resolveTarget?.difference || 500} from Vendor Settlement)
              </option>
              <option value="PRICE_ADJUSTMENT">
                ✍️ Authorize Price Variance Waiver (Accept billed invoice rate)
              </option>
              <option value="REQUEST_REVISED_INVOICE">
                🔄 Request Supplier Cancel & Re-issue Corrected Invoice
              </option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Approval Justification & Audit Trail Notes
            </label>
            <textarea
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Document reason for approval or debit note deduction..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Exceptions;
