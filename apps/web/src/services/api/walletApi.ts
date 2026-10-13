import apiClient, { adminApiClient, getErrorMessage } from '../apiClient';
import type { ApiResponse } from '../../types/api';

export interface WalletSummaryDTO {
  availableBalance: number;
  heldBalance: number;
  totalBalance: number;
  pendingWithdrawalAmount: number;
  pendingWithdrawalCount: number;
  updatedAt: string;
}

export interface WalletTransactionDTO {
  id: number;
  type: string;
  direction: 'credit' | 'debit' | string;
  amount: number;
  availableAfter: number;
  heldAfter: number;
  referenceType: string;
  referenceId: string;
  description?: string | null;
  createdAt: string;
}

export interface WithdrawalDTO {
  id: number;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected' | string;
  customerNote?: string | null;
  adminNote?: string | null;
  bankReference?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  customerName?: string;
  customerEmail?: string;
}

export interface CreateWithdrawalPayload {
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  note?: string;
}

export const walletApi = {
  async getSummary(): Promise<ApiResponse<WalletSummaryDTO>> {
    try {
      const res = await apiClient.get<WalletSummaryDTO>('/api/wallet');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getTransactions(page = 1, pageSize = 50): Promise<ApiResponse<WalletTransactionDTO[]>> {
    try {
      const res = await apiClient.get<WalletTransactionDTO[]>('/api/wallet/transactions', {
        params: { page, pageSize },
      });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async getWithdrawals(): Promise<ApiResponse<WithdrawalDTO[]>> {
    try {
      const res = await apiClient.get<WithdrawalDTO[]>('/api/wallet/withdrawals');
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async createWithdrawal(payload: CreateWithdrawalPayload): Promise<ApiResponse<WithdrawalDTO>> {
    try {
      const res = await apiClient.post<WithdrawalDTO>('/api/wallet/withdrawals', payload);
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};

export const adminWalletApi = {
  async getWithdrawals(status?: string): Promise<ApiResponse<WithdrawalDTO[]>> {
    try {
      const res = await adminApiClient.get<WithdrawalDTO[]>('/api/admin/wallet/withdrawals', {
        params: status ? { status } : undefined,
      });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async approve(id: number, note?: string): Promise<ApiResponse<WithdrawalDTO>> {
    try {
      const res = await adminApiClient.post<WithdrawalDTO>(`/api/admin/wallet/withdrawals/${id}/approve`, { note });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async reject(id: number, reason: string): Promise<ApiResponse<WithdrawalDTO>> {
    try {
      const res = await adminApiClient.post<WithdrawalDTO>(`/api/admin/wallet/withdrawals/${id}/reject`, { reason });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },

  async complete(id: number, reference: string, note?: string): Promise<ApiResponse<WithdrawalDTO>> {
    try {
      const res = await adminApiClient.post<WithdrawalDTO>(`/api/admin/wallet/withdrawals/${id}/complete`, {
        reference,
        note,
      });
      return { success: true, data: res.data };
    } catch (e) { return { success: false, error: getErrorMessage(e) }; }
  },
};
