import { apiRequest } from '@/services/api-client';
import type {
  CreateWalletWithdrawalInput,
  WalletSummary,
  WalletTransaction,
  WalletWithdrawal,
} from '@/types/wallet';

function authHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: 'Bearer ' + token,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export const walletApi = {
  getSummary(token: string) {
    return apiRequest<WalletSummary>('/api/wallet', {
      headers: authHeaders(token),
    });
  },

  getTransactions(token: string, page = 1, pageSize = 50) {
    return apiRequest<WalletTransaction[]>(
      `/api/wallet/transactions?page=${page}&pageSize=${pageSize}`,
      { headers: authHeaders(token) },
    );
  },

  getWithdrawals(token: string) {
    return apiRequest<WalletWithdrawal[]>('/api/wallet/withdrawals', {
      headers: authHeaders(token),
    });
  },

  createWithdrawal(token: string, input: CreateWalletWithdrawalInput) {
    return apiRequest<WalletWithdrawal>('/api/wallet/withdrawals', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(input),
    });
  },
};
