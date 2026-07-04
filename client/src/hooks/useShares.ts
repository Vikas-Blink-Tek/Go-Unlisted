import { useQuery } from '@tanstack/react-query';
import { getShares } from '../api/shares';
import { mergeSharesWithPrices } from '../data/sharesCatalog';
import { getSharesConfig } from '../api/shares';
import type { Share } from '../types';

export function useShares() {
  const sharesQuery = useQuery({
    queryKey: ['shares'],
    queryFn: getShares,
    // Always prefer live admin catalog (add/edit/price) over a long cache
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const fallbackQuery = useQuery({
    queryKey: ['sharesConfig'],
    queryFn: getSharesConfig,
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: sharesQuery.isError || (sharesQuery.isSuccess && (sharesQuery.data?.length ?? 0) === 0),
  });

  const shares: Share[] = sharesQuery.data?.length
    ? sharesQuery.data
    : mergeSharesWithPrices(fallbackQuery.data || {});

  const getShareById = (id: string) => shares.find((s) => s.id === id) ?? null;

  const refetch = async () => {
    await sharesQuery.refetch();
    await fallbackQuery.refetch();
  };

  return {
    shares,
    getShareById,
    isLoading: sharesQuery.isLoading,
    refetch,
  };
}

export function useWatchlist() {
  const get = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem('gu_watchlist') || '[]');
    } catch {
      return [];
    }
  };

  const toggle = (id: string) => {
    const list = get();
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    localStorage.setItem('gu_watchlist', JSON.stringify(next));
    return next;
  };

  return { get, toggle };
}
