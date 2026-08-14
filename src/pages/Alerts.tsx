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
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export const Alerts: React.FC = () => {
  const navigate = useNavigate();
  const {
    notifications,
    markAlertAsRead,
    markAllAlertsAsRead,
    showSnackbar,
  } = useApp();

  const [severityFilter, setSeverityFilter] = useState('ALL');

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
              let borderClass = 'border-l-4 border-l-blue-500';
              let iconClass = 'text-blue-600';
              let bgClass = !n.read ? 'bg-blue-50/20' : 'bg-white';

              if (n.severity === 'error') {
                Icon = XCircle;
                borderClass = 'border-l-4 border-l-rose-500';
                iconClass = 'text-rose-600';
                if (!n.read) bgClass = 'bg-rose-50/20';
              } else if (n.severity === 'warning') {
                Icon = AlertTriangle;
                borderClass = 'border-l-4 border-l-amber-500';
                iconClass = 'text-amber-600';
                if (!n.read) bgClass = 'bg-amber-50/20';
              } else if (n.severity === 'success') {
                Icon = CheckCircle2;
                borderClass = 'border-l-4 border-l-emerald-500';
                iconClass = 'text-emerald-600';
              }

              return (
                <div
                  key={n.id}
                  className={`p-4 flex items-start justify-between gap-4 transition-colors hover:bg-slate-50/75 ${borderClass} ${bgClass}`}
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
    </div>
  );
};

export default Alerts;
