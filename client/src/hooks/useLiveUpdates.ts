import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDataVersion } from '../api/content';

/** Public data that admin-panel edits can change. */
const LIVE_QUERY_KEYS = [['shares'], ['sharesConfig'], ['siteSettings'], ['site-settings'], ['active-offers'], ['articles'], ['article'], ['orders']];

/**
 * Keeps open pages current without a refresh: polls a tiny version fingerprint every 30s
 * (paused while the tab is hidden) and re-fetches the real data only when it changes.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const lastVersion = useRef('');
  const { data } = useQuery({
    queryKey: ['data-version'],
    queryFn: getDataVersion,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });

  useEffect(() => {
    const version = data?.version;
    if (!version) return;
    if (lastVersion.current && lastVersion.current !== version) {
      LIVE_QUERY_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    }
    lastVersion.current = version;
  }, [data?.version, queryClient]);
}
