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
  includePlatformFee?: boolean;
  includeStampDuty?: boolean;
}

export interface InvoiceChargeOptions {
  includePlatformFee?: boolean;
  includeStampDuty?: boolean;
}

export function getInvoices() {
  return apiRequest<Invoice[]>('getInvoices', 'GET');
}

export function getInvoice(invoiceId: string) {
  return apiRequest<Invoice>('getInvoice', 'GET', undefined, { invoiceId });
}

export function getInvoiceByOrder(orderId: string) {
  return apiRequest<Invoice>('getInvoiceByOrder', 'GET', undefined, { orderId });
}

export function generateInvoice(orderId: string, options: InvoiceChargeOptions = {}) {
  return apiRequest<{ success: boolean; invoice: Invoice }>('generateInvoice', 'POST', {
    orderId,
    includePlatformFee: !!options.includePlatformFee,
    includeStampDuty: !!options.includeStampDuty,
  });
}

export function updateInvoiceCharges(invoiceId: string, options: InvoiceChargeOptions) {
  return apiRequest<{ success: boolean; invoice: Invoice }>('updateInvoiceCharges', 'POST', {
    invoiceId,
    includePlatformFee: !!options.includePlatformFee,
    includeStampDuty: !!options.includeStampDuty,
  });
}

export function deleteInvoice(invoiceId: string) {
  return apiRequest<{ success: boolean }>('adminDeleteInvoice', 'POST', { invoiceId });
}
