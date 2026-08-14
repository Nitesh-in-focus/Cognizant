import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Truck,
  ArrowRight,
  ShieldCheck,
  Ban,
  Radio,
} from 'lucide-react';

export type StatusVariant = 
  | 'APPROVED'
  | 'COMPLETED'
  | 'CONFIRMED'
  | 'PAID'
  | 'MATCHED'
  | 'AVAILABLE'
  | 'ON_TIME'
  | 'ACCEPTED'
  | 'PENDING'
  | 'WAITING'
  | 'PROCESSING'
  | 'IN_TRANSIT'
  | 'AT_DOCK'
  | 'UNLOADING'
  | 'DISPATCHED'
  | 'DELAYED'
  | 'MISMATCH'
  | 'ON_HOLD'
  | 'REJECTED'
  | 'CRITICAL'
  | 'OPEN'
  | 'HIGH'
  | 'URGENT'
  | 'MEDIUM'
  | 'LOW'
  | 'RESOLVED'
  | 'ACTIVE'
  | 'ARRIVED'
  | string;

interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  className = '',
}) => {
  const normalized = (status || '').toUpperCase().trim();
  const displayLabel = label || status?.replace(/_/g, ' ') || 'UNKNOWN';

  // Semantic styles adhering to Section 5 & Section 26
  let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
  let IconComponent = Clock;

  if (['APPROVED', 'COMPLETED', 'CONFIRMED', 'PAID', 'MATCHED', 'AVAILABLE', 'ON_TIME', 'ACCEPTED', 'RESOLVED', 'ACTIVE'].includes(normalized)) {
    colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    IconComponent = CheckCircle2;
  } else if (['PENDING', 'WAITING', 'PROCESSING', 'MEDIUM', 'AT_DOCK', 'UNLOADING', 'SLIGHT_DELAY'].includes(normalized)) {
    colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    IconComponent = Clock;
  } else if (['IN_TRANSIT', 'DISPATCHED', 'ARRIVED', 'ARRIVED_AT_GATE', 'INFO', 'LOW'].includes(normalized)) {
    colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
    IconComponent = normalized === 'IN_TRANSIT' ? Truck : Radio;
  } else if (['DELAYED', 'MISMATCH', 'ON_HOLD', 'REJECTED', 'CRITICAL', 'HIGH', 'URGENT', 'FAILED', 'OPEN'].includes(normalized)) {
    colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
    IconComponent = normalized === 'REJECTED' ? Ban : AlertTriangle;
  }

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs font-medium' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border ${sizeClass} ${colorClass} ${className}`}
    >
      <IconComponent className="w-3.5 h-3.5 shrink-0" />
      <span className="capitalize">{displayLabel.toLowerCase()}</span>
    </span>
  );
};

export default StatusBadge;
