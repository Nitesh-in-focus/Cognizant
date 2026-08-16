import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Building2,
  Package,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Lock,
  FileText,
} from 'lucide-react';
import { verifyPoActionToken, executePoActionViaToken } from '../services/emailService';

export const PoActionLandingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const initialAction = (searchParams.get('action') || 'accept').toLowerCase();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [tokenData, setTokenData] = useState<any>(null);
  const [poData, setPoData] = useState<any>(null);
  const [supplierData, setSupplierData] = useState<any>(null);

  const [selectedAction, setSelectedAction] = useState<'ACCEPT' | 'REJECT'>(
    initialAction === 'reject' ? 'REJECT' : 'ACCEPT'
  );
  const [rejectionReason, setRejectionReason] = useState('Capacity constraint during requested delivery window');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [resultPoNumber, setResultPoNumber] = useState('');

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setValid(false);
      setErrorMessage('No authentication token provided in link URL.');
      return;
    }

    const checkToken = async () => {
      setLoading(true);
      const res = await verifyPoActionToken(token);
      setLoading(false);
      setValid(res.valid);
      setErrorMessage(res.error || '');
      setTokenData(res.tokenData);
      setPoData(res.poData);
      setSupplierData(res.supplierData);
    };

    checkToken();
  }, [token]);

  const handleExecute = async () => {
    if (!token) return;
    setSubmitting(true);
    const finalReason = selectedAction === 'REJECT' ? (customReason.trim() || rejectionReason) : undefined;
    const res = await executePoActionViaToken({
      token,
      action: selectedAction,
      rejectionReason: finalReason,
    });
    setSubmitting(false);

    if (res.success) {
      setCompleted(true);
      setResultPoNumber(res.poNumber || poData?.po_number || 'PO-2026');
    } else {
      setErrorMessage(res.error || 'Failed to record response.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans antialiased p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-600/30">
            S
          </div>
          <div>
            <div className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
              <span>SUPPLY SYNC</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                VENDOR ACTION PORTAL
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Secure One-Time Purchase Order Response</div>
          </div>
        </div>

        <Link
          to="/login"
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors font-semibold"
        >
          <span>Open Main App</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl w-full mx-auto my-8">
        {loading ? (
          <div className="p-12 text-center bg-slate-800/60 border border-slate-700/60 rounded-3xl backdrop-blur-md shadow-2xl">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-base font-bold text-white">Verifying Secure Email Action Token...</h2>
            <p className="text-xs text-slate-400 mt-1">Authenticating PO cryptographic signature with Supabase</p>
          </div>
        ) : completed ? (
          <div className="p-8 sm:p-10 text-center bg-slate-800/80 border border-slate-700 rounded-3xl shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              selectedAction === 'ACCEPT' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {selectedAction === 'ACCEPT' ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
            </div>

            <h2 className="text-2xl font-black text-white">
              {selectedAction === 'ACCEPT' ? 'Purchase Order Accepted!' : 'Purchase Order Rejection Recorded'}
            </h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto mt-2 leading-relaxed">
              {selectedAction === 'ACCEPT' ? (
                <>
                  Purchase Order <strong>#{resultPoNumber}</strong> status is updated to{' '}
                  <span className="font-mono text-emerald-400 font-bold">ACCEPTED_BY_SUPPLIER</span>.
                  An automated email confirmation has been dispatched to the responsible Procurement Officer.
                </>
              ) : (
                <>
                  Purchase Order <strong>#{resultPoNumber}</strong> has been marked as{' '}
                  <span className="font-mono text-rose-400 font-bold">REJECTED_BY_SUPPLIER</span>.
                  Procurement Officer has been alerted with your submitted reason.
                </>
              )}
            </p>

            <div className="mt-8 pt-6 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/supplier"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <span>Go to Supplier Portal</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : !valid ? (
          <div className="p-8 text-center bg-slate-800/80 border border-rose-500/30 rounded-3xl shadow-2xl backdrop-blur-md">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white">Action Link Unavailable</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
              {errorMessage || 'This token link has expired, already been executed, or is invalid.'}
            </p>

            {poData && (
              <div className="mt-6 p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 text-left text-xs space-y-1">
                <div className="text-[11px] text-slate-400">Target Purchase Order:</div>
                <div className="font-bold text-white text-sm">#{poData.po_number}</div>
                <div className="text-[11px] text-slate-400">Current PO Status: <strong className="text-blue-400">{poData.status}</strong></div>
              </div>
            )}

            <div className="mt-6">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors"
              >
                <span>Sign In to Supplier Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md">
            {/* Top Badge Banner */}
            <div className="p-6 bg-gradient-to-r from-blue-900/40 via-indigo-900/40 to-slate-900/60 border-b border-slate-700/60">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <span className="font-bold text-white text-sm">
                    {supplierData?.supplier_name || 'Vendor Partner'}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>ACTION REQUIRED</span>
                </span>
              </div>

              <h1 className="text-2xl font-black text-white tracking-tight mt-3">
                Purchase Order #{poData?.po_number}
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                Please review contractual order parameters and record your acceptance or rejection below.
              </p>
            </div>

            {/* PO Details Grid */}
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-700/60">
                <div>
                  <div className="text-slate-400 text-[11px]">Contract Value</div>
                  <div className="font-extrabold text-base text-emerald-400 mt-0.5">
                    ₹{Number(poData?.total_amount || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">Total Quantity</div>
                  <div className="font-bold text-white text-sm mt-0.5">
                    {Number(poData?.total_quantity || 0).toLocaleString()} units
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">Payment Terms</div>
                  <div className="font-bold text-blue-300 text-sm mt-0.5">
                    {poData?.payment_terms || 'NET_30'}
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">PO Date</div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {new Date(poData?.order_date || poData?.created_at || Date.now()).toLocaleDateString('en-IN')}
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">Target Delivery Date</div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {poData?.expected_delivery_date ? new Date(poData.expected_delivery_date).toLocaleDateString('en-IN') : 'Scheduled'}
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 text-[11px]">Destination Hub</div>
                  <div className="font-semibold text-slate-200 mt-0.5 truncate">
                    {poData?.warehouses?.warehouse_name || 'Central Distribution Center'}
                  </div>
                </div>
              </div>

              {/* Line Items List */}
              {poData?.po_items && poData.po_items.length > 0 && (
                <div>
                  <div className="font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-blue-400" />
                    <span>Contract Line Items ({poData.po_items.length})</span>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {poData.po_items.map((item: any, idx: number) => (
                      <div
                        key={item.item_id || idx}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {item.products?.product_name || item.item_name || 'Component Item'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            SKU: {item.products?.product_code || 'PRD-STD'} • {item.quantity} {item.products?.unit_of_measure || 'units'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">
                            ₹{Number(item.total_price || (item.quantity * item.unit_price) || 0).toLocaleString('en-IN')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            @ ₹{Number(item.unit_price || 0).toLocaleString('en-IN')}/unit
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Selection Radio */}
              <div className="pt-3 border-t border-slate-700/60">
                <label className="font-bold text-white block mb-2">Choose Response Action:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedAction('ACCEPT')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      selectedAction === 'ACCEPT'
                        ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-400'
                        : 'border-slate-700 bg-slate-900/40 hover:bg-slate-900/70'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      selectedAction === 'ACCEPT' ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-slate-600'
                    }`}>
                      {selectedAction === 'ACCEPT' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">Accept PO Contract</div>
                      <div className="text-[10px] text-emerald-400/90 mt-0.5">Confirm order & schedule dispatch</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAction('REJECT')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      selectedAction === 'REJECT'
                        ? 'border-rose-500 bg-rose-950/40 ring-1 ring-rose-400'
                        : 'border-slate-700 bg-slate-900/40 hover:bg-slate-900/70'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      selectedAction === 'REJECT' ? 'border-rose-400 bg-rose-500 text-white' : 'border-slate-600'
                    }`}>
                      {selectedAction === 'REJECT' && <XCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">Reject PO</div>
                      <div className="text-[10px] text-rose-400/90 mt-0.5">Decline with stated reason</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Rejection Reason Form */}
              {selectedAction === 'REJECT' && (
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2 animate-in fade-in">
                  <label className="font-bold text-rose-300 block text-xs">
                    Select Rejection Reason <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-rose-500/40 text-white text-xs font-medium focus:outline-hidden focus:border-rose-400"
                  >
                    <option value="Capacity constraint during requested delivery window">Capacity constraint during requested delivery window</option>
                    <option value="Raw material shortage for requested SKU">Raw material shortage for requested SKU</option>
                    <option value="Pricing / payment terms mismatch with contract">Pricing / payment terms mismatch with contract</option>
                    <option value="Delivery location unreachable within ETA">Delivery location unreachable within ETA</option>
                    <option value="Other">Other (Specify below)</option>
                  </select>

                  {rejectionReason === 'Other' && (
                    <input
                      type="text"
                      placeholder="Please specify rejection rationale..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs mt-2"
                    />
                  )}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Secure 256-Bit Verification</span>
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleExecute}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                    selectedAction === 'ACCEPT'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                  }`}
                >
                  <span>
                    {submitting
                      ? 'Recording Action...'
                      : selectedAction === 'ACCEPT'
                      ? 'Confirm & Accept PO'
                      : 'Confirm PO Rejection'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center py-4 border-t border-slate-800 text-[11px] text-slate-500">
        Supply Sync Enterprise Autonomous Procurement & Logistics Pipeline • Confidential
      </footer>
    </div>
  );
};
export default PoActionLandingPage;
