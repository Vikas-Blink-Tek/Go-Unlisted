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

export function updateOrderStatus(
  orderId: string,
  status: string,
  opsNote?: string,
  transactionId?: string,
) {
  return apiRequest<{ success: boolean }>('saveOrder', 'POST', {
    orderId,
    status,
    ...(opsNote ? { opsNote } : {}),
    ...(transactionId !== undefined ? { transactionId } : {}),
  });
}

/** Admin: set / update bank UTR without changing status. */
export function updateOrderPaymentRef(orderId: string, transactionId: string, currentStatus: string) {
  return updateOrderStatus(orderId, currentStatus, undefined, transactionId);
}

/** Master admin: correct recorded paid amount (matches bank credit). */
export function adjustOrderTotal(orderId: string, totalAmount: number, opsNote?: string) {
  return apiRequest<{ success: boolean; orderId: string; totalPaid: number; previousTotal: number }>(
    'adminAdjustOrderTotal',
    'POST',
    {
      orderId,
      totalAmount,
      ...(opsNote ? { opsNote } : {}),
    },
  );
}

export function transferOrder(orderId: string, employeeCode: string) {
  return apiRequest<{ success: boolean; orderId: string; employeeCode?: string }>('transferOrder', 'POST', {
    orderId,
    employeeCode,
  });
}
