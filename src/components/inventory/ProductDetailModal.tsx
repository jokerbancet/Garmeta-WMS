// src/components/inventory/ProductDetailModal.tsx
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Package, 
  MapPin, 
  History, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight,
  Warehouse
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchVariantHistory, fetchStockByLocation } from '@/services/inventoryService';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
}

export default function ProductDetailModal({ isOpen, onClose, product }: ProductDetailModalProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');

  useEffect(() => {
    if (isOpen && product?.variantId) {
      loadDetails();
    }
  }, [isOpen, product]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const [historyData, locationData] = await Promise.all([
        fetchVariantHistory(product.variantId),
        fetchStockByLocation(product.variantId)
      ]);
      setHistory(historyData);
      setLocations(locationData);
    } catch (error) {
      console.error('Failed to load product details:', error);
    } finally {
      setLoading(false);
    }
  };

  const processedHistory = useMemo(() => {
    const result: any[] = [];
    const pairedIds = new Set<string>();

    const sorted = [...history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (let i = 0; i < sorted.length; i++) {
        const h = sorted[i];
        if (pairedIds.has(h.id)) continue;

        if (h.transaction_type === 'Transfer') {
            const partner = sorted.find(other => 
                other.id !== h.id &&
                !pairedIds.has(other.id) &&
                other.transaction_type === 'Transfer' &&
                other.quantity_changed === -h.quantity_changed &&
                Math.abs(new Date(other.created_at).getTime() - new Date(h.created_at).getTime()) < 3000
            );

            if (partner) {
                pairedIds.add(partner.id);
                const merged = {
                    ...(h.quantity_changed > 0 ? h : partner),
                    quantity_changed: Math.abs(h.quantity_changed),
                    isMerged: true
                };
                result.push(merged);
            } else {
                result.push({ ...h, quantity_changed: Math.abs(h.quantity_changed), isMerged: true });
            }
        } else {
            result.push(h);
        }
    }
    return result;
  }, [history]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative h-[80vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Package size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{product.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {product.sku}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-400 capitalize">{product.category}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-4 gap-4 bg-slate-50/50 px-8 py-6 border-b border-slate-100">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Warna</p>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border border-slate-200" style={{ backgroundColor: product.color.toLowerCase() }}></span>
              <p className="text-sm font-bold text-slate-700">{product.color}</p>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Ukuran</p>
            <p className="text-sm font-bold text-slate-700">{product.size}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Stok</p>
            <p className="text-sm font-bold text-brand">{product.stock} Unit</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Lokasi</p>
            <p className="text-sm font-bold text-slate-700 truncate">{product.locations?.length || 0} Titik</p>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex border-b border-slate-100 px-8">
            <button 
              onClick={() => setActiveTab('stock')}
              className={cn(
                "px-6 py-4 text-sm font-bold transition-all border-b-2 relative",
                activeTab === 'stock' ? "text-brand border-brand" : "text-slate-400 border-transparent hover:text-slate-600"
              )}
            >
              Stok per Lokasi
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "px-6 py-4 text-sm font-bold transition-all border-b-2 relative",
                activeTab === 'history' ? "text-brand border-brand" : "text-slate-400 border-transparent hover:text-slate-600"
              )}
            >
              History Pergerakan
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
                <p className="text-xs font-medium">Sinkronisasi data...</p>
              </div>
            ) : activeTab === 'stock' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {locations.length > 0 ? locations.map((loc, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={idx} 
                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white hover:border-brand/20 transition-all shadow-sm group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 group-hover:scale-110 transition-transform">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {loc.locations.aisle}-{loc.locations.rack}{loc.locations.level}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                          <Warehouse size={10} />
                          {loc.locations.warehouses?.name || 'Gudang Utama'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{loc.quantity}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Unit</p>
                    </div>
                  </motion.div>
                )) : (
                  <div className="col-span-2 py-20 text-center text-slate-400">
                    <p className="text-sm font-medium">Tidak ada stok yang dialokasikan di lokasi spesifik.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {processedHistory.length > 0 ? processedHistory.map((h, idx) => {
                  const isTransfer = h.transaction_type === 'Transfer';
                  return (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      key={h.id} 
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-50 bg-slate-50/30 hover:bg-white hover:border-slate-100 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "rounded-full p-2 whitespace-nowrap",
                          h.transaction_type === 'In' ? "bg-emerald-50 text-emerald-600" : 
                          isTransfer ? "bg-indigo-50 text-indigo-600" :
                          "bg-rose-50 text-rose-600"
                        )}>
                          {h.transaction_type === 'In' ? <TrendingUp size={16} /> : 
                           isTransfer ? <Package size={16} /> :
                           <TrendingDown size={16} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {h.transaction_type === 'In' ? 'Penerimaan Barang' : 
                             isTransfer ? 'Transfer Internal' :
                             'Pengeluaran Barang'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-slate-400 font-medium">
                              {new Date(h.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {h.report_note && (
                              <>
                                <span className="text-[10px] text-slate-300">•</span>
                                <p className="text-[10px] text-slate-500 italic max-w-[200px] truncate" title={h.report_note}>
                                  {h.report_note}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-sm font-bold",
                          h.transaction_type === 'In' ? "text-emerald-600" : 
                          isTransfer ? "text-indigo-600" :
                          "text-rose-600"
                        )}>
                          {isTransfer ? '' : h.quantity_changed > 0 ? '+' : ''}{h.quantity_changed}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Unit</p>
                      </div>
                    </motion.div>
                  );
                }) : (
                  <div className="py-20 text-center text-slate-400">
                    <History size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-medium">Belum ada riwayat pergerakan untuk produk ini.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
