import { apiRequest } from './client';
import { ensureCsrfToken } from './csrf';
import type { Article, SiteSettings } from '../types';

export function getSettings() {
  return apiRequest<SiteSettings>('getSettings', 'GET');
}

export function saveSettings(settings: SiteSettings) {
  return apiRequest<{ success: boolean }>('saveSettings', 'POST', settings);
}

export async function uploadQr(file: File) {
  const form = new FormData();
  form.append('qr_image', file);
  const token = await ensureCsrfToken();
  const res = await fetch('/api/api.php?action=uploadQr', {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: { 'X-CSRF-Token': token },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data as { success: boolean; message?: string };
}

export function getArticles() {
  return apiRequest<Article[]>('getArticles', 'GET');
}

export function getArticle(slug: string) {
  return apiRequest<Article>('getArticle', 'GET', undefined, { slug });
}

export function adminGetArticles() {
  return apiRequest<Article[]>('adminGetArticles', 'GET');
}

export function adminGetArticle(id: number) {
  return apiRequest<Article>('adminGetArticle', 'GET', undefined, { id: String(id) });
}

export function adminSaveArticle(article: Record<string, unknown>) {
  return apiRequest<{ success: boolean; id?: number }>('adminSaveArticle', 'POST', article);
}

export function adminDeleteArticle(id: number) {
  return apiRequest<{ success: boolean }>('adminDeleteArticle', 'POST', { id });
}

export function getMailStatus() {
  return apiRequest<{ smtp_configured: boolean; smtp_host?: string | null; mail_from: string }>(
    'getMailStatus',
    'GET',
  );
}

export function testSmtp(email: string) {
  return apiRequest<{ success: boolean; message?: string; error?: string }>('testSmtp', 'POST', { email });
}
