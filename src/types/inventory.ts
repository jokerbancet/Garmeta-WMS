// src/types/inventory.ts

export type TransactionType = 'In' | 'Out' | 'Transfer' | 'Opname' | 'Opname_Adjustment';

export interface Product {
  id: string;
  name: string;
  description: string;
  category?: string; // Keep for backward compatibility or migration
  categories_id?: string;
  categories?: {
    id: string;
    name: string;
  };
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  color: string;
  size: string;
  barcode: string;
}

export interface Location {
  id: string;
  aisle: string;
  rack: string;
  level: string;
}

export interface Inventory {
  id: string;
  variant_id: string;
  location_id: string;
  quantity: number;
}

export interface StockLedger {
  id: string;
  variant_id: string;
  transaction_type: TransactionType;
  quantity_changed: number;
  user_id: string;
  reference_number?: string; // Nomor Surat Jalan / PO
  report_note?: string; // Catatan QC/Laporan
  document_image_url?: string; // URL gambar surat jalan
  product_image_url?: string; // URL gambar barang
  timestamp: string;
  created_at?: string;
}

// Composition types for UI
export interface VariantWithProduct extends ProductVariant {
  products: Product;
}

export interface InventoryWithDetails extends Inventory {
  product_variants: VariantWithProduct;
  locations: Location;
}
