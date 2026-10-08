import apiClient, { getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface PaymentStatus {
  orderCode: string;
  status: string;          // pending | confirmed | shipping | completed | cancelled
  paidAt?: string | null;
  paymentMethod: string;
  paymentProvider?: 'payos' | string | null;
  paymentExpiresAt?: string | null;
  secondsLeft: number;
  total: number;
}

export interface PaymentConfig {
  allowSimulatePaid: boolean;
  supportedMethods?: string[];
  bankTransferConfigured?: boolean;
  vietQrConfigured?: boolean;
  payOsConfigured?: boolean;
  paymentProvider?: 'payos' | 'legacy_bank' | null;
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
  provider?: 'payos' | 'legacy_bank' | string;
  paymentLinkId?: string | null;
  paymentStatus?: string | null;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  qrMode?: 'payos_vietqr' | 'payos_checkout' | string;
  transferContent: string;
  bankAccount?: PaymentInstructionBankAccount | null;
  qrUrl?: string | null;
}

const PAYOS_RETRY_DELAYS_MS = [5_000, 10_000, 20_000] as const;

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delayMs));
}

function isRetryablePayOsThrottle(message: string) {
  return /\b429\b|\b503\b|giới hạn tần suất|too many requests/i.test(message);
}

export const paymentApi = {
  /** Cấu hình payment public do backend trả về; không bao giờ chứa payOS secret. */
  async getConfig(): Promise<ApiResponse<PaymentConfig>> {
    try {
      const res = await apiClient.get<PaymentConfig>('/api/payment/config');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /**
   * Payment instructions authoritative của chính đơn hàng đang thanh toán.
   * payOS có rate limit; 429/503 được retry hữu hạn với backoff thay vì spam F5.
   */
  async getInstructions(orderCode: string): Promise<ApiResponse<PaymentInstructions>> {
    let lastError = 'Không thể tải thông tin thanh toán.';
    for (let attempt = 0; attempt <= PAYOS_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const res = await apiClient.get<PaymentInstructions>(
          `/api/payment/instructions/${encodeURIComponent(orderCode)}`,
        );
        return { success: true, data: res.data };
      } catch (e) {
        lastError = getErrorMessage(e);
        const delay = PAYOS_RETRY_DELAYS_MS[attempt];
        if (delay === undefined || !isRetryablePayOsThrottle(lastError)) {
          return { success: false, error: lastError };
        }
        await sleep(delay);
      }
    }
    return { success: false, error: lastError };
  },

  /** Poll KaitoKid backend; backend có thể fallback-reconcile payOS nếu webhook chậm. */
  async getStatus(orderCode: string): Promise<ApiResponse<PaymentStatus>> {
    try {
      const res = await apiClient.get<PaymentStatus>(`/api/payment/status/${encodeURIComponent(orderCode)}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Khách tự hủy giao dịch; backend provider-first trước khi hoàn tồn/coupon. */
  async cancel(orderCode: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post(`/api/payment/cancel/${encodeURIComponent(orderCode)}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** Dev-only; production endpoint bị ẩn nếu backend không cho phép. */
  async simulatePaid(orderCode: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post(`/api/payment/simulate-paid/${encodeURIComponent(orderCode)}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  /** ADMIN ONLY — manual compatibility action, không thay thế webhook payOS. */
  async markPaid(orderCode: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const res = await apiClient.post(`/api/payment/mark-paid/${encodeURIComponent(orderCode)}`);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};