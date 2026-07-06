import { apiRequest } from './client';

export interface InventoryItem {
  id: string;
  name: string;
  ticker: string;
  price: number;
  buyPrice?: number;
  qtyOnHand: number;
  inventoryStatus: string;
  marginPerShare?: number | null;
  marginPct?: number | null;
  inventoryValue?: number | null;
}

export function getInventory() {
  return apiRequest<InventoryItem[]>('getInventory', 'GET');
}

export function updateInventory(payload: {
  shareId: string;
  qtyOnHand: number;
  inventoryStatus: string;
  buyPrice?: number | string | null;
}) {
  return apiRequest<{ success: boolean }>('updateInventory', 'POST', payload);
}
