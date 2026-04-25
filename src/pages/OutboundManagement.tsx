import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Truck, 
  Plus, 
  ChevronRight, 
  Search,
  CheckCircle2,
  Clock,
  LayoutGrid,
  ClipboardList,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { 
  fetchOutboundOrders, 
  createOutboundOrder, 
  finalizeShipping, 
  OutboundOrder,
  updateOrderStatus
} from '@/services/outboundService';
import { searchVariants } from '@/services/inventoryService';
import { cn } from '@/lib/utils';

export default function OutboundManagement() {
  const [orders, setOrders] = useState<OutboundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [selectedVariants, setSelectedVariants] = useState<{ id: string; sku: string; quantity: number }[]>([]);
  const [searchSku, setSearchSku] = useState('');
  const [variants, setVariants] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<OutboundOrder['status'] | 'all'>('all');

  useEffect(() => {
    loadOrders();
  }, [tab]);

  useEffect(() => {
    if (searchSku.length >= 2) {
      setIsSearching(true);
      searchVariants(searchSku).then(data => {
        setVariants(data);
        setIsSearching(false);
      });
    } else {
      setVariants([]);
      setIsSearching(false);
    }
  }, [searchSku]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await fetchOutboundOrders(tab === 'all' ? undefined : tab);
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedVariants.length === 0 || !customerName) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createOutboundOrder(
        customerName, 
        selectedVariants.map(v => ({ variantId: v.id, quantity: v.quantity }))
      );
      setShowCreate(false);
      setCustomerName('');
      setSelectedVariants([]);
      loadOrders();
    } catch (e: any) {
      setErrorMessage(e.message || 'Gagal membuat pesanan. Pastikan stok mencukupi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShipOrder = async (orderId: string) => {
    if (!confirm('Konfirmasi pengiriman final? Stok akan dikurangi secara permanen.')) return;
    try {
      setIsSubmitting(true);
      await finalizeShipping(orderId);
      loadOrders();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <Truck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Outbound / Pengeluaran</h1>
            <p className="text-sm text-slate-500">Kelola siklus pengiriman barang ke pelanggan.</p>
          </div>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="wms-btn-primary bg-blue-600 hover:bg-blue-700"
        >
          <Plus size={18} />
          Entri Pesanan Baru
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 pb-px overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'Semua', icon: LayoutGrid },
          { id: 'allocated', label: 'Dialokasikan', icon: Clock },
          { id: 'picking', label: 'Picking', icon: ClipboardList },
          { id: 'packed', label: 'Packing', icon: Package },
          { id: 'shipped', label: 'Terkirim', icon: CheckCircle2 }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap",
              tab === t.id 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Order List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-400">
            <ClipboardList size={64} className="mx-auto mb-4 opacity-10" />
            <p>Tidak ada pesanan.</p>
          </div>
        ) : (
          orders.map(order => (
            <motion.div 
              layout
              key={order.id}
              className="wms-card overflow-hidden group"
            >
              <div className={cn(
                "h-1 w-full",
                order.status === 'shipped' ? 'bg-emerald-500' : 
                order.status === 'allocated' ? 'bg-blue-500' : 'bg-amber-500'
              )} />
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900">{order.order_number}</h3>
                    <p className="text-xs text-slate-500 mt-1">{order.customer_name}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-1 rounded-full",
                    order.status === 'shipped' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  )}>
                    {order.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>{new Date(order.created_at).toLocaleDateString()}</span>
                </div>

                <div className="pt-4 flex gap-2">
                  {order.status === 'allocated' && (
                    <button 
                      onClick={() => updateOrderStatus(order.id, 'picking').then(loadOrders)}
                      className="flex-1 wms-btn-secondary text-[10px] font-bold py-2"
                    >
                      Mulai Picking
                    </button>
                  )}
                  {order.status === 'packed' && (
                    <button 
                      onClick={() => handleShipOrder(order.id)}
                      className="flex-1 wms-btn-primary bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold py-2"
                    >
                      Konfirmasi Pengiriman
                    </button>
                  )}
                  {order.status === 'picking' && (
                    <a 
                      href={`/outbound/picking?orderId=${order.id}`}
                      className="flex-1 wms-btn-primary bg-amber-600 hover:bg-amber-700 text-[10px] font-bold py-2 text-center"
                    >
                      Buka Mobile Picking
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Order Modal (Langkah 1) */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-900">Entri Pesanan Baru</h2>
                </div>

                <form onSubmit={handleCreateOrder} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Nama Pelanggan / Nomor Resi</label>
                    <input 
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="wms-input h-12"
                      placeholder="Contoh: Toko Abadi / JNE-123"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Cari Produk (SKU)</label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        value={searchSku}
                        onChange={(e) => setSearchSku(e.target.value)}
                        className="wms-input h-12 pl-12"
                        placeholder="Ketik SKU untuk menambah..."
                      />
                    </div>
                    
                    {/* Search Results */}
                    {searchSku.length >= 2 && (
                      <div className="relative">
                        <div className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto bg-white border rounded-xl shadow-xl divide-y">
                          {isSearching ? (
                            <div className="p-4 text-center text-slate-400 text-xs">Mencari...</div>
                          ) : variants.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-xs">Produk tidak ditemukan.</div>
                          ) : (
                            variants.map(v => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  if (!selectedVariants.find(sv => sv.id === v.id)) {
                                    setSelectedVariants([...selectedVariants, { id: v.id, sku: v.sku, quantity: 1 }]);
                                  }
                                  setSearchSku('');
                                }}
                                className="w-full p-3 text-left hover:bg-blue-50 transition-colors text-sm flex justify-between items-center group"
                              >
                                <div>
                                  <span className="font-bold block text-slate-900 group-hover:text-blue-600">{v.sku}</span>
                                  <span className="text-slate-500 text-xs">{v.products.name}</span>
                                </div>
                                <Plus size={16} className="text-slate-300 group-hover:text-blue-500" />
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Selected List */}
                    <div className="space-y-2">
                      {selectedVariants.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="flex-1 font-bold text-slate-700 text-sm">{item.sku}</span>
                          <div className="flex items-center gap-2">
                            <button 
                              type="button"
                              onClick={() => {
                                const newItems = [...selectedVariants];
                                newItems[idx].quantity = Math.max(1, newItems[idx].quantity - 1);
                                setSelectedVariants(newItems);
                              }}
                              className="h-8 w-8 rounded-lg border flex items-center justify-center"
                            >-</button>
                            <input 
                              type="number"
                              className="w-12 h-8 text-center bg-transparent font-bold"
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...selectedVariants];
                                newItems[idx].quantity = parseInt(e.target.value) || 1;
                                setSelectedVariants(newItems);
                              }}
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                const newItems = [...selectedVariants];
                                newItems[idx].quantity += 1;
                                setSelectedVariants(newItems);
                              }}
                              className="h-8 w-8 rounded-lg border flex items-center justify-center font-bold"
                            >+</button>
                            <button 
                              type="button"
                              onClick={() => {
                                setSelectedVariants(selectedVariants.filter((_, i) => i !== idx));
                              }}
                              className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors ml-1"
                              title="Hapus"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedVariants.length > 0 && (
                    <div className="flex justify-between items-center px-2 py-1 text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-50 rounded-lg">
                      <span>Total Item Unik</span>
                      <span>{selectedVariants.length} Produk</span>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl bg-amber-50 text-amber-700 text-[10px] flex gap-3">
                    <AlertCircle size={20} className="shrink-0" />
                    <p className="leading-relaxed font-bold uppercase tracking-wide">
                      <strong>Soft Booking:</strong> Sistem akan membooking stok yang tersedia namun tidak akan mengurangi jumlah fisik sampai pengiriman dikonfirmasi.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="p-4 rounded-xl bg-red-50 text-red-600 flex items-center gap-3 text-xs font-bold font-mono">
                      <AlertCircle size={18} className="shrink-0" />
                      {errorMessage}
                    </div>
                  )}

                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="flex-1 wms-btn-secondary h-12"
                    >Batal</button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 wms-btn-primary bg-blue-600 hover:bg-blue-700 h-12"
                    >
                      {isSubmitting ? 'Memproses...' : 'Buat Pesanan & Alokasi'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
