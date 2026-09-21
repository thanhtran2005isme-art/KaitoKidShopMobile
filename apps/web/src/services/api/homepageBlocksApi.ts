import { adminApiClient, getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export type HomepageBlockType = 'hero' | 'categoryTile' | 'brandValue' | 'socialImage';

export interface HomepageBlock {
  id: number;
  type: HomepageBlockType | string;
  title?: string;
  subtitle?: string;
  description?: string;
  image?: string;
  link?: string;
  icon?: string;
  sortOrder: number;
}

export interface HomepageBlocksByType {
  hero?: HomepageBlock[];
  categoryTile?: HomepageBlock[];
  brandValue?: HomepageBlock[];
  socialImage?: HomepageBlock[];
  [key: string]: HomepageBlock[] | undefined;
}

export const homepageBlocksApi = {
  /** Public: l?y 1 type c? th?, tr? m?ng. */
  async getByType(type: HomepageBlockType): Promise<ApiResponse<HomepageBlock[]>> {
    try {
      const res = await adminApiClient.get<HomepageBlock[]>('/api/homepage-blocks', { params: { type } });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Public: l?y t?t c? types m?t l?n, gom theo BlockType. */
  async getAll(): Promise<ApiResponse<HomepageBlocksByType>> {
    try {
      const res = await adminApiClient.get<HomepageBlocksByType>('/api/homepage-blocks');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};

// ====== Admin ======
export interface HomepageBlockAdminDTO {
  id?: number;
  blockType: HomepageBlockType | string;
  title?: string;
  subtitle?: string;
  description?: string;
  image?: string;
  link?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

export const adminHomepageBlocksApi = {
  async list(type?: string): Promise<ApiResponse<HomepageBlockAdminDTO[]>> {
    try {
      const res = await adminApiClient.get<HomepageBlockAdminDTO[]>('/api/admin/homepage-blocks', {
        params: type ? { type } : undefined,
      });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
  async create(payload: HomepageBlockAdminDTO): Promise<ApiResponse<HomepageBlockAdminDTO>> {
    try {
      const res = await adminApiClient.post<HomepageBlockAdminDTO>('/api/admin/homepage-blocks', payload);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
  async update(id: number, payload: HomepageBlockAdminDTO): Promise<ApiResponse<HomepageBlockAdminDTO>> {
    try {
      const res = await adminApiClient.put<HomepageBlockAdminDTO>(`/api/admin/homepage-blocks/${id}`, payload);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
  async remove(id: number): Promise<ApiResponse<void>> {
    try {
      await adminApiClient.delete(`/api/admin/homepage-blocks/${id}`);
      return { success: true };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
