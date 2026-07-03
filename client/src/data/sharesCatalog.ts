import type { Share } from '../types';

export const STOCK_SECTORS = [
  'Fintech',
  'Finance',
  'Retail',
  'Hospitality',
  'Quick Commerce',
  'EV',
  'SaaS',
  'Healthcare',
  'EdTech',
  'Infrastructure',
  'Defense',
  'Agriculture',
  'Other',
];

export const SECTORS = ['All', ...STOCK_SECTORS];
export const COMMISSION_RATE = 0.01;

export const BASE_SHARES_DATA: Omit<Share, 'price'>[] = [
  {
    id: 'tata-capital',
    name: 'Tata Capital',
    ticker: 'TATACAP',
    sector: 'Fintech',
    sectorColor: '#6C63FF',
    basePrice: 850,
    minQty: 20,
    description:
      'Tata Capital is the financial services arm of the Tata Group, offering a wide range of financial products including loans, wealth management, and investment advisory services. As one of India\'s most trusted non-banking financial companies, it is poised for exponential growth ahead of its expected IPO.',
    founded: 2007,
    revenue: '₹12,400 Cr',
    valuation: '₹72,000 Cr',
    growth: '+28%',
    changePositive: true,
    logoInitials: 'TC',
    logoGradient: 'linear-gradient(135deg, #003478, #0050a8)',
    priceHistory: {
      '3M': [780, 790, 795, 805, 800, 810, 820, 818, 825, 830, 835, 840, 850],
      '6M': [710, 720, 735, 750, 745, 760, 775, 770, 785, 800, 810, 835, 850],
      '1Y': [620, 630, 650, 660, 670, 690, 700, 695, 720, 740, 760, 810, 850],
    },
    chartLabels: {
      '3M': ['Apr 1', 'Apr 8', 'Apr 15', 'Apr 22', 'May 1', 'May 8', 'May 15', 'May 22', 'Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 30'],
      '6M': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
      '1Y': ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    },
  },
  {
    id: 'reliance-retail',
    name: 'Reliance Retail',
    ticker: 'RELRET',
    sector: 'Retail',
    sectorColor: '#FF6B6B',
    basePrice: 1200,
    minQty: 10,
    description:
      'Reliance Retail is the retail division of Reliance Industries, operating India\'s largest retail chain across grocery, fashion, electronics, and digital commerce. With over 18,000 stores and a rapidly expanding e-commerce arm (JioMart), it is India\'s largest and most valued retailer targeting a blockbuster IPO.',
    founded: 2006,
    revenue: '₹2,60,000 Cr',
    valuation: '₹8,00,000 Cr',
    growth: '+34%',
    changePositive: true,
    logoInitials: 'RR',
    logoGradient: 'linear-gradient(135deg, #1565C0, #42a5f5)',
    priceHistory: {
      '3M': [1100, 1110, 1120, 1115, 1130, 1145, 1150, 1160, 1170, 1180, 1185, 1195, 1200],
      '6M': [980, 1000, 1020, 1040, 1035, 1055, 1070, 1080, 1100, 1130, 1160, 1185, 1200],
      '1Y': [820, 850, 880, 900, 920, 950, 970, 1000, 1030, 1080, 1130, 1180, 1200],
    },
    chartLabels: {
      '3M': ['Apr 1', 'Apr 8', 'Apr 15', 'Apr 22', 'May 1', 'May 8', 'May 15', 'May 22', 'Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 30'],
      '6M': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
      '1Y': ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    },
  },
  {
    id: 'oyo-rooms',
    name: 'OYO Rooms',
    ticker: 'OYOROOMS',
    sector: 'Hospitality',
    sectorColor: '#F5A623',
    basePrice: 45,
    minQty: 100,
    description:
      'OYO Rooms is one of the world\'s largest hotel chains, operating in 35+ countries with over 1,57,000 hotels. After a dramatic restructuring and cost-optimisation drive, OYO has returned to profitability and is targeting an IPO, presenting a high-potential entry point for early investors.',
    founded: 2013,
    revenue: '₹5,463 Cr',
    valuation: '₹20,000 Cr',
    growth: '+18%',
    changePositive: false,
    logoInitials: 'OY',
    logoGradient: 'linear-gradient(135deg, #c62828, #ef5350)',
    priceHistory: {
      '3M': [52, 50, 48, 47, 46, 48, 47, 45, 44, 45, 46, 45, 45],
      '6M': [60, 57, 55, 52, 50, 49, 48, 47, 46, 47, 46, 45, 45],
      '1Y': [80, 75, 68, 62, 58, 55, 52, 49, 47, 46, 46, 45, 45],
    },
    chartLabels: {
      '3M': ['Apr 1', 'Apr 8', 'Apr 15', 'Apr 22', 'May 1', 'May 8', 'May 15', 'May 22', 'Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 30'],
      '6M': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
      '1Y': ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    },
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    ticker: 'PHONEPE',
    sector: 'Fintech',
    sectorColor: '#6C63FF',
    basePrice: 3200,
    minQty: 5,
    description:
      'PhonePe is India\'s leading digital payments platform, processing over 50% of all UPI transactions in the country. Backed by Walmart, PhonePe has diversified into mutual funds, insurance, lending, and international remittances — positioning itself as a financial super-app ahead of its highly anticipated IPO.',
    founded: 2015,
    revenue: '₹5,064 Cr',
    valuation: '₹70,000 Cr',
    growth: '+67%',
    changePositive: true,
    logoInitials: 'PP',
    logoGradient: 'linear-gradient(135deg, #4a148c, #7b1fa2)',
    priceHistory: {
      '3M': [2800, 2850, 2900, 2880, 2920, 2960, 3000, 3020, 3050, 3080, 3120, 3160, 3200],
      '6M': [2200, 2280, 2350, 2400, 2450, 2500, 2580, 2650, 2750, 2880, 3000, 3120, 3200],
      '1Y': [1500, 1650, 1800, 1900, 2000, 2100, 2250, 2400, 2600, 2800, 3000, 3150, 3200],
    },
    chartLabels: {
      '3M': ['Apr 1', 'Apr 8', 'Apr 15', 'Apr 22', 'May 1', 'May 8', 'May 15', 'May 22', 'Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 30'],
      '6M': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
      '1Y': ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    },
  },
  {
    id: 'zepto',
    name: 'Zepto',
    ticker: 'ZEPTO',
    sector: 'Quick Commerce',
    sectorColor: '#00C896',
    basePrice: 620,
    minQty: 25,
    description:
      'Zepto is India\'s fastest-growing quick-commerce startup, delivering groceries and essentials in under 10 minutes through a network of dark stores. Having achieved profitability within 3 years of launch, Zepto is preparing for a landmark IPO that has drawn massive institutional interest globally.',
    founded: 2021,
    revenue: '₹4,454 Cr',
    valuation: '₹35,000 Cr',
    growth: '+140%',
    changePositive: true,
    logoInitials: 'ZP',
    logoGradient: 'linear-gradient(135deg, #6a0dad, #9c27b0)',
    priceHistory: {
      '3M': [530, 545, 555, 565, 570, 580, 585, 590, 600, 605, 610, 615, 620],
      '6M': [380, 400, 420, 440, 460, 480, 500, 520, 545, 570, 595, 610, 620],
      '1Y': [180, 220, 270, 320, 370, 420, 460, 500, 540, 570, 595, 610, 620],
    },
    chartLabels: {
      '3M': ['Apr 1', 'Apr 8', 'Apr 15', 'Apr 22', 'May 1', 'May 8', 'May 15', 'May 22', 'Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 30'],
      '6M': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
      '1Y': ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    },
  },
  {
    id: 'ola-electric',
    name: 'Ola Electric',
    ticker: 'OLAEV',
    sector: 'EV',
    sectorColor: '#00B4D8',
    basePrice: 95,
    minQty: 50,
    description:
      'Ola Electric is India\'s leading electric vehicle manufacturer, commanding over 50% of the domestic EV two-wheeler market. With a state-of-the-art Gigafactory producing 1 million scooters annually and aggressive expansion into electric cars and battery tech, Ola Electric is reshaping India\'s EV future.',
    founded: 2017,
    revenue: '₹5,010 Cr',
    valuation: '₹25,000 Cr',
    growth: '+89%',
    changePositive: true,
    logoInitials: 'OE',
    logoGradient: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    priceHistory: {
      '3M': [82, 84, 85, 87, 86, 88, 90, 89, 91, 92, 93, 94, 95],
      '6M': [65, 68, 71, 74, 73, 76, 80, 82, 86, 89, 92, 94, 95],
      '1Y': [42, 48, 53, 58, 62, 67, 72, 77, 82, 87, 91, 93, 95],
    },
    chartLabels: {
      '3M': ['Apr 1', 'Apr 8', 'Apr 15', 'Apr 22', 'May 1', 'May 8', 'May 15', 'May 22', 'Jun 1', 'Jun 8', 'Jun 15', 'Jun 22', 'Jun 30'],
      '6M': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
      '1Y': ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    },
  },
];

export function getCustomShares(): Omit<Share, 'price'>[] {
  try {
    return JSON.parse(localStorage.getItem('gu_custom_shares') || '[]');
  } catch {
    return [];
  }
}

export function getDeletedStockIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem('gu_deleted_stocks') || '[]');
  } catch {
    return [];
  }
}

export function mergeSharesWithPrices(
  overrides: Record<string, number>,
): Share[] {
  const deleted = getDeletedStockIds();
  const custom = getCustomShares();

  const all = [
    ...BASE_SHARES_DATA.map((share) => {
      const overridePrice = overrides[share.id];
      return {
        ...share,
        price: overridePrice ?? share.basePrice,
        lastUpdated: overridePrice ? new Date().toISOString() : null,
      };
    }),
    ...custom.map((share) => {
      const overridePrice = overrides[share.id];
      return {
        ...share,
        price: overridePrice ?? share.basePrice,
        lastUpdated: overridePrice ? new Date().toISOString() : null,
      };
    }),
  ];

  return all.filter((s) => !deleted.includes(s.id));
}
