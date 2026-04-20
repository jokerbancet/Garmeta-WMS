// src/pages/StockLedger.tsx
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  History, 
  Search, 
  Filter, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Calendar,
  Download,
  Package,
  Warehouse,
  Eye,
  X,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  MapPin,
  ClipboardList,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchRecentTransactions } from '@/services/inventoryService';
import { AnimatePresence } from 'motion/react';

const LedgerDetailModal = ({ isOpen, onClose, log }: { isOpen: boolean, onClose: () => void, log: any }) => {
  if (!log) return null;

  const isTransfer = log.transaction_type === 'Transfer';
  const isIn = log.transaction_type === 'In';
  const isOut = log.transaction_type === 'Out';
  const isOpname = log.transaction_type === 'Opname';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            {/* Header */}
            <div className={cn(
              "px-6 py-6 text-white relative overflow-hidden",
              isIn ? "bg-emerald-600" : 
              isOut ? "bg-rose-600" :
              isTransfer ? "bg-indigo-600" : "bg-slate-600"
            )}>
              <div className="absolute top-0 right-0 p-8 opacity-10 -rotate-12 translate-x-4">
                {isIn ? <TrendingUp size={120} /> : 
                 isOut ? <TrendingDown size={120} /> :
                 isTransfer ? <RefreshCcw size={120} /> : <History size={120} />}
              </div>
              
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Detail Pergerakan Stok</h3>
                  <p className="text-white/80 text-xs font-medium mt-1">
                    ID Transaksi: #{log.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
                <button onClick={onClose} className="rounded-full bg-white/20 p-2 hover:bg-white/30 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Product Info */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm">
                  <Package size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{log.product_variants?.sku}</p>
                  <p className="text-xs text-slate-500 font-medium">Varian: {log.product_variants?.color} • {log.product_variants?.size}</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Informasi Produk</p>
                </div>
              </div>

              {/* Transaction Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipe Aktifitas</span>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5",
                    isIn ? "bg-emerald-100 text-emerald-700" : 
                    isOut ? "bg-rose-100 text-rose-700" :
                    isTransfer ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
                  )}>
                    {isIn ? <TrendingUp size={14} /> : 
                     isOut ? <TrendingDown size={14} /> :
                     isTransfer ? <RefreshCcw size={14} /> : <History size={14} />}
                    {isIn ? 'Barang Masuk' : isOut ? 'Barang Keluar' : isTransfer ? 'Internal Transfer' : 'Opname Stok'}
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Perubahan Unit</span>
                  <p className={cn(
                    "text-xl font-bold",
                    isTransfer ? "text-indigo-600" : log.quantity_changed > 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {isTransfer ? '' : log.quantity_changed > 0 ? '+' : ''}{log.quantity_changed}
                  </p>
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Waktu Pencatatan</p>
                    <p className="text-sm font-medium text-slate-700">
                      {new Date(log.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} • {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ClipboardList size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nomor Referensi / PO</p>
                    <p className="text-sm font-mono font-bold text-brand">{log.reference_number || 'Tidak Ada'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin size={16} className="text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Catatan Sistem / Lokasi</p>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">
                      {log.report_note || 'Tidak ada catatan tambahan.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Attachments */}
              {(log.document_image_url || log.product_image_url) && (
                <div className="space-y-3 pt-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon size={14} />
                    Lampiran Dokumentasi
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {log.document_image_url && (
                      <a 
                        href={log.document_image_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="group relative h-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      >
                         <img src={log.document_image_url} alt="Doc" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white uppercase">Buka Foto 1</span>
                         </div>
                      </a>
                    )}
                    {log.product_image_url && (
                      <a 
                        href={log.product_image_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="group relative h-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      >
                         <img src={log.product_image_url} alt="Product" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white uppercase">Buka Foto 2</span>
                         </div>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default function StockLedger() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Semua');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        // Fetch a larger set for the dedicated history page
        const data = await fetchRecentTransactions(100);
        setLogs(data);
      } catch (error) {
        console.error('Failed to load stock ledger:', error);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, []);

  const processedLogs = useMemo(() => {
    const result: any[] = [];
    const pairedIds = new Set<string>();

    // We sort by date just in case
    const sorted = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    for (let i = 0; i < sorted.length; i++) {
        const log = sorted[i];
        if (pairedIds.has(log.id)) continue;

        if (log.transaction_type === 'Transfer') {
            // Find its pairing partner
            const partner = sorted.find(other => 
                other.id !== log.id &&
                !pairedIds.has(other.id) &&
                other.transaction_type === 'Transfer' &&
                other.variant_id === log.variant_id &&
                other.quantity_changed === -log.quantity_changed &&
                Math.abs(new Date(other.created_at).getTime() - new Date(log.created_at).getTime()) < 3000
            );

            if (partner) {
                pairedIds.add(partner.id);
                // Group them. Pick the positive one (In) or just one of them.
                // Both notes contain the full route anyway.
                const merged = {
                    ...(log.quantity_changed > 0 ? log : partner),
                    quantity_changed: Math.abs(log.quantity_changed),
                    isMerged: true
                };
                result.push(merged);
            } else {
                // If orphaned, still treat as transfer item
                result.push({ ...log, quantity_changed: Math.abs(log.quantity_changed), isMerged: true });
            }
        } else {
            result.push(log);
        }
    }
    return result;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return processedLogs.filter(log => {
      const matchesSearch = log.product_variants?.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'Semua' || 
                         (filterType === 'Masuk' && log.transaction_type === 'In') ||
                         (filterType === 'Keluar' && log.transaction_type === 'Out') ||
                         (filterType === 'Transfer' && log.transaction_type === 'Transfer');
      return matchesSearch && matchesType;
    });
  }, [processedLogs, searchTerm, filterType]);

  return (
    <div className="space-y-6">
      <LedgerDetailModal 
        isOpen={!!selectedLog} 
        onClose={() => setSelectedLog(null)} 
        log={selectedLog} 
      />

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Riwayat Pergerakan Stok</h1>
            <p className="text-sm text-slate-500">Audit lengkap seluruh transaksi keluar dan masuk barang.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-button border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          <Download size={16} />
          Unduh Laporan (CSV)
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari berdasarkan SKU..." 
            className="w-full rounded-button border border-slate-200 bg-slate-50 px-10 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <select 
            className="rounded-button border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="Semua">Semua Tipe</option>
            <option value="Masuk">Barang Masuk</option>
            <option value="Keluar">Barang Keluar</option>
            <option value="Transfer">Internal Transfer</option>
          </select>
          <div className="h-8 w-px bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Calendar size={16} />
            <span>7 Hari Terakhir</span>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="wms-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Tgl Masuk / Waktu</th>
                <th className="px-6 py-4">No. Surat Jalan / PO</th>
                <th className="px-6 py-4">Informasi Produk</th>
                <th className="px-6 py-4 text-center">Jumlah</th>
                <th className="px-6 py-4">Lokasi & Gudang</th>
                <th className="px-6 py-4">Laporan / Bukti</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                     <div className="flex flex-col items-center gap-3">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                        <p className="text-xs font-medium text-slate-400">Sinkronisasi data ledger...</p>
                     </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <History size={32} strokeWidth={1.5} className="opacity-20" />
                      <p className="text-xs font-medium">Belum ada catatan transaksi yang ditemukan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const inventory = log.product_variants?.inventory || [];
                  const locations = inventory.map((inv: any) => 
                    inv.locations ? `${inv.locations.aisle}-${inv.locations.rack}${inv.locations.level}` : null
                  ).filter(Boolean);
                  
                  const warehouses = inventory.map((inv: any) => 
                    inv.locations?.warehouses?.name
                  ).filter(Boolean);

                  const uniqueLocations = Array.from(new Set(locations)).join(', ') || 'N/A';
                  const uniqueWarehouses = Array.from(new Set(warehouses)).join(', ') || 'Unknown';

                  const isIn = log.transaction_type === 'In';
                  const isTransfer = log.transaction_type === 'Transfer';
                  const isOut = log.transaction_type === 'Out';

                  return (
                    <motion.tr 
                      key={log.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <Calendar size={14} className={cn(
                             isIn ? "text-emerald-500" : 
                             isTransfer ? "text-indigo-500" :
                             "text-rose-500"
                           )} />
                           <div>
                            <p className="font-bold text-slate-900">
                              {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className={cn(
                           "font-mono text-[10px] font-bold px-2 py-0.5 rounded border",
                           isIn ? "text-emerald-600 bg-emerald-50 border-emerald-100" : 
                           isTransfer ? "text-indigo-600 bg-indigo-50 border-indigo-100" :
                           "text-rose-600 bg-rose-50 border-rose-100"
                         )}>
                           {log.reference_number || '-'}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800">{log.product_variants?.sku}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            {log.product_variants?.color} • {log.product_variants?.size}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className="flex flex-col items-center">
                           <span className={cn(
                             "font-bold text-xs px-2 py-1 rounded-full min-w-[40px]",
                             isIn ? "bg-emerald-100 text-emerald-700" : 
                             isTransfer ? "bg-indigo-100 text-indigo-700" :
                             "bg-rose-100 text-rose-700"
                           )}>
                             {isTransfer ? '' : log.quantity_changed > 0 ? '+' : ''}{log.quantity_changed}
                           </span>
                           <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                             {isIn ? 'Masuk' : isTransfer ? 'Transfer' : 'Keluar'}
                           </span>
                         </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700 text-xs">
                        <div className="flex flex-col">
                          <span>{uniqueLocations}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{uniqueWarehouses}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {log.report_note ? (
                            <p className="text-[10px] text-slate-500 font-medium italic truncate max-w-[150px]" title={log.report_note}>
                              {log.report_note}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-400">Reguler</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <button 
                           onClick={() => setSelectedLog(log)}
                           className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:bg-brand hover:text-white"
                         >
                           <Eye size={14} />
                           Detail
                         </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
