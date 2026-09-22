import { apiRequest } from '@/services/api-client';
import type {
  CustomerOrder,
  ReorderResult,
  ShippingTracking,
} from '@/types/orders';

function authHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: 'Bearer ' + token,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export const ordersApi = {
  getOrders(token: string) {
    return apiRequest<CustomerOrder[]>('/api/orders', {
      headers: authHeaders(token),
    });
  },

  getOrder(token: string, orderId: number) {
    return apiRequest<CustomerOrder>('/api/orders/' + orderId, {
      headers: authHeaders(token),
    });
  },

  cancelOrder(token: string, orderId: number) {
    return apiRequest<{ message: string }>('/api/orders/' + orderId + '/cancel', {
      method: 'PUT',
      headers: authHeaders(token),
    });
  },

  reorder(token: string, orderId: number) {
    return apiRequest<ReorderResult>('/api/cart/reorder/' + orderId, {
      method: 'POST',
      headers: authHeaders(token),
    });
  },

  getTracking(token: string, orderCode: string) {
    return apiRequest<ShippingTracking>(
      '/api/shipping/track/' + encodeURIComponent(orderCode),
      { headers: authHeaders(token) },
    );
  },
};
