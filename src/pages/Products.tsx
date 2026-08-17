import React, { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Layers,
  Edit,
  Trash2,
  Lock,
  Boxes,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';

export const Products: React.FC = () => {
  const { role, canApprovePO, refreshKey, triggerRefresh, showSnackbar } = useApp();

  const isProcurementOfficer =
    role === 'PROCUREMENT_OFFICER' ||
    role === 'ADMIN' ||
    role === 'SYSTEM_ADMIN' ||
    (canApprovePO && canApprovePO());

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Realtime Live Sync across devices/users
  useRealtimeSubscription({
    tables: ['products'],
    channelName: 'products_page_realtime',
    callback: () => fetchProducts(true),
  });

  // Helper to dynamically calculate next collision-free SKU code
  const generateUniqueProductCode = (currentList: any[]) => {
    const existingCodes = new Set(currentList.map((p) => (p.product_code || '').trim().toUpperCase()));
    let nextNum = 3001;
    while (existingCodes.has(`PRD-${nextNum}`)) {
      nextNum++;
    }
    return `PRD-${nextNum}`;
  };

  // Add Product Modal
  const [openCreate, setOpenCreate] = useState(false);
  const [newProd, setNewProd] = useState({
    product_code: 'PRD-3001',
    product_name: '',
    category: 'Hardware',
    unit_of_measure: 'PCS',
    unit_price: 150,
    description: '',
  });

  const handleOpenCreate = () => {
    const nextSku = generateUniqueProductCode(products);
    setNewProd({
      product_code: nextSku,
      product_name: '',
      category: 'Hardware',
      unit_of_measure: 'PCS',
      unit_price: 150,
      description: '',
    });
    setOpenCreate(true);
  };

  // Edit Product Modal
  const [openEdit, setOpenEdit] = useState(false);
  const [editingProd, setEditingProd] = useState<any | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [refreshKey]);

  const fetchProducts = async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const { data, error } = await supabase.from('products').select('*').order('product_name');
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!isProcurementOfficer) {
      showSnackbar('Permission Denied: Only Procurement Officers can add products.', 'error');
      return;
    }

    let cleanCode = newProd.product_code.trim().toUpperCase();
    const cleanName = newProd.product_name.trim();

    if (!cleanName || newProd.unit_price <= 0) {
      showSnackbar('Please enter valid product name and positive unit price.', 'error');
      return;
    }

    // Check if code is already taken in current catalog
    const isCodeTaken = products.some(
      (p) => (p.product_code || '').trim().toUpperCase() === cleanCode
    );
    if (isCodeTaken) {
      const freshSku = generateUniqueProductCode(products);
      showSnackbar(`SKU "${cleanCode}" is already in use. Auto-assigning unique SKU: ${freshSku}`, 'info');
      cleanCode = freshSku;
    }

    try {
      const { error } = await supabase.from('products').insert([
        {
          product_code: cleanCode || generateUniqueProductCode(products),
          product_name: cleanName,
          category: newProd.category,
          unit_of_measure: newProd.unit_of_measure,
          unit_price: newProd.unit_price,
          description: newProd.description || 'Standard OEM grade component',
          status: 'ACTIVE',
        },
      ]);

      if (error) throw error;

      showSnackbar(`Product "${cleanName}" (${cleanCode}) added to master catalog!`, 'success');
      setOpenCreate(false);
      setNewProd({
        product_code: generateUniqueProductCode(products),
        product_name: '',
        category: 'Hardware',
        unit_of_measure: 'PCS',
        unit_price: 150,
        description: '',
      });
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message || 'Failed to add product.', 'error');
    }
  };

  const handleOpenEdit = (p: any) => {
    if (!isProcurementOfficer) {
      showSnackbar('Permission Denied: Only Procurement Officers can edit products.', 'error');
      return;
    }
    setEditingProd({ ...p });
    setOpenEdit(true);
  };

  const handleSaveEditProduct = async () => {
    if (!editingProd || !isProcurementOfficer) return;

    const cleanName = editingProd.product_name?.trim();
    if (!cleanName || Number(editingProd.unit_price) <= 0) {
      showSnackbar('Please enter valid product name and positive price.', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({
          product_name: cleanName,
          category: editingProd.category,
          unit_of_measure: editingProd.unit_of_measure,
          unit_price: Number(editingProd.unit_price),
          description: editingProd.description,
          status: editingProd.status || 'ACTIVE',
        })
        .eq('product_id', editingProd.product_id);

      if (error) throw error;

      showSnackbar(`Product "${cleanName}" updated successfully!`, 'success');
      setOpenEdit(false);
      setEditingProd(null);
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message || 'Failed to update product.', 'error');
    }
  };

  const handleDeleteProduct = async (p: any) => {
    if (!isProcurementOfficer) {
      showSnackbar('Permission Denied: Only Procurement Officers can delete products.', 'error');
      return;
    }

    const confirmDelete = window.confirm(`Are you sure you want to delete SKU "${p.product_name}" (${p.product_code})?`);
    if (!confirmDelete) return;

    try {
      const { error } = await supabase.from('products').delete().eq('product_id', p.product_id);
      if (error) throw error;

      showSnackbar(`Product "${p.product_name}" removed from catalog.`, 'info');
      triggerRefresh();
    } catch (err: any) {
      showSnackbar('Delete failed: ' + err.message, 'error');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span>Master Product SKU Catalog</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              PROCUREMENT CONTROLLED
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Component parts, Bill of Materials (BOM) items, standard contract unit pricing, and UOM specifications. Only Procurement Officers can add and edit catalog items.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs cursor-pointer"
            title="Refresh Catalog"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isProcurementOfficer ? (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Read-Only View</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SKU code, part name, category..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-semibold">Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-hidden focus:border-blue-500"
          >
            <option value="ALL">All Categories</option>
            <option value="Hardware">Hardware & Fasteners</option>
            <option value="Machinery">Machinery & Motors</option>
            <option value="Electronics">Electrical & Sensors</option>
            <option value="Raw Materials">Raw Materials / Metals</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">SKU / Code</th>
                <th className="py-3.5 px-4">Item Name & Description</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Unit of Measure</th>
                <th className="py-3.5 px-4">Standard Rate (INR)</th>
                <th className="py-3.5 px-4">Catalog Status</th>
                {isProcurementOfficer && <th className="py-3.5 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={isProcurementOfficer ? 7 : 6} className="py-12 text-center text-slate-400">
                    Loading Product Catalog...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={isProcurementOfficer ? 7 : 6} className="py-16 text-center text-slate-400">
                    <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2 opacity-75" />
                    <span className="font-bold text-slate-700 block text-sm">No Products found in catalog</span>
                    <span className="text-xs text-slate-500 mt-1 block max-w-md mx-auto">
                      {isProcurementOfficer
                        ? 'Click "Add Product" above to create SKU items with contract pricing and category metadata.'
                        : 'Products are maintained and cataloged exclusively by Procurement Officers.'}
                    </span>
                    {isProcurementOfficer && (
                      <button
                        onClick={() => setOpenCreate(true)}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Product</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.product_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      {p.product_code || 'PRD-001'}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{p.product_name}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{p.description || 'Standard component'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                      {p.unit_of_measure}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      ₹{Number(p.unit_price || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={p.status || 'ACTIVE'} size="sm" />
                    </td>
                    {isProcurementOfficer && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="Delete Product"
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

      {/* Add Product Modal */}
      <Modal
        isOpen={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Add Master Product to Catalog"
        subtitle="Specify part SKU, category classification, contract rate, and measurement standards"
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setOpenCreate(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProduct}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Add Product SKU
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 block">Product Code / SKU</label>
                <button
                  type="button"
                  onClick={() => setNewProd({ ...newProd, product_code: generateUniqueProductCode(products) })}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  title="Generate Unique SKU"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Auto-Gen SKU</span>
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. PRD-3001"
                value={newProd.product_code}
                onChange={(e) => setNewProd({ ...newProd, product_code: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 font-mono"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Category</label>
              <select
                value={newProd.category}
                onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800"
              >
                <option value="Hardware">Hardware & Fasteners</option>
                <option value="Machinery">Machinery & Motors</option>
                <option value="Electronics">Electrical & Sensors</option>
                <option value="Raw Materials">Raw Materials / Metals</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Product Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Industrial Servo Motor 24V"
              value={newProd.product_name}
              onChange={(e) => setNewProd({ ...newProd, product_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Unit of Measure (UOM)</label>
              <select
                value={newProd.unit_of_measure}
                onChange={(e) => setNewProd({ ...newProd, unit_of_measure: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800"
              >
                <option value="PCS">PCS (Pieces)</option>
                <option value="UNITS">UNITS</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="METERS">METERS</option>
                <option value="BOXES">BOXES</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Standard Rate (INR)</label>
              <input
                type="number"
                min="1"
                placeholder="150"
                value={newProd.unit_price}
                onChange={(e) => setNewProd({ ...newProd, unit_price: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Description / Spec Notes</label>
            <textarea
              rows={2}
              placeholder="OEM Grade high precision tolerance component..."
              value={newProd.description}
              onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Edit Product Modal */}
      {editingProd && (
        <Modal
          isOpen={openEdit}
          onClose={() => {
            setOpenEdit(false);
            setEditingProd(null);
          }}
          title={`Edit Product: ${editingProd.product_name}`}
          subtitle={`Update catalog specifications for SKU ${editingProd.product_code}`}
          maxWidth="md"
          footer={
            <>
              <button
                onClick={() => {
                  setOpenEdit(false);
                  setEditingProd(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditProduct}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                Save Changes
              </button>
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Product Code</label>
                <input
                  type="text"
                  disabled
                  value={editingProd.product_code}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Category</label>
                <select
                  value={editingProd.category || 'Hardware'}
                  onChange={(e) => setEditingProd({ ...editingProd, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800"
                >
                  <option value="Hardware">Hardware & Fasteners</option>
                  <option value="Machinery">Machinery & Motors</option>
                  <option value="Electronics">Electrical & Sensors</option>
                  <option value="Raw Materials">Raw Materials / Metals</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Product Name</label>
              <input
                type="text"
                required
                value={editingProd.product_name || ''}
                onChange={(e) => setEditingProd({ ...editingProd, product_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Unit of Measure (UOM)</label>
                <input
                  type="text"
                  value={editingProd.unit_of_measure || 'PCS'}
                  onChange={(e) => setEditingProd({ ...editingProd, unit_of_measure: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Standard Rate (INR)</label>
                <input
                  type="number"
                  min="1"
                  value={editingProd.unit_price || 150}
                  onChange={(e) => setEditingProd({ ...editingProd, unit_price: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Description / Spec Notes</label>
              <textarea
                rows={2}
                value={editingProd.description || ''}
                onChange={(e) => setEditingProd({ ...editingProd, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 resize-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Products;
