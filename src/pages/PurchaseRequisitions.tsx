import React, { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  RefreshCw,
  Check,
  X,
  Search,
  Filter,
  ArrowUpDown,
  Building2,
  Calendar,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const PurchaseRequisitions: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar } = useApp();

  const [prs, setPrs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // New PR Modal state
  const [openCreate, setOpenCreate] = useState(false);
  const [newPr, setNewPr] = useState({
    warehouse_id: '',
    product_id: '',
    quantity: 100,
    priority: 'HIGH',
    reason: '',
  });

  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [
        { data: prData },
        { data: prodData },
        { data: whData },
      ] = await Promise.all([
        supabase
          .from('purchase_requisitions')
          .select(`
            *,
            warehouses(warehouse_name, city),
            pr_items(
              *,
              products(product_name, unit_price, unit_of_measure)
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('warehouses').select('*'),
      ]);

      setPrs(prData || []);
      setProducts(prodData || []);
      setWarehouses(whData || []);
      if (whData?.length && !newPr.warehouse_id) {
        setNewPr((prev) => ({
          ...prev,
          warehouse_id: whData[0].warehouse_id,
          product_id: prodData?.[0]?.product_id || '',
        }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePr = async () => {
    try {
      if (!newPr.warehouse_id || !newPr.product_id || newPr.quantity <= 0) {
        showSnackbar('Please complete all required requisition fields', 'error');
        return;
      }

      const suffix = Math.floor(1000 + Math.random() * 9000);
      const prNumber = `PR-2026-${suffix}`;

      const { data: pr, error: prErr } = await supabase
        .from('purchase_requisitions')
        .insert([
          {
            pr_number: prNumber,
            warehouse_id: newPr.warehouse_id,
            priority: newPr.priority,
            status: 'PENDING',
            reason: newPr.reason || 'Restocking component stock levels',
            request_date: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (prErr) throw prErr;

      await supabase.from('pr_items').insert([
        {
          pr_id: pr.pr_id,
          product_id: newPr.product_id,
          requested_quantity: newPr.quantity,
        },
      ]);

      showSnackbar(`Requisition #${prNumber} created successfully!`, 'success');
      setOpenCreate(false);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const handleUpdateStatus = async (prId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const { error } = await supabase
        .from('purchase_requisitions')
        .update({
          status,
          approved_at: status === 'APPROVED' ? new Date().toISOString() : null,
        })
        .eq('pr_id', prId);

      if (error) throw error;

      showSnackbar(`PR marked as ${status}`, 'info');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const filteredPrs = prs.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.pr_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.pr_items?.[0]?.products?.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.warehouses?.warehouse_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = filterPriority === 'ALL' || p.priority === filterPriority;
    const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  return (
    <div className="space-y-5 pb-12">
      {/* Header (Section 23) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Purchase Requisitions (PR)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Internal demand requests, inventory replenishment authorizations, and line approval queue.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Requisitions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOpenCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Requisition</span>
          </button>
        </div>
      </div>

      {/* Filter Bar (Section 24) */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by PR#, SKU, warehouse..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Priority:</span>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">URGENT</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <span className="text-slate-400 font-medium ml-2">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
      </div>

      {/* Requisitions Table (Section 24, 25, 26) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">PR Number</th>
                <th className="py-3 px-4">Destination Warehouse</th>
                <th className="py-3 px-4">Requested Item</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Justification</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading Purchase Requisitions...
                  </td>
                </tr>
              ) : filteredPrs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No purchase requisitions found. Click "New Requisition" to submit a request.
                  </td>
                </tr>
              ) : (
                filteredPrs.map((pr) => {
                  const item = pr.pr_items?.[0];
                  return (
                    <tr key={pr.pr_id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-blue-600">
                        {pr.pr_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {pr.warehouses?.warehouse_name || 'Central Hub'}
                        </div>
                        <div className="text-[11px] text-slate-400">{pr.warehouses?.city}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-900 font-semibold">
                          {item?.products?.product_name || 'Industrial Bearings'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Est: ₹{item?.products?.unit_price || 50} / {item?.products?.unit_of_measure || 'PCS'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {item?.requested_quantity || 100}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={pr.priority || 'MEDIUM'} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-500">
                        {pr.reason || 'Inventory Replenishment'}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={pr.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {pr.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleUpdateStatus(pr.pr_id, 'APPROVED')}
                              className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs transition-colors flex items-center gap-1 border border-emerald-200"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(pr.pr_id, 'REJECTED')}
                              className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-xs transition-colors flex items-center gap-1 border border-rose-200"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {pr.status === 'APPROVED' ? 'Approved & Ready' : 'Archived'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Requisition Modal (Section 46 & 47) */}
      <Modal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Submit Purchase Requisition"
        subtitle="Create an internal material replenishment request for warehouse review"
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setOpenCreate(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePr}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              Submit Requisition
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Destination Warehouse
            </label>
            <select
              value={newPr.warehouse_id}
              onChange={(e) => setNewPr({ ...newPr, warehouse_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              {warehouses.map((w) => (
                <option key={w.warehouse_id} value={w.warehouse_id}>
                  {w.warehouse_name} ({w.city})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="font-semibold text-slate-700 block mb-1.5">
                Requested SKU / Product
              </label>
              <select
                value={newPr.product_id}
                onChange={(e) => setNewPr({ ...newPr, product_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name} (₹{p.unit_price}/{p.unit_of_measure})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                Quantity
              </label>
              <input
                type="number"
                value={newPr.quantity}
                onChange={(e) => setNewPr({ ...newPr, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Priority Urgency Level
            </label>
            <select
              value={newPr.priority}
              onChange={(e) => setNewPr({ ...newPr, priority: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            >
              <option value="URGENT">URGENT - Production Line Stop Risk</option>
              <option value="HIGH">HIGH - Low Safety Buffer</option>
              <option value="MEDIUM">MEDIUM - Standard Scheduled Cycle</option>
              <option value="LOW">LOW - General Stock Up</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Business Justification / Notes
            </label>
            <textarea
              rows={2}
              value={newPr.reason}
              onChange={(e) => setNewPr({ ...newPr, reason: e.target.value })}
              placeholder="State the reason for this procurement requirement..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PurchaseRequisitions;
