import { apiRequest } from '@/services/api-client';
import type {
  CheckoutAddress,
  CheckoutAddressInput,
  CouponResult,
  CreateOrderInput,
  CreatedOrder,
  PaymentConfig,
  PaymentInstructions,
  PaymentStatus,
  ShippingProvider,
  ShippingQuoteResponse,
} from '@/types/checkout';
import type { ComboDiscountResult } from '@/types/shopping';

function authHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: 'Bearer ' + token,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

const PAYOS_RETRY_DELAYS_MS = [5_000, 10_000, 20_000] as const;

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

function isRetryablePayOsThrottle(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /\b429\b|\b503\b|giới hạn tần suất|too many requests/i.test(message);
}

export const checkoutApi = {
  getAddresses(token: string) {
    return apiRequest<CheckoutAddress[]>('/api/addresses', {
      headers: authHeaders(token),
    });
  },

  createAddress(token: string, input: CheckoutAddressInput) {
    return apiRequest<CheckoutAddress>('/api/addresses', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(input),
    });
  },

  updateAddress(token: string, id: number, input: CheckoutAddressInput) {
    return apiRequest<CheckoutAddress>('/api/addresses/' + id, {
      method: 'PUT',
      headers: authHeaders(token, true),
      body: JSON.stringify(input),
    });
  },

  deleteAddress(token: string, id: number) {
    return apiRequest<void>('/api/addresses/' + id, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  setDefaultAddress(token: string, id: number) {
    return apiRequest<{ message: string }>('/api/addresses/' + id + '/default', {
      method: 'PUT',
      headers: authHeaders(token),
    });
  },

  getShippingProviders() {
    return apiRequest<ShippingProvider[]>('/api/shipping/providers');
  },

  quoteShipping(input: {
    provider?: string;
    toProvince: string;
    toDistrict: string;
    toWard?: string;
    toAddress?: string;
    weightGram: number;
    orderValue: number;
  }) {
    return apiRequest<ShippingQuoteResponse>('/api/shipping/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  },

  validateCoupon(token: string, code: string, orderAmount: number) {
    return apiRequest<CouponResult>('/api/coupons/validate', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({ code, orderAmount }),
    });
  },

  getSelectedCombo(token: string, itemIds: number[]) {
    return apiRequest<ComboDiscountResult>('/api/cart/combo-discount/selected', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({ itemIds }),
    });
  },

  createOrder(token: string, input: CreateOrderInput) {
    return apiRequest<CreatedOrder>('/api/orders', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(input),
    });
  },

  getPaymentConfig() {
    return apiRequest<PaymentConfig>('/api/payment/config');
  },

  async getPaymentInstructions(token: string, orderCode: string) {
    let lastError: unknown = new Error('Không thể tải thông tin thanh toán.');
    for (let attempt = 0; attempt <= PAYOS_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await apiRequest<PaymentInstructions>(
          '/api/payment/instructions/' + encodeURIComponent(orderCode),
          { headers: authHeaders(token) },
        );
      } catch (error) {
        lastError = error;
        const delay = PAYOS_RETRY_DELAYS_MS[attempt];
        if (delay === undefined || !isRetryablePayOsThrottle(error)) throw error;
        await sleep(delay);
      }
    }
    throw lastError;
  },

  getPaymentStatus(token: string, orderCode: string) {
    return apiRequest<PaymentStatus>(
      '/api/payment/status/' + encodeURIComponent(orderCode),
      { headers: authHeaders(token) },
    );
  },

  cancelPayment(token: string, orderCode: string) {
    return apiRequest<{ message: string; orderCode: string }>(
      '/api/payment/cancel/' + encodeURIComponent(orderCode),
      { method: 'POST', headers: authHeaders(token) },
    );
  },

  simulatePaid(token: string, orderCode: string) {
    return apiRequest<{ message: string }>(
      '/api/payment/simulate-paid/' + encodeURIComponent(orderCode),
      { method: 'POST', headers: authHeaders(token) },
    );
  },
};