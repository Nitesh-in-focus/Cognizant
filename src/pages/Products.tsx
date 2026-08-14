import React, { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const Products: React.FC = () => {
  const { refreshKey, triggerRefresh, showSnackbar } = useApp();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Add Product Modal
  const [openCreate, setOpenCreate] = useState(false);
  const [newProd, setNewProd] = useState({
    product_name: '',
    category: 'Hardware',
    unit_of_measure: 'PCS',
    unit_price: 150,
    description: '',
  });

  useEffect(() => {
    fetchProducts();
  }, [refreshKey]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('products').select('*').order('product_name');
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async () => {
    try {
      if (!newProd.product_name || newProd.unit_price <= 0) {
        showSnackbar('Please enter valid product details and price', 'error');
        return;
      }

      const suffix = Math.floor(100 + Math.random() * 900);
      const prodCode = `PRD-${suffix}`;

      const { error } = await supabase.from('products').insert([
        {
          product_code: prodCode,
          product_name: newProd.product_name,
          category: newProd.category,
          unit_of_measure: newProd.unit_of_measure,
          unit_price: newProd.unit_price,
          description: newProd.description || 'Standard OEM grade component',
          status: 'ACTIVE',
        },
      ]);

      if (error) throw error;

      showSnackbar(`Product "${newProd.product_name}" added to master catalog!`, 'success');
      setOpenCreate(false);
      setNewProd({ product_name: '', category: 'Hardware', unit_of_measure: 'PCS', unit_price: 150, description: '' });
      triggerRefresh();
    } catch (err: any) {
      showSnackbar(err.message, 'error');
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
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Master Product SKU Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Component parts, Bill of Materials (BOM) items, standard contract unit pricing, and UOM standards.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerRefresh}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Catalog"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOpenCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SKU code, part name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="ALL">All Categories</option>
            <option value="Hardware">Hardware & Fasteners</option>
            <option value="Machinery">Machinery & Motors</option>
            <option value="Electronics">Electrical & Sensors</option>
            <option value="Raw Materials">Raw Materials / Metals</option>
          </select>
        </div>
      </div>

      {/* Products Table (Sections 24, 25, 26) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">SKU / Code</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Standard Unit Price</th>
                <th className="py-3 px-4">Unit of Measure (UOM)</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading Master Catalog...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No products found. Click "Add Product" to add a part.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => (
                  <tr key={prod.product_id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      {prod.product_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{prod.product_name}</div>
                      <div className="text-[11px] text-slate-400">{prod.description || 'OEM Component'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200">
                        {prod.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      ₹{Number(prod.unit_price || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {prod.unit_of_measure || 'PCS'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={prod.status || 'ACTIVE'} size="sm" />
                    </td>
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
        title="Add Product to Master Catalog"
        subtitle="Specify part code, standard contract pricing, and UOM"
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
              onClick={handleCreateProduct}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              Save Product
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Product / Part Name
            </label>
            <input
              type="text"
              placeholder="e.g. Precision Ball Bearings (Grade A)"
              value={newProd.product_name}
              onChange={(e) => setNewProd({ ...newProd, product_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                Category
              </label>
              <select
                value={newProd.category}
                onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              >
                <option value="Hardware">Hardware & Fasteners</option>
                <option value="Machinery">Machinery & Motors</option>
                <option value="Electronics">Electrical & Sensors</option>
                <option value="Raw Materials">Raw Materials / Metals</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                Unit of Measure (UOM)
              </label>
              <select
                value={newProd.unit_of_measure}
                onChange={(e) => setNewProd({ ...newProd, unit_of_measure: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
              >
                <option value="PCS">Pieces (PCS)</option>
                <option value="BOX">Boxes (BOX)</option>
                <option value="KG">Kilograms (KG)</option>
                <option value="MTR">Meters (MTR)</option>
                <option value="SET">Sets (SET)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Standard Base Unit Price (INR)
            </label>
            <input
              type="number"
              value={newProd.unit_price}
              onChange={(e) => setNewProd({ ...newProd, unit_price: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1.5">
              Technical Specification / Description
            </label>
            <textarea
              rows={2}
              placeholder="Specification details, material grade, tolerance..."
              value={newProd.description}
              onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Products;
