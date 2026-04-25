import { supabase } from '@/lib/supabase';
import { logTransaction } from './inventoryService';

export interface OutboundOrder {
  id: string;
  order_number: string;
  customer_name: string;
  status: 'pending' | 'allocated' | 'picking' | 'packed' | 'shipped' | 'cancelled';
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  inventory_id: string;
  quantity: number;
  picked_quantity: number;
  is_picked: boolean;
  product_variants: {
    sku: string;
    products: { name: string };
  };
  inventory: {
    locations: { aisle: string; rack: string; level: string };
  };
}

/**
 * LANGKAH 1: Soft Booking
 */
export async function createOutboundOrder(customerName: string, items: { variantId: string; quantity: number }[]) {
  const orderNumber = `OUT-${Date.now().toString().slice(-6)}`;

  // 1. Cek Ketersediaan & Alokasi (Soft Booking)
  const allocations = [];
  
  for (const item of items) {
    // Cari inventory dengan stok mencukupi (Quantity - Reserved >= Item Quantity)
    const { data: inv, error: invError } = await supabase
      .from('inventory')
      .select('id, quantity, reserved_quantity, variant_id')
      .eq('variant_id', item.variantId)
      .gte('quantity', item.quantity + (0)) // Logic sederhana: cari yang totalnya cukup
      .order('quantity', { ascending: true }) // FIFO/LIFO logic bisa diatur di sini
      .limit(1)
      .single();

    if (invError || !inv || (inv.quantity - (inv.reserved_quantity || 0)) < item.quantity) {
      throw new Error(`Stok untuk varian ${item.variantId} tidak mencukupi untuk dialokasikan.`);
    }
    
    allocations.push({ 
      inventory_id: inv.id, 
      variant_id: inv.variant_id, 
      quantity: item.quantity,
      current_reserved: inv.reserved_quantity || 0
    });
  }

  // 2. Insert Order Header
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Sesi berakhir atau Anda belum login. Silakan login kembali.');
  }

  const { data: order, error: oError } = await supabase
    .from('outbound_orders')
    .insert({ 
      order_number: orderNumber, 
      customer_name: customerName, 
      status: 'allocated',
      created_by: user.id 
    })
    .select()
    .single();

  if (oError) throw oError;

  // 3. Update Inventory (Add Reserved) & Insert Order Items
  for (const alloc of allocations) {
    await supabase
      .from('inventory')
      .update({ reserved_quantity: alloc.current_reserved + alloc.quantity })
      .eq('id', alloc.inventory_id);

    await supabase
      .from('order_items')
      .insert({
        order_id: order.id,
        variant_id: alloc.variant_id,
        inventory_id: alloc.inventory_id,
        quantity: alloc.quantity
      });
  }

  return order;
}

/**
 * LANGKAH 2: Dashboard & Picking List
 */
export async function fetchOutboundOrders(status?: string) {
  let query = supabase.from('outbound_orders').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data as OutboundOrder[];
}

/**
 * LANGKAH 3: Mobile Picking Logic
 */
export async function fetchPickingItems(orderId: string) {
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      *,
      product_variants:variant_id(sku, products(name)),
      inventory:inventory_id(locations:location_id(aisle, rack, level))
    `)
    .eq('order_id', orderId)
    // RUTE OPTIMAL: Sort berdasarkan Lorong -> Rak -> Level
    .order('inventory(locations(aisle))', { ascending: true })
    .order('inventory(locations(rack))', { ascending: true });

  if (error) throw error;
  return data as any[];
}

export async function confirmPickItem(itemId: string, quantity: number) {
  const { error } = await supabase
    .from('order_items')
    .update({ is_picked: true, picked_quantity: quantity })
    .eq('id', itemId);
  if (error) throw error;
}

/**
 * LANGKAH 4: Packing
 */
export async function updateOrderStatus(orderId: string, status: OutboundOrder['status']) {
  const { error } = await supabase
    .from('outbound_orders')
    .update({ status })
    .eq('id', orderId);
  if (error) throw error;
}

/**
 * LANGKAH 5: Final Shipping & Stock Reduction
 */
export async function finalizeShipping(orderId: string) {
  // 1. Ambil semua item pesanan
  const { data: items, error: iError } = await supabase
    .from('order_items')
    .select('*, inventory:inventory_id(id, quantity, reserved_quantity)')
    .eq('order_id', orderId);

  if (iError || !items) throw iError;

  // 2. Update Stok Permanen & Log Transaksi
  for (const item of items) {
    const inv = item.inventory;
    const newQty = inv.quantity - item.quantity;
    const newReserved = inv.reserved_quantity - item.quantity;

    // Kurangi Qty & Reserved permanen
    const { error: invError } = await supabase
      .from('inventory')
      .update({ 
        quantity: newQty, 
        reserved_quantity: Math.max(0, newReserved) 
      })
      .eq('id', inv.id);
    
    if (invError) throw invError;

    // Log ke Ledger
    await logTransaction({
      variant_id: item.variant_id,
      type: 'Out',
      quantity: item.quantity,
      report_note: `Outbound Order: ${orderId}`
    });
  }

  // 3. Update Status Order
  await updateOrderStatus(orderId, 'shipped');
  await supabase.from('outbound_orders').update({ shipped_at: new Date().toISOString() }).eq('id', orderId);
}
