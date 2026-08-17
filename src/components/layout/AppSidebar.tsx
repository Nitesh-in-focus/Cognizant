import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitFork,
  FileText,
  ShoppingCart,
  Truck,
  Building2,
  Package,
  Boxes,
  ClipboardCheck,
  Receipt,
  AlertTriangle,
  CreditCard,
  BarChart3,
  Bell,
  Radio,
  Layers,
  LucideIcon,
  LogOut,
  Shield,
  X,
} from 'lucide-react';
import { useApp, UserRole } from '../../contexts/AppContext';

interface NavItem {
  title: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: string;
  live?: boolean;
  allowedRoles?: UserRole[];
}

interface NavGroup {
  label: string;
  roleTag?: string;
  roleTagColor?: string;
  icon?: LucideIcon;
  items: NavItem[];
}

interface AppSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, role, logout, unreadAlertsCount } = useApp();

  const isSystemAdmin = role === 'SYSTEM_ADMIN' || role === 'ADMIN';

  // System Admin gets a dedicated, role-divided sidebar containing EVERYTHING
  const systemAdminNavGroups: NavGroup[] = [
    {
      label: 'Executive & Core Control',
      roleTag: 'ADMIN',
      roleTagColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      items: [
        { title: 'Master Command Dashboard', path: '/', icon: LayoutDashboard },
        { title: 'E2E Traceability Matrix', path: '/traceability', icon: GitFork, badge: 'E2E' },
        { title: 'Procurement Intelligence', path: '/analytics', icon: BarChart3 },
        {
          title: 'System Realtime Alerts',
          path: '/alerts',
          icon: Bell,
          badge: unreadAlertsCount > 0 ? String(unreadAlertsCount) : undefined,
          badgeColor: 'bg-rose-500 text-white',
        },
      ],
    },
    {
      label: 'Procurement Officer',
      roleTag: 'PROCUREMENT',
      roleTagColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      items: [
        { title: 'Purchase Requisitions', path: '/purchase-requisitions', icon: FileText },
        { title: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingCart },
        { title: 'Suppliers Directory', path: '/suppliers', icon: Building2 },
        { title: 'Product SKU Catalog', path: '/products', icon: Package },
        { title: 'Warehouses & Plants', path: '/warehouses', icon: Building2 },
      ],
    },
    {
      label: 'Supplier Partner',
      roleTag: 'SUPPLIER',
      roleTagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      items: [
        { title: 'Supplier Portal & Dispatches', path: '/supplier', icon: Building2, badge: 'PORTAL' },
      ],
    },
    {
      label: 'Carrier Fleet & Driver',
      roleTag: 'DRIVER',
      roleTagColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      items: [
        { title: 'Driver Operational Console', path: '/driver', icon: Truck, badge: 'LIVE GPS' },
        { title: 'Live Shipments Telematics', path: '/shipments', icon: Truck, live: true },
        { title: 'Fleet Trucks & Live Tracking', path: '/trucks', icon: Radio },
      ],
    },
    {
      label: 'Logistics & Gate Post',
      roleTag: 'GATE POST',
      roleTagColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      items: [
        { title: 'Gate Check-In & Yard Docks', path: '/yard', icon: Boxes },
      ],
    },
    {
      label: 'Receiving & Quality Control',
      roleTag: 'QC',
      roleTagColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      items: [
        { title: 'Receiving & GRN Intake', path: '/grn', icon: ClipboardCheck },
        { title: 'Quality Check (8-Factor QC)', path: '/quality', icon: Shield, badge: '8-FACTOR', badgeColor: 'bg-indigo-500 text-white' },
      ],
    },
    {
      label: 'Finance & 3-Way Match',
      roleTag: 'FINANCE',
      roleTagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      items: [
        { title: 'Invoices & AI OCR', path: '/invoices', icon: Receipt },
        { title: 'Exceptions Settlement Hub', path: '/exceptions', icon: AlertTriangle, badgeColor: 'bg-rose-500 text-white' },
        { title: 'Payments & Payouts', path: '/payments', icon: CreditCard },
      ],
    },
  ];

  const standardNavGroups: NavGroup[] = role === 'SUPPLIER'
    ? [
        {
          label: 'Supplier Hub',
          roleTag: 'SUPPLIER',
          roleTagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          items: [
            { title: 'Dashboard', path: '/', icon: LayoutDashboard },
            { title: 'Supplier Portal', path: '/supplier', icon: Building2, badge: 'PORTAL' },
            {
              title: 'Supplier Alerts',
              path: '/alerts',
              icon: Bell,
              badge: unreadAlertsCount > 0 ? String(unreadAlertsCount) : undefined,
              badgeColor: 'bg-rose-500 text-white',
            },
          ],
        },
      ]
    : role === 'TRUCK_DRIVER'
    ? [
        {
          label: 'Driver App Console',
          roleTag: 'DRIVER',
          roleTagColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          items: [
            { title: 'Dashboard', path: '/', icon: LayoutDashboard },
            { title: 'Driver Trip Console', path: '/driver', icon: Truck, badge: 'ACTIVE' },
            {
              title: 'Driver Alerts',
              path: '/alerts',
              icon: Bell,
              badge: unreadAlertsCount > 0 ? String(unreadAlertsCount) : undefined,
              badgeColor: 'bg-rose-500 text-white',
            },
          ],
        },
      ]
    : [
        {
          label: 'Control Center',
          items: [
            { title: 'Dashboard', path: '/', icon: LayoutDashboard },
            {
              title: 'Traceability Matrix',
              path: '/traceability',
              icon: GitFork,
              badge: 'E2E',
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER', 'LOGISTICS_GATE_POST', 'LOGISTICS', 'LOGISTICS_MANAGER', 'GATE_POST_OFFICER', 'GATE_OPERATOR', 'RECEIVING_QC', 'RECEIVING_QC_OPERATOR', 'FINANCE', 'FINANCE_MANAGER'],
            },
          ],
        },
        {
          label: 'Procurement',
          items: [
            {
              title: 'Purchase Requisitions',
              path: '/purchase-requisitions',
              icon: FileText,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'WORKER', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
            },
            {
              title: 'Purchase Orders',
              path: '/purchase-orders',
              icon: ShoppingCart,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
            },
            {
              title: 'Suppliers Directory',
              path: '/suppliers',
              icon: Building2,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
            },
            {
              title: 'Product SKU Catalog',
              path: '/products',
              icon: Package,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'WORKER', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
            },
            {
              title: 'Warehouses & Plants',
              path: '/warehouses',
              icon: Building2,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
            },
          ],
        },
        {
          label: 'Logistics & Gate Post',
          items: [
            {
              title: 'Live Shipments',
              path: '/shipments',
              icon: Truck,
              live: true,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'LOGISTICS_GATE_POST', 'LOGISTICS', 'LOGISTICS_MANAGER', 'GATE_POST_OFFICER', 'GATE_OPERATOR', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
            },
            {
              title: 'Fleet & Telematics',
              path: '/trucks',
              icon: Radio,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'LOGISTICS_GATE_POST', 'LOGISTICS', 'LOGISTICS_MANAGER', 'GATE_POST_OFFICER', 'GATE_OPERATOR'],
            },
            {
              title: 'Gate & Yard Docks',
              path: '/yard',
              icon: Boxes,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'LOGISTICS_GATE_POST', 'GATE_POST_OFFICER', 'GATE_OPERATOR', 'RECEIVING_QC', 'RECEIVING_QC_OPERATOR'],
            },
          ],
        },
        {
          label: 'Receiving + QC',
          items: [
            {
              title: 'Receiving & GRN',
              path: '/grn',
              icon: ClipboardCheck,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'RECEIVING_QC', 'RECEIVING_QC_OPERATOR', 'RECEIVING_OPERATOR'],
            },
            {
              title: 'Quality Check (QC)',
              path: '/quality',
              icon: Shield,
              badge: '8-FACTOR',
              badgeColor: 'bg-indigo-500 text-white',
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'RECEIVING_QC', 'RECEIVING_QC_OPERATOR', 'RECEIVING_OPERATOR', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
            },
          ],
        },
        {
          label: 'Finance & 3-Way Match',
          items: [
            {
              title: 'Invoices & AI OCR',
              path: '/invoices',
              icon: Receipt,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'FINANCE', 'FINANCE_MANAGER', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
            },
            {
              title: 'Exceptions Hub',
              path: '/exceptions',
              icon: AlertTriangle,
              badgeColor: 'bg-rose-500 text-white',
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'FINANCE', 'FINANCE_MANAGER', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER'],
            },
            {
              title: 'Payments Settlement',
              path: '/payments',
              icon: CreditCard,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'FINANCE', 'FINANCE_MANAGER'],
            },
          ],
        },
        {
          label: 'Intelligence & System',
          items: [
            {
              title: 'Procurement Intelligence',
              path: '/analytics',
              icon: BarChart3,
              allowedRoles: ['SYSTEM_ADMIN', 'ADMIN', 'PROCUREMENT_OFFICER', 'PROCUREMENT_MANAGER', 'LOGISTICS_GATE_POST', 'LOGISTICS', 'LOGISTICS_MANAGER', 'FINANCE', 'FINANCE_MANAGER'],
            },
            {
              title: 'System Alerts',
              path: '/alerts',
              icon: Bell,
              badge: unreadAlertsCount > 0 ? String(unreadAlertsCount) : undefined,
              badgeColor: 'bg-rose-500 text-white',
            },
          ],
        },
      ];

  // System Admin gets full access with role-divided sections
  const activeNavGroups = isSystemAdmin
    ? systemAdminNavGroups
    : standardNavGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.allowedRoles || item.allowedRoles.includes(role)
          ),
        }))
        .filter((group) => group.items.length > 0);

  const sidebarContent = (
    <aside className="w-64 shrink-0 bg-[#0F172A] text-slate-300 flex flex-col h-full min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-slate-800 bg-[#0B1120]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-black tracking-wide text-white leading-none">
              SUPPLY SYNC
            </div>
            <div className="text-[10px] font-medium text-slate-400 leading-none mt-1">
              Autonomous Supply Chain
            </div>
          </div>
        </div>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* System Admin Mode Indicator */}
      {isSystemAdmin && (
        <div className="mx-3 mt-3 p-2.5 rounded-xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/30 text-purple-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-purple-300">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>SYSTEM ADMIN CONSOLE</span>
            </div>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
              ALL ROLES
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
            Role-divided master access across all 6 departments.
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {activeNavGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <span className="truncate">{group.label}</span>
              {group.roleTag && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[8px] font-black border tracking-normal ${
                    group.roleTagColor || 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {group.roleTag}
                </span>
              )}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.live && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                      )}
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            item.badgeColor || (isActive ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-300')
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Profile Card & Sign Out */}
      <div className="p-3 border-t border-slate-800 bg-[#0B1120]">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {currentUser?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {currentUser?.full_name || 'Active User'}
              </div>
              <div className="text-[10px] text-blue-400 font-semibold truncate">
                {role.replace('_', ' ')}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop permanent sidebar */}
      <div className="hidden lg:flex shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile / Tablet slide-over drawer with backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0F172A] z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default AppSidebar;
