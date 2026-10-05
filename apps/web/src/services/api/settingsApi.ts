import apiClient, { adminApiClient, getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface SettingDTO {
  id?: number;
  maCauHinh: string;
  giaTri: string;
  nhomCauHinh: string;
  moTa?: string;
  ngayCapNhat?: string;
}

export interface UpsertSettingDTO {
  maCauHinh: string;
  giaTri: string;
  nhomCauHinh?: string;
  moTa?: string;
}

export interface VietQrBankDTO {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported: boolean;
  lookupSupported: boolean;
}

export interface VietQrAccountLookupDTO {
  bank: VietQrBankDTO;
  accountNumber: string;
  accountName: string;
}

interface PublicPaymentConfig {
  allowSimulatePaid: boolean;
  supportedMethods?: string[];
  bankTransferConfigured?: boolean;
}

export const settingsApi = {
  /** Lấy tất cả settings. Payment public không được đọc endpoint Admin protected. */
  async getAll(group?: string): Promise<ApiResponse<SettingDTO[]>> {
    try {
      if (group === 'payment') {
        // Checkout cũ chỉ dùng call này để preload bankAccounts. Thông tin nhận tiền
        // authoritative được PaymentStep lấy qua /api/payment/instructions/:orderCode.
        // Chỉ đọc public config để tránh request trái quyền tới /api/admin/settings.
        await apiClient.get<PublicPaymentConfig>('/api/payment/config');
        return { success: true, data: [] };
      }

      const params = group ? { group } : {};
      const response = await adminApiClient.get<SettingDTO[]>('/api/admin/settings', { params });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Lấy 1 setting theo key */
  async getByKey(key: string): Promise<ApiResponse<SettingDTO>> {
    try {
      const response = await adminApiClient.get<SettingDTO>(`/api/admin/settings/${key}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Upsert nhiều settings */
  async upsert(settings: UpsertSettingDTO[]): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await adminApiClient.put<{ message: string }>('/api/admin/settings', settings);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Danh sách ngân hàng authoritative từ VietQR, proxy qua backend Admin. */
  async getPaymentBanks(): Promise<ApiResponse<VietQrBankDTO[]>> {
    try {
      const response = await adminApiClient.get<VietQrBankDTO[]>('/api/admin/payment/banks');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  /** Xác minh BIN + số tài khoản và lấy tên chủ tài khoản từ VietQR. */
  async lookupBankAccount(
    bankBin: string,
    accountNumber: string,
  ): Promise<ApiResponse<VietQrAccountLookupDTO>> {
    try {
      const response = await adminApiClient.post<VietQrAccountLookupDTO>(
        '/api/admin/payment/lookup-account',
        { bankBin, accountNumber },
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
