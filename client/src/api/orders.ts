import { apiRequest } from './client';
import type { Order } from '../types';

export function getOrders() {
  return apiRequest<Order[]>('getOrders', 'GET');
}

export function saveOrder(order: Record<string, unknown>) {
  return apiRequest<{
    success: boolean;
    orderId?: string;
    transactionId?: string;
    status?: string;
    totalPaid?: number;
  }>('saveOrder', 'POST', order);
}

export function updateOrderStatus(orderId: string, status: string, opsNote?: string) {
  return apiRequest<{ success: boolean }>('saveOrder', 'POST', { orderId, status, opsNote });
}

export function transferOrder(orderId: string, employeeCode: string) {
  return apiRequest<{ success: boolean; orderId: string; employeeCode?: string }>('transferOrder', 'POST', {
    orderId,
    employeeCode,
  });
}
