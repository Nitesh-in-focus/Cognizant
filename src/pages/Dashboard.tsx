import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layers,
  LayoutDashboard,
  BarChart3,
  GitFork,
  Radio,
  FileText,
  DollarSign,
  ShieldCheck,
  Boxes,
  Truck,
  Building2,
  Receipt,
  Sparkles,
  User,
  Activity,
  ArrowRight,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useApp, UserRole } from '../contexts/AppContext';
import { ProcurementIntelligenceDashboard } from '../components/analytics/ProcurementIntelligenceDashboard';
import { FinanceIntelligenceDashboard } from '../components/analytics/FinanceIntelligenceDashboard';
import { WorkerIntelligenceDashboard } from '../components/analytics/WorkerIntelligenceDashboard';
import { SupplierIntelligenceDashboard } from '../components/analytics/SupplierIntelligenceDashboard';
import { LogisticsIntelligenceDashboard } from '../components/analytics/LogisticsIntelligenceDashboard';
import { ReceivingQcIntelligenceDashboard } from '../components/analytics/ReceivingQcIntelligenceDashboard';
import { TruckTrackingMap } from '../components/maps/TruckTrackingMap';
import { DriverPortal } from './driver/DriverPortal';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  onOpenGuide?: () => void;
  defaultTab?: 'procurement' | 'cross_role' | 'control_tower' | 'analytics';
  defaultRoleView?: UserRole;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenGuide,
  defaultTab,
  defaultRoleView,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, role, refreshKey, triggerRefresh } = useApp();

  // Determine active tab & role perspective
  const effectiveRole = defaultRoleView || role;

  const [activeTab, setActiveTab] = useState<'procurement' | 'cross_role' | 'control_tower'>(
    defaultTab === 'control_tower'
      ? 'control_tower'
      : defaultTab === 'cross_role'
      ? 'cross_role'
      : 'procurement'
  );

  const [selectedRoleView, setSelectedRoleView] = useState<UserRole>(effectiveRole);

  useEffect(() => {
    if (defaultRoleView) {
      setSelectedRoleView(defaultRoleView);
    } else {
      setSelectedRoleView(role);
    }
  }, [defaultRoleView, role]);

  // If logged in as specific single-function persona and viewing main root / dashboard:
  const isDedicatedRole =
    !['SYSTEM_ADMIN', 'ADMIN', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'].includes(role);

  // If user is a dedicated role and not switching views in admin mode:
  if (isDedicatedRole && !defaultRoleView) {
    switch (role as string) {
      case 'WORKER':
        return <WorkerIntelligenceDashboard />;
      case 'FINANCE':
      case 'FINANCE_MANAGER':
        return <FinanceIntelligenceDashboard />;
      case 'SUPPLIER':
        return <SupplierIntelligenceDashboard />;
      case 'LOGISTICS_GATE_POST':
      case 'GATE_POST_OFFICER':
      case 'GATE_OPERATOR':
      case 'LOGISTICS':
        return <LogisticsIntelligenceDashboard />;
      case 'RECEIVING_QC':
      case 'RECEIVING_QC_OPERATOR':
      case 'RECEIVING_OPERATOR':
        return <ReceivingQcIntelligenceDashboard />;
      case 'TRUCK_DRIVER':
      case 'DRIVER':
        return <DriverPortal />;
      default:
        return <ProcurementIntelligenceDashboard />;
    }
  }

  // If navigated directly to a role-specific dashboard route (/finance/dashboard, /worker/dashboard, etc.)
  if (defaultRoleView) {
    switch (defaultRoleView as string) {
      case 'FINANCE':
      case 'FINANCE_MANAGER':
        return <FinanceIntelligenceDashboard />;
      case 'WORKER':
        return <WorkerIntelligenceDashboard />;
      case 'SUPPLIER':
        return <SupplierIntelligenceDashboard />;
      case 'LOGISTICS_GATE_POST':
      case 'GATE_POST_OFFICER':
      case 'GATE_OPERATOR':
      case 'LOGISTICS':
        return <LogisticsIntelligenceDashboard />;
      case 'RECEIVING_QC':
      case 'RECEIVING_QC_OPERATOR':
      case 'RECEIVING_OPERATOR':
        return <ReceivingQcIntelligenceDashboard />;
      case 'TRUCK_DRIVER':
      case 'DRIVER':
        return <DriverPortal />;
      case 'PROCUREMENT_OFFICER':
      case 'PROCUREMENT_MANAGER':
      case 'SYSTEM_ADMIN':
      case 'ADMIN':
      default:
        return <ProcurementIntelligenceDashboard />;
    }
  }

  // Executive / Procurement Officer / Admin View with Interactive Navigation
  return (
    <div className="space-y-6">
      {/* Tab Bar Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1">
          <button
            onClick={() => setActiveTab('procurement')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'procurement'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Procurement Intelligence</span>
            <span className="px-1.5 py-0.2 bg-blue-500/30 text-white text-[9px] font-black rounded">
              PRIMARY
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cross_role')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'cross_role'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Role Dashboards</span>
          </button>

          <button
            onClick={() => setActiveTab('control_tower')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'control_tower'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Highway Fleet Control Tower</span>
          </button>
        </div>

        {/* Right Role Badge */}
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-slate-500 font-medium">
          <span className="text-[11px] text-slate-400">Authenticated:</span>
          <strong className="text-slate-800 font-semibold">{currentUser?.full_name || 'Officer'}</strong>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {role.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* TAB 1: Primary Procurement Intelligence Dashboard */}
      {activeTab === 'procurement' && <ProcurementIntelligenceDashboard />}

      {/* TAB 2: Cross-Functional Role Analytics Explorer */}
      {activeTab === 'cross_role' && (
        <div className="space-y-6">
          {/* Role Persona Selector Strip */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">
              Select Role Intelligence View
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <button
                onClick={() => setSelectedRoleView('PROCUREMENT_OFFICER')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedRoleView === 'PROCUREMENT_OFFICER'
                    ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="text-[10px] font-bold uppercase text-slate-400">Strategic Sourcing</div>
                <div className="text-xs font-black mt-0.5">Procurement</div>
              </button>

              <button
                onClick={() => setSelectedRoleView('FINANCE')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedRoleView === 'FINANCE'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="text-[10px] font-bold uppercase text-slate-400">Accounts Payable</div>
                <div className="text-xs font-black mt-0.5">Finance & 3-Way</div>
              </button>

              <button
                onClick={() => setSelectedRoleView('LOGISTICS_GATE_POST')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedRoleView === 'LOGISTICS_GATE_POST'
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-900 shadow-xs ring-2 ring-cyan-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="text-[10px] font-bold uppercase text-slate-400">Yard & Docks</div>
                <div className="text-xs font-black mt-0.5">Logistics & Gate</div>
              </button>

              <button
                onClick={() => setSelectedRoleView('RECEIVING_QC')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedRoleView === 'RECEIVING_QC'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="text-[10px] font-bold uppercase text-slate-400">QA Inspection</div>
                <div className="text-xs font-black mt-0.5">Receiving & QC</div>
              </button>

              <button
                onClick={() => setSelectedRoleView('WORKER')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedRoleView === 'WORKER'
                    ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs ring-2 ring-amber-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="text-[10px] font-bold uppercase text-slate-400">Shop Floor</div>
                <div className="text-xs font-black mt-0.5">Worker PRs</div>
              </button>

              <button
                onClick={() => setSelectedRoleView('SUPPLIER')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedRoleView === 'SUPPLIER'
                    ? 'bg-teal-50 border-teal-300 text-teal-900 shadow-xs ring-2 ring-teal-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="text-[10px] font-bold uppercase text-slate-400">Vendor Partner</div>
                <div className="text-xs font-black mt-0.5">Supplier Portal</div>
              </button>
            </div>
          </div>

          {/* Render selected view */}
          {selectedRoleView === 'FINANCE' && <FinanceIntelligenceDashboard />}
          {selectedRoleView === 'LOGISTICS_GATE_POST' && <LogisticsIntelligenceDashboard />}
          {selectedRoleView === 'RECEIVING_QC' && <ReceivingQcIntelligenceDashboard />}
          {selectedRoleView === 'WORKER' && <WorkerIntelligenceDashboard />}
          {selectedRoleView === 'SUPPLIER' && <SupplierIntelligenceDashboard />}
          {selectedRoleView === 'PROCUREMENT_OFFICER' && <ProcurementIntelligenceDashboard />}
        </div>
      )}

      {/* TAB 3: Highway Fleet Telematics Control Tower */}
      {activeTab === 'control_tower' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Highway GPS Telematics & Staging Control Tower
              </h2>
              <p className="text-xs text-slate-500">
                Real-time truck locations, transit waypoints, and dock facility tracking.
              </p>
            </div>
            <div className="h-[550px] w-full rounded-xl overflow-hidden border border-slate-200">
              <TruckTrackingMap />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
