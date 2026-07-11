import { useQuery } from '@tanstack/react-query';
import { getSettings } from '../api/content';
import {
  SITE_BANK_DEFAULTS,
  SITE_CONTACT_DEFAULTS,
  SITE_DISCLAIMER_DEFAULT,
} from '../constants/siteContact';

const DEFAULTS: Record<string, string> = {
  ...SITE_CONTACT_DEFAULTS,
  ...SITE_BANK_DEFAULTS,
  disclaimer: SITE_DISCLAIMER_DEFAULT,
};

export function useSiteSettings() {
  const query = useQuery({
    queryKey: ['siteSettings'],
    queryFn: getSettings,
    staleTime: 120_000,
  });

  const settings = { ...DEFAULTS, ...(query.data || {}) };
  return { settings, isLoading: query.isLoading, refetch: query.refetch };
}
