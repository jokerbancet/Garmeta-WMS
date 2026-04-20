// src/pages/StockOpname.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCcw, 
  Search, 
  MapPin, 
  Package, 
  CheckCircle2, 
  AlertCircle,
  History,
  Scale,
  ArrowRightLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  processStockOpname, 
  fetchFullInventory,
  fetchRecentTransactions 
} from '@/services/inventoryService';
import { InventoryWithDetails } from '@/types/inventory';

const SuccessFeedback = ({ onReset }: { onReset: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-12 text-center"
  >
    <div className="mb-4 rounded-full bg-amber-100 p-4 text-amber-600">
      <CheckCircle2 size={48} />
    </div>
    <h2 className="text-xl font-bold text-slate-900">Opname Berhasil</h2>
    <p className="mt-2 text-sm text-slate-500">Data persediaan telah disinkronkan dengan stok fisik.</p>
    <button 
      onClick={onReset}
      className="mt-8 wms-btn-primary bg-amber-600 hover:bg-amber-700"
    >
      Lanjut Opname
    </button>
  </motion.div>
);

export default function StockOpname() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  // Selection state
  const [selectedInventory, setSelectedInventory] = useState<InventoryWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInventorySearch, setShowInventorySearch] = useState(false);

  // Form state
  const [physicalQuantity, setPhysicalQuantity] = useState<number | ''>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [invData, logData] = await Promise.all([
        fetchFullInventory(),
        fetchRecentTransactions(5)
      ]);
      setInventory(invData);
      setRecentLogs(logData);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredInventory = useMemo(() => {
    if (!searchQuery) return [];
    return inventory.filter(item => 
      item.product_variants.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_variants.products.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);
  }, [inventory, searchQuery]);

  const handleOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventory || physicalQuantity === '') {
      setError('Harap lengkapi semua data opname.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await processStockOpname({
        inventory_id: selectedInventory.id,
        physical_quantity: physicalQuantity,
        note
      });
      setIsSuccess(true);
      loadInitialData();
      // Reset form
      setSelectedInventory(null);
      setSearchQuery('');
      setPhysicalQuantity('');
      setNote('');
    } catch (e: any) {
      setError(e.message || 'Gagal memproses opname.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) return <SuccessFeedback onReset={() => setIsSuccess(false)} />;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
          <RefreshCcw size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Opname</h1>
          <p className="text-sm text-slate-500">Cocokkan jumlah fisik dengan data di sistem (Cycle Counting).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-xl bg-rose-50 p-4 text-rose-600 border border-rose-100"
            >
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}

          <div className="wms-card p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">1. Cari Barang yang di-Cek</h3>
            
            {!selectedInventory ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowInventorySearch(true);
                  }}
                  onFocus={() => setShowInventorySearch(true)}
                  placeholder="Cari SKU atau Lokasi Rak..."
                  className="wms-input pl-10 h-10"
                />
                
                <AnimatePresence>
                  {showInventorySearch && filteredInventory.length > 0 && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowInventorySearch(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute z-20 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl py-2"
                      >
                        {filteredInventory.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedInventory(item);
                              setShowInventorySearch(false);
                              setPhysicalQuantity(item.quantity);
                            }}
                            className="w-full px-4 py-3 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-0"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-bold text-slate-900">{item.product_variants.sku}</p>
                                <p className="text-[10px] text-slate-500">{item.product_variants.products.name} • {item.product_variants.color}/{item.product_variants.size}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase font-bold">{item.locations.aisle}-{item.locations.rack}{item.locations.level}</p>
                                <p className="text-sm font-bold text-slate-600">Sistem: {item.quantity}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 rounded-xl border-2 border-amber-100 bg-amber-50/30">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center text-amber-600 shadow-sm">
                    <Scale size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{selectedInventory.product_variants.sku}</p>
                    <p className="text-xs text-slate-500">Lokasi: {selectedInventory.locations.aisle}-{selectedInventory.locations.rack}{selectedInventory.locations.level}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedInventory(null)}
                  className="text-xs font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider"
                >
                  Ganti
                </button>
              </div>
            )}
          </div>

          {selectedInventory && (
            <motion.form 
              onSubmit={handleOpname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="wms-card p-6 space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">2. Hasil Perhitungan Fisik</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data Sistem Saat Ini</p>
                      <p className="text-3xl font-bold text-slate-900">{selectedInventory.quantity} <span className="text-sm font-medium text-slate-400">Pcs</span></p>
                    </div>

                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-600">Jumlah Fisik Sebenarnya</label>
                       <div className="relative">
                         <Scale className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" size={18} />
                         <input 
                           type="number" 
                           value={physicalQuantity}
                           onChange={(e) => setPhysicalQuantity(parseInt(e.target.value) || 0)}
                           className="wms-input pl-10 h-12 text-xl font-bold bg-amber-50/10 border-amber-200"
                           required
                         />
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className={cn(
                      "p-4 rounded-xl border flex flex-col items-center justify-center h-full text-center",
                      physicalQuantity === '' || physicalQuantity === selectedInventory.quantity 
                        ? "bg-slate-50 border-slate-100 text-slate-400"
                        : physicalQuantity > selectedInventory.quantity
                          ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                          : "bg-rose-50 border-rose-100 text-rose-600"
                    )}>
                       <ArrowRightLeft size={32} className="mb-2 opacity-20" />
                       <p className="text-[10px] font-bold uppercase tracking-widest mb-1">Analisis Selisih</p>
                       <p className="text-2xl font-bold">
                          {physicalQuantity === '' ? '-' : physicalQuantity - selectedInventory.quantity}
                       </p>
                       <p className="text-[10px] font-medium uppercase mt-1">
                          {physicalQuantity === '' || physicalQuantity === selectedInventory.quantity 
                            ? "Sesuai" 
                            : physicalQuantity > selectedInventory.quantity ? "Stok Lebih" : "Stok Kurang"}
                       </p>
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">Alasan Selisih / Catatan</label>
                    <textarea 
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Contoh: Barang cacat ditemukan, kesalahan input sebelumnya..."
                      className="wms-input min-h-[80px] py-2 resize-none"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full wms-btn-primary h-12 bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-100"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <RefreshCcw size={18} />
                    Selesaikan Opname & Update Stok
                  </>
                )}
              </button>
            </motion.form>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="wms-card p-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <History size={16} className="text-slate-400" />
              Opname Terbaru
            </h3>
            <div className="space-y-3">
              {recentLogs.filter(log => log.transaction_type === 'Opname').length === 0 ? (
                <div className="text-center py-8 text-slate-400 opacity-50">
                  <p className="text-[10px] font-bold uppercase tracking-widest">Belum ada opname</p>
                </div>
              ) : (
                recentLogs.filter(log => log.transaction_type === 'Opname').map((log) => (
                  <div key={log.id} className="p-3 rounded-lg border border-slate-100 bg-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{log.product_variants.sku}</p>
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{log.report_note}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-xs font-bold",
                          log.quantity_changed > 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {log.quantity_changed > 0 ? '+' : ''}{log.quantity_changed}
                        </p>
                        <p className="text-[9px] text-slate-400 mt-1">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl p-6 bg-amber-600 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <RefreshCcw size={100} />
             </div>
             <div className="relative z-10">
                <h4 className="text-lg font-bold mb-1">Akurasi Itu Penting</h4>
                <p className="text-xs text-amber-100 leading-relaxed">Lakukan Cycle Counting secara rutin untuk menjaga kepercayaan data stok tanpa mengganggu operasional gudang.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
