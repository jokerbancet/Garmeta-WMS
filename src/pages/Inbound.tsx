// src/pages/Inbound.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  ArrowDownLeft, 
  Search, 
  MapPin, 
  Package, 
  CheckCircle2, 
  Plus,
  QrCode,
  History,
  AlertCircle,
  Warehouse
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { processInbound, fetchRecentInboundLogs, searchVariants, uploadImage } from '@/services/inventoryService';
import { fetchLocations, LocationRecord } from '@/services/locationService';
import { fetchWarehouses, Warehouse as WarehouseType } from '@/services/warehouseService';
import { TransactionType } from '@/types/inventory';

// Component for the "Success" state after receiving
const SuccessFeedback = ({ onReset }: { onReset: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-12 text-center"
  >
    <div className="mb-4 rounded-full bg-emerald-100 p-4 text-emerald-600">
      <CheckCircle2 size={48} />
    </div>
    <h2 className="text-xl font-bold text-slate-900">Barang Berhasil Diterima</h2>
    <p className="mt-2 text-sm text-slate-500">Persediaan telah diperbarui dan entri buku besar telah dibuat.</p>
    <button 
      onClick={onReset}
      className="mt-8 wms-btn-primary"
    >
      Terima Barang Lanjut
    </button>
  </motion.div>
);

export default function Inbound() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [availableLocations, setAvailableLocations] = useState<LocationRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  
  // Inbound List state
  const [inboundList, setInboundList] = useState<any[]>([]);
  
  // Search state
  const [searchSKU, setSearchSKU] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Form State
  const [quantity, setQuantity] = useState<number>(0);
  const [location, setLocation] = useState({ aisle: '', rack: '', level: '', warehouseId: '' });
  const [referenceNumber, setReferenceNumber] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState('');
  const [productPreview, setProductPreview] = useState('');

  // Load initial data
  useEffect(() => {
    loadRecentLogs();
    fetchWarehouses().then(setWarehouses).catch(console.error);
    fetchLocations().then(setAvailableLocations).catch(console.error);
  }, []);

  const loadRecentLogs = async () => {
    try {
      setLoading(true);
      const logs = await fetchRecentInboundLogs(4);
      setRecentLogs(logs);
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = async (val: string) => {
    setSearchSKU(val);
    if (val.length >= 2) {
      try {
        const results = await searchVariants(val);
        setSuggestions(results || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Search failed:', err);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (variant: any) => {
    setSearchSKU(variant.sku);
    setSelectedVariant(variant);
    setShowSuggestions(false);
  };

  const addItemToList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.warehouseId || !searchSKU || quantity <= 0 || !location.aisle || !location.rack || !location.level) {
      setError('Harap lengkapi semua data produk dan lokasi.');
      return;
    }

    const warehouseName = warehouses.find(w => w.id === location.warehouseId)?.name || 'Unknown';
    
    const newItem = {
      id: Math.random().toString(36).substr(2, 9),
      sku: searchSKU,
      variant: selectedVariant,
      quantity,
      location: { ...location, warehouseName }
    };

    setInboundList([...inboundList, newItem]);
    
    // Reset individual item form but KEEP global document info (PO, QC, Images)
    setSearchSKU('');
    setSelectedVariant(null);
    setQuantity(0);
    setError(null);
  };

  const removeItemFromList = (id: string) => {
    setInboundList(inboundList.filter(item => item.id !== id));
  };

  const handleReceiveAll = async () => {
    if (inboundList.length === 0) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // 1. Upload images if they exist
      let finalDocUrl = '';
      let finalProdUrl = '';

      if (documentFile) {
        finalDocUrl = await uploadImage(documentFile, 'ledger_documents');
      }
      if (productFile) {
        finalProdUrl = await uploadImage(productFile, 'ledger_products');
      }

      // 2. Process each item in the list using the GLOBAL document info
      for (const item of inboundList) {
        await processInbound({
          skuOrBarcode: item.sku,
          quantity: item.quantity,
          location: {
            aisle: item.location.aisle,
            rack: item.location.rack,
            level: item.location.level,
            warehouseId: item.location.warehouseId
          },
          reference_number: referenceNumber,
          report_note: reportNote,
          document_image_url: finalDocUrl,
          product_image_url: finalProdUrl
        });
      }
      
      setInboundList([]);
      setIsSuccess(true);
      // Reset global fields ONLY after success
      setReferenceNumber('');
      setReportNote('');
      setDocumentFile(null);
      setProductFile(null);
      setDocumentPreview('');
      setProductPreview('');
      loadRecentLogs();
    } catch (e: any) {
      setError(e.message || 'Terjadi kesalahan saat memproses penerimaan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Extract unique aisles, racks based on selected aisle, etc.
  const uniqueAisles = useMemo(() => {
    return Array.from(new Set(
      availableLocations
        .filter(l => l.warehouse_id === location.warehouseId)
        .map(l => l.aisle)
    )).sort();
  }, [availableLocations, location.warehouseId]);

  const filteredRacks = useMemo(() => 
    Array.from(new Set(
      availableLocations
        .filter(l => l.warehouse_id === location.warehouseId && l.aisle === location.aisle)
        .map(l => l.rack)
    )).sort()
  , [availableLocations, location.warehouseId, location.aisle]);

  const filteredLevels = useMemo(() => 
    Array.from(new Set(
      availableLocations
        .filter(l => l.warehouse_id === location.warehouseId && l.aisle === location.aisle && l.rack === location.rack)
        .map(l => l.level)
    )).sort()
  , [availableLocations, location.warehouseId, location.aisle, location.rack]);

  if (isSuccess) return <SuccessFeedback onReset={() => setIsSuccess(false)} />;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-indigo-50 p-3 text-brand">
          <ArrowDownLeft size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Penerimaan Barang</h1>
          <p className="text-sm text-slate-500">Pilih gudang, scan SKU, dan tentukan lokasi penyimpanan.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Main Entry Form */}
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

          {/* SECTION 1: DOCUMENT / BATCH INFO */}
          <div className="wms-card p-6 space-y-6 bg-slate-50/50">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Informasi Surat Jalan / PO (Satu Dokumen untuk Banyak Barang)</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-600">Nomor Surat Jalan / PO</label>
                <input 
                  type="text" 
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Contoh: SJ-2024-001 atau PO-98765"
                  className="wms-input h-10 border-slate-300"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-600">Laporan QC / Catatan Penerimaan</label>
                <textarea 
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Catatan tambahan untuk seluruh dokumen ini..."
                  className="wms-input min-h-[60px] py-2 resize-none border-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                  <span>Foto Surat Jalan / PO</span>
                  {documentPreview && <span className="text-[10px] text-emerald-500 font-bold uppercase underline">Lihat Preview</span>}
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setDocumentFile(file);
                      setDocumentPreview(URL.createObjectURL(file));
                    }
                  }}
                  className="wms-input h-10 flex items-center p-1 text-[10px] border-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                  <span>Foto Bukti Barang</span>
                  {productPreview && <span className="text-[10px] text-emerald-500 font-bold uppercase underline">Lihat Preview</span>}
                </label>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setProductFile(file);
                      setProductPreview(URL.createObjectURL(file));
                    }
                  }}
                  className="wms-input h-10 flex items-center p-1 text-[10px] border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: ITEM ENTRY */}
          <form onSubmit={addItemToList} className="wms-card p-6 space-y-6 relative border-brand/20 shadow-lg shadow-brand/5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-brand">Input Produk & Lokasi</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Warehouse Selection */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-600">Gudang Penyimpanan</label>
                <div className="relative">
                  <Warehouse size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select 
                    value={location.warehouseId}
                    onChange={(e) => setLocation({ 
                      ...location, 
                      warehouseId: e.target.value,
                      aisle: '',
                      rack: '',
                      level: ''
                    })}
                    className="wms-input pl-10 h-10 appearance-none bg-white font-semibold"
                    required
                  >
                    <option value="">Pilih Gudang</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
              </div>

              {/* SKU Search/Scan with Suggestions */}
              <div className="space-y-2 relative md:col-span-2">
                <label className="text-xs font-bold text-slate-600">SKU Produk / Barcode</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={searchSKU}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => searchSKU.length >= 2 && setShowSuggestions(true)}
                    placeholder="Ketik SKU atau scan Barcode..."
                    className="wms-input pl-10 h-10"
                    required
                  />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
                    <QrCode size={18} />
                  </button>
                </div>

                {/* Suggestions Dropdown */}
                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute z-20 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl py-2"
                      >
                        {suggestions.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => selectSuggestion(s)}
                            className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-0"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-900">{s.sku}</p>
                              <p className="text-[10px] text-slate-400">{s.products?.name} • {s.color}/{s.size}</p>
                            </div>
                            <Package size={14} className="text-slate-300" />
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">Jumlah Penerimaan</label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="number" 
                    value={quantity || ''}
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                    placeholder="Contoh: 50"
                    className="wms-input pl-10 font-bold h-10"
                    min="1"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">Lorong (Aisle)</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select 
                    value={location.aisle}
                    onChange={(e) => setLocation({...location, aisle: e.target.value, rack: '', level: ''})}
                    className="wms-input pl-10 h-10 appearance-none bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
                    required
                    disabled={!location.warehouseId}
                  >
                    <option value="">Pilih Lorong</option>
                    {uniqueAisles.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">Rak</label>
                <select 
                  value={location.rack}
                  onChange={(e) => setLocation({...location, rack: e.target.value, level: ''})}
                  className="wms-input h-10 appearance-none bg-white disabled:bg-slate-50 disabled:cursor-not-allowed"
                  required
                  disabled={!location.aisle}
                >
                  <option value="">Pilih Rak</option>
                  {filteredRacks.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">Level / Baris</label>
                <select 
                  value={location.level}
                  onChange={(e) => setLocation({...location, level: e.target.value})}
                  className="wms-input h-10 appearance-none bg-white font-bold disabled:bg-slate-50 disabled:cursor-not-allowed uppercase"
                  required
                  disabled={!location.rack}
                >
                  <option value="">Level</option>
                  {filteredLevels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
               <div className="flex items-center gap-3 text-brand">
                  <Warehouse size={20} className="shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest leading-none">Status Lokasi Terpilih</p>
                    <p className="text-xs font-medium text-slate-600 mt-1 line-clamp-1">
                      {location.warehouseId && location.aisle && location.rack && location.level 
                        ? `${warehouses.find(w => w.id === location.warehouseId)?.name} > ${location.aisle}-${location.rack}${location.level}`
                        : "Harap pilih gudang dan detail lokasi penyimpanan."}
                    </p>
                  </div>
               </div>
            </div>

            <button 
              type="submit" 
              className="w-full h-11 border-2 border-dashed border-brand/30 rounded-xl text-brand font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand/5 hover:border-brand/50 transition-all"
            >
              <Plus size={18} />
              Tambahkan ke Daftar
            </button>
          </form>

          {/* Inbound List / Cart */}
          <AnimatePresence>
            {inboundList.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="wms-card p-0 overflow-hidden border-brand/20 ring-4 ring-brand/5"
              >
                <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Daftar Penerimaan ({inboundList.length})</h3>
                  <Package size={16} className="text-slate-400" />
                </div>
                
                <div className="divide-y divide-slate-50 max-h-80 overflow-y-auto">
                  {inboundList.map((item) => (
                    <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-brand">
                          <Package size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{item.sku}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide mt-0.5">
                            {item.location.warehouseName} • {item.location.aisle}-{item.location.rack}{item.location.level}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">{item.quantity} Unit</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Jumlah</p>
                        </div>
                        <button 
                          onClick={() => removeItemFromList(item.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Plus size={18} className="rotate-45" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-slate-50/50">
                  <button 
                    onClick={handleReceiveAll}
                    disabled={isSubmitting}
                    className="w-full wms-btn-primary h-12 shadow-lg shadow-brand/20 active:scale-[0.98] transition-all"
                  >
                    {isSubmitting ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        Konfirmasi & Masukkan Gudang
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent History Sidebar */}
        <div className="lg:col-span-2 space-y-6">
          <div className="wms-card p-6 overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History size={16} className="text-slate-400" />
                Log Penerimaan Terbaru
              </h3>
            </div>
            
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                  {recentLogs.map((log) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    key={log.id} 
                    className="flex flex-col rounded-xl border border-slate-100 p-4 bg-white hover:border-brand/30 transition-colors shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded w-fit">{log.product_variants.sku}</p>
                        <p className="text-[10px] font-bold text-brand uppercase">{log.reference_number || 'No REF/PO'}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold">
                          <Plus size={10} strokeWidth={3} />
                          <span className="text-sm">{log.quantity_changed}</span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {recentLogs.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-50">
                  <Package size={32} className="mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Tidak ada data hari ini</p>
                </div>
              )}
              {recentLogs.length > 0 && (
                <Link 
                  to="/history" 
                  className="block w-full py-2 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-brand transition-colors border-t border-slate-50 mt-4"
                >
                  Lihat Selengkapnya
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <QrCode size={120} />
             </div>
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                   <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                   <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Scanner Ready</p>
                </div>
                <h4 className="text-lg font-bold mb-1">Cepat & Akurat</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">Gunakan alat pemindai untuk mempercepat input SKU dan meminimalisir kesalahan data manual.</p>
                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                   <span className="text-[10px] font-mono text-slate-500 uppercase">Input Mode: SKU/Barcode</span>
                   <QrCode size={20} className="text-slate-500" />
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
