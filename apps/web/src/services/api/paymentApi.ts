import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface PaymentStatus {
  orderCode: string;
  status: string;          // pending | confirmed | shipping | completed | cancelled
  paidAt?: string | null;
  paymentMethod: string;
  paymentExpiresAt?: string | null;
  secondsLeft: number;
  total: number;
}

export interface PaymentConfig {
  allowSimulatePaid: boolean;
  supportedMethods?: string[];
  bankTransferConfigured?: boolean;
  vietQrConfigured?: boolean;
}

export interface PaymentInstructionBankAccount {
  id: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch?: string | null;
  qrImage?: string | null;
}

export interface PaymentInstructions {
  orderCode: string;
  total: number;
  paymentExpiresAt?: string | null;
  secondsLeft: number;
  transferContent: string;
  bankAccount: PaymentInstructionBankAccount;
  qrUrl?: string | null;
}

export const paymentApi = {
  /** Cấu hình hiển thị payment do backend trả về (vd: có cho phép mô phỏng paid hay không) */
  async getConfig(): Promise<ApiResponse<PaymentConfig>> {
    try {
      const res = await apiClient.get<PaymentConfig>('/api/payment/config');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Thông tin chuyển khoản authoritative của chính đơn hàng đang thanh toán. */
  async getInstructions(orderCode: string): Promise<ApiResponse<PaymentInstructions>> {
    try {
      const res = await apiClient.get<PaymentInstructions>(
        `/api/payment/instructions/${encodeURIComponent(orderCode)}`,
      );
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Poll trạng thái thanh toán + còn bao nhiêu giây */
  async getStatus(orderCode: string): Promise<ApiResponse<PaymentStatus>> {
    try {
      const res = await apiClient.get<PaymentStatus>(`/api/payment/status/${encodeURIComponent(orderCode)}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Khách tự hủy giao dịch (chưa thanh toán) */
  async cancel(orderCode: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post(`/api/payment/cancel/${encodeURIComponent(orderCode)}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Dev demo — chính chủ đơn click để mô phỏng webhook ngân hàng */
  async simulatePaid(orderCode: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post(`/api/payment/simulate-paid/${encodeURIComponent(orderCode)}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** ADMIN ONLY — mô phỏng webhook ngân hàng đã nhận tiền (dùng demo) */
  async markPaid(orderCode: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post(`/api/payment/mark-paid/${encodeURIComponent(orderCode)}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
