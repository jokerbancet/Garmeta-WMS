// src/components/inventory/EditProductModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { fetchCategories, Category } from '@/services/categoryService';
import { updateProduct, updateVariant } from '@/services/inventoryService';

interface EditProductModalProps {
  product: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditProductModal({ product, isOpen, onClose, onSuccess }: EditProductModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    categories_id: '',
    description: '',
    color: '',
    size: ''
  });

  useEffect(() => {
    if (isOpen && product) {
      setFormData({
        name: product.name || '',
        categories_id: product.categories_id || '',
        description: product.description || '',
        color: product.color || '',
        size: product.size || ''
      });
      setError(null);
      fetchCategories().then(setCategories).catch(console.error);
    }
  }, [isOpen, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const realProductId = product.productId;
      const variantId = product.variantId || (product.id.startsWith('v-') ? product.id.replace('v-', '') : null);
      
      const promises = [
        updateProduct(realProductId, {
          name: formData.name,
          categories_id: formData.categories_id,
          description: formData.description
        })
      ];

      if (variantId) {
        promises.push(updateVariant(variantId, {
          color: formData.color,
          size: formData.size
        }));
      }

      await Promise.all(promises);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating product:', err);
      setError(err.message || 'Gagal memperbarui data produk.');
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
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">Edit Data & Variasi Produk</h2>
              <button 
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nama Produk</label>
                  <input 
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="wms-input h-10"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kategori</label>
                  <select 
                    value={formData.categories_id}
                    onChange={e => setFormData({ ...formData, categories_id: e.target.value })}
                    className="wms-input h-10"
                    required
                  >
                    <option value="">Pilih Kategori</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Warna</label>
                  <input 
                    type="text"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="wms-input h-10"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ukuran</label>
                  <input 
                    type="text"
                    value={formData.size}
                    onChange={e => setFormData({ ...formData, size: e.target.value })}
                    className="wms-input h-10"
                  />
                </div>
                
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deskripsi</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="wms-input py-2 resize-none h-20"
                    placeholder="Informasi tambahan produk..."
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-600">
                  <AlertCircle className="shrink-0" size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
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
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <><Save size={18} /> Simpan Perubahan</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
