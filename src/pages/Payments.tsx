import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Building2,
  Receipt,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const Payments: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar, addAlert, canReleasePayment, logAuditAction } = useApp();

  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Execute Payment Modal
  const [openPayModal, setOpenPayModal] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('NEFT');

  useEffect(() => {
    fetchPaymentsData();
  }, [refreshKey]);

  const fetchPaymentsData = async () => {
    try {
      setLoading(true);
      const [
        { data: payData },
        { data: invData },
      ] = await Promise.all([
        supabase
          .from('payments')
          .select(`
            *,
            invoices(invoice_number, total_amount),
            suppliers(supplier_name, email, city)
          `)
          .order('payment_date', { ascending: false }),
        supabase
          .from('invoices')
          .select('*, suppliers(supplier_name)')
          .in('payment_status', ['PROCESSING', 'UNPAID', 'MANUAL_OVERRIDE']),
      ]);

      setPayments(payData || []);
      setInvoices(invData || []);
      if (invData?.length) {
        setSelectedInvoiceId(invData[0].invoice_id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecutePayment = async () => {
    if (!canReleasePayment()) {
      showSnackbar('Permission Denied: Only Financial Controllers can disburse payments.', 'error');
      return;
    }

    try {
      const inv = invoices.find((i) => i.invoice_id === selectedInvoiceId);
      if (!inv) return;

      const txRef = `${paymentMethod}-${Date.now().toString().slice(-8)}`;

      const { error: payErr } = await supabase.from('payments').insert([
        {
          invoice_id: inv.invoice_id,
          supplier_id: inv.supplier_id,
          payment_amount: inv.total_amount,
          payment_date: new Date().toISOString(),
          payment_method: paymentMethod,
          status: 'COMPLETED',
          transaction_reference: txRef,
        },
      ]);

      if (payErr) throw payErr;

      await supabase
        .from('invoices')
        .update({ payment_status: 'PAID' })
        .eq('invoice_id', inv.invoice_id);

      await logAuditAction('PAYMENT_DISBURSED', 'payments', inv.invoice_id, {
        transaction_reference: txRef,
        amount: inv.total_amount,
        payment_method: paymentMethod,
      });

      addAlert({
        title: `Payment Disbursed: ${txRef}`,
        message: `₹${Number(inv.total_amount).toLocaleString()} paid to ${inv.suppliers?.supplier_name} via ${paymentMethod}.`,
        severity: 'success',
        link: '/payments',
      });

      showSnackbar(`Payout of ₹${Number(inv.total_amount).toLocaleString()} confirmed (Txn: ${txRef})!`, 'success');
      setOpenPayModal(false);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const filteredPayments = payments.filter(
    (p) =>
      !searchQuery ||
      p.transaction_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.suppliers?.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.invoices?.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header (Section 40) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Payment Disbursements & Banking Settlement
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vendor payout execution, automated bank NEFT/RTGS gateway transmissions, and financial audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Settlements"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOpenPayModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Execute Payout</span>
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
            placeholder="Search txn ref, vendor payee, invoice#..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Settled Transactions: <strong className="text-slate-900">{filteredPayments.length}</strong>
        </div>
      </div>

      {/* Settlements Table (Section 24, 25, 40) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Transaction Reference</th>
                <th className="py-3 px-4">Supplier Payee</th>
                <th className="py-3 px-4">Settled Invoice #</th>
                <th className="py-3 px-4">Amount Disbursed</th>
                <th className="py-3 px-4">Payment Rail</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading Settlements...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-75" />
                    <span className="font-bold text-slate-700 block text-sm">No Payment Disbursements yet</span>
                    <span className="text-xs text-slate-500 mt-0.5 block">Approved and 3-way matched invoices will appear here for commercial settlement.</span>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.payment_id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      {p.transaction_reference || p.payment_id.slice(0, 12)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {p.suppliers?.supplier_name || 'Acme Corp'}
                      </div>
                      <div className="text-[11px] text-slate-400">{p.suppliers?.city}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {p.invoices?.invoice_number || 'INV-2026-001'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ₹{Number(p.payment_amount || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                        {p.payment_method || 'NEFT'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={p.status || 'COMPLETED'} size="sm" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execute Payout Modal */}
      <Modal
        isOpen={openPayModal}
        onClose={() => setOpenPayModal(false)}
        title="Execute Vendor Payout Disbursement"
        subtitle="Authorize bank gateway transmission for 3-way matched & approved invoices"
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setOpenPayModal(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExecutePayment}
              disabled={invoices.length === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              Authorize Payout
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {invoices.length === 0 ? (
            <p className="text-slate-500 py-4 text-center">
              No approved invoices are currently awaiting payment in the queue.
            </p>
          ) : (
            <>
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Select Matched Invoice to Settle
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                >
                  {invoices.map((i) => (
                    <option key={i.invoice_id} value={i.invoice_id}>
                      {i.invoice_number} - {i.suppliers?.supplier_name} (₹{Number(i.total_amount).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Settlement Banking Rail
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                >
                  <option value="NEFT">National Electronic Funds Transfer (NEFT)</option>
                  <option value="RTGS">Real Time Gross Settlement (RTGS)</option>
                  <option value="ACH">Automated Clearing House (ACH Direct)</option>
                  <option value="WIRE">International Wire Transfer</option>
                </select>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Payments;
