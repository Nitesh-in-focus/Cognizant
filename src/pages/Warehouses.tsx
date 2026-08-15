import React, { useState, useEffect } from 'react';
import {
  Building,
  MapPin,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Globe,
  Layers,
  ShieldCheck,
  Power,
  Navigation,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { Modal } from '../components/common/Modal';
import { LocationPickerModal } from '../components/maps/LocationPickerModal';
import { Warehouse } from '../types/database';

export const Warehouses: React.FC = () => {
  const { role, refreshKey, triggerRefresh, showSnackbar, logAuditAction } = useApp();
  const isProcurementOfficer = role === 'PROCUREMENT_OFFICER' || role === 'SYSTEM_ADMIN' || role === 'ADMIN';

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [openLocationPicker, setOpenLocationPicker] = useState(false);

  // Form State
  const [whForm, setWhForm] = useState({
    warehouse_code: '',
    warehouse_name: '',
    city: 'Mumbai',
    address: 'Andheri East Industrial Zone',
    total_docks: 6,
    latitude: 19.1136,
    longitude: 72.8697,
    status: 'ACTIVE',
  });

  useEffect(() => {
    fetchWarehouses();
  }, [refreshKey]);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('warehouse_name');

      if (error) throw error;
      setWarehouses(data || []);
    } catch (err: any) {
      console.error('Error fetching warehouses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    const code = `WH-${Math.floor(100 + Math.random() * 900)}`;
    setWhForm({
      warehouse_code: code,
      warehouse_name: '',
      city: 'Pune',
      address: 'Chakan Industrial Logistics Corridor',
      total_docks: 8,
      latitude: 18.7606,
      longitude: 73.8567,
      status: 'ACTIVE',
    });
    setOpenCreate(true);
  };

  const handleOpenEdit = (wh: Warehouse) => {
    setEditingWh(wh);
    setWhForm({
      warehouse_code: wh.warehouse_code,
      warehouse_name: wh.warehouse_name,
      city: wh.city,
      address: wh.address || '',
      total_docks: wh.total_docks || 4,
      latitude: wh.latitude || 18.7606,
      longitude: wh.longitude || 73.8567,
      status: wh.status || 'ACTIVE',
    });
    setOpenEdit(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProcurementOfficer) {
      showSnackbar('Permission Denied: Only PR Officers can manage warehouses.', 'error');
      return;
    }

    if (!whForm.warehouse_name.trim()) {
      showSnackbar('Please enter a warehouse name.', 'error');
      return;
    }

    try {
      if (editingWh) {
        // Update
        const { error } = await supabase
          .from('warehouses')
          .update({
            warehouse_name: whForm.warehouse_name,
            city: whForm.city,
            address: whForm.address,
            total_docks: whForm.total_docks,
            latitude: whForm.latitude,
            longitude: whForm.longitude,
            status: whForm.status,
          })
          .eq('warehouse_id', editingWh.warehouse_id);

        if (error) throw error;

        await logAuditAction('WAREHOUSE_LOCATION_UPDATED', 'warehouses', editingWh.warehouse_id, {
          warehouse_name: whForm.warehouse_name,
          city: whForm.city,
          latitude: whForm.latitude,
          longitude: whForm.longitude,
          status: whForm.status,
        });

        showSnackbar(`Warehouse ${whForm.warehouse_name} updated successfully!`, 'success');
        setOpenEdit(false);
      } else {
        // Create
        const newId = crypto.randomUUID();
        const { error } = await supabase.from('warehouses').insert([
          {
            warehouse_id: newId,
            warehouse_code: whForm.warehouse_code,
            warehouse_name: whForm.warehouse_name,
            city: whForm.city,
            address: whForm.address,
            total_docks: whForm.total_docks,
            latitude: whForm.latitude,
            longitude: whForm.longitude,
            status: 'ACTIVE',
          },
        ]);

        if (error) throw error;

        await logAuditAction('WAREHOUSE_CREATED', 'warehouses', newId, {
          warehouse_code: whForm.warehouse_code,
          warehouse_name: whForm.warehouse_name,
        });

        showSnackbar(`Warehouse ${whForm.warehouse_name} created and pinned on map!`, 'success');
        setOpenCreate(false);
      }

      fetchWarehouses();
    } catch (err: any) {
      showSnackbar('Failed to save warehouse: ' + err.message, 'error');
    }
  };

  const handleToggleStatus = async (wh: Warehouse) => {
    if (!isProcurementOfficer) return;
    const newStatus = wh.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    try {
      const { error } = await supabase
        .from('warehouses')
        .update({ status: newStatus })
        .eq('warehouse_id', wh.warehouse_id);

      if (error) throw error;
      showSnackbar(`Warehouse status changed to ${newStatus}`, 'info');
      fetchWarehouses();
    } catch (err: any) {
      showSnackbar('Status update failed: ' + err.message, 'error');
    }
  };

  const filteredWarehouses = warehouses.filter(
    (w) =>
      w.warehouse_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.warehouse_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Central Warehouse & Plant Location Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage company delivery terminals, fulfillment DCs, dock capacity, and Google Maps GPS coordinates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchWarehouses}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isProcurementOfficer && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Warehouse Location</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Search warehouse by name, code, or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
        />
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWarehouses.map((wh) => {
          const isActive = wh.status !== 'INACTIVE';
          return (
            <div
              key={wh.warehouse_id}
              className={`p-5 rounded-2xl border bg-white transition-all shadow-xs ${
                isActive ? 'border-slate-200 hover:border-blue-300' : 'border-slate-200 opacity-60 bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">{wh.warehouse_name}</span>
                    <span className="text-[11px] font-mono text-slate-400 font-semibold">{wh.warehouse_code}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">{wh.city}</span>
                    <span className="text-slate-500 block text-[11px]">{wh.address || 'Industrial Hub Corridor'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-500">Intake Docks:</span>
                  <span className="font-bold text-slate-800">{wh.total_docks || 6} Dock Bays</span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">GPS Coordinates:</span>
                  <span className="font-mono text-cyan-700 font-semibold">
                    {wh.latitude ? `${wh.latitude.toFixed(4)}°, ${wh.longitude?.toFixed(4)}°` : 'Standard DC Point'}
                  </span>
                </div>
              </div>

              {isProcurementOfficer && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleStatus(wh)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Power className="w-3 h-3" />
                    <span>{isActive ? 'Mark Inactive' : 'Activate'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(wh)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Location</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit Warehouse Modal */}
      {(openCreate || openEdit) && (
        <Modal
          isOpen={openCreate || openEdit}
          onClose={() => {
            setOpenCreate(false);
            setOpenEdit(false);
          }}
          title={openCreate ? 'Add Central Warehouse & Facility' : `Edit Warehouse: ${whForm.warehouse_name}`}
          maxWidth="lg"
        >
          <form onSubmit={handleSaveWarehouse} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Warehouse Code</label>
                <input
                  type="text"
                  required
                  value={whForm.warehouse_code}
                  onChange={(e) => setWhForm({ ...whForm, warehouse_code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">City Hub</label>
                <input
                  type="text"
                  required
                  value={whForm.city}
                  onChange={(e) => setWhForm({ ...whForm, city: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Warehouse Facility Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Pune Central Fulfillment Hub"
                value={whForm.warehouse_name}
                onChange={(e) => setWhForm({ ...whForm, warehouse_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Street Address</label>
              <input
                type="text"
                value={whForm.address}
                onChange={(e) => setWhForm({ ...whForm, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Map Location Confirmation</span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpenLocationPicker(true)}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors"
                >
                  Pin on Map
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-600">
                <div>Lat: {whForm.latitude.toFixed(4)}° N</div>
                <div>Lng: {whForm.longitude.toFixed(4)}° E</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Total Dock Bays</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={whForm.total_docks}
                  onChange={(e) => setWhForm({ ...whForm, total_docks: parseInt(e.target.value) || 4 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Operational Status</label>
                <select
                  value={whForm.status}
                  onChange={(e) => setWhForm({ ...whForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setOpenCreate(false);
                  setOpenEdit(false);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-md shadow-blue-500/20"
              >
                Save Warehouse
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Map Location Confirmation Modal */}
      <LocationPickerModal
        isOpen={openLocationPicker}
        onClose={() => setOpenLocationPicker(false)}
        initialAddress={whForm.address}
        initialLat={whForm.latitude}
        initialLng={whForm.longitude}
        onConfirm={(loc) => {
          setWhForm({
            ...whForm,
            address: loc.formatted_address,
            city: loc.city,
            latitude: loc.latitude,
            longitude: loc.longitude,
          });
        }}
      />
    </div>
  );
};

export default Warehouses;
