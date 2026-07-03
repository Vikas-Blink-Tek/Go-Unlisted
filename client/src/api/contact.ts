import { apiRequest } from './client';

export function submitContact(data: { name: string; email: string; message: string }) {
  return apiRequest<{ success: boolean; message?: string }>('submitContact', 'POST', data);
}
