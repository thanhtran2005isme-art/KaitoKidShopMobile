/**
 * Customer API Service
 */

import { adminApiClient, getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface CustomerDTO {
  // Backend returns PascalCase
  Id?: number;
  HoTen?: string;
  Email?: string;
  SoDienThoai?: string;
  TrangThai?: boolean;
  NgayTao?: string;
  NgayCapNhat?: string;
  OrderCount?: number;
  TotalSpent?: number;
  // Also support camelCase for compatibility
  id?: number;
  name?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  orderCount?: number;
  totalSpent?: number;
  createdAt?: string;
  updatedAt?: string;
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

export const customerApi = {
  /**
   * Lấy danh sách khách hàng (Admin)
   */
  async getCustomers(params: CustomerListParams = {}): Promise<ApiResponse<CustomerListResponse>> {
    try {
      const response = await adminApiClient.get<CustomerListResponse>('/api/admin/customers', { params });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Lấy chi tiết khách hàng (Admin)
   */
  async getCustomerById(id: number): Promise<ApiResponse<CustomerDTO>> {
    try {
      const response = await adminApiClient.get<CustomerDTO>(`/api/admin/customers/${id}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },

  /**
   * Toggle trạng thái active/inactive (Admin)
   */
  async toggleStatus(id: number): Promise<ApiResponse<CustomerDTO>> {
    try {
      const response = await adminApiClient.put<CustomerDTO>(`/api/admin/customers/${id}/toggle-status`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  },
};
