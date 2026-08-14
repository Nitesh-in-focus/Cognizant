import React from 'react';
import { useApp, ToastMessage } from '../../contexts/AppContext';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast: ToastMessage) => {
        let Icon = Info;
        let borderStyle = 'border-blue-200 bg-white text-blue-900';
        let iconColor = 'text-blue-600';

        if (toast.severity === 'success') {
          Icon = CheckCircle2;
          borderStyle = 'border-emerald-200 bg-white text-emerald-900';
          iconColor = 'text-emerald-600';
        } else if (toast.severity === 'warning') {
          Icon = AlertTriangle;
          borderStyle = 'border-amber-200 bg-white text-amber-900';
          iconColor = 'text-amber-600';
        } else if (toast.severity === 'error') {
          Icon = XCircle;
          borderStyle = 'border-rose-200 bg-white text-rose-900';
          iconColor = 'text-rose-600';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg ${borderStyle} transition-all animate-in slide-in-from-bottom-5`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 text-xs font-medium leading-relaxed">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
