// src/components/layout/Header.tsx
import { Bell, Search, User, Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-bottom border-slate-200 bg-white/80 px-6 backdrop-blur-md">
      {/* Mobile Menu Toggle */}
      <button 
        onClick={onMenuClick}
        className="mr-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
      >
        <Menu size={20} />
      </button>

      {/* Global Search */}
      <div className="relative w-full max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          placeholder="Cari SKU, Barcode, atau Pesanan..."
          className="wms-input pl-10 h-10 border-none bg-slate-100/50 hover:bg-slate-100 focus:bg-white"
        />
      </div>

      {/* Profile & Notifications */}
      <div className="flex items-center gap-4">
        <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 transition-colors">
          <Bell size={20} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-status-error ring-2 ring-white"></span>
        </button>
        
        <div className="h-8 w-px bg-slate-200"></div>

        <button className="flex items-center gap-3 rounded-lg border border-transparent p-1 pl-2 transition-all hover:border-slate-200 hover:bg-slate-50">
          <div className="flex flex-col items-end text-right">
            <span className="text-xs font-semibold text-slate-900">John Doe</span>
            <span className="text-[10px] text-slate-500">Kepala Gudang</span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
            <User size={18} />
          </div>
        </button>
      </div>
    </header>
  );
}
