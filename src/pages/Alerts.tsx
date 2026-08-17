import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Trash2,
  Filter,
  Check,
  ArrowRight,
  ExternalLink,
  Mail,
  RefreshCw,
  Clock,
  Send,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { supabase } from '../lib/supabase';
import { EMAILJS_CONFIG, testEmailJsConnection } from '../services/emailService';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

export const Alerts: React.FC = () => {
  const navigate = useNavigate();
  const {
    notifications,
    markAlertAsRead,
    markAllAlertsAsRead,
    showSnackbar,
    refreshKey,
  } = useApp();

  const [mainTab, setMainTab] = useState<'alerts' | 'emails'>('alerts');
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('ALL');

  // Realtime Live Sync across devices/users
  useRealtimeSubscription({
    tables: ['email_notifications', 'exceptions'],
    channelName: 'alerts_page_realtime',
    callback: () => fetchEmailLogs(true),
  });

  // EmailJS Diagnostic Tool State (Phases 1 & 19)
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('Test Recipient');
  const [sendingTest, setSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  React.useEffect(() => {
    if (mainTab === 'emails') {
      fetchEmailLogs();
    }
  }, [mainTab, refreshKey]);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) {
      showSnackbar('Please specify a valid test email address.', 'error');
      return;
    }

    try {
      setSendingTest(true);
      setTestStatus(null);
      const res = await testEmailJsConnection(testEmail.trim(), testName.trim() || 'Supply Sync Tester');

      if (res.success) {
        setTestStatus({
          success: true,
          message: `Test email successfully transmitted to ${testEmail.trim()} via EmailJS!`,
        });
        showSnackbar(`Test email sent to ${testEmail.trim()}!`, 'success');
        fetchEmailLogs();
      } else {
        setTestStatus({
          success: false,
          error: res.error || 'EmailJS rejected test dispatch.',
        });
        showSnackbar(`EmailJS Test Failed: ${res.error}`, 'error');
        fetchEmailLogs();
      }
    } catch (err: any) {
      setTestStatus({
        success: false,
        error: err.message || 'Unexpected test dispatch error.',
      });
      showSnackbar('Test failed: ' + err.message, 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const fetchEmailLogs = async (isBackground = false) => {
    try {
      if (!isBackground) setLoadingEmails(true);
      const { data, error } = await supabase
        .from('email_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (err: any) {
      console.warn('Failed to fetch email logs:', err);
    } finally {
      setLoadingEmails(false);
    }
  };

  const filteredAlerts = notifications.filter(
    (n) => severityFilter === 'ALL' || n.severity === severityFilter
  );

  const criticalCount = notifications.filter((n) => n.severity === 'error').length;
  const warningCount = notifications.filter((n) => n.severity === 'warning').length;
  const infoCount = notifications.filter((n) => n.severity === 'info').length;
  const successCount = notifications.filter((n) => n.severity === 'success').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header (Section 44) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            Supply Chain Operations Alert Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active exception alerts, delay telemetry warnings, yard congestion notices, and financial hold audit streams.
          </p>
        </div>

        <button
          onClick={() => {
            markAllAlertsAsRead();
            showSnackbar('All alerts marked as read', 'info');
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-xs"
        >
          <Check className="w-4 h-4 text-blue-600" />
          <span>Mark All as Read</span>
        </button>
      </div>

      {/* Main Tabs (Operational Alerts vs EmailJS Dispatch Stream) */}
      <div className="flex border-b border-slate-200 space-x-2 text-xs font-bold text-slate-600">
        <button
          onClick={() => setMainTab('alerts')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            mainTab === 'alerts'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Operational Event Stream</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[10px]">{notifications.length}</span>
        </button>

        <button
          onClick={() => setMainTab('emails')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 cursor-pointer transition-all ${
            mainTab === 'emails'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>EmailJS Notification Logs (Updates 12)</span>
          <span className="px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
            {EMAILJS_CONFIG.isConfigured() ? 'LIVE EMAILJS' : 'DB LOGS READY'}
          </span>
        </button>
      </div>

      {mainTab === 'alerts' ? (
        <>
          {/* Severity Breakdown Bar (Section 21 & 44) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div
              onClick={() => setSeverityFilter(severityFilter === 'error' ? 'ALL' : 'error')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                severityFilter === 'error'
                  ? 'border-rose-500 bg-rose-50/75 ring-2 ring-rose-200'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  Critical
                </span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-950 mt-1">{criticalCount}</div>
              <span className="text-[11px] text-slate-500">Immediate action</span>
            </div>

            <div
              onClick={() => setSeverityFilter(severityFilter === 'warning' ? 'ALL' : 'warning')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                severityFilter === 'warning'
                  ? 'border-amber-500 bg-amber-50/75 ring-2 ring-amber-200'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Warning
                </span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-950 mt-1">{warningCount}</div>
              <span className="text-[11px] text-slate-500">Delays & capacity</span>
            </div>

            <div
              onClick={() => setSeverityFilter(severityFilter === 'info' ? 'ALL' : 'info')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                severityFilter === 'info'
                  ? 'border-blue-500 bg-blue-50/75 ring-2 ring-blue-200'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Info
                </span>
                <Info className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-950 mt-1">{infoCount}</div>
              <span className="text-[11px] text-slate-500">Operational updates</span>
            </div>

            <div
              onClick={() => setSeverityFilter(severityFilter === 'success' ? 'ALL' : 'success')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                severityFilter === 'success'
                  ? 'border-emerald-500 bg-emerald-50/75 ring-2 ring-emerald-200'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  Success
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-950 mt-1">{successCount}</div>
              <span className="text-[11px] text-slate-500">Completed payouts</span>
            </div>
          </div>

          {/* Alert Feed List (Section 44) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900">
                Active Event Log Stream ({filteredAlerts.length} items)
              </div>
              {severityFilter !== 'ALL' && (
                <button
                  onClick={() => setSeverityFilter('ALL')}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Reset filter
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {filteredAlerts.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No alerts found for selected severity filter.
                </div>
              ) : (
                filteredAlerts.map((n) => {
                  let Icon = Info;
                  let iconClass = 'text-blue-600';
                  if (n.severity === 'error') {
                    Icon = XCircle;
                    iconClass = 'text-rose-600';
                  } else if (n.severity === 'warning') {
                    Icon = AlertTriangle;
                    iconClass = 'text-amber-600';
                  } else if (n.severity === 'success') {
                    Icon = CheckCircle2;
                    iconClass = 'text-emerald-600';
                  }

                  return (
                    <div
                      key={n.id}
                      className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                        n.read ? 'bg-white hover:bg-slate-50/75' : 'bg-blue-50/35 hover:bg-blue-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconClass}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{n.title}</span>
                            {!n.read && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded">
                                UNREAD
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1.5 block">{n.timestamp}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!n.read && (
                          <button
                            onClick={() => markAlertAsRead(n.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                          >
                            Acknowledge
                          </button>
                        )}
                        {n.link && (
                          <button
                            onClick={() => {
                              markAlertAsRead(n.id);
                              if (typeof n.link === 'string') navigate(n.link);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors flex items-center gap-1"
                          >
                            <span>Investigate</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : (
        /* EmailJS Notification Dispatch Logs View (Phases 1, 17, 19) */
        <div className="space-y-4">
          {/* Diagnostic Test Box */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-blue-600" />
                  <span>EmailJS Live Diagnostic Tester (Phase 1 & 19)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Test your connected EmailJS service and verify template parameter delivery with real-time feedback.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  EMAILJS_CONFIG.isConfigured() ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {EMAILJS_CONFIG.isConfigured() ? 'CONFIGURED IN .ENV' : 'MISSING .ENV KEYS'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSendTestEmail} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Target Test Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. your-email@gmail.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Recipient Name</label>
                <input
                  type="text"
                  placeholder="Recipient Name"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={sendingTest || !testEmail.trim()}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${sendingTest ? 'animate-spin' : ''}`} />
                  <span>{sendingTest ? 'Sending via EmailJS...' : 'Send Live Test'}</span>
                </button>
              </div>
            </form>

            {testStatus && (
              <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                testStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {testStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testStatus.message || testStatus.error}</span>
              </div>
            )}
          </div>

          {/* Email Logs Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>Supabase Email Dispatch History (email_notifications)</span>
                </div>
                <span className="text-xs text-slate-500">
                  Non-destructive audit trail of all automated EmailJS events dispatched to PR Officers and Suppliers.
                </span>
              </div>

              <button
                onClick={fetchEmailLogs}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                title="Refresh Email Logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingEmails ? 'animate-spin' : ''}`} />
              </button>
            </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase text-[11px]">
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Recipient Name & Email</th>
                  <th className="py-3 px-4">Entity Ref</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Template ID</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loadingEmails ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Loading email dispatch logs...
                    </td>
                  </tr>
                ) : emailLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                      <span className="font-bold text-slate-700 block text-xs">No email dispatches recorded yet</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Dispatches will appear here automatically when PR Officers click "Send to Supplier", Suppliers accept/dispatch, or Finance raises exceptions.
                      </span>
                    </td>
                  </tr>
                ) : (
                  emailLogs.map((log) => (
                    <tr key={log.notification_id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono text-[11px]">
                        {log.event_type}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{log.recipient_name || 'Recipient'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{log.recipient_email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {log.po_id ? `PO: ${log.po_id.slice(0, 8)}...` : log.shipment_id ? `SHP: ${log.shipment_id.slice(0, 8)}...` : log.invoice_id ? `INV: ${log.invoice_id.slice(0, 8)}...` : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : log.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                        {log.emailjs_template_id || 'DEFAULT'}
                      </td>
                      <td className="py-3 px-4 text-right text-[11px] text-slate-400">
                        {new Date(log.created_at || log.sent_at).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default Alerts;
