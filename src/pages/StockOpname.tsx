import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCcw, 
  Plus,
  Warehouse,
  ChevronRight,
  ClipboardList,
  Fingerprint,
  Package,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  createOpnameTicket,
  fetchActiveOpnameTickets,
  fetchOpnameItems,
  submitPhysicalCount,
  OpnameTicket,
  OpnameItem
} from '@/services/opnameService';
import { fetchWarehouses, Warehouse as WarehouseType } from '@/services/warehouseService';
import { fetchLocations, LocationRecord } from '@/services/locationService';
import { fetchCategories } from '@/services/inventoryService';
import { Category } from '@/types/category';

export default function StockOpname() {
  const [tickets, setTickets] = useState<OpnameTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<OpnameTicket | null>(null);
  const [items, setItems] = useState<OpnameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initiation state
  const [showInitiate, setShowInitiate] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [availableLocations, setAvailableLocations] = useState<LocationRecord[]>([]);
  const [initPayload, setInitPayload] = useState({
    warehouseId: '',
    aisle: '',
    rack: '',
    level: '',
    categoryId: ''
  });

  // Counting state
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [processingItemId, setProcessingItemId] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [ticketData, whData, catData, locData] = await Promise.all([
        fetchActiveOpnameTickets(),
        fetchWarehouses(),
        fetchCategories(),
        fetchLocations()
      ]);
      setTickets(ticketData);
      setWarehouses(whData);
      setCategories(catData);
      setAvailableLocations(locData);
    } catch (e) {
      console.error('Failed to load initial data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initPayload.warehouseId) {
      setError('Harap pilih gudang.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createOpnameTicket(initPayload);
      setShowInitiate(false);
      await loadInitialData();
    } catch (e: any) {
      setError(e.message || 'Gagal membuat tiket opname.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startCounting = async (ticket: OpnameTicket) => {
    try {
      setLoading(true);
      const itemData = await fetchOpnameItems(ticket.id);
      setItems(itemData);
      setSelectedTicket(ticket);
      // Initialize counts
      const counts: Record<string, number> = {};
      itemData.forEach(item => {
        if (item.physical_quantity !== null) counts[item.id] = item.physical_quantity;
      });
      setItemCounts(counts);
    } catch (e) {
      console.error('Failed to load items:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCount = async (itemId: string) => {
    const count = itemCounts[itemId];
    if (count === undefined || isNaN(count)) return;

    try {
      setProcessingItemId(itemId);
      await submitPhysicalCount(itemId, count);
      // Update local state status
      setItems(items.map(i => i.id === itemId ? { ...i, status: 'counted', physical_quantity: count } : i));
    } catch (e) {
      console.error('Failed to submit count:', e);
    } finally {
      setProcessingItemId(null);
    }
  };

  // Filters for dropdowns
  const uniqueAisles = useMemo(() => 
    Array.from(new Set(availableLocations.filter(l => l.warehouse_id === initPayload.warehouseId).map(l => l.aisle))).sort()
  , [availableLocations, initPayload.warehouseId]);

  const filteredRacks = useMemo(() => 
    Array.from(new Set(availableLocations.filter(l => l.warehouse_id === initPayload.warehouseId && l.aisle === initPayload.aisle).map(l => l.rack))).sort()
  , [availableLocations, initPayload.warehouseId, initPayload.aisle]);

  const filteredLevels = useMemo(() => 
    Array.from(new Set(availableLocations.filter(l => l.warehouse_id === initPayload.warehouseId && l.aisle === initPayload.aisle && l.rack === initPayload.rack).map(l => l.level))).sort()
  , [availableLocations, initPayload.warehouseId, initPayload.aisle, initPayload.rack]);

  if (loading && !selectedTicket && !showInitiate) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {!selectedTicket && !showInitiate ? (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
                <RefreshCcw size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Stock Opname</h1>
                <p className="text-sm text-slate-500">Kelola kegiatan penghitungan fisik stok.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowInitiate(true)}
              className="wms-btn-primary bg-amber-600 hover:bg-amber-700"
            >
              <Plus size={18} />
              Buat Tiket Baru
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tickets.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                <ClipboardList size={48} className="mx-auto mb-4 opacity-20" />
                <p>Tidak ada kegiatan opname aktif.</p>
              </div>
            ) : (
              tickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => startCounting(ticket)}
                  className="wms-card p-6 text-left hover:border-amber-300 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Fingerprint size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                      {ticket.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-1">{ticket.ticket_number}</h4>
                  <p className="text-xs text-slate-500 mb-4">{ticket.warehouses?.name || 'Gudang'}</p>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      ) : showInitiate ? (
        <div className="max-w-2xl mx-auto space-y-6">
           <button 
            onClick={() => setShowInitiate(false)}
            className="text-sm font-bold text-slate-400 hover:text-amber-600 flex items-center gap-2"
          >
            ← Kembali
          </button>
          
          <div className="wms-card p-6 space-y-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                <Plus size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Inisiasi Stock Opname</h2>
                <p className="text-xs text-slate-500">Pilih parameter untuk membekukan lokasi dan mulai hitung.</p>
              </div>
            </div>

            <form onSubmit={handleInitiate} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">Pilih Gudang</label>
                    <select 
                      value={initPayload.warehouseId}
                      onChange={(e) => setInitPayload({ ...initPayload, warehouseId: e.target.value, aisle: '', rack: '', level: '' })}
                      className="wms-input h-10 appearance-none bg-white font-semibold"
                      required
                    >
                      <option value="">Pilih Gudang</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Lorong (Optional)</label>
                    <select 
                      value={initPayload.aisle}
                      onChange={(e) => setInitPayload({...initPayload, aisle: e.target.value, rack: '', level: ''})}
                      className="wms-input h-10 appearance-none bg-white"
                      disabled={!initPayload.warehouseId}
                    >
                      <option value="">Semua Lorong</option>
                      {uniqueAisles.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Rak (Optional)</label>
                    <select 
                      value={initPayload.rack}
                      onChange={(e) => setInitPayload({...initPayload, rack: e.target.value, level: ''})}
                      className="wms-input h-10 appearance-none bg-white"
                      disabled={!initPayload.aisle}
                    >
                      <option value="">Semua Rak</option>
                      {filteredRacks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Level (Optional)</label>
                    <select 
                      value={initPayload.level}
                      onChange={(e) => setInitPayload({...initPayload, level: e.target.value})}
                      className="wms-input h-10 appearance-none bg-white"
                      disabled={!initPayload.rack}
                    >
                      <option value="">Semua Level</option>
                      {filteredLevels.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600">Kategori (Optional)</label>
                    <select 
                      value={initPayload.categoryId}
                      onChange={(e) => setInitPayload({...initPayload, categoryId: e.target.value})}
                      className="wms-input h-10 appearance-none bg-white"
                    >
                      <option value="">Semua Kategori</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
               </div>

               <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex gap-3 text-blue-700">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="text-xs leading-relaxed">
                    <strong>Catatan:</strong> Lokasi yang dipilih akan <strong>DIBEKUKAN</strong>. Tidak ada transaksi barang masuk atau keluar yang diizinkan selama proses opname berlangsung.
                  </p>
               </div>

               {error && (
                 <div className="p-4 rounded-xl bg-red-50 text-red-600 flex items-center gap-3 text-xs">
                   <AlertCircle size={18} className="shrink-0" />
                   {error}
                 </div>
               )}

               <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full wms-btn-primary h-12 bg-amber-600 hover:bg-amber-700"
               >
                 {isSubmitting ? 'Memproses...' : 'Mulai Opname & Bekukan Lokasi'}
               </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
           <div className="flex items-center justify-between">
              <button 
                onClick={() => setSelectedTicket(null)}
                className="text-sm font-bold text-slate-400 hover:text-amber-600 flex items-center gap-2"
              >
                ← Kembali ke Daftar Tiket
              </button>
              <div className="text-right">
                <h3 className="font-bold text-slate-900">{selectedTicket?.ticket_number}</h3>
                <p className="text-[10px] text-slate-500 uppercase font-bold">{selectedTicket?.warehouses?.name}</p>
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => (
                <div key={item.id} className="wms-card p-5 space-y-4">
                   <div className="flex justify-between items-start">
                      <div className="h-8 w-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
                         <Package size={16} />
                      </div>
                      <span className="text-[10px] font-bold uppercase text-slate-600 bg-slate-100 px-2 py-1 rounded">
                         {item.locations.aisle}-{item.locations.rack}{item.locations.level}
                      </span>
                   </div>
                   
                   <div>
                      <p className="text-sm font-bold text-slate-900">{item.product_variants.sku}</p>
                      <p className="text-[10px] text-slate-500 line-clamp-1">{item.product_variants.products.name}</p>
                   </div>

                   <div className="pt-2 border-t border-slate-50">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Perhitungan Fisik</label>
                      <div className="flex gap-2">
                         <input 
                           type="number"
                           value={itemCounts[item.id] ?? ''}
                           onChange={(e) => setItemCounts({ ...itemCounts, [item.id]: parseInt(e.target.value) || 0 })}
                           placeholder="0"
                           className="wms-input h-10 text-center font-bold"
                         />
                         <button 
                           onClick={() => handleSubmitCount(item.id)}
                           disabled={processingItemId === item.id}
                           className={cn(
                             "px-3 rounded-lg transition-all",
                             item.status === 'counted' || item.status === 'verified'
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-amber-600 text-white shadow-sm"
                           )}
                         >
                            {processingItemId === item.id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              item.status === 'counted' || item.status === 'verified' ? <CheckCircle2 size={18} /> : <Plus size={18} />
                            )}
                         </button>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
}
