// src/services/categoryService.ts
import { supabase } from '@/lib/supabase';

export interface Category {
  id: string;
  name: string;
  created_at?: string;
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Category[];
}

export async function addCategory(name: string) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: name.trim() })
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
