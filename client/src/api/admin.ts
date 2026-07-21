import { apiRequest } from './client';
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
    bankAccount: u.bank_account ? String(u.bank_account) : u.bankAccount ? String(u.bankAccount) : undefined,
    bankName: u.bank_name ? String(u.bank_name) : u.bankName ? String(u.bankName) : undefined,
    ifsc: u.ifsc ? String(u.ifsc) : undefined,
    kycRejectReason: u.kyc_reject_reason ? String(u.kyc_reject_reason) : u.kycRejectReason ? String(u.kycRejectReason) : undefined,
    createdAt: u.created_at ? String(u.created_at) : undefined,
  };
}
