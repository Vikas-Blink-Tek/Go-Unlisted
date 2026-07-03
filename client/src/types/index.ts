export type ChartPeriod = '3M' | '6M' | '1Y';

export interface Share {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  sectorColor: string;
  basePrice: number;
  price: number;
  minQty: number;
  description: string;
  founded: number | null;
  revenue: string;
  valuation: string;
  growth: string;
  changePositive: boolean;
  logoInitials: string;
  logoGradient: string;
  priceHistory: Record<ChartPeriod, number[]>;
  chartLabels: Record<ChartPeriod, string[]>;
  listingType?: string;
  ipoTimeline?: string;
  buyPrice?: number | null;
  inventoryStatus?: string;
  keyHighlights?: string[];
  riskNotes?: string;
  lockInMonths?: number;
  isFeatured?: boolean;
  lastUpdated?: string | null;
  isBuiltin?: boolean;
  _isCustom?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  kycStatus: string;
  role?: string;
  referralCode?: string;
  kycPan?: string;
  kycDemat?: string;
  bankAccount?: string;
  ifsc?: string;
  kycRejectReason?: string;
  createdAt?: string;
}

export interface Order {
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  shareId: string;
  companyName?: string;
  shareName?: string;
  shareTicker?: string;
  sector?: string;
  logoInitials?: string;
  logoGradient?: string;
  pricePerShare: number;
  qty: number;
  totalPaid?: number;
  total?: number;
  status: string;
  method?: string;
  paymentMethod?: string;
  transactionId?: string;
  opsNote?: string;
  orderSource?: string;
  date?: string;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  content?: string;
  image_url?: string;
  author?: string;
  status?: string;
  created_at?: string;
}

export interface SiteSettings {
  [key: string]: string;
}

export interface CheckoutState {
  shareId: string;
  qty: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerPan: string;
  buyerDemat: string;
  paymentMethod: string;
  transactionId: string;
}
