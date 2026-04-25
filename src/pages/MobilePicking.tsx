import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Package, 
  MapPin, 
  Scan, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  Search,
  Check
} from 'lucide-react';
import { 
  fetchPickingItems, 
  updateOrderStatus,
  finalizeShipping // Not needed here but for context
} from '@/services/outboundService';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function MobilePicking() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const navigate = useNavigate();
  
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      navigate('/outbound');
      return;
    }
    loadPickingItems();
  }, [orderId]);

  const loadPickingItems = async () => {
    try {
      setLoading(true);
      const data = await fetchPickingItems(orderId!);
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const targetItem = items.find(i => 
      !i.is_picked && i.product_variants.sku.toLowerCase() === scanInput.toLowerCase()
    );

    if (!targetItem) {
      setError('SKU tidak ditemukan atau sudah diambil.');
      setScanInput('');
      return;
    }

    try {
      // Logic konfirmasi pick
      const { error: pickError } = await supabase
        .from('order_items')
        .update({ is_picked: true, picked_quantity: targetItem.quantity })
        .eq('id', targetItem.id);

      if (pickError) throw pickError;

      setSuccess(`Berhasil mengambil: ${targetItem.product_variants.sku}`);
      setScanInput('');
      loadPickingItems();
    } catch (err) {
      setError('Gagal mengonfirmasi pengambilan.');
    }
  };

  const currentItem = items.find(i => !i.is_picked);
  const allPicked = items.length > 0 && items.every(i => i.is_picked);

  const handleFinishPicking = async () => {
    try {
      // Ubah status ke packed setelah picking selesai
      const { error } = await supabase
        .from('outbound_orders')
        .update({ status: 'packed' })
        .eq('id', orderId);
      
      if (error) throw error;
      navigate('/outbound');
    } catch (err) {
      alert('Gagal menyelesaikan picking.');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading picking list...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto">
      {/* Header Mobile */}
      <div className="bg-white border-b px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate('/outbound')} className="text-slate-400">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900">Mobile Picking</h1>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-none">ORDER ID: {orderId?.slice(0, 8)}</p>
        </div>
      </div>

      {allPicked ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
          <div className="h-24 w-24 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Check size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900">Selesai!</h2>
            <p className="text-slate-500">Semua item telah berhasil diambil dari rak.</p>
          </div>
          <button 
            onClick={handleFinishPicking}
            className="w-full wms-btn-primary bg-emerald-600 h-14 text-lg font-bold rounded-2xl shadow-lg"
          >
            Selesaikan & Masuk Packing
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-6 flex-1">
          {/* Target Item JUMBO CARD */}
          {currentItem && (
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 p-6 border-2 border-blue-500 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4">
                  <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex flex-col items-center justify-center">
                     <span className="text-[10px] font-bold leading-none">QTY</span>
                     <span className="text-2xl font-black">{currentItem.quantity}</span>
                  </div>
               </div>

               <div className="space-y-6">
                  {/* LOKASI */}
                  <div className="flex items-center gap-3 text-blue-600 font-bold">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <MapPin size={20} />
                    </div>
                    <span className="text-xl tracking-tight uppercase">
                      Lorong {currentItem.inventory.locations.aisle} - Rak {currentItem.inventory.locations.rack}
                    </span>
                  </div>

                  {/* PRODUK */}
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-slate-900">{currentItem.product_variants.sku}</h2>
                    <p className="text-sm text-slate-500 font-medium">{currentItem.product_variants.products.name}</p>
                    <div className="flex gap-2 pt-2">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">VAR: {currentItem.product_variants.color || '-'} / {currentItem.product_variants.size || '-'}</span>
                    </div>
                  </div>
               </div>
            </div>
          )}

          {/* Scanner Input Simulation */}
          <form onSubmit={handleManualScan} className="space-y-4 pt-4">
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <Scan size={24} />
              </div>
              <input 
                autoFocus
                placeholder="Scan Barcode / Ketik SKU..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                className="w-full h-16 bg-white rounded-2xl border-2 border-slate-200 px-14 font-bold text-lg focus:border-blue-500 focus:outline-none focus:ring-0 transition-all placeholder:text-slate-300 shadow-sm"
              />
            </div>
            
            {(error || success) && (
              <div className={cn(
                "p-4 rounded-xl flex items-center gap-3 text-sm font-bold",
                error ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
              )}>
                {error ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                {error || success}
              </div>
            )}
          </form>

          {/* Queue List Minimap */}
          <div className="space-y-2 pt-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sisa Antrian Picking ({items.filter(i => !i.is_picked).length})</h4>
            <div className="space-y-2">
              {items.filter(i => !i.is_picked).slice(1).map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-slate-100 opacity-60">
                   <div className="h-10 w-10 rounded-lg bg-slate-50 flex items-center justify-center font-bold text-slate-400 text-xs">{item.quantity}</div>
                   <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800">{item.product_variants.sku}</p>
                      <p className="text-[10px] text-slate-500">{item.inventory.locations.aisle}-{item.inventory.locations.rack}</p>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
