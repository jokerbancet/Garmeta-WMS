// src/pages/Warehouses.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Warehouse as WarehouseIcon, 
  Plus, 
  Trash2, 
  MapPin, 
  AlertCircle,
  Loader2,
  Building
} from 'lucide-react';
import { fetchWarehouses, addWarehouse, deleteWarehouse, Warehouse } from '@/services/warehouseService';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', address: '' });
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchWarehouses();
      setWarehouses(data);
    } catch (err: any) {
      setError('Gagal memuat data gudang.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await addWarehouse(formData);
      setFormData({ name: '', code: '', address: '' });
      await loadData();
    } catch (err: any) {
      console.error('Error adding warehouse:', err);
      if (err.code === '23505') {
        setError('Kode gudang ini sudah digunakan.');
      } else if (err.message?.includes('row-level security') || err.code === '42501') {
        setError('Izin ditolak (RLS). Silakan jalankan perintah SQL "CREATE POLICY" untuk tabel warehouses.');
      } else if (err.code === '23502') {
        setError(`Data tidak lengkap: Kolom "${err.column}" tidak boleh kosong. Pastikan tabel warehouses memiliki "DEFAULT gen_random_uuid()".`);
      } else {
        setError(err.message || 'Gagal menambah gudang.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteWarehouse(id);
      setConfirmDeleteId(null);
      await loadData();
    } catch (err: any) {
      setError(`Gagal menghapus: ${err.message || 'Gudang mungkin memiliki rak aktif.'}`);
      console.error(err);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
          <WarehouseIcon size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Gudang</h1>
          <p className="text-sm text-slate-500">Kelola daftar pusat distribusi dan gedung penyimpanan barang.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Form */}
        <div className="lg:col-span-4">
          <div className="wms-card p-6 sticky top-8">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Gudang Baru</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Kode Gudang</label>
                <input 
                  type="text" 
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="Contoh: WH-JKT-01"
                  className="wms-input h-10"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nama Gudang</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Gudang Merdeka Utama"
                  className="wms-input h-10"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Alamat</label>
                <textarea 
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Alamat lengkap..."
                  className="wms-input py-2 h-20 resize-none"
                />
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="wms-btn-primary w-full h-11"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={18} /> Simpan Gudang</>}
              </button>
            </form>
            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 flex items-center gap-2 text-[10px] font-bold text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100 uppercase"
              >
                <AlertCircle size={14} />
                {error}
              </motion.div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-8">
          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="py-20 flex flex-col items-center gap-3 opacity-20">
                <Loader2 className="animate-spin" size={32} />
                <span className="text-xs font-bold uppercase tracking-widest">Sinkronisasi Data...</span>
              </div>
            ) : warehouses.length > 0 ? (
              warehouses.map((wh) => (
                <motion.div 
                  key={wh.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="wms-card p-5 group hover:border-emerald-200 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="h-12 w-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                        <Building size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 uppercase">
                            {wh.code}
                          </span>
                          <h4 className="font-bold text-slate-800">{wh.name}</h4>
                        </div>
                        {wh.address && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin size={12} />
                            {wh.address}
                          </div>
                        )}
                      </div>
                    </div>
                    {confirmDeleteId === wh.id ? (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleDelete(wh.id)}
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
                        onClick={() => setConfirmDeleteId(wh.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                        title="Hapus Gudang"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-20 text-center opacity-30 border-2 border-dashed border-slate-200 rounded-2xl">
                <WarehouseIcon size={48} className="mx-auto mb-3" />
                <p className="text-sm font-medium">Belum ada gudang yang terdaftar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
