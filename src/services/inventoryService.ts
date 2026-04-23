// src/services/inventoryService.ts
import { supabase } from '@/lib/supabase';
import { Product, ProductVariant, Inventory, InventoryWithDetails, TransactionType } from '@/types/inventory';

/**
 * Fetches all product variants and their associated inventory (left join).
 * This ensures products show up even if they have 0 stock or no location assigned yet.
 */
export async function fetchFullInventory() {
  // We query inventory but we want to make sure we aren't missing products.
  // Actually, in a WMS, the "Inventory" view usually shows what's in the warehouse.
  // However, users expect to see their created products.
  
  // Strategy: Query 'inventory' and ensure we handle the joins.
  // If the 'inventory' table is empty, we might want to suggest checking the catalog.
  
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      id,
      quantity,
      location_id,
      variant_id,
      product_variants:variant_id (
        id,
        sku,
        color,
        size,
        barcode,
        products:product_id (
          id,
          name,
          categories_id,
          categories (
            id,
            name
          ),
          description
        )
      ),
      locations:location_id (
        aisle,
        rack,
        level
      )
    `);

  if (error) throw error;
  return data || [];
}

/**
 * NEW: Fetches the entire product catalog including those with 0 stock.
 * Use this to debug or show a complete product list.
 */
export async function fetchCatalogWithStock() {
  const { data, error } = await supabase
    .from('product_variants')
    .select(`
      id,
      sku,
      color,
      size,
      products:product_id (
        id,
        name,
        categories_id,
        description,
        categories (
          id,
          name
        )
      ),
      inventory (
        quantity,
        locations:location_id (
          aisle,
          rack,
          level
        )
      )
    `);

  if (error) throw error;
  return data;
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Aggregates variants into a base product view.
 * Useful for the high-level 'Products' table.
 */
export function aggregateByProduct(inventory: InventoryWithDetails[]) {
  const productMap = new Map<string, any>();

  inventory.forEach((item) => {
    const productId = item.product_variants.products.id;
    if (!productMap.has(productId)) {
      productMap.set(productId, {
        ...item.product_variants.products,
        totalStock: 0,
        variantCount: 0,
        variants: [],
      });
    }

    const p = productMap.get(productId);
    p.totalStock += item.quantity;
    p.variantCount += 1;
    p.variants.push({
      sku: item.product_variants.sku,
      color: item.product_variants.color,
      size: item.product_variants.size,
      quantity: item.quantity,
      location: `${item.locations.aisle}-${item.locations.rack}${item.locations.level}`,
    });
  });

  return Array.from(productMap.values());
}

/**
 * Uploads an image to Supabase Storage and returns the public URL.
 */
export async function uploadImage(file: File, bucket: 'ledger_documents' | 'ledger_products') {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Helper to check if a location is frozen.
 */
async function checkLocationFrozen(locationId: string) {
  const { data, error } = await supabase
    .from('locations')
    .select('is_frozen')
    .eq('id', locationId)
    .single();
  
  if (error) return false;
  return data.is_frozen;
}

/**
 * Logs a movement in the stock ledger.
 */
export async function logTransaction(payload: {
  variant_id: string;
  type: TransactionType;
  quantity: number;
  reference_number?: string;
  report_note?: string;
  document_image_url?: string;
  product_image_url?: string;
}) {
  // Get current user session
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase
    .from('stock_ledger')
    .insert({
      variant_id: payload.variant_id,
      transaction_type: payload.type,
      quantity_changed: payload.quantity,
      user_id: user?.id,
      reference_number: payload.reference_number,
      report_note: payload.report_note,
      document_image_url: payload.document_image_url,
      product_image_url: payload.product_image_url
    });

  if (error) throw error;
}

/**
 * Robust Inbound Processing:
 * 1. Find or create location ID
 * 2. Find variant by SKU/Barcode
 * 3. Update or Insert Inventory
 * 4. Log to immutable Stock Ledger
 */
export async function processInbound(payload: {
  skuOrBarcode: string;
  quantity: number;
  location: { aisle: string; rack: string; level: string; warehouseId: string };
  reference_number?: string;
  report_note?: string;
  document_image_url?: string;
  product_image_url?: string;
}) {
  // 1. Find variant
  const { data: variant, error: vError } = await supabase
    .from('product_variants')
    .select('id')
    .or(`sku.eq.${payload.skuOrBarcode},barcode.eq.${payload.skuOrBarcode}`)
    .single();

  if (vError || !variant) throw new Error(`SKU/Barcode ${payload.skuOrBarcode} tidak ditemukan.`);

  // 2. Find or create location
  let { data: location, error: lError } = await supabase
    .from('locations')
    .select('id, is_frozen')
    .match({ 
      warehouse_id: payload.location.warehouseId,
      aisle: payload.location.aisle.toUpperCase(), 
      rack: payload.location.rack, 
      level: payload.location.level.toUpperCase() 
    })
    .single();

  if (location?.is_frozen) {
    throw new Error('Lokasi sedang dibekukan untuk Stock Opname. Transaksi tidak diizinkan.');
  }

  if (!location) {
    const { data: newLoc, error: nLocError } = await supabase
      .from('locations')
      .insert({
        warehouse_id: payload.location.warehouseId,
        aisle: payload.location.aisle.toUpperCase(),
        rack: payload.location.rack,
        level: payload.location.level.toUpperCase()
      })
      .select()
      .single();
    
    if (nLocError) throw nLocError;
    location = newLoc;
  }

  // 3. Update Inventory (Upsert)
  // We check if this variant already exists at this location
  const { data: existingInv } = await supabase
    .from('inventory')
    .select('id, quantity')
    .match({ variant_id: variant.id, location_id: location.id })
    .single();

  if (existingInv) {
    const { error: uError } = await supabase
      .from('inventory')
      .update({ quantity: existingInv.quantity + payload.quantity })
      .eq('id', existingInv.id);
    if (uError) throw uError;
  } else {
    const { error: iError } = await supabase
      .from('inventory')
      .insert({
        variant_id: variant.id,
        location_id: location.id,
        quantity: payload.quantity
      });
    if (iError) throw iError;
  }

  // 4. Log Transaction
  await logTransaction({
    variant_id: variant.id,
    type: 'In',
    quantity: payload.quantity,
    reference_number: payload.reference_number,
    report_note: payload.report_note,
    document_image_url: payload.document_image_url,
    product_image_url: payload.product_image_url
  });

  return { success: true };
}

/**
 * Fetches recent stock ledger entries with joined variant details.
 * Also fetches current inventory locations as a fallback since location_id is missing in ledger.
 */
export async function fetchRecentTransactions(limit = 10) {
  const { data, error } = await supabase
    .from('stock_ledger')
    .select(`
      id,
      transaction_type,
      quantity_changed,
      created_at,
      reference_number,
      report_note,
      document_image_url,
      product_image_url,
      product_variants (
        id,
        sku,
        color,
        size,
        inventory (
          locations (
            aisle,
            rack,
            level,
            warehouses (
              name,
              code
            )
          )
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Fetches the movement history for a specific variant.
 */
export async function fetchVariantHistory(variantId: string) {
  const { data, error } = await supabase
    .from('stock_ledger')
    .select(`
      id,
      transaction_type,
      quantity_changed,
      created_at,
      reference_number,
      report_note,
      document_image_url,
      product_image_url,
      product_variants (
        inventory (
          locations (
            aisle,
            rack,
            level,
            warehouses ( name )
          )
        )
      )
    `)
    .eq('variant_id', variantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Fetches stock breakdown by location for a specific variant.
 */
export async function fetchStockByLocation(variantId: string) {
  const { data, error } = await supabase
    .from('inventory')
    .select(`
      quantity,
      locations (
        id,
        aisle,
        rack,
        level,
        warehouses ( name, code )
      )
    `)
    .eq('variant_id', variantId);

  if (error) throw error;
  return data;
}

/**
 * Robust Outbound Processing:
 * Deducts stock from inventory and logs to ledger.
 */
export async function processOutbound(payload: {
  variant_id: string;
  quantity: number;
}) {
  // 1. Find inventory with stock
  const { data: invItems, error: fError } = await supabase
    .from('inventory')
    .select('id, quantity, location_id')
    .eq('variant_id', payload.variant_id)
    .gte('quantity', payload.quantity)
    .limit(1);

  if (fError || !invItems || invItems.length === 0) {
    throw new Error('Stok tidak mencukupi di lokasi manapun untuk variasi ini.');
  }

  const targetInv = invItems[0];

  if (await checkLocationFrozen(targetInv.location_id)) {
    throw new Error('Lokasi sedang dibekukan untuk Stock Opname. Transaksi tidak diizinkan.');
  }

  // 2. Deduct Stock
  const { error: uError } = await supabase
    .from('inventory')
    .update({ quantity: targetInv.quantity - payload.quantity })
    .eq('id', targetInv.id);

  if (uError) throw uError;

  // 3. Log to Ledger
  await logTransaction({
    variant_id: payload.variant_id,
    type: 'Out',
    quantity: payload.quantity
  });

  return { success: true };
}

/**
 * Process Internal Transfer (Rack to Rack)
 */
export async function processInternalTransfer(payload: {
  variant_id: string;
  source_location_id: string;
  target_location: { aisle: string; rack: string; level: string; warehouseId: string };
  quantity: number;
  note?: string;
  reference_number?: string;
  before_image_url?: string;
  after_image_url?: string;
}) {
  // 1. Find or create target location
  let { data: targetLocation, error: tlError } = await supabase
    .from('locations')
    .select('id, is_frozen')
    .match({
      warehouse_id: payload.target_location.warehouseId,
      aisle: payload.target_location.aisle.toUpperCase(),
      rack: payload.target_location.rack,
      level: payload.target_location.level.toUpperCase()
    })
    .single();

  if (await checkLocationFrozen(payload.source_location_id)) {
    throw new Error('Lokasi asal sedang dibekukan untuk Stock Opname.');
  }

  if (targetLocation?.is_frozen) {
    throw new Error('Lokasi tujuan sedang dibekukan untuk Stock Opname.');
  }

  if (!targetLocation) {
    const { data: newLoc, error: nLocError } = await supabase
      .from('locations')
      .insert({
        warehouse_id: payload.target_location.warehouseId,
        aisle: payload.target_location.aisle.toUpperCase(),
        rack: payload.target_location.rack,
        level: payload.target_location.level.toUpperCase()
      })
      .select()
      .single();
    
    if (nLocError) throw nLocError;
    targetLocation = newLoc;
  }

  // 2. Validate source inventory
  const { data: sourceInv, error: siError } = await supabase
    .from('inventory')
    .select('id, quantity')
    .match({ variant_id: payload.variant_id, location_id: payload.source_location_id })
    .single();

  if (siError || !sourceInv) throw new Error('Stok asal tidak ditemukan.');
  if (sourceInv.quantity < payload.quantity) throw new Error('Stok di lokasi asal tidak mencukupi.');

  // 3. Deduct from source
  const { error: dsError } = await supabase
    .from('inventory')
    .update({ quantity: sourceInv.quantity - payload.quantity })
    .eq('id', sourceInv.id);
  if (dsError) throw dsError;

  // 4. Add to target
  const { data: existingTargetInv } = await supabase
    .from('inventory')
    .select('id, quantity')
    .match({ variant_id: payload.variant_id, location_id: targetLocation.id })
    .single();

  if (existingTargetInv) {
    const { error: utError } = await supabase
      .from('inventory')
      .update({ quantity: existingTargetInv.quantity + payload.quantity })
      .eq('id', existingTargetInv.id);
    if (utError) throw utError;
  } else {
    const { error: itError } = await supabase
      .from('inventory')
      .insert({
        variant_id: payload.variant_id,
        location_id: targetLocation.id,
        quantity: payload.quantity
      });
    if (itError) throw itError;
  }

  // 5. Log Transactions (Duo logic: Out from source, In to target)
  const sourceLocation = await supabase.from('locations').select('aisle, rack, level').eq('id', payload.source_location_id).single();
  const sourceLocStr = sourceLocation.data ? `${sourceLocation.data.aisle}-${sourceLocation.data.rack}${sourceLocation.data.level}` : payload.source_location_id;
  const targetLocStr = `${payload.target_location.aisle}-${payload.target_location.rack}${payload.target_location.level}`;

  // Log "Transfer Out" for source
  await logTransaction({
    variant_id: payload.variant_id,
    type: 'Transfer',
    quantity: -payload.quantity,
    reference_number: payload.reference_number,
    report_note: `Pemindahan KELUAR. Dari ${sourceLocStr} ke ${targetLocStr}. ${payload.note || ''}`,
    document_image_url: payload.before_image_url,
    product_image_url: payload.after_image_url
  });

  // Log "Transfer In" for target
  await logTransaction({
    variant_id: payload.variant_id,
    type: 'Transfer',
    quantity: payload.quantity,
    reference_number: payload.reference_number,
    report_note: `Pemindahan MASUK. Ke ${targetLocStr} dari ${sourceLocStr}. ${payload.note || ''}`,
    document_image_url: payload.before_image_url,
    product_image_url: payload.after_image_url
  });

  return { success: true };
}

/**
 * Process Stock Opname (Inventory Reconciliation)
 */
export async function processStockOpname(payload: {
  inventory_id: string;
  physical_quantity: number;
  note?: string;
}) {
  // 1. Get current inventory
  const { data: inv, error: iError } = await supabase
    .from('inventory')
    .select('id, quantity, variant_id, location_id')
    .eq('id', payload.inventory_id)
    .single();

  if (iError || !inv) throw new Error('Data inventaris tidak ditemukan.');

  if (await checkLocationFrozen(inv.location_id)) {
    throw new Error('Lokasi sedang dibekukan untuk Stock Opname.');
  }

  const diff = payload.physical_quantity - inv.quantity;

  // 2. Update inventory
  const { error: uError } = await supabase
    .from('inventory')
    .update({ quantity: payload.physical_quantity })
    .eq('id', inv.id);
  
  if (uError) throw uError;

  // 3. Log Transaction
  await logTransaction({
    variant_id: inv.variant_id,
    type: 'Opname',
    quantity: diff,
    report_note: `Opname: Fisik ${payload.physical_quantity}, Sistem ${inv.quantity}. Selisih: ${diff}. ${payload.note || ''}`
  });

  return { success: true };
}

/**
 * Fetches aggregated statistics for the dashboard.
 */
export async function fetchDashboardStats() {
  // 1. Total Inventory
  const { data: invData, error: invError } = await supabase
    .from('inventory')
    .select('quantity');
  
  if (invError) throw invError;
  const totalStock = invData.reduce((acc, curr) => acc + curr.quantity, 0);

  // 2. Low Stock SKU count (threshold = 10 for garment)
  const threshold = 10;
  const { count: lowStockCount, error: lowError } = await supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })
    .lt('quantity', threshold);

  if (lowError) throw lowError;

  // 3. Out of stock rate
  const { count: totalVariants, error: vCountError } = await supabase
    .from('product_variants')
    .select('*', { count: 'exact', head: true });
  
  const { count: outOfStockCount, error: oosError } = await supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })
    .eq('quantity', 0);

  if (vCountError || oosError) throw (vCountError || oosError || new Error('Gagal mengambil data stok'));
  
  const oosRate = totalVariants ? ((outOfStockCount || 0) / totalVariants) * 100 : 0;

  return {
    totalStock: totalStock.toLocaleString('id-ID'),
    lowStockCount: lowStockCount || 0,
    oosRate: oosRate.toFixed(1) + '%',
    pendingInbound: '0', // Placeholder
  };
}

/**
 * Fetches stock movement data for charts (Last 7 days).
 */
export async function fetchStockMovement() {
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('stock_ledger')
    .select('transaction_type, quantity_changed, created_at')
    .gte('created_at', sevenDaysAgo.toISOString());

  if (error) throw error;

  // Process data for Recharts
  const movementMap = new Map();

  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayName = days[d.getDay()];
    movementMap.set(dayName, { name: dayName, masuk: 0, keluar: 0 });
  }

  data.forEach((tx) => {
    const dayName = days[new Date(tx.created_at).getDay()];
    if (movementMap.has(dayName)) {
      const entry = movementMap.get(dayName);
      if (tx.transaction_type === 'In') entry.masuk += tx.quantity_changed;
      if (tx.transaction_type === 'Out') entry.keluar += Math.abs(tx.quantity_changed);
    }
  });

  return Array.from(movementMap.values());
}

/**
 * Deletes a product and its associated variants (cascading).
 * Note: DB needs to be configured with ON DELETE CASCADE.
 */
export async function deleteProduct(productId: string) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) throw error;
}

/**
 * Updates base product information.
 */
export async function updateProduct(productId: string, payload: Partial<Product & { categories_id?: string }>) {
  const { error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', productId);

  if (error) throw error;
}

/**
 * Updates variant information (color, size, etc).
 */
export async function updateVariant(variantId: string, payload: { color?: string, size?: string, sku?: string }) {
  const { error } = await supabase
    .from('product_variants')
    .update(payload)
    .eq('id', variantId);

  if (error) throw error;
}

/**
 * Searches for product variants by SKU or name for autocomplete features.
 */
export async function searchVariants(query: string) {
  if (!query) return [];
  
  const { data, error } = await supabase
    .from('product_variants')
    .select(`
      id,
      sku,
      color,
      size,
      products:product_id (
        name,
        categories_id,
        categories (
          name
        )
      )
    `)
    .or(`sku.ilike.%${query}%`)
    .limit(10);

  if (error) throw error;
  return data;
}

/**
 * Specifically fetches recent 'In' (Inbound) transactions.
 */
export async function fetchRecentInboundLogs(limit = 10) {
  const { data, error } = await supabase
    .from('stock_ledger')
    .select(`
      id,
      transaction_type,
      quantity_changed,
      created_at,
      reference_number,
      report_note,
      document_image_url,
      product_image_url,
      product_variants (
        sku,
        color,
        size
      )
    `)
    .eq('transaction_type', 'In')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
