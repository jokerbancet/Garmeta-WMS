// src/services/warehouseService.ts
import { supabase } from '@/lib/supabase';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  created_at?: string;
}

export async function fetchWarehouses() {
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Warehouse[];
}

export async function addWarehouse(payload: { name: string; code: string; address?: string }) {
  const { data, error } = await supabase
    .from('warehouses')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as Warehouse;
}

export async function deleteWarehouse(id: string) {
  const { error } = await supabase
    .from('warehouses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
