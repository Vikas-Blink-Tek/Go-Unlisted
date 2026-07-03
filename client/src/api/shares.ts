import { apiRequest } from './client';
import type { Share } from '../types';

export function getShares() {
  return apiRequest<Share[]>('getShares', 'GET');
}

export function getSharesConfig() {
  return apiRequest<Record<string, number>>('getSharesConfig', 'GET');
}

export function saveShareConfig(shareId: string, basePrice: number) {
  return apiRequest<{ success: boolean }>('saveShareConfig', 'POST', { shareId, basePrice });
}

export type ShareInput = Omit<Share, 'price' | 'lastUpdated' | 'id'> & { id?: string };

export function saveShare(share: ShareInput) {
  return apiRequest<{ success: boolean; shareId: string }>('saveShare', 'POST', share);
}

export function deleteShare(shareId: string) {
  return apiRequest<{ success: boolean }>('deleteShare', 'POST', { shareId });
}
