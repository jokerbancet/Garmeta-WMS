// src/pages/InternalTransfer.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Box, 
  Search, 
  MapPin, 
  Package, 
  CheckCircle2, 
  MoveRight,
  AlertCircle,
  Warehouse,
  History,
  Camera,
  Plus,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  processInternalTransfer, 
  fetchFullInventory,
  fetchRecentTransactions,
  uploadImage
} from '@/services/inventoryService';
import { fetchWarehouses, Warehouse as WarehouseType } from '@/services/warehouseService';
import { fetchLocations, LocationRecord } from '@/services/locationService';
import { InventoryWithDetails } from '@/types/inventory';

const SuccessFeedback = ({ onReset }: { onReset: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-12 text-center"
  >
    <div className="mb-4 rounded-full bg-indigo-100 p-4 text-indigo-600">
      <CheckCircle2 size={48} />
    </div>
    <h2 className="text-xl font-bold text-slate-900">Transfer Berhasil</h2>
    <p className="mt-2 text-sm text-slate-500">Stok telah dipindahkan ke lokasi baru dengan dokumentasi lengkap.</p>
    <button 
      onClick={onReset}
      className="mt-8 wms-btn-primary bg-indigo-600 hover:bg-indigo-700"
    >
      Pindahkan Barang Lain
    </button>
  </motion.div>
);

export default function InternalTransfer() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [availableLocations, setAvailableLocations] = useState<LocationRecord[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  // Selection state
  const [selectedInventory, setSelectedInventory] = useState<InventoryWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInventorySearch, setShowInventorySearch] = useState(false);
  
  // Pending transfers list (batch)
  const [transferList, setTransferList] = useState<any[]>([]);

  // Form state
  const [quantity, setQuantity] = useState<number>(1);
  const [targetLocation, setTargetLocation] = useState({ aisle: '', rack: '', level: '', warehouseId: '' });
  const [note, setNote] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  
  // Photo evidence state
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState('');
  const [afterPreview, setAfterPreview] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [invData, whData, locData, logData] = await Promise.all([
        fetchFullInventory(),
        fetchWarehouses(),
        fetchLocations(),
        fetchRecentTransactions(20) // Fetch more to allow for merging and filtering
      ]);
      setInventory(invData);
      setWarehouses(whData);
      setAvailableLocations(locData);
      setRecentLogs(logData);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredInventory = useMemo(() => {
    if (searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    return inventory.filter(item => 
      item.product_variants.sku.toLowerCase().includes(query) ||
      item.product_variants.products.name.toLowerCase().includes(query) ||
      `${item.locations.aisle}-${item.locations.rack}${item.locations.level}`.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [inventory, searchQuery]);

  const addItemToTransferList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventory || !targetLocation.warehouseId || !targetLocation.aisle || !targetLocation.rack || !targetLocation.level) {
      setError('Harap lengkapi semua data transfer.');
      return;
    }

    if (quantity > selectedInventory.quantity) {
      setError('Jumlah transfer melebihi stok yang tersedia.');
      return;
    }

    const isSameLocation = 
      selectedInventory.locations.aisle === targetLocation.aisle.toUpperCase() &&
      selectedInventory.locations.rack === targetLocation.rack &&
      selectedInventory.locations.level === targetLocation.level.toUpperCase() &&
      selectedInventory.locations.warehouse_id === targetLocation.warehouseId;

    if (isSameLocation) {
      setError('Barang tidak bisa dipindahkan ke tempat yang sama.');
      return;
    }

    // Check if the same SKU is already in the list for the same target location
    const alreadyInList = transferList.find(t => 
      t.variant_id === selectedInventory.variant_id && 
      t.source_location_id === selectedInventory.location_id &&
      t.target_location.aisle === targetLocation.aisle &&
      t.target_location.rack === targetLocation.rack &&
      t.target_location.level === targetLocation.level &&
      t.target_location.warehouseId === targetLocation.warehouseId
    );

    if (alreadyInList) {
       setError('Item dengan rute yang sama sudah ada di daftar.');
       return;
    }

    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      inventory: selectedInventory,
      variant_id: selectedInventory.variant_id,
      source_location_id: selectedInventory.location_id,
      target_location: { ...targetLocation },
      quantity,
      targetDisplay: `${warehouses.find(w => w.id === targetLocation.warehouseId)?.name} > ${targetLocation.aisle}-${targetLocation.rack}${targetLocation.level}`
    };

    setTransferList([...transferList, newItem]);
    
    // Reset item selection
    setSelectedInventory(null);
    setSearchQuery('');
    setQuantity(1);
    setTargetLocation({ aisle: '', rack: '', level: '', warehouseId: '' });
    setError(null);
  };

  const removeItemFromList = (id: string) => {
    setTransferList(transferList.filter(t => t.id !== id));
  };

  const handleBulkTransfer = async () => {
    if (transferList.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Upload evidence photos if they exist (once per batch)
      let beforeUrl = '';
      let afterUrl = '';

      if (beforeFile) {
        beforeUrl = await uploadImage(beforeFile, 'ledger_documents');
      }
      if (afterFile) {
        afterUrl = await uploadImage(afterFile, 'ledger_products');
      }

      // 2. Process each item in the list
      for (const item of transferList) {
        await processInternalTransfer({
          variant_id: item.variant_id,
          source_location_id: item.source_location_id,
          target_location: item.target_location,
          quantity: item.quantity,
          note: note,
          reference_number: referenceNumber,
          before_image_url: beforeUrl,
          after_image_url: afterUrl
        });
      }
      
      setIsSuccess(true);
      loadInitialData();
      
      // Reset everything
      setTransferList([]);
      setNote('');
      setReferenceNumber('');
      setBeforeFile(null);
      setAfterFile(null);
      setBeforePreview('');
      setAfterPreview('');
    } catch (e: any) {
      setError(e.message || 'Gagal memproses transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Target Location Helpers
  const uniqueAisles = useMemo(() => {
    return Array.from(new Set(
      availableLocations
        .filter(l => l.warehouse_id === targetLocation.warehouseId)
        .map(l => l.aisle)
    )).sort();
  }, [availableLocations, targetLocation.warehouseId]);

  const filteredRacks = useMemo(() => 
    Array.from(new Set(
      availableLocations
        .filter(l => l.warehouse_id === targetLocation.warehouseId && l.aisle === targetLocation.aisle)
        .map(l => l.rack)
    )).sort()
  , [availableLocations, targetLocation.warehouseId, targetLocation.aisle]);

  const filteredLevels = useMemo(() => 
    Array.from(new Set(
      availableLocations
        .filter(l => l.warehouse_id === targetLocation.warehouseId && l.aisle === targetLocation.aisle && l.rack === targetLocation.rack)
        .map(l => l.level)
    )).sort()
  , [availableLocations, targetLocation.warehouseId, targetLocation.aisle, targetLocation.rack]);

  if (isSuccess) return <SuccessFeedback onReset={() => setIsSuccess(false)} />;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
          <Box size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Internal Transfer</h1>
          <p className="text-sm text-slate-500">Pindahkan stok antar rak atau lorong dalam gudang.</p>
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
          
          {/* Step 0: Batch Documentation (Shared for all items in this transfer) */}
            <div className="wms-card p-6 space-y-6 bg-slate-50/50 border border-indigo-100">
               <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400">0. Dokumentasi Group Transfer (Opsional)</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                       <span>Foto Sebelum</span>
                       <Camera size={14} className="text-slate-400" />
                     </label>
                     <div className="relative group cursor-pointer h-24 overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-white hover:border-indigo-300 transition-all">
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) { setBeforeFile(file); setBeforePreview(URL.createObjectURL(file)); }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        {beforePreview ? (
                          <img src={beforePreview} alt="Before" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full">
                            <Camera size={20} className="text-slate-300 mb-1" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Ambil</span>
                          </div>
                        )}
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                       <span>Foto Sesudah</span>
                       <Camera size={14} className="text-slate-400" />
                     </label>
                     <div className="relative group cursor-pointer h-24 overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-white hover:border-indigo-300 transition-all">
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) { setAfterFile(file); setAfterPreview(URL.createObjectURL(file)); }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        {afterPreview ? (
                          <img src={afterPreview} alt="After" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full">
                            <Camera size={20} className="text-slate-300 mb-1" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Ambil</span>
                          </div>
                        )}
                     </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">Nomor Referensi / Surat Internal</label>
                    <input 
                      type="text"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="Contoh: IT-2024/001 atau No. Memo"
                      className="wms-input h-10 bg-white"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold text-slate-600">Catatan Group Transfer</label>
                    <textarea 
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Catatan untuk seluruh barang yang dipindahkan dalam batch ini..."
                      className="wms-input min-h-[60px] py-2 resize-none bg-white"
                    />
                  </div>
               </div>
            </div>

            <form onSubmit={addItemToTransferList} className="space-y-6">
              {/* Step 1: Select Source Item */}
              <div className="wms-card p-6 space-y-4 !overflow-visible">
                <h3 className="text-xs font-bold uppercase tracking-widest text-brand">1. Pilih Barang & Lokasi Asal</h3>
                
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
                      placeholder="Cari SKU atau Nama Produk..."
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
                            className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl py-2"
                          >
                            {filteredInventory.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSelectedInventory(item);
                                  setShowInventorySearch(false);
                                  setQuantity(1);
                                }}
                                className="w-full px-4 py-3 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-0"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">{item.product_variants.sku}</p>
                                    <p className="text-[10px] text-slate-500">{item.product_variants.products.name} • {item.product_variants.color}/{item.product_variants.size}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-indigo-600">{item.quantity} Unit</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">{item.locations.aisle}-{item.locations.rack}{item.locations.level}</p>
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
                  <div className="flex items-center justify-between p-4 rounded-xl border-2 border-indigo-100 bg-indigo-50/30">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center text-indigo-600 shadow-sm">
                        <Package size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{selectedInventory.product_variants.sku}</p>
                        <p className="text-xs text-slate-500">{selectedInventory.locations.aisle}-{selectedInventory.locations.rack}{selectedInventory.locations.level} • Stok: {selectedInventory.quantity}</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setSelectedInventory(null)}
                      className="text-xs font-bold text-slate-400 hover:text-rose-500 uppercase tracking-wider"
                    >
                      Ubah
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Set Quantity & Target */}
              {selectedInventory && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="wms-card p-6 space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">2. Detail Lokasi Tujuan</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-600">Jumlah yang Dipindahkan</label>
                        <div className="relative">
                          <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="number" 
                            value={quantity || ''}
                            onChange={(e) => setQuantity(Math.min(selectedInventory.quantity, parseInt(e.target.value) || 0))}
                            max={selectedInventory.quantity}
                            min={1}
                            className="wms-input pl-10 font-bold h-10"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                         <div className="flex items-center gap-2 text-indigo-600">
                            <MoveRight size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Lokasi Tujuan</span>
                         </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-slate-600">Gudang Tujuan</label>
                        <select 
                          value={targetLocation.warehouseId}
                          onChange={(e) => setTargetLocation({ ...targetLocation, warehouseId: e.target.value, aisle: '', rack: '', level: '' })}
                          className="wms-input h-10 appearance-none bg-white font-semibold"
                          required
                        >
                          <option value="">Pilih Gudang</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">Lorong (Aisle)</label>
                        <select 
                          value={targetLocation.aisle}
                          onChange={(e) => setTargetLocation({...targetLocation, aisle: e.target.value, rack: '', level: ''})}
                          className="wms-input h-10 appearance-none bg-white"
                          required
                          disabled={!targetLocation.warehouseId}
                        >
                          <option value="">Pilih Lorong</option>
                          {uniqueAisles.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">Rak</label>
                        <select 
                          value={targetLocation.rack}
                          onChange={(e) => setTargetLocation({...targetLocation, rack: e.target.value, level: ''})}
                          className="wms-input h-10 appearance-none bg-white"
                          required
                          disabled={!targetLocation.aisle}
                        >
                          <option value="">Pilih Rak</option>
                          {filteredRacks.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">Level / Baris</label>
                        <select 
                          value={targetLocation.level}
                          onChange={(e) => setTargetLocation({...targetLocation, level: e.target.value})}
                          className="wms-input h-10 appearance-none bg-white font-bold"
                          required
                          disabled={!targetLocation.rack}
                        >
                          <option value="">Level</option>
                          {filteredLevels.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full h-11 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-600 font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 hover:border-indigo-400 transition-all"
                  >
                    <Plus size={18} />
                    Tambahkan ke Daftar Transfer
                  </button>
                </motion.div>
              )}
            </form>

            {/* Batch List / Cart for Transfers */}
            <AnimatePresence>
              {transferList.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="wms-card p-0 overflow-hidden border-indigo-200 ring-4 ring-indigo-50"
                >
                  <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Daftar Pemindahan ({transferList.length})</h3>
                    <History size={16} className="text-slate-400" />
                  </div>
                  
                  <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                    {transferList.map((item) => (
                      <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <Box size={20} />
                          </div>
                          <div className="max-w-[200px]">
                            <p className="font-bold text-slate-900 leading-tight">{item.inventory.product_variants.sku}</p>
                            <div className="flex items-center gap-1 mt-1">
                               <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter truncate" title={item.inventory.locations.warehouse_id}>
                                  {item.inventory.locations.aisle}-{item.inventory.locations.rack}{item.inventory.locations.level}
                               </p>
                               <MoveRight size={10} className="text-indigo-400 shrink-0" />
                               <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-tighter truncate" title={item.targetDisplay}>
                                  {item.targetDisplay.split('>').pop()?.trim()}
                               </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-900">{item.quantity} Unit</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Qty</p>
                          </div>
                          <button 
                            onClick={() => removeItemFromList(item.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-6 bg-slate-50/50">
                    <button 
                      onClick={handleBulkTransfer}
                      disabled={isSubmitting}
                      className="w-full wms-btn-primary h-12 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all"
                    >
                      {isSubmitting ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          Konfirmasi Semua Pemindahan
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="wms-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History size={16} className="text-slate-400" />
                Transfer Terbaru
              </h3>
              <Link to="/history" className="text-[10px] font-bold text-indigo-600 hover:underline uppercase tracking-wider">
                Lihat Selengkapnya
              </Link>
            </div>
            <div className="space-y-3">
              {(() => {
                const transfersOnly = recentLogs.filter(log => log.transaction_type === 'Transfer');
                const merged: any[] = [];
                const pairedIds = new Set<string>();

                for (let i = 0; i < transfersOnly.length; i++) {
                    const log = transfersOnly[i];
                    if (pairedIds.has(log.id)) continue;

                    const partner = transfersOnly.find(other => 
                        other.id !== log.id &&
                        !pairedIds.has(other.id) &&
                        other.variant_id === log.variant_id &&
                        other.quantity_changed === -log.quantity_changed &&
                        Math.abs(new Date(other.created_at).getTime() - new Date(log.created_at).getTime()) < 3000
                    );

                    if (partner) {
                        pairedIds.add(partner.id);
                        merged.push({
                            ...(log.quantity_changed > 0 ? log : partner),
                            quantity_changed: Math.abs(log.quantity_changed)
                        });
                    } else {
                        merged.push({ ...log, quantity_changed: Math.abs(log.quantity_changed) });
                    }
                }

                const displayedLogs = merged.slice(0, 4);

                if (displayedLogs.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 opacity-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest">Belum ada pemindahan</p>
                    </div>
                  );
                }

                return displayedLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/30 hover:bg-white transition-all group">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{log.product_variants.sku}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1 italic" title={log.report_note}>{log.report_note?.split('.').pop()?.trim() || 'Internal Transfer'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-indigo-600">{log.quantity_changed} Unit</p>
                        <p className="text-[9px] text-slate-400 mt-1">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="rounded-2xl p-6 bg-indigo-600 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Box size={100} />
             </div>
             <div className="relative z-10">
                <h4 className="text-lg font-bold mb-1">Optimasi Gudang</h4>
                <p className="text-xs text-indigo-100 leading-relaxed">Pindahkan stok secara rutin untuk merapikan gudang dan mempercepat proses picking.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
