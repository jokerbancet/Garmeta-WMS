// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Package, 
  TrendingUp, 
  AlertTriangle, 
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownLeft,
  ChevronRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { fetchDashboardStats, fetchStockMovement } from '@/services/inventoryService';

export default function Dashboard() {
  const [stats, setStats] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const data = await fetchDashboardStats();
        const movement = await fetchStockMovement();
        
        setStats([
          {
            name: 'Total Stok Tersedia',
            value: data.totalStock,
            change: '-',
            trend: 'up',
            icon: Package,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
          },
          {
            name: 'Penerimaan (Pending)',
            value: data.pendingInbound,
            change: '-',
            trend: 'up',
            icon: Truck,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
          },
          {
            name: 'SKU Stok Rendah',
            value: data.lowStockCount,
            change: '-',
            trend: 'up',
            icon: AlertTriangle,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
          },
          {
            name: 'Rasio Stok Habis',
            value: data.oosRate,
            change: '-',
            trend: 'down',
            icon: TrendingUp,
            color: 'text-slate-600',
            bg: 'bg-slate-50',
          },
        ]);
        setChartData(movement);
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand/30 border-t-brand" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header section remains same */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Kontrol Operasional</h1>
        <p className="text-sm text-slate-500">Ringkasan performa gudang garmen Anda secara real-time.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="wms-card p-6"
          >
            <div className="flex items-start justify-between">
              <div className={stat.bg + " rounded-xl p-2.5 " + stat.color}>
                <stat.icon size={24} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${
                stat.trend === 'up' ? 'text-status-success' : 'text-status-error'
              }`}>
                {stat.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {stat.change}
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-500">{stat.name}</h3>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="wms-card lg:col-span-2 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Pergerakan Stok</h2>
              <p className="text-xs text-slate-500">Arus Barang Masuk vs Keluar (7 Hari Terakhir)</p>
            </div>
            <select className="rounded-button border border-slate-200 bg-white px-3 py-1 text-xs font-medium focus:outline-none">
              <option>7 Hari Terakhir</option>
              <option>30 Hari Terakhir</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                  formatter={(value: any, name: string) => [value, name === 'masuk' ? 'Barang Masuk' : 'Barang Keluar']}
                />
                <Area 
                  type="monotone" 
                  dataKey="masuk" 
                  stroke="#4f46e5" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorInbound)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="keluar" 
                  stroke="#94a3b8" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorOutbound)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Action Sidebar on Dashboard */}
        <div className="space-y-6">
          <div className="wms-card p-6 bg-slate-900 text-white border-none">
            <h3 className="font-bold flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-status-warning"></span>
              Peringatan Stok Rendah
            </h3>
            <p className="mt-2 text-xs text-slate-400">14 variasi SKU berada di bawah ambang batas aman.</p>
            <button className="mt-4 w-full rounded-button bg-white py-2 text-xs font-bold text-slate-900 transition-colors hover:bg-slate-100">
              Isi Stok Sekarang
            </button>
          </div>

          <div className="wms-card p-6">
            <h3 className="font-bold text-sm mb-4">Akses Cepat</h3>
            <div className="space-y-3">
              <button className="flex w-full items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <ArrowDownLeft size={16} />
                  </div>
                  <span className="text-xs font-medium">Penerimaan Baru</span>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
              <button className="flex w-full items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <ArrowUpRight size={16} />
                  </div>
                  <span className="text-xs font-medium">Buat Surat Jalan</span>
                </div>
                <ChevronRight size={14} className="text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
