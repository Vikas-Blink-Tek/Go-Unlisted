import { apiRequest } from './client';

export interface InitiatedCheckout {
  sessionId: string;
  shareId: string;
  shareName: string;
  shareTicker?: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  qty: number;
  pricePerShare: number;
  totalAmount: number;
  paymentMode: string;
  status: string;
  initiatedAt: string;
}

export function saveInitiatedCheckout(data: Record<string, unknown>) {
  return apiRequest<{ success: boolean }>('saveInitiatedCheckout', 'POST', data);
}

export function getInitiatedCheckouts() {
  return apiRequest<InitiatedCheckout[]>('getInitiatedCheckouts', 'GET');
}

export function deleteInitiatedCheckout(sessionId: string) {
  return apiRequest<{ success: boolean }>('deleteInitiatedCheckout', 'POST', { sessionId });
}

export function approveInitiatedCheckout(sessionId: string, orderId?: string) {
  return apiRequest<{ success: boolean; orderId: string }>('approveInitiatedCheckout', 'POST', { sessionId, orderId });
}
