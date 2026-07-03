import { apiRequest } from './client';
import type { User } from '../types';

export function loginUser(email: string, password: string) {
  return apiRequest<{ success: boolean; user?: User; error?: string }>('loginUser', 'POST', {
    email,
    password,
  });
}

export function loginAdmin(email: string, password: string) {
  return apiRequest<{ success: boolean; id?: string; isMaster?: boolean; error?: string }>(
    'loginAdmin',
    'POST',
    { email, password },
  );
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
    user?: User;
    csrfToken?: string;
  }>('checkAuth', 'GET');
}

export function sendOtp(email: string, phone: string) {
  return apiRequest<{
    success: boolean;
    message?: string;
    sms_sent?: boolean;
    sms_error?: string;
    dev_mode?: boolean;
    error?: string;
  }>(
    'sendOtp',
    'POST',
    { email, phone },
  );
}

export function verifyOtp(phone: string, otp: string) {
  return apiRequest<{ success: boolean; message?: string; error?: string }>('verifyOtp', 'POST', {
    phone,
    otp,
  });
}

/** @deprecated Use verifyOtp(phone, otp) for registration; email only for password reset */
export function verifyOtpEmail(email: string, otp: string) {
  return apiRequest<{ success: boolean; message?: string; error?: string }>('verifyOtp', 'POST', {
    email,
    otp,
  });
}

export function saveUser(user: Record<string, unknown>) {
  return apiRequest<{ success: boolean; id?: string }>('saveUser', 'POST', user);
}

export function sendResetOtp(loginId: string) {
  return apiRequest<{ success: boolean; email?: string; message?: string; error?: string }>(
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

export function updateKyc(pan: string, demat: string, bankAccount?: string, ifsc?: string) {
  return apiRequest<{ success: boolean; kycStatus?: string }>('updateKyc', 'POST', {
    pan,
    demat,
    bankAccount,
    ifsc,
  });
}
