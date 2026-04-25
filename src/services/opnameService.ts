import { supabase } from '@/lib/supabase';
import { logTransaction } from './inventoryService';
import { unfreezeLocations } from './locationService';

export interface OpnameTicket {
  id: string;
  ticket_number: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'cancelled';
  warehouse_id: string;
  aisle?: string;
  rack?: string;
  level?: string;
  category_id?: string;
  created_at: string;
  created_by?: string;
  warehouses?: {
    name: string;
  };
}

export interface OpnameItem {
  id: string;
  ticket_id: string;
  inventory_id: string;
  variant_id: string;
  location_id: string;
  system_quantity: number;
  physical_quantity: number | null;
  status: 'pending' | 'counted' | 'verified' | 'recount';
  product_variants: {
    sku: string;
    products: {
      name: string;
    }
  };
  locations: {
    aisle: string;
    rack: string;
    level: string;
  };
}

export async function createOpnameTicket(payload: {
  warehouseId: string;
  aisle?: string;
  rack?: string;
  level?: string;
  categoryId?: string;
}) {
  const ticketNumber = `OPN-${Math.floor(100000 + Math.random() * 900000)}`;
  
  const cleanPayload = {
    warehouse_id: payload.warehouseId,
    aisle: payload.aisle || null,
    rack: payload.rack || null,
    level: payload.level || null,
    category_id: payload.categoryId || null
  };

  // 1. Identify items to count based on filters FIRST
  // to ensure we don't create an empty ticket
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Anda harus login untuk melakukan Stock Opname.');

  // We use explicit join mapping (e.g., locations:location_id) for robustness
  let query = supabase
    .from('inventory')
    .select(`
      id,
      quantity,
      variant_id,
      location_id,
      locations:location_id!inner(id, warehouse_id, aisle, rack, level),
      product_variants:variant_id!inner(
        id, 
        product_id, 
        products:product_id!inner(id, categories_id)
      )
    `)
    .eq('locations.warehouse_id', payload.warehouseId);

  if (cleanPayload.aisle) query = query.eq('locations.aisle', cleanPayload.aisle);
  if (cleanPayload.rack) query = query.eq('locations.rack', cleanPayload.rack);
  if (cleanPayload.level) query = query.eq('locations.level', cleanPayload.level);
  
  // Use the nested filter path based on aliased joins
  if (cleanPayload.category_id) {
    query = query.eq('product_variants.products.categories_id', cleanPayload.category_id);
  }

  const { data: items, error: iError } = await query;
  if (iError) {
    console.error('Inventory query error:', iError);
    throw iError;
  }

  if (!items || items.length === 0) {
    throw new Error('Tidak ada barang yang ditemukan untuk kriteria ini. Silakan sesuaikan filter Anda.');
  }

  // 2. Create the ticket
  const { data: ticket, error: tError } = await supabase
    .from('opname_tickets')
    .insert({
      ticket_number: ticketNumber,
      status: 'initiated',
      created_by: user?.id,
      ...cleanPayload
    })
    .select()
    .single();

  if (tError) throw tError;

  // 3. Create opname items
  const opnameItems = items.map(item => ({
    ticket_id: ticket.id,
    inventory_id: item.id,
    variant_id: item.variant_id,
    location_id: item.location_id,
    system_quantity: item.quantity,
    status: 'pending'
  }));

  const { error: itemsError } = await supabase
    .from('opname_items')
    .insert(opnameItems);
  
  if (itemsError) throw itemsError;

  // 4. Freeze locations
  const locationIds = Array.from(new Set(items.map(i => i.location_id)));
  const { error: freezeError } = await supabase
    .from('locations')
    .update({ is_frozen: true })
    .in('id', locationIds);
  
  if (freezeError) throw freezeError;

  return ticket;
}

export async function fetchActiveOpnameTickets() {
  const { data, error } = await supabase
    .from('opname_tickets')
    .select('*, warehouses(name)')
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as OpnameTicket[];
}

export async function fetchOpnameItems(ticketId: string) {
  const { data, error } = await supabase
    .from('opname_items')
    .select(`
      *,
      product_variants:variant_id(
        sku, 
        products:product_id(name)
      ),
      locations:location_id(aisle, rack, level)
    `)
    .eq('ticket_id', ticketId);

  if (error) throw error;
  return data as OpnameItem[];
}

export async function submitPhysicalCount(itemId: string, quantity: number) {
  const { error } = await supabase
    .from('opname_items')
    .update({ 
      physical_quantity: quantity,
      status: 'counted'
    })
    .eq('id', itemId);

  if (error) throw error;
}

export async function approveOpnameItem(item: OpnameItem) {
  const variance = (item.physical_quantity || 0) - item.system_quantity;

  // 1. Update Inventory
  const { error: invError } = await supabase
    .from('inventory')
    .update({ quantity: item.physical_quantity })
    .eq('id', item.inventory_id);
  
  if (invError) throw invError;

  // 2. Log Transaction
  await logTransaction({
    variant_id: item.variant_id,
    type: 'Opname',
    quantity: variance,
    report_note: `Opname Adjustment: Fisik ${item.physical_quantity}, Sistem ${item.system_quantity}. Selisih: ${variance}.`
  });

  // 3. Update Item Status
  const { error: itemError } = await supabase
    .from('opname_items')
    .update({ status: 'verified' })
    .eq('id', item.id);
  
  if (itemError) throw itemError;
}

export async function requestRecount(itemId: string) {
  const { error } = await supabase
    .from('opname_items')
    .update({ status: 'recount', physical_quantity: null })
    .eq('id', itemId);

  if (error) throw error;
}

export async function completeOpnameTicket(ticketId: string) {
  // 1. Get all items to find locations to unfreeze
  const { data: items, error: iError } = await supabase
    .from('opname_items')
    .select('location_id')
    .eq('ticket_id', ticketId);
  
  if (iError) throw iError;

  // 2. Unfreeze locations
  const locationIds = Array.from(new Set(items.map(i => i.location_id)));
  await unfreezeLocations(locationIds);

  // 3. Update ticket status
  const { error: tError } = await supabase
    .from('opname_tickets')
    .update({ status: 'completed' })
    .eq('id', ticketId);
  
  if (tError) throw tError;
}
