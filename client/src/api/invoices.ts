import { apiRequest } from './client';

export interface Invoice {
  invoiceId: string;
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  shareId: string;
  shareName: string;
  shareTicker: string;
  qty: number;
  pricePerShare: number;
  subtotal: number;
  platformFee: number;
  stampDuty: number;
  totalAmount: number;
  paymentMethod?: string;
  transactionId?: string;
  status: string;
  invoiceDate: string;
  createdAt?: string;
}

export function getInvoices() {
  return apiRequest<Invoice[]>('getInvoices', 'GET');
}

export function getInvoice(invoiceId: string) {
  return apiRequest<Invoice>('getInvoice', 'GET', undefined, { invoiceId });
}

export function generateInvoice(orderId: string) {
  return apiRequest<{ success: boolean; invoice: Invoice }>('generateInvoice', 'POST', { orderId });
}
