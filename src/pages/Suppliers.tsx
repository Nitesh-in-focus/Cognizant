import React, { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  RefreshCw,
  Search,
  Mail,
  Phone,
  MapPin,
  Star,
  CheckCircle2,
  Edit,
  Trash2,
  ShieldCheck,
  Lock,
  AlertCircle,
  AlertTriangle,
  Hash,
  X,
  Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

export const Suppliers: React.FC = () => {
  const { role, currentUser, logAuditAction, canApprovePO, refreshKey, triggerRefresh, showSnackbar } = useApp();

  // Procurement Officer & Admin are the only roles authorized to add/edit/delete suppliers
  const isProcurementOfficer =
    role === 'PROCUREMENT_OFFICER' ||
    role === 'ADMIN' ||
    role === 'SYSTEM_ADMIN' ||
    (canApprovePO && canApprovePO());

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Realtime Live Sync across devices/users
  useRealtimeSubscription({
    tables: ['suppliers', 'purchase_orders'],
    channelName: 'suppliers_page_realtime',
    callback: () => fetchSuppliers(true),
  });

  // Onboard Supplier Modal State
  const [openCreate, setOpenCreate] = useState(false);
  const [newSup, setNewSup] = useState({
    supplier_code: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
    supplier_name: '',
    contact_person: '',
    email: '',
    phone: '',
    city: '',
    state: 'Maharashtra',
    address: '',
    gstin: '',
  });

  // Edit Supplier Modal State
  const [openEdit, setOpenEdit] = useState(false);
  const [editingSup, setEditingSup] = useState<any | null>(null);

  useEffect(() => {
    fetchSuppliers();
  }, [refreshKey]);

  const fetchSuppliers = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (err: any) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create Supplier (Procurement Officer only)
  const handleCreateSupplier = async () => {
    if (!isProcurementOfficer) {
      showSnackbar('Permission Denied: Only Procurement Officers can onboard suppliers.', 'error');
      return;
    }

    const cleanCode = newSup.supplier_code.trim().toUpperCase();
    const cleanName = newSup.supplier_name.trim();
    const cleanEmail = newSup.email.trim().toLowerCase();

    if (!cleanCode) {
      showSnackbar('Supplier ID is compulsory (e.g. SUP-0001).', 'error');
      return;
    }
    if (!cleanName) {
      showSnackbar('Supplier Business Name is compulsory.', 'error');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      showSnackbar('Valid Supplier Email is compulsory for sending PO requests.', 'error');
      return;
    }

    try {
      const { error } = await supabase.from('suppliers').insert([
        {
          supplier_code: cleanCode,
          supplier_name: cleanName,
          contact_person: newSup.contact_person.trim() || 'Key Account Manager',
          email: cleanEmail,
          phone: newSup.phone.trim() || '+91 98200 11000',
          city: newSup.city.trim() || 'Mumbai Hub',
          state: newSup.state.trim() || 'Maharashtra',
          address: newSup.address.trim() || 'Industrial Estate Zone',
          gstin: newSup.gstin.trim() || '27AABCS1429B1Z' + Math.floor(1 + Math.random() * 9),
          rating: 4.8,
          status: 'ACTIVE',
        },
      ]);

      if (error) throw error;

      showSnackbar(`Supplier "${cleanName}" (${cleanCode}) registered successfully!`, 'success');
      setOpenCreate(false);
      setNewSup({
        supplier_code: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
        supplier_name: '',
        contact_person: '',
        email: '',
        phone: '',
        city: '',
        state: 'Maharashtra',
        address: '',
        gstin: '',
      });
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message || 'Failed to onboard supplier.', 'error');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (sup: any) => {
    if (!isProcurementOfficer) {
      showSnackbar('Permission Denied: Only Procurement Officers can edit suppliers.', 'error');
      return;
    }
    setEditingSup({ ...sup });
    setOpenEdit(true);
  };

  // Save Edit Supplier
  const handleSaveEditSupplier = async () => {
    if (!editingSup || !isProcurementOfficer) return;

    const cleanName = editingSup.supplier_name?.trim();
    const cleanEmail = editingSup.email?.trim().toLowerCase();

    if (!cleanName || !cleanEmail) {
      showSnackbar('Supplier Name and Email are compulsory.', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          supplier_name: cleanName,
          contact_person: editingSup.contact_person?.trim(),
          email: cleanEmail,
          phone: editingSup.phone?.trim(),
          city: editingSup.city?.trim(),
          state: editingSup.state?.trim(),
          address: editingSup.address?.trim(),
          gstin: editingSup.gstin?.trim(),
          status: editingSup.status || 'ACTIVE',
        })
        .eq('supplier_id', editingSup.supplier_id);

      if (error) throw error;

      showSnackbar(`Supplier "${cleanName}" updated successfully!`, 'success');
      setOpenEdit(false);
      setEditingSup(null);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message || 'Failed to update supplier.', 'error');
    }
  };

  // Remove / Inactivate Supplier with Mandatory Reason (Sections 20-22 of updates9.md)
  const [openRemoveModal, setOpenRemoveModal] = useState(false);
  const [removingSup, setRemovingSup] = useState<any | null>(null);
  const [removalReason, setRemovalReason] = useState('');

  const handleOpenRemoveModal = (sup: any) => {
    if (!isProcurementOfficer) {
      showSnackbar('Permission Denied: Only Procurement Officers can remove suppliers.', 'error');
      return;
    }
    setRemovingSup(sup);
    setRemovalReason('');
    setOpenRemoveModal(true);
  };

  const handleConfirmRemoval = async () => {
    if (!removingSup || !isProcurementOfficer) return;

    if (!removalReason.trim()) {
      showSnackbar('Reason for Supplier Removal is mandatory.', 'error');
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const removedBy = currentUser?.full_name || 'PR Officer';

      // Soft delete: Mark as INACTIVE / REMOVED to preserve historical transactional integrity
      const { error } = await supabase
        .from('suppliers')
        .update({
          status: 'INACTIVE',
          removal_reason: removalReason.trim(),
          removed_at: timestamp,
          removed_by: removedBy,
        })
        .eq('supplier_id', removingSup.supplier_id);

      if (error) throw error;

      await logAuditAction('SUPPLIER_REMOVED', 'suppliers', removingSup.supplier_id, {
        supplier_code: removingSup.supplier_code,
        supplier_name: removingSup.supplier_name,
        reason: removalReason.trim(),
        removed_by: removedBy,
        timestamp,
      });

      // Send simulated notifications to Supplier & Higher Authority
      try {
        await supabase.from('email_logs').insert([
          {
            recipient_email: removingSup.email || 'supplier@partner.com',
            recipient_role: 'SUPPLIER',
            subject: `Notice of Vendor Deactivation: ${removingSup.supplier_name} (${removingSup.supplier_code})`,
            template_name: 'SUPPLIER_DEACTIVATION_NOTICE',
            severity: 'HIGH',
            status: 'SENT',
            sent_at: timestamp,
          },
          {
            recipient_email: 'director.procurement@supplysync.io',
            recipient_role: 'EXECUTIVE_LEADERSHIP',
            subject: `Executive Alert: Supplier ${removingSup.supplier_name} Inactivated`,
            template_name: 'EXECUTIVE_SUPPLIER_REMOVAL_ALERT',
            severity: 'HIGH',
            status: 'SENT',
            sent_at: timestamp,
          },
        ]);
      } catch {}

      showSnackbar(`Supplier "${removingSup.supplier_name}" inactivated. Removal reason archived.`, 'info');
      setOpenRemoveModal(false);
      setRemovingSup(null);
      setRemovalReason('');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar('Removal failed: ' + err.message, 'error');
    }
  };

  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterRating, setFilterRating] = useState('ALL');

  const filteredSuppliers = suppliers.filter((s) => {
    // 1. Status Filter
    if (filterStatus !== 'ALL' && s.status !== filterStatus) {
      return false;
    }

    // 2. Rating Filter
    if (filterRating === '4.5+' && (s.rating || 0) < 4.5) {
      return false;
    }
    if (filterRating === '4.0+' && (s.rating || 0) < 4.0) {
      return false;
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = s.supplier_name?.toLowerCase().includes(q);
      const matchCity = s.city?.toLowerCase().includes(q);
      const matchEmail = s.email?.toLowerCase().includes(q);
      const matchCode = s.supplier_code?.toLowerCase().includes(q);
      const matchId = s.supplier_id?.toLowerCase().includes(q);
      const matchPhone = s.phone?.toLowerCase().includes(q);

      if (!matchName && !matchCity && !matchEmail && !matchCode && !matchId && !matchPhone) {
        return false;
      }
    }

    return true;
  });

  const hasSupplierFilters = filterStatus !== 'ALL' || filterRating !== 'ALL' || Boolean(searchQuery.trim());

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>Suppliers & Vendor Register</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              PROCUREMENT CONTROLLED
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Certified component manufacturers and tier-1 vendor organizations. Only authorized Procurement Officers can register and edit suppliers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs cursor-pointer"
            title="Refresh Suppliers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isProcurementOfficer ? (
            <button
              onClick={() => setOpenCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Onboard Supplier</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Read-Only View</span>
            </div>
          )}
        </div>
      </div>

      {/* Universal Filter + Search Bar (Updates 12 Sections 13 & 15) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Multi-Facet Category Filters: FILTER ➔ SEARCH */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 font-bold text-slate-500 mr-1">
              <span>Filter:</span>
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:border-slate-300 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="ON_HOLD">ON_HOLD</option>
            </select>

            {/* Rating Filter */}
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:border-slate-300 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">All Ratings</option>
              <option value="4.5+">★ 4.5+ Rating</option>
              <option value="4.0+">★ 4.0+ Rating</option>
            </select>

            {hasSupplierFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('ALL');
                  setFilterRating('ALL');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{filteredSuppliers.length}</strong> of {suppliers.length} vendors
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suppliers by Name, Supplier ID, Code, Email, Phone, City..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Supplier ID & Code</th>
                <th className="py-3.5 px-4">Supplier Organization</th>
                <th className="py-3.5 px-4">Mandatory Email & Contact</th>
                <th className="py-3.5 px-4">Location / Hub</th>
                <th className="py-3.5 px-4">Reliability Rating</th>
                <th className="py-3.5 px-4">Status</th>
                {isProcurementOfficer && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={isProcurementOfficer ? 7 : 6} className="py-12 text-center text-slate-400">
                    Loading Supplier Directory...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={isProcurementOfficer ? 7 : 6} className="py-16 text-center text-slate-400">
                    <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-75" />
                    <span className="font-bold text-slate-700 block text-sm">No Suppliers registered in system yet</span>
                    <span className="text-xs text-slate-500 mt-1 block max-w-md mx-auto">
                      {isProcurementOfficer
                        ? 'Click "Onboard Supplier" above to register your first vendor with compulsory Supplier ID and Email.'
                        : 'Suppliers are registered and managed exclusively by Procurement Officers.'}
                    </span>
                    {isProcurementOfficer && (
                      <button
                        onClick={() => setOpenCreate(true)}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Onboard First Supplier</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => (
                  <tr key={sup.supplier_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-blue-600 block">
                        {sup.supplier_code || sup.supplier_id?.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {sup.supplier_id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{sup.supplier_name}</div>
                      <div className="text-[11px] text-slate-400">
                        GSTIN: {sup.gstin || '27AABCS1429B1Z2'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 font-semibold flex items-center gap-1 text-xs">
                        <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-900">{sup.email}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{sup.contact_person || 'Lead'} • {sup.phone || '+91 98000 00000'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-slate-700 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>{sup.city || 'Mumbai'}, {sup.state || 'Maharashtra'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span className="font-bold text-slate-900">{Number(sup.rating || 4.8).toFixed(1)}</span>
                        <span className="text-[10px] text-slate-400">/ 5.0</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={sup.status || 'ACTIVE'} size="sm" />
                    </td>
                    {isProcurementOfficer && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(sup)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                            title="Edit Supplier"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenRemoveModal(sup)}
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="Inactivate / Remove Supplier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* Onboard Supplier Modal (Compulsory Supplier ID & Email)        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Onboard Certified Supplier Partner"
        subtitle="Register verified vendor organization with mandatory Supplier ID and transmission email"
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => setOpenCreate(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSupplier}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Register & Save Supplier
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Supplier Code / ID <span className="text-rose-500">* (Compulsory)</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. SUP-0021"
                  value={newSup.supplier_code}
                  onChange={(e) => setNewSup({ ...newSup, supplier_code: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Supplier Email <span className="text-rose-500">* (Compulsory)</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="e.g. orders@supplier.com"
                  value={newSup.email}
                  onChange={(e) => setNewSup({ ...newSup, email: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                POs and fulfillment dispatch requests will be delivered to this email.
              </span>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Supplier Business Name <span className="text-rose-500">* (Compulsory)</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Tata Industrial Solutions Ltd"
              value={newSup.supplier_name}
              onChange={(e) => setNewSup({ ...newSup, supplier_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Contact Person Name
              </label>
              <input
                type="text"
                placeholder="e.g. Rajesh Gupta"
                value={newSup.contact_person}
                onChange={(e) => setNewSup({ ...newSup, contact_person: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                placeholder="+91 98200 11008"
                value={newSup.phone}
                onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Facility City / Hub
              </label>
              <input
                type="text"
                placeholder="e.g. Pune"
                value={newSup.city}
                onChange={(e) => setNewSup({ ...newSup, city: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                State / Region
              </label>
              <input
                type="text"
                placeholder="e.g. Maharashtra"
                value={newSup.state}
                onChange={(e) => setNewSup({ ...newSup, state: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Registered Facility Address
            </label>
            <textarea
              rows={2}
              placeholder="Plot 42, MIDC Bhosari Industrial Area..."
              value={newSup.address}
              onChange={(e) => setNewSup({ ...newSup, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 resize-none focus:outline-hidden focus:border-blue-500"
            />
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* Edit Supplier Modal                                            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {editingSup && (
        <Modal
          isOpen={openEdit}
          onClose={() => {
            setOpenEdit(false);
            setEditingSup(null);
          }}
          title={`Edit Supplier: ${editingSup.supplier_name}`}
          subtitle={`Update vendor master information for Supplier ID ${editingSup.supplier_code || editingSup.supplier_id}`}
          maxWidth="lg"
          footer={
            <>
              <button
                onClick={() => {
                  setOpenEdit(false);
                  setEditingSup(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditSupplier}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                Save Changes
              </button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Supplier Code / ID
                </label>
                <input
                  type="text"
                  disabled
                  value={editingSup.supplier_code || editingSup.supplier_id}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Supplier Email <span className="text-rose-500">* (Compulsory)</span>
                </label>
                <input
                  type="email"
                  required
                  value={editingSup.email || ''}
                  onChange={(e) => setEditingSup({ ...editingSup, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Supplier Business Name <span className="text-rose-500">* (Compulsory)</span>
              </label>
              <input
                type="text"
                required
                value={editingSup.supplier_name || ''}
                onChange={(e) => setEditingSup({ ...editingSup, supplier_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  value={editingSup.contact_person || ''}
                  onChange={(e) => setEditingSup({ ...editingSup, contact_person: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={editingSup.phone || ''}
                  onChange={(e) => setEditingSup({ ...editingSup, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  City / Hub
                </label>
                <input
                  type="text"
                  value={editingSup.city || ''}
                  onChange={(e) => setEditingSup({ ...editingSup, city: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Vendor Status
                </label>
                <select
                  value={editingSup.status || 'ACTIVE'}
                  onChange={(e) => setEditingSup({ ...editingSup, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PENDING">PENDING REVIEW</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Mandatory Reason Supplier Removal Modal (Sections 21-22 of updates9.md) */}
      {openRemoveModal && removingSup && (
        <Modal
          isOpen={openRemoveModal}
          onClose={() => {
            setOpenRemoveModal(false);
            setRemovingSup(null);
          }}
          title={`Remove / Inactivate Supplier: ${removingSup.supplier_name}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Mandatory Vendor Removal Reason</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Supplier <strong>{removingSup.supplier_name}</strong> ({removingSup.supplier_code}) will be inactivated. The reason provided will be archived in the permanent audit ledger and sent to the vendor and executive leadership.
              </p>
            </div>

            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Reason for Supplier Removal <span className="text-rose-500">* (Mandatory)</span>
              </label>
              <textarea
                required
                rows={4}
                placeholder="Specify the detailed operational or commercial rationale for removing this vendor (e.g. Repeated quality check defects, non-fulfillment of agreed lead times, contract expiration)..."
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setOpenRemoveModal(false);
                  setRemovingSup(null);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoval}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Removal</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Suppliers;
