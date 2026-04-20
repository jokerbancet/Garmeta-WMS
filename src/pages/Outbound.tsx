// src/pages/Outbound.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUpRight, 
  Search, 
  ShoppingCart, 
  Trash2, 
  ChevronRight, 
  CheckCircle2, 
  Box,
  Truck,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { processOutbound } from '@/services/inventoryService';
import { ProductVariant } from '@/types/inventory';

interface PickingItem {
  id: string;
  sku: string;
  name: string;
  available: number;
  quantity: number;
}

const SuccessState = ({ onReset }: { onReset: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-12 text-center"
  >
    <div className="mb-4 rounded-full bg-indigo-100 p-4 text-indigo-600">
      <Truck size={48} />
    </div>
    <h2 className="text-xl font-bold text-slate-900">Pesanan Dikirim</h2>
    <p className="mt-2 text-sm text-slate-500">Stok telah dikurangi dan slip pengepakan telah dibuat.</p>
    <button 
      onClick={onReset}
      className="mt-8 wms-btn-primary"
    >
      Mulai Daftar Pengeluaran Baru
    </button>
  </motion.div>
);

export default function Outbound() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickingList, setPickingList] = useState<PickingItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('product_variants')
      .select(`
        id,
        sku,
        color,
        size,
        products (name)
      `)
      .or(`sku.ilike.%${val}%,barcode.ilike.%${val}%`)
      .limit(5);
    
    setSearchResults(data || []);
  };

  const addToPickingList = (variant: any) => {
    if (pickingList.find(p => p.id === variant.id)) return;
    setPickingList([...pickingList, { 
      id: variant.id, 
      sku: variant.sku, 
      name: `${variant.products.name} (${variant.color}/${variant.size})`, 
      available: 999, // We verify during confirm
      quantity: 1 
    }]);
    setSearchTerm('');
    setSearchResults([]);
  };

  const updateQuantity = (id: string, delta: number) => {
    setPickingList(current => current.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setPickingList(current => current.filter(item => item.id !== id));
  };

  const handleShipment = async () => {
    if (pickingList.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Process sequentially
      for (const item of pickingList) {
        await processOutbound({
          variant_id: item.id,
          quantity: item.quantity
        });
      }
      setIsSuccess(true);
      setPickingList([]);
    } catch (e: any) {
      setError(e.message || 'Gagal memproses pengiriman. Cek stok Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) return <SuccessState onReset={() => setIsSuccess(false)} />;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
          <ArrowUpRight size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pengeluaran Barang</h1>
          <p className="text-sm text-slate-500">Buat daftar pengambilan barang untuk pengiriman pesanan.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Search and Selection */}
        <div className="lg:col-span-7 space-y-6">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-700 border border-amber-100"
            >
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
          <div className="wms-card p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Cari Komponen</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Cari SKU atau Produk..."
                className="wms-input pl-10 h-12"
              />
            </div>

            {/* Search Results Dropdown-style list */}
            <AnimatePresence>
              {searchTerm && searchResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-2 divide-y divide-slate-50 rounded-lg border border-slate-100 bg-white shadow-lg"
                >
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToPickingList(item)}
                      className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-900">{item.products.name}</p>
                        <p className="font-mono text-[10px] text-slate-400 uppercase">{item.sku} ({item.color}/{item.size})</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-300" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="wms-card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart size={16} className="text-slate-400" />
                Daftar Ambil Barang Aktif
              </h3>
            </div>
            {pickingList.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {pickingList.map((item) => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-50/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 shadow-inner">
                        <Box size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{item.name}</p>
                        <p className="font-mono text-xs text-slate-400 uppercase tracking-tighter">{item.sku}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between sm:mt-0 sm:gap-8">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold text-slate-900">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm"
                        >
                          +
                        </button>
                      </div>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                <ShoppingCart size={48} className="mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">Daftar pengambilan barang kosong.</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Cari dan tambah barang untuk memulai</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Summary and Shipment Actions */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 space-y-6">
            <div className="wms-card p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Ringkasan Pengiriman</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total SKU</span>
                  <span className="font-bold">{pickingList.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Jumlah Barang</span>
                  <span className="font-bold">
                    {pickingList.reduce((acc, curr) => acc + curr.quantity, 0)} Unit
                  </span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Alokasi Kurir</span>
                  <select className="bg-transparent font-bold text-xs focus:outline-none">
                    <option>DHL Logistics</option>
                    <option>FedEx Ground</option>
                    <option>Fleet Internal</option>
                  </select>
                </div>
              </div>

              {pickingList.some(item => item.available < item.quantity) && (
                <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-amber-700">
                  <AlertCircle size={16} className="shrink-0" />
                  <p className="text-[10px] leading-tight font-medium">
                    Peringatan: Satu atau lebih barang melewati batas stok tersedia di lokasi utama.
                  </p>
                </div>
              )}

              <button
                disabled={pickingList.length === 0 || isSubmitting}
                onClick={handleShipment}
                className="w-full wms-btn-primary h-12 mt-4 shadow-brand/20 shadow-xl"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Konfirmasi & Kirim Pesanan
                  </>
                )}
              </button>
            </div>

            <div className="wms-card p-6 bg-slate-50 border-none">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Panduan Pengeluaran</h4>
              <ul className="space-y-3">
                <li className="flex gap-3 items-start">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                  <p className="text-[11px] text-slate-500 leading-normal">Lakukan pengecekan kualitas garmen sebelum dibungkus.</p>
                </li>
                <li className="flex gap-3 items-start">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                  <p className="text-[11px] text-slate-500 leading-normal">Pastikan slip pengepakan dimasukkan ke dalam kantong pengiriman.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
