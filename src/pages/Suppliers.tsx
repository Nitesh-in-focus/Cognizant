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
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const Suppliers: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar } = useApp();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Onboard Supplier Modal
  const [openCreate, setOpenCreate] = useState(false);
  const [newSup, setNewSup] = useState({
    supplier_name: '',
    contact_person: '',
    email: '',
    phone: '',
    city: '',
    address: '',
  });

  useEffect(() => {
    fetchSuppliers();
  }, [refreshKey]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('supplier_name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async () => {
    try {
      if (!newSup.supplier_name || !newSup.email || !newSup.city) {
        showSnackbar('Please complete all required vendor fields', 'error');
        return;
      }

      const suffix = Math.floor(100 + Math.random() * 900);
      const supplierCode = `SUP-${suffix}`;

      const { error } = await supabase.from('suppliers').insert([
        {
          supplier_code: supplierCode,
          supplier_name: newSup.supplier_name,
          contact_person: newSup.contact_person || 'Operations Lead',
          email: newSup.email,
          phone: newSup.phone || '+91 9876543210',
          city: newSup.city,
          address: newSup.address || 'Industrial MIDC Zone',
          status: 'ACTIVE',
        },
      ]);

      if (error) throw error;

      showSnackbar(`Supplier "${newSup.supplier_name}" onboarded successfully!`, 'success');
      setOpenCreate(false);
      setNewSup({ supplier_name: '', contact_person: '', email: '', phone: '', city: '', address: '' });
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
    }
  };

  const filteredSuppliers = suppliers.filter(
    (s) =>
      !searchQuery ||
      s.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.supplier_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Suppliers & Vendor Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified tier-1/2 component suppliers, fulfillment SLA scores, and facility directories.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Suppliers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOpenCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Supplier</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suppliers by name, code, city..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Active Vendors: <strong className="text-slate-900">{filteredSuppliers.length}</strong>
        </div>
      </div>

      {/* Suppliers Table (Sections 24, 25, 26) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Vendor Code</th>
                <th className="py-3 px-4">Supplier Organization</th>
                <th className="py-3 px-4">Primary Contact & Email</th>
                <th className="py-3 px-4">Location / Hub</th>
                <th className="py-3 px-4">Reliability Rating</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading Suppliers...
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No suppliers found. Click "Onboard Supplier" to register one.
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => (
                  <tr key={sup.supplier_id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      {sup.supplier_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{sup.supplier_name}</div>
                      <div className="text-[11px] text-slate-400">Tier-1 OEM Partner</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-900 font-medium">{sup.contact_person || 'Operations Lead'}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" />
                        <span>{sup.email}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span>{sup.city || 'Mumbai'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span className="font-bold text-slate-900">4.8</span>
                        <span className="text-[10px] text-slate-400">/ 5.0</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={sup.status || 'ACTIVE'} size="sm" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard Supplier Modal */}
      <Modal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Onboard New Supplier"
        subtitle="Register certified vendor organization, point of contact, and facility hub"
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
              onClick={handleCreateSupplier}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              Register Supplier
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Supplier Business Name
            </label>
            <input
              type="text"
              placeholder="e.g. Bharat Logistics & Components Ltd"
              value={newSup.supplier_name}
              onChange={(e) => setNewSup({ ...newSup, supplier_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                Primary Contact Person
              </label>
              <input
                type="text"
                placeholder="e.g. Vikram Verma"
                value={newSup.contact_person}
                onChange={(e) => setNewSup({ ...newSup, contact_person: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                Contact Email
              </label>
              <input
                type="email"
                placeholder="vikram@vendor.com"
                value={newSup.email}
                onChange={(e) => setNewSup({ ...newSup, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                placeholder="+91 9876543210"
                value={newSup.phone}
                onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                City / Hub
              </label>
              <input
                type="text"
                placeholder="e.g. Pune / Mumbai"
                value={newSup.city}
                onChange={(e) => setNewSup({ ...newSup, city: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Registered Facility Address
            </label>
            <textarea
              rows={2}
              placeholder="Plot 42, MIDC Industrial Area..."
              value={newSup.address}
              onChange={(e) => setNewSup({ ...newSup, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Suppliers;
