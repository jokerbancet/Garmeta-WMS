// src/pages/Categories.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Search, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchCategories, addCategory, deleteCategory, Category } from '@/services/categoryService';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await fetchCategories();
      setCategories(data);
    } catch (err: any) {
      setError(`Kesalahan koneksi: ${err.message || 'Gagal memuat kategori'}. Pastikan koneksi internet stabil dan tabel Supabase sudah siap.`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await addCategory(newCategoryName);
      setNewCategoryName('');
      await loadCategories();
    } catch (err: any) {
      console.error('Error adding category:', err);
      if (err.code === '23505') {
        setError('Kategori dengan nama ini sudah ada.');
      } else if (err.code === 'PGRST116') {
        setError('Gagal mengambil data setelah input. Coba muat ulang.');
      } else if (err.message?.includes('row-level security') || err.code === '42501') {
        setError('Izin ditolak (RLS). Silakan jalankan perintah SQL "CREATE POLICY" untuk tabel categories.');
      } else if (err.code === '23502') {
        setError(`Data tidak lengkap: Kolom "${err.column}" tidak boleh kosong. Pastikan tabel categories memiliki "DEFAULT gen_random_uuid()".`);
      } else {
        setError(err.message || 'Gagal menambah kategori. Pastikan tabel "categories" sudah dibuat di Supabase.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteCategory(id);
      setConfirmDeleteId(null);
      await loadCategories();
    } catch (err: any) {
      setError(`Gagal menghapus: ${err.message || 'Kategori mungkin sedang digunakan oleh produk lain.'}`);
      console.error(err);
      setConfirmDeleteId(null);
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
          <Tag size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Kategori</h1>
          <p className="text-sm text-slate-500">Kelola daftar referensi kategori produk untuk klasifikasi inventaris.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Add Category Form */}
        <div className="lg:col-span-12">
          <div className="wms-card p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Tambah Kategori Baru</h3>
            <form onSubmit={handleAddCategory} className="flex gap-4">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Contoh: Outerwear, Celana, Aksesoris..."
                  className="wms-input pl-10 h-12"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="wms-btn-primary px-8 h-12 shadow-brand/20 shadow-lg shrink-0"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={20} /> Tambah</>}
              </button>
            </form>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-2 text-xs font-medium text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100"
              >
                <AlertCircle size={14} />
                {error}
              </motion.div>
            )}
          </div>
        </div>

        {/* Categories List */}
        <div className="lg:col-span-12">
          <div className="wms-card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Daftar Kategori Terdaftar
              </h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari kategori..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>

            <div className="p-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-brand/30" />
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Memuat Master Data...</p>
                </div>
              ) : filteredCategories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {filteredCategories.map((category) => (
                    <motion.div 
                      key={category.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group flex items-center justify-between rounded-xl border border-slate-100 p-4 hover:border-brand/30 hover:shadow-md transition-all duration-200 bg-white"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          <Tag size={18} />
                        </div>
                        <span className="font-bold text-slate-700">{category.name}</span>
                      </div>
                      
                      {confirmDeleteId === category.id ? (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleDelete(category.id)}
                            className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded"
                          >
                            Hapus
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[10px] font-bold text-slate-400 hover:bg-slate-50 px-2 py-1 rounded"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmDeleteId(category.id)}
                          className="rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200"
                          title="Hapus Kategori"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                  <Tag size={48} className="mb-3 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500">Belum ada kategori yang terdaftar.</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Silakan tambah kategori menggunakan formulir di atas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
