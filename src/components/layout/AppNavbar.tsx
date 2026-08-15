import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  PlayCircle,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Shield,
  ChevronDown,
  User,
  GitFork,
  ExternalLink,
  LogOut,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { useApp, UserRole } from '../../contexts/AppContext';

interface AppNavbarProps {
  onOpenScenarioRunner: () => void;
  onOpenSearch: () => void;
  onOpenGuide: () => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({
  onOpenScenarioRunner,
  onOpenSearch,
  onOpenGuide,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentUser,
    role,
    setRole,
    logout,
    notifications,
    unreadAlertsCount,
    markAllAlertsAsRead,
    markAlertAsRead,
  } = useApp();

  const [openNotifications, setOpenNotifications] = useState(false);
  const [openRoleMenu, setOpenRoleMenu] = useState(false);

  // Compute breadcrumbs adhering to Section 13 & 58
  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbName =
    pathParts.length === 0
      ? 'Dashboard'
      : pathParts[0]
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

  const roleLabels: Partial<Record<UserRole, { label: string; badge: string }>> = {
    SYSTEM_ADMIN: { label: 'System Administration', badge: 'Sys Admin' },
    ADMIN: { label: 'System Administration', badge: 'Sys Admin' },
    WORKER: { label: 'Shop Floor & Assembly', badge: 'Worker' },
    PROCUREMENT_OFFICER: { label: 'Strategic Sourcing', badge: 'Procurement' },
    PROCUREMENT_MANAGER: { label: 'Strategic Sourcing', badge: 'Procurement' },
    SUPPLIER: { label: 'Tata Industrial Solutions', badge: 'Supplier' },
    TRUCK_DRIVER: { label: 'Carrier Fleet Driver', badge: 'Driver' },
    LOGISTICS_GATE_POST: { label: 'Inbound Logistics & Gate Post', badge: 'Logistics & Gate' },
    LOGISTICS: { label: 'Inbound Logistics & Gate Post', badge: 'Logistics & Gate' },
    LOGISTICS_MANAGER: { label: 'Inbound Logistics & Gate Post', badge: 'Logistics & Gate' },
    GATE_POST_OFFICER: { label: 'Inbound Logistics & Gate Post', badge: 'Logistics & Gate' },
    GATE_OPERATOR: { label: 'Inbound Logistics & Gate Post', badge: 'Logistics & Gate' },
    RECEIVING_QC: { label: 'Receiving + QC Lead', badge: 'Receiving + QC' },
    RECEIVING_QC_OPERATOR: { label: 'Receiving + QC Lead', badge: 'Receiving + QC' },
    RECEIVING_OPERATOR: { label: 'Receiving + QC Lead', badge: 'Receiving + QC' },
    FINANCE: { label: 'Financial Controller', badge: 'Finance' },
    FINANCE_MANAGER: { label: 'Financial Controller', badge: 'Finance' },
    WAREHOUSE_MANAGER: { label: 'Receiving + QC Lead', badge: 'Receiving + QC' },
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400">Supply Sync</span>
        <span className="text-xs text-slate-300">/</span>
        <span className="text-sm font-bold text-slate-900">{breadcrumbName}</span>
      </div>

      {/* Center: Global Command Search Bar */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-all text-xs"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search PO, shipment, truck, invoice, supplier...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 rounded text-slate-400">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* System User Guide Button */}
        <button
          onClick={onOpenGuide}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-xs font-semibold transition-colors"
          title="Learn How to Use Supply Sync"
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-600" />
          <span>System Guide</span>
        </button>

        {/* Traceability Matrix Quick Action */}
        <button
          onClick={() => navigate('/traceability')}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition-colors"
        >
          <GitFork className="w-3.5 h-3.5" />
          <span>Traceability</span>
        </button>

        {/* Live System Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>LIVE PIPELINE</span>
        </div>

        {/* Unread Alerts Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenNotifications(!openNotifications)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors relative"
            aria-label="Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>

          {openNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <div className="font-bold text-xs text-slate-900">
                  Operational Alerts ({unreadAlertsCount} unread)
                </div>
                {unreadAlertsCount > 0 && (
                  <button
                    onClick={markAllAlertsAsRead}
                    className="text-[11px] font-semibold text-blue-600 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    No active notifications
                  </div>
                ) : (
                  notifications.slice(0, 5).map((n) => {
                    let Icon = Info;
                    let iconColor = 'text-blue-600';
                    if (n.severity === 'error') {
                      Icon = XCircle;
                      iconColor = 'text-rose-600';
                    } else if (n.severity === 'warning') {
                      Icon = AlertTriangle;
                      iconColor = 'text-amber-600';
                    } else if (n.severity === 'success') {
                      Icon = CheckCircle2;
                      iconColor = 'text-emerald-600';
                    }

                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          markAlertAsRead(n.id);
                          if (n.link) {
                            navigate(n.link);
                            setOpenNotifications(false);
                          }
                        }}
                        className={`p-3 flex items-start gap-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                          !n.read ? 'bg-blue-50/25' : ''
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {n.title}
                          </div>
                          <div className="text-slate-500 text-[11px] leading-tight mt-0.5 line-clamp-2">
                            {n.message}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {n.timestamp}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-4 py-2 border-t border-slate-100 text-center">
                <button
                  onClick={() => {
                    navigate('/alerts');
                    setOpenNotifications(false);
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <span>Open Full Alert Center</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Persona Role & User Profile Selector */}
        <div className="relative border-l border-slate-200 pl-2.5">
          <button
            onClick={() => setOpenRoleMenu(!openRoleMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {currentUser?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="hidden lg:block text-xs leading-none">
              <div className="font-bold text-slate-900">
                {currentUser?.full_name || 'Active User'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {roleLabels[role]?.badge || 'User'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {openRoleMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3.5 py-2.5 border-b border-slate-100">
                <div className="font-bold text-xs text-slate-900">{currentUser?.full_name}</div>
                <div className="text-[11px] text-slate-500 truncate">{currentUser?.email}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {roleLabels[role]?.badge || role}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium truncate">
                    {currentUser?.department}
                  </span>
                </div>
                {(currentUser as any)?.driver_code && (
                  <div className="text-[10px] text-cyan-600 font-semibold mt-1">
                    Driver ID: {(currentUser as any).driver_code}
                  </div>
                )}
                {(currentUser as any)?.supplier_id && (
                  <div className="text-[10px] text-orange-600 font-semibold mt-1">
                    Supplier ID: {(currentUser as any).supplier_id}
                  </div>
                )}
              </div>

              <div className="pt-1.5 px-2">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out / Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppNavbar;
