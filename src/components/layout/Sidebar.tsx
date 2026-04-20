// src/components/layout/Sidebar.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PackageSearch, 
  ArrowDownLeft, 
  ArrowUpRight, 
  RefreshCcw,
  Settings,
  ChevronDown,
  Box,
  Tag,
  Warehouse,
  MapPinned,
  Database,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';
import { DynamicIcon } from '@/components/ui/DynamicIcon';

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Penerimaan Barang', icon: ArrowDownLeft, path: '/inbound' },
  { name: 'Manajemen Stok', icon: PackageSearch, path: '/inventory' },
  { name: 'Internal Transfer', icon: Box, path: '/transfer' },
  { name: 'Stock Opname', icon: RefreshCcw, path: '/opname' },
  { name: 'Pengeluaran Barang', icon: ArrowUpRight, path: '/outbound' },
  { name: 'Riwayat Stok', icon: History, path: '/history' },
];

const masterItems = [
  { name: 'Kategori', icon: Tag, path: '/categories' },
  { name: 'Gudang', icon: Warehouse, path: '/warehouses' },
  { name: 'Lokasi Rak', icon: MapPinned, path: '/locations' },
];

export default function Sidebar() {
  const [isMasterOpen, setIsMasterOpen] = useState(true);
  const location = useLocation();
  const { settings } = useSettings();

  const isMasterActive = masterItems.some(item => location.pathname === item.path);

  return (
    <div className="flex h-screen w-64 flex-col border-r border-slate-200 bg-slate-900 text-white">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand font-bold text-white shadow-lg shadow-brand/20">
          <DynamicIcon name={settings.brand_logo_icon} size={24} />
        </div>
        <span className="text-xl font-bold tracking-tight truncate">{settings.brand_name}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 px-3">
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-brand text-white shadow-md shadow-brand/10" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                )
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </div>

        {/* Master Data Dropdown */}
        <div className="space-y-1">
          <button 
            onClick={() => setIsMasterOpen(!isMasterOpen)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isMasterActive ? "text-white" : "text-slate-500 hover:bg-slate-800 hover:text-white"
            )}
          >
            <div className="flex items-center gap-3">
              <Database size={20} />
              <span>Master Data</span>
            </div>
            <motion.div
              animate={{ rotate: isMasterOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={14} />
            </motion.div>
          </button>

          <AnimatePresence>
            {isMasterOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-1"
              >
                {masterItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg pl-10 pr-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive 
                          ? "text-brand" 
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      )
                    }
                  >
                    <item.icon size={16} />
                    {item.name}
                  </NavLink>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-slate-800 p-4">
        <NavLink 
          to="/settings"
          className={({ isActive }) => cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive ? "bg-brand text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
          )}
        >
          <Settings size={20} />
          Pengaturan
        </NavLink>
      </div>
    </div>
  );
}
