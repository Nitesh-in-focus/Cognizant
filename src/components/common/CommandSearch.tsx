import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  FileText,
  Truck,
  Receipt,
  Users,
  AlertTriangle,
  ArrowRight,
  X,
  Boxes,
  CreditCard,
  ClipboardCheck,
  Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp, UserRole } from '../../contexts/AppContext';

interface CommandSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

// Define which tables/results each role is allowed to search
const ROLE_SEARCH_SCOPES: Record<UserRole, string[]> = {
  SYSTEM_ADMIN: ['purchase_orders', 'purchase_requisitions', 'shipments', 'trucks', 'invoices', 'suppliers', 'exceptions', 'quality_checks', 'audit_logs'],
  ADMIN: ['purchase_orders', 'purchase_requisitions', 'shipments', 'trucks', 'invoices', 'suppliers', 'exceptions', 'quality_checks', 'audit_logs'],
  PROCUREMENT_MANAGER: ['purchase_orders', 'purchase_requisitions', 'suppliers', 'exceptions', 'quality_checks'],
  LOGISTICS_MANAGER: ['shipments', 'trucks', 'purchase_orders'],
  WAREHOUSE_MANAGER: ['shipments', 'trucks', 'purchase_orders', 'quality_checks'],
  GATE_OPERATOR: ['shipments', 'trucks'],
  RECEIVING_QC_OPERATOR: ['shipments', 'purchase_orders', 'quality_checks'],
  RECEIVING_OPERATOR: ['shipments', 'purchase_orders', 'quality_checks'],
  FINANCE_MANAGER: ['invoices', 'exceptions', 'purchase_orders'],
  SUPPLIER: ['purchase_orders', 'shipments', 'invoices', 'quality_checks'],
};

const ROLE_QUICK_LINKS: Record<UserRole, { label: string; path: string; color: string }[]> = {
  SYSTEM_ADMIN: [
    { label: 'Traceability Matrix', path: '/traceability', color: 'text-blue-600' },
    { label: 'Live GPS Fleet', path: '/shipments', color: 'text-blue-600' },
    { label: 'Quality Control (QC)', path: '/quality', color: 'text-indigo-600' },
    { label: 'Exceptions Hub', path: '/exceptions', color: 'text-rose-600' },
  ],
  ADMIN: [
    { label: 'Traceability Matrix', path: '/traceability', color: 'text-blue-600' },
    { label: 'Live GPS Fleet', path: '/shipments', color: 'text-blue-600' },
    { label: 'Quality Control (QC)', path: '/quality', color: 'text-indigo-600' },
    { label: 'Exceptions Hub', path: '/exceptions', color: 'text-rose-600' },
  ],
  PROCUREMENT_MANAGER: [
    { label: 'Purchase Requisitions', path: '/purchase-requisitions', color: 'text-amber-600' },
    { label: 'Purchase Orders', path: '/purchase-orders', color: 'text-blue-600' },
    { label: 'Suppliers Directory', path: '/suppliers', color: 'text-emerald-600' },
    { label: 'Supplier Quality', path: '/quality', color: 'text-indigo-600' },
  ],
  LOGISTICS_MANAGER: [
    { label: 'Live GPS Fleet', path: '/shipments', color: 'text-blue-600' },
    { label: 'Fleet & Telematics', path: '/trucks', color: 'text-indigo-600' },
    { label: 'Traceability Matrix', path: '/traceability', color: 'text-purple-600' },
  ],
  WAREHOUSE_MANAGER: [
    { label: 'Live GPS Fleet', path: '/shipments', color: 'text-blue-600' },
    { label: 'Dock & Yard Bays', path: '/yard', color: 'text-emerald-600' },
    { label: 'Quality Inspection', path: '/quality', color: 'text-indigo-600' },
    { label: 'Goods Receipts', path: '/grn', color: 'text-purple-600' },
  ],
  GATE_OPERATOR: [
    { label: 'Live GPS Fleet', path: '/shipments', color: 'text-blue-600' },
    { label: 'Yard & Gate Queue', path: '/yard', color: 'text-emerald-600' },
    { label: 'Fleet Trucks', path: '/trucks', color: 'text-indigo-600' },
  ],
  RECEIVING_QC_OPERATOR: [
    { label: 'Quality Check (QC)', path: '/quality', color: 'text-indigo-600' },
    { label: 'Goods Receipts (GRN)', path: '/grn', color: 'text-purple-600' },
    { label: 'Dock & Yard Bays', path: '/yard', color: 'text-emerald-600' },
  ],
  RECEIVING_OPERATOR: [
    { label: 'Quality Check (QC)', path: '/quality', color: 'text-indigo-600' },
    { label: 'Goods Receipts (GRN)', path: '/grn', color: 'text-purple-600' },
    { label: 'Dock & Yard Bays', path: '/yard', color: 'text-emerald-600' },
  ],
  FINANCE_MANAGER: [
    { label: 'Invoices & OCR', path: '/invoices', color: 'text-blue-600' },
    { label: 'Exceptions Hub', path: '/exceptions', color: 'text-rose-600' },
    { label: 'Payments Queue', path: '/payments', color: 'text-emerald-600' },
    { label: 'Traceability Matrix', path: '/traceability', color: 'text-purple-600' },
  ],
  SUPPLIER: [
    { label: 'Supplier Portal', path: '/supplier', color: 'text-indigo-600' },
    { label: 'Supplier Alerts', path: '/alerts', color: 'text-rose-600' },
  ],
};

export const CommandSearch: React.FC<CommandSearchProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { role, currentUser } = useApp();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const allowedScopes = ROLE_SEARCH_SCOPES[role] || ROLE_SEARCH_SCOPES.ADMIN;
  const quickLinks = ROLE_QUICK_LINKS[role] || ROLE_QUICK_LINKS.ADMIN;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const searchTimer = setTimeout(async () => {
      try {
        setLoading(true);
        const q = query.trim().toLowerCase();
        const combined: any[] = [];

        // Only search tables the role is authorized for
        const searches: Promise<any>[] = [];

        const runQuery = (q: PromiseLike<any>) => Promise.resolve(q);

        if (allowedScopes.includes('purchase_orders')) {
          searches.push(
            runQuery(
              supabase
                .from('purchase_orders')
                .select('po_id, po_number, total_amount, status')
                .ilike('po_number', `%${q}%`)
                .limit(3)
                .then(({ data }) => {
                  data?.forEach((p) =>
                    combined.push({
                      type: 'Purchase Order',
                      id: p.po_number,
                      subtitle: `Total: ₹${Number(p.total_amount).toLocaleString()}`,
                      status: p.status,
                      link: '/purchase-orders',
                      icon: ShoppingCart,
                    })
                  );
                })
            )
          );
        }

        if (allowedScopes.includes('purchase_requisitions')) {
          searches.push(
            runQuery(
              supabase
                .from('purchase_requisitions')
                .select('pr_id, pr_number, priority, status')
                .ilike('pr_number', `%${q}%`)
                .limit(3)
                .then(({ data }) => {
                  data?.forEach((p) =>
                    combined.push({
                      type: 'Requisition',
                      id: p.pr_number,
                      subtitle: `Priority: ${p.priority}`,
                      status: p.status,
                      link: '/purchase-requisitions',
                      icon: FileText,
                    })
                  );
                })
            )
          );
        }

        if (allowedScopes.includes('shipments')) {
          searches.push(
            runQuery(
              supabase
                .from('shipments')
                .select('shipment_id, shipment_number, status, origin')
                .ilike('shipment_number', `%${q}%`)
                .limit(3)
                .then(({ data }) => {
                  data?.forEach((s) =>
                    combined.push({
                      type: 'Shipment',
                      id: s.shipment_number,
                      subtitle: `From: ${s.origin || 'Mumbai'}`,
                      status: s.status,
                      link: '/shipments',
                      icon: Truck,
                    })
                  );
                })
            )
          );
        }

        if (allowedScopes.includes('trucks')) {
          searches.push(
            runQuery(
              supabase
                .from('trucks')
                .select('truck_id, vehicle_number, driver_name, status')
                .ilike('vehicle_number', `%${q}%`)
                .limit(3)
                .then(({ data }) => {
                  data?.forEach((t) =>
                    combined.push({
                      type: 'Truck',
                      id: t.vehicle_number,
                      subtitle: `Driver: ${t.driver_name}`,
                      status: t.status,
                      link: '/trucks',
                      icon: Truck,
                    })
                  );
                })
            )
          );
        }

        if (allowedScopes.includes('invoices')) {
          searches.push(
            runQuery(
              supabase
                .from('invoices')
                .select('invoice_id, invoice_number, total_amount, match_status')
                .ilike('invoice_number', `%${q}%`)
                .limit(3)
                .then(({ data }) => {
                  data?.forEach((i) =>
                    combined.push({
                      type: 'Invoice',
                      id: i.invoice_number,
                      subtitle: `Amount: ₹${Number(i.total_amount).toLocaleString()}`,
                      status: i.match_status,
                      link: '/invoices',
                      icon: Receipt,
                    })
                  );
                })
            )
          );
        }

        if (allowedScopes.includes('suppliers')) {
          searches.push(
            runQuery(
              supabase
                .from('suppliers')
                .select('supplier_id, supplier_name, city')
                .ilike('supplier_name', `%${q}%`)
                .limit(3)
                .then(({ data }) => {
                  data?.forEach((s) =>
                    combined.push({
                      type: 'Supplier',
                      id: s.supplier_name,
                      subtitle: `Hub: ${s.city}`,
                      status: 'ACTIVE',
                      link: '/suppliers',
                      icon: Users,
                    })
                  );
                })
            )
          );
        }

        if (allowedScopes.includes('exceptions')) {
          searches.push(
            runQuery(
              supabase
                .from('exceptions')
                .select('exception_id, exception_number, exception_type, severity')
                .ilike('exception_number', `%${q}%`)
                .limit(3)
                .then(({ data }) => {
                  data?.forEach((e) =>
                    combined.push({
                      type: 'Exception',
                      id: e.exception_number,
                      subtitle: `Type: ${e.exception_type}`,
                      status: e.severity,
                      link: '/exceptions',
                      icon: AlertTriangle,
                    })
                  );
                })
            )
          );
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(searchTimer);
  }, [query, role]);

  if (!isOpen) return null;

  const scopeLabels: Record<string, string> = {
    purchase_orders: 'Purchase Orders',
    purchase_requisitions: 'Requisitions',
    shipments: 'Shipments',
    trucks: 'Trucks',
    invoices: 'Invoices',
    suppliers: 'Suppliers',
    exceptions: 'Exceptions',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        {/* Role-Scoped Search Header */}
        <div className="border-b border-slate-100">
          <div className="flex items-center px-4 py-3.5 gap-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${allowedScopes.map((s) => scopeLabels[s]).join(', ')}...`}
              className="flex-1 text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent border-none outline-hidden"
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded">
              ESC
            </kbd>
          </div>

          {/* Role scope indicator */}
          <div className="px-4 pb-2.5 flex items-center gap-1.5 flex-wrap">
            <Lock className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] text-slate-400 font-semibold">Searching within your authorized scope:</span>
            {allowedScopes.map((s) => (
              <span
                key={s}
                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
              >
                {scopeLabels[s]}
              </span>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <div className="py-8 text-center text-xs text-slate-500">
              Searching your authorized data scope...
            </div>
          )}

          {!loading && results.length === 0 && query && (
            <div className="py-8 text-center text-xs text-slate-500">
              No results found for "{query}" in your authorized data scope.
            </div>
          )}

          {/* Quick Suggestions (role-specific) */}
          {!loading && !query && (
            <div className="px-3 py-4 text-xs text-slate-400">
              <div className="font-semibold text-slate-600 mb-2">
                Quick Navigation — {role.replace('_', ' ')}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {quickLinks.map((link) => (
                  <button
                    key={link.path}
                    onClick={() => { navigate(link.path); onClose(); }}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-left border border-slate-100 transition-colors"
                  >
                    <ArrowRight className={`w-3.5 h-3.5 ${link.color}`} />
                    <span className="font-medium text-slate-700">{link.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {results.map((item, idx) => {
            const ItemIcon = item.icon;
            return (
              <div
                key={idx}
                onClick={() => {
                  navigate(item.link);
                  onClose();
                }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                    <ItemIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{item.id}</span>
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{item.subtitle}</div>
                  </div>
                </div>
                <div className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                  {item.status}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer — user identity + scope lock indicator */}
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center gap-2 text-[10px] text-slate-400">
          <Lock className="w-3 h-3" />
          <span>
            Signed in as <strong className="text-slate-600">{currentUser?.full_name}</strong> •{' '}
            Results restricted to <strong className="text-slate-600">{role.replace(/_/g, ' ')}</strong> data scope
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandSearch;
