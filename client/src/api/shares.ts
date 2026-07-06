import { apiRequest } from './client';
import { fetchCsrfToken } from './csrf';
import type { Share } from '../types';

export function getShares() {
  return apiRequest<Share[]>('getShares', 'GET');
}

export async function uploadShareLogo(file: File) {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/i) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error('Use JPG, PNG or WEBP only');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Logo too large (max 2MB)');
  }
  const form = new FormData();
  form.append('logo', file);
  // Always refresh CSRF — admin session may have rotated the token
  const token = await fetchCsrfToken();
  const res = await fetch('/api/api.php?action=uploadShareLogo', {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: { 'X-CSRF-Token': token },
  });
  let data: { success?: boolean; url?: string; error?: string } = {};
  try {
    data = await res.json();
  } catch {
    throw new Error(res.ok ? 'Invalid server response' : `Upload failed (HTTP ${res.status})`);
  }
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Logo upload failed');
  }
  return data as { success: boolean; url: string };
}

export function getSharesConfig() {
  return apiRequest<Record<string, number>>('getSharesConfig', 'GET');
}

export function saveShareConfig(shareId: string, basePrice: number, listingPrice?: number | null) {
  const payload: { shareId: string; basePrice: number; listingPrice?: number | null } = {
    shareId,
    basePrice,
  };
  if (listingPrice !== undefined) {
    payload.listingPrice = listingPrice;
  }
  return apiRequest<{ success: boolean }>('saveShareConfig', 'POST', payload);
}

export type ShareInput = Omit<Share, 'price' | 'lastUpdated' | 'id'> & { id?: string };

export function saveShare(share: ShareInput) {
  return apiRequest<{ success: boolean; shareId: string }>('saveShare', 'POST', share);
}

export function deleteShare(shareId: string) {
  return apiRequest<{ success: boolean }>('deleteShare', 'POST', { shareId });
}
