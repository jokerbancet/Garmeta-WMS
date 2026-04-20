// src/pages/Settings.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Settings as SettingsIcon, 
  Save, 
  Box, 
  Package, 
  Layout, 
  Shield, 
  Bell, 
  Database,
  Search,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';
import { updateSettings } from '@/services/settingsService';
import { DynamicIcon } from '@/components/ui/DynamicIcon';

const iconOptions = [
  'Box', 'Package', 'Layout', 'Database', 'Shield', 'Bell', 'Archive', 'Truck', 'Layers', 'Grid', 'Circle', 'Square', 'Triangle', 'Hexagon', 'Zap', 'Star', 'Heart', 'Smile', 'Sun', 'Moon'
];

export default function Settings() {
  const { settings, updateLocalSettings } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    brand_name: settings.brand_name,
    brand_logo_icon: settings.brand_logo_icon
  });

  useEffect(() => {
    setFormData({
      brand_name: settings.brand_name,
      brand_logo_icon: settings.brand_logo_icon
    });
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await updateSettings(formData);
      updateLocalSettings(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan pengaturan.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-slate-100 p-3 text-slate-600">
          <SettingsIcon size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pengaturan Sistem</h1>
          <p className="text-sm text-slate-500">Konfigurasi identitas platform dan preferensi aplikasi.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Navigation Tabs Placeholder */}
        <div className="lg:col-span-3 space-y-1">
          <button className="flex w-full items-center gap-3 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-brand shadow-sm">
            <Layout size={18} />
            Identitas Brand
          </button>
          <button disabled className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-400 opacity-50">
            <Bell size={18} />
            Notifikasi
          </button>
          <button disabled className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-400 opacity-50">
            <Shield size={18} />
            Privasi & Keamanan
          </button>
        </div>

        {/* Content */}
        <div className="lg:col-span-9">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="wms-card p-8">
              <h3 className="mb-6 text-lg font-bold text-slate-900 border-b border-slate-50 pb-4">Identitas Brand</h3>
              
              <div className="space-y-8">
                {/* Brand Name */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-8">
                    <div>
                      <label className="text-sm font-bold text-slate-900">Nama Brand / Aplikasi</label>
                      <p className="mt-1 text-xs text-slate-500">Akan muncul di Sidebar dan judul halaman.</p>
                    </div>
                    <div className="md:col-span-2">
                      <input 
                        type="text" 
                        value={formData.brand_name}
                        onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                        placeholder="Contoh: StitchFlow WMS"
                        className="wms-input h-12"
                        required
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-slate-50" />

                {/* Brand Logo Icon */}
                <div className="space-y-4">
                   <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-8">
                    <div>
                      <label className="text-sm font-bold text-slate-900">Ikon Brand</label>
                      <p className="mt-1 text-xs text-slate-500">Pilih simbol yang merepresentasikan operasional gudang Anda.</p>
                    </div>
                    <div className="md:col-span-2">
                      <div className="mb-6 flex items-center gap-6">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand font-bold text-white shadow-xl shadow-brand/20">
                          <DynamicIcon name={formData.brand_logo_icon} size={40} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-900">Pratinjau Logo</p>
                          <p className="text-xs text-slate-500 italic">Ikon ini akan muncul di sudut kiri atas sidebar.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        {iconOptions.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => setFormData({ ...formData, brand_logo_icon: icon })}
                            className={cn(
                              "flex h-12 items-center justify-center rounded-xl transition-all duration-200",
                              formData.brand_logo_icon === icon 
                                ? "bg-brand text-white shadow-lg shadow-brand/20 scale-110" 
                                : "bg-white text-slate-400 hover:text-slate-900 hover:shadow-sm"
                            )}
                          >
                            <DynamicIcon name={icon} size={20} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col items-end gap-3">
              {error && (
                <div className="flex items-start gap-2 text-xs font-bold text-rose-600 bg-rose-50 p-4 rounded-xl border border-rose-100 max-w-md">
                  <AlertCircle className="shrink-0" size={16} />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <p className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase">
                  <Check size={14} />
                  Pengaturan Berhasil Disimpan
                </p>
              )}
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="wms-btn-primary px-10 h-12 shadow-brand/30 shadow-xl"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Simpan Perubahan</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
