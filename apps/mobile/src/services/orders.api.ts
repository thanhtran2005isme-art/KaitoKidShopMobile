import { apiRequest } from '@/services/api-client';
import type {
  CustomerOrder,
  OrderAfterSalesResult,
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

  confirmReceived(token: string, orderId: number) {
    return apiRequest<OrderAfterSalesResult>(
      '/api/orders/' + orderId + '/confirm-received',
      {
        method: 'POST',
        headers: authHeaders(token),
      },
    );
  },

  reportNotReceived(token: string, orderId: number) {
    return apiRequest<OrderAfterSalesResult>(
      '/api/orders/' + orderId + '/report-not-received',
      {
        method: 'POST',
        headers: authHeaders(token),
      },
    );
  },

  requestReturn(token: string, orderId: number, reason: string) {
    return apiRequest<OrderAfterSalesResult>(
      '/api/orders/' + orderId + '/return-request',
      {
        method: 'POST',
        headers: authHeaders(token, true),
        body: JSON.stringify({ reason }),
      },
    );
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
