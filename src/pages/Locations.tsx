// src/pages/Locations.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  MapPinned, 
  Plus, 
  Trash2, 
  AlertCircle,
  Loader2,
  Layers,
  Search
} from 'lucide-react';
import { fetchLocations, addLocation, deleteLocation, LocationRecord } from '@/services/locationService';
import { fetchWarehouses, Warehouse } from '@/services/warehouseService';

export default function Locations() {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ warehouse_id: '', aisle: '', rack: '', level: '' });
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [locs, whs] = await Promise.all([fetchLocations(), fetchWarehouses()]);
      setLocations(locs);
      setWarehouses(whs);
      if (whs.length > 0) setFormData(prev => ({ ...prev, warehouse_id: whs[0].id }));
    } catch (err: any) {
      setError('Gagal memuat data lokasi.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warehouse_id || !formData.aisle || !formData.rack || !formData.level) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await addLocation(formData);
      setFormData({ ...formData, aisle: '', rack: '', level: '' }); // keep warehouse_id
      await loadInitialData();
    } catch (err: any) {
      console.error('Error adding location:', err);
      if (err.code === '23505') {
        setError('Lokasi koordinat ini sudah ada.');
      } else if (err.message?.includes('row-level security') || err.code === '42501') {
        setError('Izin ditolak (RLS). Silakan jalankan perintah SQL "CREATE POLICY" untuk tabel locations.');
      } else if (err.code === '23502') {
        setError(`Data tidak lengkap: Kolom "${err.column}" tidak boleh kosong. Pastikan tabel locations memiliki "DEFAULT gen_random_uuid()".`);
      } else {
        setError(err.message || 'Gagal menambah lokasi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteLocation(id);
      setConfirmDeleteId(null);
      await loadInitialData();
    } catch (err: any) {
      setError(`Gagal menghapus: ${err.message || 'Lokasi mungkin berisi stok barang aktif.'}`);
      console.error(err);
      setConfirmDeleteId(null);
    }
  };

  const filteredLocations = locations.filter(l => 
    l.aisle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.rack.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.warehouses?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
          <MapPinned size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lokasi Rak & Penyimpanan</h1>
          <p className="text-sm text-slate-500">Definisikan koordinat lorong, rak, dan level untuk penempatan barang yang presisi.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Form */}
        <div className="lg:col-span-4">
          <div className="wms-card p-6 sticky top-8">
            <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-slate-400">Tambah Rak Baru</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pilih Gudang</label>
                <select 
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                  className="wms-input h-10"
                  required
                >
                  <option value="" disabled>Pilih Gudang...</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>{wh.name} ({wh.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Lorong</label>
                  <input 
                    type="text" 
                    value={formData.aisle}
                    onChange={(e) => setFormData({ ...formData, aisle: e.target.value.toUpperCase() })}
                    placeholder="A1"
                    className="wms-input h-10 text-center"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nomor Rak</label>
                  <input 
                    type="text" 
                    value={formData.rack}
                    onChange={(e) => setFormData({ ...formData, rack: e.target.value.toUpperCase() })}
                    placeholder="12"
                    className="wms-input h-10 text-center"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Level</label>
                  <input 
                    type="text" 
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value.toUpperCase() })}
                    placeholder="B"
                    className="wms-input h-10 text-center"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || warehouses.length === 0}
                className="wms-btn-primary w-full h-11 shadow-lg shadow-brand/10"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Plus size={18} /> Simpan Lokasi</>}
              </button>

              {warehouses.length === 0 && !loading && (
                <p className="mt-2 text-[10px] text-center text-amber-600 font-bold uppercase italic">
                  * Tambah gudang terlebih dahulu
                </p>
              )}
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

        {/* Multi-column List */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari Lorong atau Rak..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-sm"
                />
             </div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest"> Total: {filteredLocations.length} Titik</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full py-20 flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-brand/30" size={32} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sinkronisasi Peta Gudang...</span>
              </div>
            ) : filteredLocations.length > 0 ? (
              filteredLocations.map((loc) => (
                <motion.div 
                  key={loc.id}
                  layout
                  className="wms-card p-4 group hover:shadow-lg transition-all border-slate-100"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-orange-50 text-orange-600 flex flex-col items-center justify-center font-bold">
                        <span className="text-[10px] leading-none text-orange-400 mb-0.5 uppercase">Rak</span>
                        <span className="text-xl leading-none">{loc.rack}</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {loc.warehouses?.name || 'Tanpa Gudang'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-bold text-slate-800 text-lg">
                            {loc.aisle}-{loc.rack}{loc.level}
                          </span>
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                          <span className="text-xs font-medium text-slate-500">Level {loc.level}</span>
                        </div>
                      </div>
                    </div>
                    {confirmDeleteId === loc.id ? (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleDelete(loc.id)}
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
                        onClick={() => setConfirmDeleteId(loc.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                        title="Hapus Lokasi"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center bg-white border border-slate-100 rounded-2xl shadow-sm">
                 <Layers size={40} className="mx-auto mb-3 text-slate-100" />
                 <p className="text-sm font-medium text-slate-400">Belum ada pemetaan lokasi rak.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
