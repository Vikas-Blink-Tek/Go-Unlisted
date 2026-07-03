import type { FocusEvent } from 'react';

/** Stops Chrome/Safari from pre-filling saved login credentials into non-login forms. */
export const blockAutofillOnFocus = {
  readOnly: true,
  onFocus: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.readOnly = false;
  },
} as const;

export function blockTextInput(extra?: Record<string, unknown>) {
  return { autoComplete: 'off', ...blockAutofillOnFocus, ...extra };
}

export function blockEmailInput(extra?: Record<string, unknown>) {
  return { autoComplete: 'off', type: 'email' as const, ...blockAutofillOnFocus, ...extra };
}

export function blockNewPasswordInput(extra?: Record<string, unknown>) {
  return { autoComplete: 'new-password', type: 'password' as const, ...blockAutofillOnFocus, ...extra };
}

export function blockTelInput(extra?: Record<string, unknown>) {
  return { autoComplete: 'off', type: 'tel' as const, ...blockAutofillOnFocus, ...extra };
}
