// API auth riêng cho nhân viên (admin + staff)
import axios from 'axios';
import type { ApiResponse } from '../../types/api';

// Auth API client - riêng cho authentication
const AUTH_BASE_URL = import.meta.env.VITE_API_AUTH_URL || 'http://localhost:5053';

const authClient = axios.create({
  baseURL: AUTH_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
authClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('staff_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface StaffProfile {
  id: number;
  email: string;
  hoTen: string;
  anhDaiDien?: string | null;
  soDienThoai?: string | null;
  maVaiTro: string;
  tenVaiTro: string;
  laSuperAdmin: boolean;
  permissions: string[];
}

export interface StaffLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: StaffProfile;
}

const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Đã xảy ra lỗi'
    );
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Đã xảy ra lỗi';
};

export const staffAuthApi = {
  async login(email: string, password: string): Promise<ApiResponse<StaffLoginResponse>> {
    try {
      const res = await authClient.post<StaffLoginResponse>('/api/auth/staff/login', { email, password });
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },

  async getMe(): Promise<ApiResponse<StaffProfile>> {
    try {
      const res = await authClient.get<StaffProfile>('/api/auth/staff/me');
      return { success: true, data: res.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
};
