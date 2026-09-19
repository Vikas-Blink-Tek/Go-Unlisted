import { apiRequest } from './client';
import { ensureCsrfToken } from './csrf';
import type { FestivalOffer } from '../types';

export async function fetchActiveOffers(): Promise<FestivalOffer[]> {
  const res = await apiRequest<{ success: boolean; offers: FestivalOffer[] }>('getActiveOffers');
  return res.offers || [];
}

export async function fetchAdminOffers(): Promise<FestivalOffer[]> {
  const res = await apiRequest<{ success: boolean; offers: FestivalOffer[] }>('getAdminOffers');
  return res.offers || [];
}

export async function saveOffer(data: Partial<FestivalOffer>): Promise<{ success: boolean; id: string; message: string }> {
  return apiRequest('saveOffer', 'POST', data);
}

export async function deleteOffer(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest('deleteOffer', 'POST', { id });
}

export async function toggleOfferStatus(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest('toggleOfferStatus', 'POST', { id });
}

export async function uploadOfferBanner(file: File): Promise<string> {
  const token = await ensureCsrfToken();
  const formData = new FormData();
  formData.append('banner', file);

  try {
    const res = await fetch('/api/api.php?action=uploadOfferBanner', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': token,
      },
      body: formData,
    });

    const json = await res.json();
    if (res.ok && json.success && json.url) {
      return json.url;
    }
    // If live server returns "Invalid action", fall through to fallback
    if (json.error !== 'Invalid action') {
      throw new Error(json.error || 'Banner upload failed');
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message !== 'Invalid action') {
      // If network error or other, try fallback
    }
  }

  // Fallback: uploadShareLogo exists on live server
  const fallbackData = new FormData();
  fallbackData.append('logo', file);

  const fallbackRes = await fetch('/api/api.php?action=uploadShareLogo', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRF-Token': token,
    },
    body: fallbackData,
  });

  const fallbackJson = await fallbackRes.json();
  if (!fallbackRes.ok || !fallbackJson.success) {
    throw new Error(fallbackJson.error || 'Banner upload failed');
  }

  return fallbackJson.url;
}

