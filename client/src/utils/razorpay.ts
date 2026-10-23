/** Razorpay Standard Checkout — https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/ */

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailure = {
  error?: { description?: string; reason?: string; metadata?: { payment_id?: string } };
};

export type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  config?: Record<string, unknown>;
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: 'payment.failed', cb: (response: RazorpayFailure) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Razorpay hides UPI QR on phones by default; this block puts QR first (pay from another phone),
 * keeps UPI apps / UPI ID, and still shows cards, netbanking and wallets below.
 */
export const RAZORPAY_UPI_QR_CONFIG = {
  display: {
    blocks: {
      upi: {
        name: 'Pay via UPI',
        instruments: [{ method: 'upi', flows: ['qrcode', 'intent', 'collect'] }],
      },
    },
    sequence: ['block.upi'],
    preferences: { show_default_blocks: true },
  },
};

let loader: Promise<void> | null = null;

/** Load checkout.js once, only when the buyer picks online payment. */
export function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!loader) {
    loader = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loader = null;
        script.remove();
        reject(new Error('Could not load Razorpay. Check your internet connection and try again.'));
      };
      document.body.appendChild(script);
    });
  }
  return loader;
}

/**
 * Open the Razorpay modal. Resolves with the payment ids + signature on success,
 * resolves null if the buyer closes the modal, rejects if the payment fails.
 */
export async function openRazorpayCheckout(
  options: Omit<RazorpayOptions, 'handler' | 'modal'>,
): Promise<RazorpaySuccess | null> {
  await loadRazorpayCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay is unavailable. Please try again.');

  return new Promise((resolve, reject) => {
    let failure: Error | null = null;
    const rzp = new Razorpay({
      config: RAZORPAY_UPI_QR_CONFIG,
      ...options,
      handler: (response) => resolve(response),
      modal: {
        // Razorpay keeps the modal open after a failed attempt so the buyer can retry;
        // report the last failure only once they give up and close it.
        ondismiss: () => (failure ? reject(failure) : resolve(null)),
      },
    });
    rzp.on('payment.failed', (response) => {
      const reason = response.error?.description || 'Payment failed';
      const paymentId = response.error?.metadata?.payment_id;
      failure = new Error(paymentId ? `${reason} (payment ID ${paymentId})` : reason);
    });
    rzp.open();
  });
}
