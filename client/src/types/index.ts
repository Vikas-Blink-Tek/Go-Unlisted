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
  /** Optional company logo image path (e.g. uploads/shares/xxx.png) */
  logoUrl?: string;
  priceHistory: Record<ChartPeriod, number[]>;
  chartLabels: Record<ChartPeriod, string[]>;
  listingType?: string;
  ipoTimeline?: string;
  buyPrice?: number | null;
  /** Listing / IPO price — when set, stock appears in homepage pre-IPO vs listing comparison */
  listingPrice?: number | null;
  inventoryStatus?: string;
  keyHighlights?: string[];
  riskNotes?: string;
  lockInMonths?: number;
  /** Optional ISIN (e.g. INE312K01010) */
  isin?: string;
  /** Optional key-data metrics — all optional (show N/A when empty) */
  week52High?: string;
  week52Low?: string;
  marketCap?: string;
  peRatio?: string;
  pbRatio?: string;
  debtEquity?: string;
  roe?: string;
  bookValue?: string;
  faceValue?: string;
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
  utr?: string;
  opsNote?: string;
  orderSource?: string;
  employeeCode?: string;
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
