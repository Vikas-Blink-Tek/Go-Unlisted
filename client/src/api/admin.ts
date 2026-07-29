import { apiRequest } from './client';
import { ensureCsrfToken } from './csrf';
import { displayUserCode } from '../utils/userCode';
import type { User } from '../types';

export function getUsers() {
  return apiRequest<Record<string, unknown>[]>('getUsers', 'GET');
}

export function saveUser(user: Record<string, unknown>) {
  return apiRequest<{ success: boolean; id?: string }>('saveUser', 'POST', user);
}

export function deleteUser(email: string) {
  return apiRequest<{ success: boolean }>('deleteUser', 'POST', { email });
}

export function getEmployees() {
  return apiRequest<Record<string, unknown>[]>('getEmployees', 'GET');
}

export function saveEmployee(employee: Record<string, unknown>) {
  return apiRequest<{ success: boolean; id?: string }>('saveEmployee', 'POST', employee);
}

export function deleteEmployee(id: string) {
  return apiRequest<{ success: boolean }>('deleteEmployee', 'POST', { id });
}

export function demoteEmployee(id: string) {
  return apiRequest<{ success: boolean; message?: string }>('demoteEmployee', 'POST', { id });
}

/** Master: move user to another employee; optionally reassign their orders / initiate rows. */
export function transferUser(
  userId: string,
  employeeCode: string,
  orderScope: 'none' | 'open' | 'all' = 'all',
) {
  return apiRequest<{
    success: boolean;
    userId: string;
    employeeCode: string;
    orderScope?: string;
    ordersUpdated?: number;
    initiatedUpdated?: number;
    message?: string;
  }>('transferUser', 'POST', { userId, employeeCode, orderScope });
}

/** Admin: upload / replace CMR demat proof for a client. */
export async function adminUploadKycDematProof(userId: string, file: File) {
  if (!file.type.match(/^(image\/(jpeg|png|webp)|application\/pdf)$/i) && !/\.(jpe?g|png|webp|pdf)$/i.test(file.name)) {
    throw new Error('Use JPG, PNG, WEBP, or PDF only');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large (max 5MB)');
  }
  const form = new FormData();
  form.append('proof', file);
  form.append('userId', userId);
  const token = await ensureCsrfToken();
  const res = await fetch('/api/api.php?action=adminUploadKycDematProof', {
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
  return data as { success: boolean; url: string; userId?: string; kycDematProofExists?: boolean };
}

export function mapApiUser(u: Record<string, unknown>): User {
  return {
    id: String(u.id),
    name: String(u.name),
    email: String(u.email),
    phone: String(u.phone),
    kycStatus: String(u.kyc_status || u.kycStatus || 'Not Submitted'),
    role: u.role ? String(u.role) : undefined,
    referralCode: displayUserCode(u.referral_code ? String(u.referral_code) : (u.referralCode as string | undefined)),
    kycPan: u.kyc_pan ? String(u.kyc_pan) : u.kycPan ? String(u.kycPan) : undefined,
    kycDemat: u.kyc_demat ? String(u.kyc_demat) : u.kycDemat ? String(u.kycDemat) : undefined,
    kycDematProof: u.kyc_demat_proof ? String(u.kyc_demat_proof) : u.kycDematProof ? String(u.kycDematProof) : undefined,
    kycDematProofExists: (() => {
      const raw = u.kyc_demat_proof_exists ?? u.kycDematProofExists;
      if (raw === undefined || raw === null || raw === '') return undefined;
      return raw === 1 || raw === '1' || raw === true;
    })(),
    bankAccount: u.bank_account ? String(u.bank_account) : u.bankAccount ? String(u.bankAccount) : undefined,
    bankName: u.bank_name ? String(u.bank_name) : u.bankName ? String(u.bankName) : undefined,
    ifsc: u.ifsc ? String(u.ifsc) : undefined,
    kycRejectReason: u.kyc_reject_reason ? String(u.kyc_reject_reason) : u.kycRejectReason ? String(u.kycRejectReason) : undefined,
    createdAt: u.created_at ? String(u.created_at) : undefined,
  };
}
