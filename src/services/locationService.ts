// src/services/locationService.ts
import { supabase } from '@/lib/supabase';

export interface LocationRecord {
  id: string;
  warehouse_id: string;
  aisle: string;
  rack: string;
  level: string;
  created_at?: string;
  warehouses?: {
    name: string;
    code: string;
  };
}

export async function fetchLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('*, warehouses(name, code)')
    .order('aisle', { ascending: true });

  if (error) throw error;
  return data as LocationRecord[];
}

export async function addLocation(payload: { warehouse_id: string; aisle: string; rack: string; level: string }) {
  const { data, error } = await supabase
    .from('locations')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as LocationRecord;
}

export async function deleteLocation(id: string) {
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
