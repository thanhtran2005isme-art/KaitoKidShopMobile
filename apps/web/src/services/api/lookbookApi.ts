import { adminApiClient, getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface LookbookDTO {
  id: number;
  tieuDe: string;
  tieuDePhu?: string;
  moTa?: string;
  hinhAnh: string;
  lienKet?: string;
  trangThai: string; // 'active' | 'hidden'
  thuTu: number;
  ngayTao: string;
}

export interface LookbookHotspotDTO {
  id: number;
  productId: number;
  productName: string;
  productImage?: string;
  productPrice: number;
  productOldPrice?: number | null;
  x: number;
  y: number;
  note?: string;
  sortOrder: number;
}

// Public DTO (from LookbooksController)
export interface PublicLookbookDTO {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  image: string;
  link?: string;
  videoUrl?: string;
  season?: string;
  style?: string;
  sortOrder: number;
  hotspots: LookbookHotspotDTO[];
}

export interface CreateLookbookDTO {
  tieuDe: string;
  tieuDePhu?: string;
  moTa?: string;
  hinhAnh: string;
  lienKet?: string;
  trangThai: string;
  thuTu: number;
}

export const lookbookApi = {
  /**
   * Public: Get all active lookbooks
   * GET /api/lookbooks?season=&style=
   */
  async getPublic(opts: { season?: string; style?: string } = {}): Promise<ApiResponse<PublicLookbookDTO[]>> {
    try {
      const params = new URLSearchParams();
      if (opts.season) params.append('season', opts.season);
      if (opts.style) params.append('style', opts.style);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await adminApiClient.get<PublicLookbookDTO[]>(`/api/lookbooks${qs}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Public: l?y danh sách season/style d? FE render dropdown filter. */
  async getFilters(): Promise<ApiResponse<{ seasons: string[]; styles: string[] }>> {
    try {
      const response = await adminApiClient.get<{ seasons: string[]; styles: string[] }>('/api/lookbooks/filters');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getAll(): Promise<ApiResponse<LookbookDTO[]>> {
    try {
      const response = await adminApiClient.get<LookbookDTO[]>('/api/admin/lookbook');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async create(data: CreateLookbookDTO): Promise<ApiResponse<LookbookDTO>> {
    try {
      const response = await adminApiClient.post<LookbookDTO>('/api/admin/lookbook', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async update(id: number, data: CreateLookbookDTO): Promise<ApiResponse<LookbookDTO>> {
    try {
      const response = await adminApiClient.put<LookbookDTO>(`/api/admin/lookbook/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async delete(id: number): Promise<ApiResponse<void>> {
    try {
      await adminApiClient.delete(`/api/admin/lookbook/${id}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
