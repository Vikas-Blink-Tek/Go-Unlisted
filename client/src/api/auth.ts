import { apiRequest } from './client';
import { fetchCsrfToken } from './csrf';
import type { User } from '../types';

export function loginUser(email: string, password: string) {
  return apiRequest<{ success: boolean; user?: User; error?: string }>('loginUser', 'POST', {
    email,
    password,
  });
}

export function loginAdmin(email: string, password: string, portal: 'master' | 'staff' = 'master') {
  return apiRequest<{
    success: boolean;
    id?: string;
    isMaster?: boolean;
    portal?: 'master' | 'staff';
    permissions?: string[];
    error?: string;
  }>('loginAdmin', 'POST', { email, password, portal });
}

export function logout() {
  return apiRequest<{ success: boolean }>('logout', 'POST');
}

export function checkAuth() {
  return apiRequest<{
    authenticated: boolean;
    type?: 'admin' | 'user';
    id?: string;
    isMaster?: boolean;
    portal?: 'master' | 'staff';
    permissions?: string[];
    user?: User;
    csrfToken?: string;
  }>('checkAuth', 'GET');
}

export function sendOtp(email: string) {
  return apiRequest<{
    success: boolean;
    message?: string;
    dev_mode?: boolean;
    dev_otp?: string;
    email_sent?: boolean;
    error?: string;
  }>('sendOtp', 'POST', { email });
}

export function verifyOtp(email: string, otp: string) {
  return apiRequest<{ success: boolean; message?: string; error?: string }>('verifyOtp', 'POST', {
    email,
    otp,
  });
}

export function saveUser(user: Record<string, unknown>) {
  return apiRequest<{ success: boolean; id?: string }>('saveUser', 'POST', user);
}

export function sendResetOtp(loginId: string) {
  return apiRequest<{
    success: boolean;
    email?: string;
    message?: string;
    dev_mode?: boolean;
    dev_otp?: string;
    email_sent?: boolean;
    error?: string;
  }>(
    'sendResetOtp',
    'POST',
    { loginId },
  );
}

export function resetMpin(email: string, mpin: string) {
  return apiRequest<{ success: boolean; message?: string; error?: string }>('resetMpin', 'POST', {
    email,
    mpin,
  });
}

export function updateKyc(payload: {
  pan: string;
  demat: string;
  bankAccount: string;
  bankName: string;
  ifsc: string;
  kycDematProof: string;
}) {
  return apiRequest<{ success: boolean; kycStatus?: string }>('updateKyc', 'POST', payload);
}

export async function uploadKycDematProof(file: File) {
  if (!file.type.match(/^(image\/(jpeg|png|webp)|application\/pdf)$/i) && !/\.(jpe?g|png|webp|pdf)$/i.test(file.name)) {
    throw new Error('Use JPG, PNG, WEBP, or PDF only');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large (max 5MB)');
  }
  const form = new FormData();
  form.append('proof', file);
  const token = await fetchCsrfToken();
  const res = await fetch('/api/api.php?action=uploadKycDematProof', {
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
    throw new Error(data.error || 'Proof upload failed');
  }
  return data as { success: boolean; url: string };
}

export interface AccountContacts {
  support: { phone: string; email: string; whatsapp: string };
  relationManager?: { name: string; email: string; phone: string; employeeId: string } | null;
  referralCode?: string;
}

export function getAccountContacts() {
  return apiRequest<{ success: boolean } & AccountContacts>('getAccountContacts', 'GET');
}

export function deleteMyAccount(confirm = 'delete') {
  return apiRequest<{ success: boolean; message?: string; error?: string }>('deleteMyAccount', 'POST', {
    confirm,
  });
}

export function sendStaffResetOtp(loginId: string) {
  return apiRequest<{
    success: boolean;
    email?: string;
    message?: string;
    dev_mode?: boolean;
    dev_otp?: string;
    email_sent?: boolean;
    error?: string;
  }>('sendStaffResetOtp', 'POST', { loginId });
}

export function resetStaffPassword(email: string, password: string) {
  return apiRequest<{ success: boolean; message?: string; error?: string }>('resetStaffPassword', 'POST', {
    email,
    password,
  });
}
