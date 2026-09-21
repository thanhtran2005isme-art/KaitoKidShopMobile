import { adminApiClient } from '../apiClient';

export interface AttributeDTO {
  id: number;
  tenThuocTinh: string;
  giaTri: string;
  nhomThuocTinh?: string;
  thuTu: number;
  ngayTao: string;
}

export interface CreateAttributeDTO {
  tenThuocTinh: string;
  giaTri: string;
  nhomThuocTinh?: string;
  thuTu: number;
}

export interface UpdateAttributeDTO {
  tenThuocTinh: string;
  giaTri: string;
  nhomThuocTinh?: string;
  thuTu: number;
}

export const attributeApi = {
  /**
   * Lấy tất cả thuộc tính (Admin)
   * @param group - Lọc theo nhóm thuộc tính (size, color, material...)
   */
  async getAll(group?: string): Promise<AttributeDTO[]> {
    const params = group ? { group } : {};
    const response = await adminApiClient.get<AttributeDTO[]>('/api/admin/attributes', { params });
    return response.data;
  },

  /**
   * Lấy thuộc tính public (không cần auth) - dùng cho bộ lọc trang sản phẩm customer
   */
  async getPublic(group?: string): Promise<AttributeDTO[]> {
    const params = group ? { group } : {};
    const response = await adminApiClient.get<AttributeDTO[]>('/api/attributes', { params });
    return response.data;
  },

  /**
   * Tạo thuộc tính mới (Admin)
   */
  async create(data: CreateAttributeDTO): Promise<AttributeDTO> {
    const response = await adminApiClient.post<AttributeDTO>('/api/admin/attributes', data);
    return response.data;
  },

  /**
   * Cập nhật thuộc tính (Admin)
   */
  async update(id: number, data: UpdateAttributeDTO): Promise<AttributeDTO> {
    const response = await adminApiClient.put<AttributeDTO>(`/api/admin/attributes/${id}`, data);
    return response.data;
  },

  /**
   * Xóa thuộc tính (Admin)
   */
  async delete(id: number): Promise<void> {
    await adminApiClient.delete(`/api/admin/attributes/${id}`);
  },
};
