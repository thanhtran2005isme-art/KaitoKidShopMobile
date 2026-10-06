/**
 * Customer API Service
 */

import { adminApiClient, getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export type CustomerOrderStatus = 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled' | 'returned';

export interface CustomerDTO {
  id: number;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  createdAt?: string;
  orderCount: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  firstOrderAt?: string;
  lastOrderAt?: string;
  lastOrderStatus?: CustomerOrderStatus;
  lastCompletedOrderAt?: string;
}

export interface CustomerListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerListResponse {
  items: CustomerDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CustomerOrderSummaryDTO {
  id: number;
  orderCode?: string;
  total: number;
  status: CustomerOrderStatus;
  createdAt: string;
  itemCount: number;
}

export interface CustomerPurchaseAnalyticsDTO {
  topCategories: string[];
  purchasedProducts: string[];
  orders: CustomerOrderSummaryDTO[];
}

interface RawCustomerDTO {
  id?: unknown;
  hoTen?: unknown;
  email?: unknown;
  soDienThoai?: unknown;
  trangThai?: unknown;
  ngayTao?: unknown;
  orderCount?: unknown;
  completedOrders?: unknown;
  cancelledOrders?: unknown;
  totalSpent?: unknown;
  averageOrderValue?: unknown;
  firstOrderAt?: unknown;
  lastOrderAt?: unknown;
  lastOrderStatus?: unknown;
  lastCompletedOrderAt?: unknown;
}

interface RawCustomerListResponse {
  items?: RawCustomerDTO[];
  total?: unknown;
  page?: unknown;
  pageSize?: unknown;
  totalPages?: unknown;
}

interface RawCustomerPurchaseAnalyticsDTO {
  topCategories?: unknown;
  purchasedProducts?: unknown;
  orders?: Array<{
    id?: unknown;
    orderCode?: unknown;
    total?: unknown;
    status?: unknown;
    createdAt?: unknown;
    itemCount?: unknown;
  }>;
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asOptionalText(value: unknown): string | undefined {
  const text = asText(value);
  return text || undefined;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return /^(true|1)$/i.test(value);
  return false;
}

function asOrderStatus(value: unknown): CustomerOrderStatus | undefined {
  const status = asText(value);
  return status === 'pending'
    || status === 'confirmed'
    || status === 'shipping'
    || status === 'completed'
    || status === 'cancelled'
    || status === 'returned'
    ? status
    : undefined;
}

function mapCustomer(customer: RawCustomerDTO): CustomerDTO {
  return {
    id: asNumber(customer.id),
    name: asText(customer.hoTen) || 'Khách hàng',
    email: asText(customer.email),
    phone: asText(customer.soDienThoai),
    isActive: asBoolean(customer.trangThai),
    createdAt: asOptionalText(customer.ngayTao),
    orderCount: asNumber(customer.orderCount),
    completedOrders: asNumber(customer.completedOrders),
    cancelledOrders: asNumber(customer.cancelledOrders),
    totalSpent: asNumber(customer.totalSpent),
    averageOrderValue: asNumber(customer.averageOrderValue),
    firstOrderAt: asOptionalText(customer.firstOrderAt),
    lastOrderAt: asOptionalText(customer.lastOrderAt),
    lastOrderStatus: asOrderStatus(customer.lastOrderStatus),
    lastCompletedOrderAt: asOptionalText(customer.lastCompletedOrderAt),
  };
}

function mapCustomerList(data: RawCustomerListResponse): CustomerListResponse {
  const page = Math.max(1, asNumber(data.page) || 1);
  const pageSize = Math.max(1, asNumber(data.pageSize) || 20);
  const total = Math.max(0, asNumber(data.total));
  return {
    items: (data.items || []).map(mapCustomer).filter((customer) => customer.id > 0),
    total,
    page,
    pageSize,
    totalPages: Math.max(0, asNumber(data.totalPages) || Math.ceil(total / pageSize)),
  };
}

function mapPurchaseAnalytics(data: RawCustomerPurchaseAnalyticsDTO): CustomerPurchaseAnalyticsDTO {
  return {
    topCategories: Array.isArray(data.topCategories)
      ? data.topCategories.map(asText).filter(Boolean)
      : [],
    purchasedProducts: Array.isArray(data.purchasedProducts)
      ? data.purchasedProducts.map(asText).filter(Boolean)
      : [],
    orders: (data.orders || []).map((order) => ({
      id: asNumber(order.id),
      orderCode: asOptionalText(order.orderCode),
      total: asNumber(order.total),
      status: asOrderStatus(order.status) || 'pending',
      createdAt: asText(order.createdAt),
      itemCount: asNumber(order.itemCount),
    })).filter((order) => order.id > 0),
  };
}

export const customerApi = {
  /**
   * Lấy danh sách khách hàng (Admin)
   */
  async getCustomers(params: CustomerListParams = {}): Promise<ApiResponse<CustomerListResponse>> {
    try {
      const response = await adminApiClient.get<RawCustomerListResponse>('/api/admin/customers', { params });
      return {
        success: true,
        data: mapCustomerList(response.data),
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  async getAllCustomers(params: Omit<CustomerListParams, 'page' | 'pageSize'> = {}): Promise<ApiResponse<CustomerDTO[]>> {
    const first = await this.getCustomers({ ...params, page: 1, pageSize: 200 });
    if (!first.success || !first.data) return { success: false, error: first.error };

    const customers = [...first.data.items];
    for (let page = 2; page <= first.data.totalPages; page += 1) {
      const response = await this.getCustomers({ ...params, page, pageSize: 200 });
      if (!response.success || !response.data) {
        return { success: false, error: response.error || 'Không thể tải đầy đủ danh sách khách hàng' };
      }
      customers.push(...response.data.items);
    }

    return { success: true, data: customers };
  },

  /**
   * Lấy chi tiết khách hàng (Admin)
   */
  async getCustomerById(id: number): Promise<ApiResponse<CustomerDTO>> {
    try {
      const response = await adminApiClient.get<RawCustomerDTO>(`/api/admin/customers/${id}`);
      return {
        success: true,
        data: mapCustomer(response.data),
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  async getPurchaseAnalytics(id: number): Promise<ApiResponse<CustomerPurchaseAnalyticsDTO>> {
    try {
      const response = await adminApiClient.get<RawCustomerPurchaseAnalyticsDTO>(`/api/admin/customers/${id}/analytics`);
      return { success: true, data: mapPurchaseAnalytics(response.data) };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /**
   * Toggle trạng thái active/inactive (Admin)
   */
  async toggleStatus(id: number): Promise<ApiResponse<{ id: number; isActive: boolean }>> {
    try {
      const response = await adminApiClient.put<{ id?: unknown; trangThai?: unknown }>(`/api/admin/customers/${id}/toggle-status`);
      return {
        success: true,
        data: { id: asNumber(response.data.id), isActive: asBoolean(response.data.trangThai) },
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },
};
