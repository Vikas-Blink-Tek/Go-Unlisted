import { useQuery } from '@tanstack/react-query';
import { getSettings } from '../api/content';

const DEFAULTS: Record<string, string> = {
  email: 'infogounlisted@gmail.com',
  mobile: '+91 98208 97828',
  whatsapp: '919820897828',
  address: 'Charkop, Kandivali West, Mumbai – 400067',
  disclaimer: 'Trading in unlisted shares carries significant risk. GO UNLISTED is not a SEBI-registered broker.',
  bank_name: 'Kotak Mahindra Bank',
  bank_ac_name: 'GOUNLISTED',
  bank_ac_no: '0053829665',
  bank_ifsc: 'KKBK0001364',
  bank_upi: 'gounlisted@kotak',
  bank_branch: 'MUM - ANDHERI - SAKIVIHAR ROAD',
  bank_address: 'HYDE PARK, MAROL, SAKI VIHAR ROAD, ANDHERI EAST, Mumbai 400072',
};


export function useSiteSettings() {
  const query = useQuery({
    queryKey: ['siteSettings'],
    queryFn: getSettings,
    staleTime: 120_000,
  });

  const settings = { ...DEFAULTS, ...(query.data || {}) };
  return { settings, isLoading: query.isLoading };
}
