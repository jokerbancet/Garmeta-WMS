import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Scale, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCcw,
  Search,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  fetchActiveOpnameTickets, 
  fetchOpnameItems, 
  approveOpnameItem, 
  requestRecount,
  completeOpnameTicket,
  OpnameTicket,
  OpnameItem
} from '@/services/opnameService';

export default function StockReconciliation() {
  const [tickets, setTickets] = useState<OpnameTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<OpnameTicket | null>(null);
  const [items, setItems] = useState<OpnameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await fetchActiveOpnameTickets();
      setTickets(data);
    } catch (e) {
      console.error('Failed to load tickets:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async (ticket: OpnameTicket) => {
    try {
      setSelectedTicket(ticket);
      setLoading(true);
      const data = await fetchOpnameItems(ticket.id);
      setItems(data);
    } catch (e) {
      console.error('Failed to load items:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (item: OpnameItem) => {
    try {
      setProcessingId(item.id);
      await approveOpnameItem(item);
      // Refresh items
      if (selectedTicket) await loadItems(selectedTicket);
    } catch (e) {
      console.error('Approval failed:', e);
      alert('Gagal menyetujui penyesuaian.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRecount = async (itemId: string) => {
    try {
      setProcessingId(itemId);
      await requestRecount(itemId);
      if (selectedTicket) await loadItems(selectedTicket);
    } catch (e) {
      console.error('Recount request failed:', e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCompleteTicket = async () => {
    if (!selectedTicket) return;
    const pending = items.filter(i => i.status !== 'verified');
    if (pending.length > 0) {
      if (!confirm(`Ada ${pending.length} item yang belum diverifikasi. Tutup tiket sekarang?`)) return;
    }

    try {
      setLoading(true);
      await completeOpnameTicket(selectedTicket.id);
      setSelectedTicket(null);
      await loadTickets();
    } catch (e) {
      console.error('Failed to complete ticket:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !selectedTicket) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
            <Scale size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Rekonsiliasi Data</h1>
            <p className="text-sm text-slate-500">Bandingkan hasil hitung fisik dengan data sistem.</p>
          </div>
        </div>
        {selectedTicket && (
          <button 
            onClick={handleCompleteTicket}
            className="wms-btn-primary bg-emerald-600 hover:bg-emerald-700"
          >
            Selesaikan & Buka Lokasi
          </button>
        )}
      </div>

      {!selectedTicket ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tickets.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              <RefreshCcw size={48} className="mx-auto mb-4 opacity-20" />
              <p>Tidak ada tiket opname aktif.</p>
            </div>
          ) : (
            tickets.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => loadItems(ticket)}
                className="wms-card p-6 text-left hover:border-indigo-300 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Scale size={20} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-1 rounded-full",
                    ticket.status === 'initiated' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {ticket.status}
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 mb-1">{ticket.ticket_number}</h4>
                <p className="text-xs text-slate-500 mb-4">{ticket.warehouses?.name || 'Gudang Unknown'}</p>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                  <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <button 
            onClick={() => setSelectedTicket(null)}
            className="text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-2"
          >
            ← Kembali ke Daftar Tiket
          </button>

          <div className="wms-card overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 italic">
                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">SKU & Produk</th>
                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Lokasi</th>
                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Sistem</th>
                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Fisik</th>
                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">Varians</th>
                         <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Aksi</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {items.map(item => {
                        const variance = item.physical_quantity !== null ? item.physical_quantity - item.system_quantity : null;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="px-6 py-4">
                                <p className="text-sm font-bold text-slate-900">{item.product_variants.sku}</p>
                                <p className="text-[10px] text-slate-500">{item.product_variants.products.name}</p>
                             </td>
                             <td className="px-6 py-4">
                                <span className="text-[10px] font-bold uppercase text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                   {item.locations.aisle}-{item.locations.rack}{item.locations.level}
                                </span>
                             </td>
                             <td className="px-6 py-4 text-center font-medium text-slate-600">
                                {item.system_quantity}
                             </td>
                             <td className="px-6 py-4 text-center">
                                {item.physical_quantity !== null ? (
                                  <span className="font-bold text-slate-900">{item.physical_quantity}</span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Belum dihitung</span>
                                )}
                             </td>
                             <td className="px-6 py-4 text-center">
                                {variance !== null ? (
                                  <div className={cn(
                                    "flex items-center justify-center gap-1 font-bold",
                                    variance === 0 ? "text-slate-400" : variance > 0 ? "text-emerald-600" : "text-rose-600"
                                  )}>
                                     {variance > 0 ? <TrendingUp size={12} /> : variance < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                                     <span>{variance > 0 ? '+' : ''}{variance}</span>
                                  </div>
                                ) : '-'}
                             </td>
                             <td className="px-6 py-4 text-right">
                                {item.status === 'verified' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
                                     <CheckCircle2 size={12} /> Terverifikasi
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-end gap-2">
                                     <button 
                                      onClick={() => handleRecount(item.id)}
                                      disabled={processingId === item.id}
                                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                      title="Hitung Ulang"
                                     >
                                        <RefreshCcw size={16} />
                                     </button>
                                     <button 
                                      onClick={() => handleApprove(item)}
                                      disabled={processingId === item.id || item.physical_quantity === null}
                                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-20"
                                      title="Setujui & Sesuaikan"
                                     >
                                        <CheckCircle2 size={16} />
                                     </button>
                                  </div>
                                )}
                             </td>
                          </tr>
                        );
                      })}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
