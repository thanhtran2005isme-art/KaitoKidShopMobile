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

  getPaymentInstructions(token: string, orderCode: string) {
    return apiRequest<PaymentInstructions>(
      '/api/payment/instructions/' + encodeURIComponent(orderCode),
      { headers: authHeaders(token) },
    );
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
