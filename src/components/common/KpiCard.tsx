import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  icon?: LucideIcon;
  variant?: 'default' | 'critical' | 'warning' | 'success' | 'info' | 'error';
  onClick?: () => void;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subtext,
  trend,
  icon: Icon,
  variant = 'default',
  onClick,
  className = '',
}) => {
  let accentBorder = 'border-slate-200';
  let accentTop = '';

  if (variant === 'critical' || variant === 'error') {
    accentTop = 'before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-rose-500';
  } else if (variant === 'warning') {
    accentTop = 'before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-amber-500';
  } else if (variant === 'success') {
    accentTop = 'before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-emerald-500';
  } else if (variant === 'info') {
    accentTop = 'before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-blue-500';
  }

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl bg-white p-4.5 border ${accentBorder} ${accentTop} shadow-xs transition-all ${
        onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </span>
          <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </div>
        </div>
        {Icon && (
          <div className="rounded-lg bg-slate-50 p-2 text-slate-600 border border-slate-100">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(subtext || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 font-semibold ${
                trend.isNeutral
                  ? 'text-slate-600'
                  : trend.isPositive
                  ? 'text-emerald-600'
                  : 'text-rose-600'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {trend.value}
            </span>
          )}
          {subtext && <span className="text-slate-500">{subtext}</span>}
        </div>
      )}
    </div>
  );
};

export default KpiCard;
