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
  items: NavItem[];
}

export const AppSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, role, logout, unreadAlertsCount } = useApp();

  const allNavGroups: NavGroup[] = [
    {
      label: 'Control Tower',
      items: [
        { title: 'Dashboard', path: '/', icon: LayoutDashboard },
        {
          title: 'Traceability Matrix',
          path: '/traceability',
          icon: GitFork,
          badge: 'E2E',
          allowedRoles: ['ADMIN', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER'],
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
          allowedRoles: ['ADMIN', 'PROCUREMENT_MANAGER'],
        },
        {
          title: 'Purchase Orders',
          path: '/purchase-orders',
          icon: ShoppingCart,
          allowedRoles: ['ADMIN', 'PROCUREMENT_MANAGER'],
        },
        {
          title: 'Suppliers Directory',
          path: '/suppliers',
          icon: Building2,
          allowedRoles: ['ADMIN', 'PROCUREMENT_MANAGER'],
        },
        {
          title: 'Product SKU Catalog',
          path: '/products',
          icon: Package,
          allowedRoles: ['ADMIN', 'PROCUREMENT_MANAGER'],
        },
      ],
    },
    {
      label: 'Logistics & Yard',
      items: [
        {
          title: 'Live Shipments',
          path: '/shipments',
          icon: Truck,
          live: true,
          allowedRoles: ['ADMIN', 'WAREHOUSE_MANAGER', 'GATE_OPERATOR'],
        },
        {
          title: 'Fleet & Trucks',
          path: '/trucks',
          icon: Radio,
          allowedRoles: ['ADMIN', 'WAREHOUSE_MANAGER', 'GATE_OPERATOR'],
        },
        {
          title: 'Yard & Dock Bays',
          path: '/yard',
          icon: Boxes,
          allowedRoles: ['ADMIN', 'WAREHOUSE_MANAGER', 'GATE_OPERATOR', 'RECEIVING_OPERATOR'],
        },
        {
          title: 'Receiving & GRN',
          path: '/grn',
          icon: ClipboardCheck,
          allowedRoles: ['ADMIN', 'WAREHOUSE_MANAGER', 'RECEIVING_OPERATOR'],
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
          allowedRoles: ['ADMIN', 'FINANCE_MANAGER', 'PROCUREMENT_MANAGER'],
        },
        {
          title: 'Exceptions Hub',
          path: '/exceptions',
          icon: AlertTriangle,
          badgeColor: 'bg-rose-500 text-white',
          allowedRoles: ['ADMIN', 'FINANCE_MANAGER', 'PROCUREMENT_MANAGER'],
        },
        {
          title: 'Payments Settlement',
          path: '/payments',
          icon: CreditCard,
          allowedRoles: ['ADMIN', 'FINANCE_MANAGER'],
        },
      ],
    },
    {
      label: 'Intelligence & System',
      items: [
        {
          title: 'Analytics & Power BI',
          path: '/analytics',
          icon: BarChart3,
          allowedRoles: ['ADMIN', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER'],
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

  // Filter items based on active user role
  const filteredNavGroups = allNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.allowedRoles || item.allowedRoles.includes(role)
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="w-64 shrink-0 bg-[#0F172A] text-slate-300 flex flex-col min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-14 flex items-center gap-3 px-5 border-b border-slate-800 bg-[#0B1120]">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-black tracking-wide text-white leading-none">
            C2 CONTROL TOWER
          </div>
          <div className="text-[10px] font-medium text-slate-400 leading-none mt-1">
            Supply Chain Mission Control
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {filteredNavGroups.map((group) => (
          <div key={group.label}>
            <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              {group.label}
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
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
