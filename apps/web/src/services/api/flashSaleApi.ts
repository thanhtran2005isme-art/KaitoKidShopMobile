import { adminApiClient, getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface FlashSaleItemDTO {
  id?: number;
  flashSaleId?: number;
  sanPhamId: number;
  giaFlashSale: number;
  soLuongGioiHan: number;
  daBan: number;
}

export interface FlashSaleDTO {
  id: number;
  tenFlashSale: string;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: boolean;
  ngayTao: string;
  chiTiet: FlashSaleItemDTO[];
}

export interface CreateFlashSaleDTO {
  tenFlashSale: string;
  ngayBatDau: string;
  ngayKetThuc: string;
  trangThai: boolean;
  chiTiet: FlashSaleItemDTO[];
}

// Public DTO cho trang chủ
export interface PublicFlashSaleItem {
  id: number;
  productId: number;
  name: string;
  image: string;
  originalPrice: number;
  flashPrice: number;
  stockLimit: number;
  sold: number;
  category: string;
  gender: string;
}

export interface PublicFlashSale {
  active: boolean;
  id?: number;
  name?: string;
  startDate?: string;
  endDate?: string;
  items?: PublicFlashSaleItem[];
}

export const flashSaleApi = {
  /**
   * Lấy chương trình flash sale đang chạy (public)
   * Nếu không có chương trình → { active: false }
   */
  async getActive(): Promise<ApiResponse<PublicFlashSale>> {
    try {
      const response = await adminApiClient.get<PublicFlashSale>('/api/flash-sales/active');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getAll(): Promise<ApiResponse<FlashSaleDTO[]>> {
    try {
      const response = await adminApiClient.get<FlashSaleDTO[]>('/api/admin/flash-sales');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getById(id: number): Promise<ApiResponse<FlashSaleDTO>> {
    try {
      const response = await adminApiClient.get<FlashSaleDTO>(`/api/admin/flash-sales/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async create(data: CreateFlashSaleDTO): Promise<ApiResponse<FlashSaleDTO>> {
    try {
      const response = await adminApiClient.post<FlashSaleDTO>('/api/admin/flash-sales', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async update(id: number, data: CreateFlashSaleDTO): Promise<ApiResponse<FlashSaleDTO>> {
    try {
      const response = await adminApiClient.put<FlashSaleDTO>(`/api/admin/flash-sales/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await adminApiClient.delete(`/api/admin/flash-sales/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
