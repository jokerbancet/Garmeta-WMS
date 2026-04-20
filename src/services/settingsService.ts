// src/services/settingsService.ts
import { supabase } from '@/lib/supabase';

export interface AppSettings {
  id: string;
  brand_name: string;
  brand_logo_icon: string; // lucide-react icon name string
  updated_at?: string;
}

export async function fetchSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .single();

  if (error) {
    // If not found, return default
    if (error.code === 'PGRST116') {
      return {
        brand_name: 'StitchFlow',
        brand_logo_icon: 'Box'
      } as AppSettings;
    }
    throw error;
  }
  return data as AppSettings;
}

export async function updateSettings(payload: Partial<AppSettings>) {
  const { data: current } = await supabase.from('app_settings').select('id').single();
  
  if (!current) {
    const { data, error } = await supabase
      .from('app_settings')
      .insert({ ...payload })
      .select()
      .single();
    if (error) {
      if (error.message.includes('row-level security')) {
        throw new Error('Izin ditolak (RLS). Silakan jalankan perintah SQL "CREATE POLICY" untuk memberikan akses ke tabel "app_settings".');
      }
      throw error;
    }
    return data as AppSettings;
  } else {
    const { data, error } = await supabase
      .from('app_settings')
      .update(payload)
      .eq('id', current.id)
      .select()
      .single();
    
    if (error) {
      if (error.message.includes('row-level security')) {
        throw new Error('Izin ditolak (RLS). Pastikan kebijakan keamanan tabel "app_settings" mengizinkan pembaruan.');
      }
      throw error;
    }
    return data as AppSettings;
  }
}
