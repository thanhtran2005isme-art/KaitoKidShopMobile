import { adminApiClient } from '../apiClient';
import type { OrderDTO, UpdateOrderStatusDTO } from '../../types/api';

export interface OrderListParams {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface OrderListResponse {
  items: OrderDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type AdminReturnStatus =
  | 'none'
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'received_restock'
  | 'received_quarantine';
export type AdminRefundStatus = 'none' | 'pending' | 'completed';

export interface AdminAfterSalesHistoryItem {
  id: number;
  status: string;
  description?: string | null;
  actor?: string | null;
  at: string;
}

export interface AdminAfterSalesCase {
  orderId: number;
  orderCode: string;
  customerName: string;
  orderStatus: string;
  shippingStatus: string;
  paymentMethod: string;
  paidAt?: string | null;
  total: number;
  deliveryIssueOpen: boolean;
  returnStatus: AdminReturnStatus;
  returnReason?: string | null;
  decisionNote?: string | null;
  disposition?: 'restock' | 'quarantine' | null;
  refundStatus: AdminRefundStatus;
  refundReference?: string | null;
  latestEventAt?: string | null;
  requiresAttention: boolean;
  canApproveReturn: boolean;
  canRejectReturn: boolean;
  canReceiveReturn: boolean;
  canMarkRefundCompleted: boolean;
  history: AdminAfterSalesHistoryItem[];
}

export const orderApi = {
  async getOrders(params: OrderListParams = {}): Promise<OrderListResponse> {
    const response = await adminApiClient.get<OrderListResponse>('/api/admin/orders', { params });
    return response.data;
  },

  async getOrderById(id: string): Promise<OrderDTO> {
    const response = await adminApiClient.get<OrderDTO>(`/api/admin/orders/${id}`);
    return response.data;
  },

  async updateOrderStatus(id: string, data: UpdateOrderStatusDTO): Promise<OrderDTO> {
    const response = await adminApiClient.put<OrderDTO>(`/api/admin/orders/${id}/status`, data);
    return response.data;
  },

  async getAfterSalesCases(): Promise<AdminAfterSalesCase[]> {
    const response = await adminApiClient.get<AdminAfterSalesCase[]>('/api/admin/order-after-sales/cases');
    return response.data;
  },

  async getAfterSalesCase(id: number): Promise<AdminAfterSalesCase> {
    const response = await adminApiClient.get<AdminAfterSalesCase>(`/api/admin/order-after-sales/${id}`);
    return response.data;
  },

  async decideReturn(
    id: number,
    decision: 'approve' | 'reject',
    note?: string,
  ): Promise<AdminAfterSalesCase> {
    const response = await adminApiClient.post<AdminAfterSalesCase>(
      `/api/admin/order-after-sales/${id}/decision`,
      { decision, note },
    );
    return response.data;
  },

  async receiveReturn(
    id: number,
    disposition: 'restock' | 'quarantine',
    note: string,
  ): Promise<AdminAfterSalesCase> {
    const response = await adminApiClient.post<AdminAfterSalesCase>(
      `/api/admin/order-after-sales/${id}/receive`,
      { disposition, note },
    );
    return response.data;
  },

  async markRefundCompleted(id: number, reference: string): Promise<AdminAfterSalesCase> {
    const response = await adminApiClient.post<AdminAfterSalesCase>(
      `/api/admin/order-after-sales/${id}/refund-completed`,
      { reference },
    );
    return response.data;
  },
};
