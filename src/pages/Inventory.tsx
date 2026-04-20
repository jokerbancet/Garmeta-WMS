// src/pages/Inventory.tsx
import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  ArrowUpDown,
  Download,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AddProductModal from '@/components/inventory/AddProductModal';
import EditProductModal from '@/components/inventory/EditProductModal';
import ProductDetailModal from '@/components/inventory/ProductDetailModal';
import { fetchCatalogWithStock, deleteProduct } from '@/services/inventoryService';
import { fetchCategories, Category } from '@/services/categoryService';

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('Semua');
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [data, catData] = await Promise.all([
        fetchCatalogWithStock(),
        fetchCategories()
      ]);
      
      setCategories(catData);
      console.log('Raw catalog data:', data);

      if (!data || data.length === 0) {
        setInventory([]);
        return;
      }

      // We aggregate by SKU because one SKU might be in multiple locations
      const aggregatedMap = new Map<string, any>();

      data.forEach(variant => {
        const product = (variant.products || {}) as any;
        const inventoryRecords = variant.inventory || [];
        const variantKey = variant.sku || variant.id;

        if (!aggregatedMap.has(variantKey)) {
          aggregatedMap.set(variantKey, {
            id: variant.id,
            productId: product.id,
            variantId: variant.id,
            name: product.name || 'Produk Tanpa Nama',
            categories_id: product.categories_id || '',
            category: product.categories?.name || product.category || 'N/A',
            description: product.description || '',
            sku: variant.sku || 'N/A',
            color: variant.color || '-',
            size: variant.size || '-',
            stock: 0,
            locations: [],
            status: 'Stok Habis'
          });
        }

        const aggregated = aggregatedMap.get(variantKey);
        
        if (inventoryRecords.length > 0) {
          inventoryRecords.forEach((inv: any) => {
            const loc = inv.locations || {};
            aggregated.stock += (inv.quantity || 0);
            if (loc.aisle) {
              aggregated.locations.push(`${loc.aisle}-${loc.rack}${loc.level}`);
            }
          });
        }
      });

      // Finalize status and location strings
      const result = Array.from(aggregatedMap.values()).map(item => ({
        ...item,
        location: item.locations.length > 0 ? Array.from(new Set(item.locations)).join(', ') : 'Belum Dialokasi',
        status: item.stock === 0 ? 'Stok Habis' : item.stock < 10 ? 'Stok Rendah' : 'Tersedia'
      }));
      
      setInventory(result);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Hapus produk ini secara permanen? Seluruh variasi dan stok terkait akan ikut terhapus.')) return;
    
    try {
      await deleteProduct(productId);
      loadData();
    } catch (error: any) {
      console.error('Delete failed:', error);
      alert(`Gagal menghapus: ${error.message}`);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = useMemo(() => {
    return inventory.filter(item => 
      (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       item.sku.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterCategory === 'Semua' || item.category === filterCategory)
    );
  }, [searchTerm, filterCategory, inventory]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Stok</h1>
          <p className="text-sm text-slate-500">Kelola variasi pakaian dan pantau level stok berdasarkan lokasi.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-button border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Download size={16} />
            Ekspor
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="wms-btn-primary"
          >
            <Plus size={18} />
            Tambah Produk
          </button>
        </div>
      </div>

      <AddProductModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => loadData()}
      />

      <EditProductModal
        isOpen={isEditModalOpen}
        product={selectedProduct}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedProduct(null);
        }}
        onSuccess={() => loadData()}
      />

      <ProductDetailModal
        isOpen={isDetailModalOpen}
        product={selectedProduct}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedProduct(null);
        }}
      />

      {/* Control Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari SKU atau Nama Produk..." 
            className="w-full rounded-button border border-slate-200 bg-slate-50 px-10 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-500 mr-2">
            <Filter size={16} />
            Kategori:
          </div>
          <select 
            className="rounded-button border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="Semua">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="wms-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Detail Produk</th>
                <th className="px-6 py-4">Variasi SKU</th>
                <th className="px-6 py-4">Ukuran / Warna</th>
                <th className="px-6 py-4">Stok Saat Ini</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                      <p className="text-xs font-medium">Memuat data stok...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <Package size={32} className="text-slate-200" />
                      <p className="text-xs font-medium">Tidak ada produk ditemukan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <motion.tr 
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group hover:bg-slate-50/50 transition-colors"
                  >
                  <td className="px-6 py-4 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500 shrink-0">
                        <Package size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-slate-900 truncate" title={item.name}>{item.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{item.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {item.sku}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: item.color.toLowerCase() }}></span>
                      {item.color} / {item.size}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900 text-xs">
                    {item.stock} unit
                  </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        item.status === 'Tersedia' ? "bg-emerald-50 text-emerald-600" :
                        item.status === 'Stok Rendah' ? "bg-amber-50 text-amber-600" :
                        "bg-rose-50 text-rose-600"
                      )}>
                        <span className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          item.status === 'Tersedia' ? "bg-emerald-500" :
                          item.status === 'Stok Rendah' ? "bg-amber-500" :
                          "bg-rose-500"
                        )}></span>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setSelectedProduct(item); setIsDetailModalOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Detail Produk"
                        >
                          <Eye size={14} />
                        </button>
                        <button 
                          onClick={() => { setSelectedProduct(item); setIsEditModalOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-all"
                          title="Edit Produk"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(item.productId)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Hapus Produk"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/30">
          <p className="text-xs text-slate-500">Menampilkan {filteredData.length} entri</p>
          <div className="flex gap-2">
            <button disabled className="rounded-button border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-400 opacity-50">Sebelumnya</button>
            <button className="rounded-button border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50">Selanjutnya</button>
          </div>
        </div>
      </div>
    </div>
  );
}
