// src/components/inventory/AddProductModal.tsx
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Plus, Trash2, Box, Palette, Ruler, Hash, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { fetchCategories, Category } from '@/services/categoryService';
import { useEffect } from 'react';

// Validation Schema
const variantSchema = z.object({
  sku: z.string().min(3, 'SKU minimal harus 3 karakter'),
  color: z.string().min(1, 'Warna wajib diisi'),
  size: z.string().min(1, 'Ukuran wajib diisi'),
  barcode: z.string().optional(),
  initialStock: z.number().min(0),
});

const productSchema = z.object({
  name: z.string().min(3, 'Nama produk wajib diisi'),
  categories_id: z.string().min(1, 'Kategori wajib diisi'),
  description: z.string().optional(),
  variants: z.array(variantSchema).min(1, 'Minimal harus ada satu variasi'),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddProductModal({ isOpen, onClose, onSuccess }: AddProductModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      fetchCategories().then(setCategories).catch(console.error);
    }
  }, [isOpen]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      categories_id: '',
      description: '',
      variants: [{ sku: '', color: '', size: '', initialStock: 0 }],
    },
});

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variants',
  });

  const onSubmit = async (values: ProductFormValues) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Create Base Product
      const { data: product, error: pError } = await supabase
        .from('products')
        .insert({
          name: values.name,
          categories_id: values.categories_id,
          description: values.description,
        })
        .select()
        .single();

      if (pError) throw pError;

      // 2. Create Variants
      const variantsToInsert = values.variants.map(v => ({
        product_id: product.id,
        sku: v.sku,
        color: v.color,
        size: v.size,
        barcode: v.barcode || v.sku, // Default barcode to SKU if missing
      }));

      const { data: variants, error: vError } = await supabase
        .from('product_variants')
        .insert(variantsToInsert)
        .select();

      if (vError) throw vError;

      // 3. Create Initial Inventory & Ledger if stock > 0
      // We'll use a virtual "RECEIVING" location for initial batch entry
      // First, get or create the RECEIVING location
      let { data: location } = await supabase
        .from('locations')
        .select('id')
        .match({ aisle: 'REC', rack: '00', level: '0' })
        .single();
      
      if (!location) {
        const { data: newLoc } = await supabase
          .from('locations')
          .insert({ aisle: 'REC', rack: '00', level: '0' })
          .select()
          .single();
        location = newLoc;
      }

      if (location) {
        for (let i = 0; i < values.variants.length; i++) {
          const v = values.variants[i];
          const variantId = variants.find(rv => rv.sku === v.sku)?.id;
          
          if (variantId && v.initialStock > 0) {
            // Create Inventory
            const { error: invError } = await supabase.from('inventory').insert({
              variant_id: variantId,
              location_id: location.id,
              quantity: v.initialStock
            });
            if (invError) throw invError;

            // Log Ledger
            const { error: ledgerError } = await supabase.from('stock_ledger').insert({
              variant_id: variantId,
              transaction_type: 'In',
              quantity_changed: v.initialStock,
              user_id: (await supabase.auth.getUser()).data.user?.id || null
            });
            if (ledgerError) throw ledgerError;
          }
        }
      }

      onSuccess();
      reset();
      onClose();
    } catch (err: any) {
      console.error('Error saving product:', err);
      if (err.message?.includes('row-level security') || err.code === '42501') {
        setError('Izin ditolak (RLS). Silakan jalankan perintah SQL "CREATE POLICY" untuk tabel terkait.');
      } else if (err.code === '23502') {
        setError(`Data tidak lengkap: Kolom "${err.column}" tidak boleh kosong. Pastikan tabel di database sudah memiliki "DEFAULT gen_random_uuid()".`);
      } else {
        setError(err.message || 'Gagal menyimpan produk. Periksa konsol untuk detailnya.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Tambah Produk Baru</h2>
              <button 
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="max-h-[80vh] overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {/* Base Details */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nama Produk</label>
                    <input 
                      {...register('name')} 
                      placeholder="contoh: Kemeja Oxford Klasik"
                      className={cn("wms-input", errors.name && "border-status-error")}
                    />
                    {errors.name && <p className="text-[10px] text-status-error">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Kategori</label>
                    <select 
                      {...register('categories_id')}
                      className={cn("wms-input", errors.categories_id && "border-status-error")}
                    >
                      <option value="">{categories.length === 0 ? 'Kategori Tidak Ditemukan' : 'Pilih Kategori'}</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    {errors.categories_id && <p className="text-[10px] text-status-error">{errors.categories_id.message}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Deskripsi</label>
                  <textarea 
                    {...register('description')}
                    rows={2}
                    className="wms-input resize-none"
                    placeholder="Deskripsi singkat untuk pelacakan internal..."
                  />
                </div>

                {/* Variants Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      Variasi Produk
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                        {fields.length} Variasi
                      </span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => append({ sku: '', color: '', size: '', initialStock: 0 })}
                      className="flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-hover transition-colors"
                    >
                      <Plus size={14} />
                      Tambah Variasi
                    </button>
                  </div>

                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={field.id} 
                        className="group relative grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-4"
                      >
                        <div className="sm:col-span-1 space-y-1">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <Hash size={10} /> SKU
                          </div>
                          <input 
                            {...register(`variants.${index}.sku`)} 
                            className="wms-input h-9 text-xs"
                            placeholder="TS-BLK-S"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <Palette size={10} /> Warna
                          </div>
                          <input 
                            {...register(`variants.${index}.color`)} 
                            className="wms-input h-9 text-xs"
                            placeholder="Hitam"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                            <Ruler size={10} /> Ukuran
                          </div>
                          <input 
                            {...register(`variants.${index}.size`)} 
                            className="wms-input h-9 text-xs"
                            placeholder="S"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                              <Box size={10} /> Stok
                            </div>
                            <input 
                              type="number"
                              {...register(`variants.${index}.initialStock`, { valueAsNumber: true })} 
                              className="wms-input h-9 text-xs"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                            className="mb-1 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-30"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 overflow-hidden"
                  >
                    <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-600">
                      <AlertCircle className="shrink-0" size={16} />
                      <span>{error}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form Actions */}
              <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-button px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="wms-btn-primary min-w-[140px]"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
