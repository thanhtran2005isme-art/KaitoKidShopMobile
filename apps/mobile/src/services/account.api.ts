import { apiRequest } from '@/services/api-client';
import type {
  AccountProfile,
  AccountVoucher,
  BirthdayVoucherResult,
  PointsHistoryItem,
  RedeemResult,
  UpdateAccountInput,
} from '@/types/account';

function authHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: 'Bearer ' + token,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export const accountApi = {
  getProfile(token: string) {
    return apiRequest<AccountProfile>('/api/account', {
      headers: authHeaders(token),
    });
  },

  updateProfile(token: string, input: UpdateAccountInput) {
    return apiRequest<AccountProfile>('/api/account', {
      method: 'PUT',
      headers: authHeaders(token, true),
      body: JSON.stringify(input),
    });
  },

  uploadAvatar(token: string, formData: FormData) {
    return apiRequest<{ url: string }>(
      '/api/account/avatar',
      {
        method: 'POST',
        headers: authHeaders(token),
        body: formData,
      },
      45000,
    );
  },

  getPointsHistory(token: string, page = 1, pageSize = 20) {
    return apiRequest<PointsHistoryItem[]>(
      '/api/account/points-history?page=' + page + '&pageSize=' + pageSize,
      { headers: authHeaders(token) },
    );
  },

  redeemPoints(token: string, points: number) {
    return apiRequest<RedeemResult>('/api/account/redeem', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({ points }),
    });
  },

  getVouchers(token: string) {
    return apiRequest<AccountVoucher[]>('/api/account/vouchers', {
      headers: authHeaders(token),
    });
  },

  claimBirthdayVoucher(token: string) {
    return apiRequest<BirthdayVoucherResult>('/api/account/birthday-voucher', {
      method: 'POST',
      headers: authHeaders(token),
    });
  },

  deleteAccount(token: string, confirm: string) {
    return apiRequest<{ message: string }>('/api/account', {
      method: 'DELETE',
      headers: authHeaders(token, true),
      body: JSON.stringify({ confirm }),
    });
  },
};
