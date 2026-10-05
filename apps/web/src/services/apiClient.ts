/**
 * API Client - Node-only backend với JWT authentication.
 */

import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './tokenStorage';

const API_BASE_URL = (
  (import.meta.env.VITE_NODE_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  'http://localhost:5300'
).trim().replace(/\/+$/, '');

const STAFF_ACCESS_TOKEN_KEY = 'staff_access_token';
const STAFF_REFRESH_TOKEN_KEY = 'staff_refresh_token';

function isStaffRequest(url?: string): boolean {
  if (!url) return false;
  return url.includes('/api/admin') || url.includes('/api/auth/staff');
}

function expireStaffSession(url?: string): void {
  if (url?.includes('/api/auth/staff/login')) return;

  localStorage.removeItem(STAFF_ACCESS_TOKEN_KEY);
  localStorage.removeItem(STAFF_REFRESH_TOKEN_KEY);

  if (window.location.pathname !== '/admin/login') {
    window.location.replace('/admin/login?reason=session-expired');
  }
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const adminApiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

adminApiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(STAFF_ACCESS_TOKEN_KEY);
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

adminApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      expireStaffSession(error.config?.url);
    }
    return Promise.reject(error);
  },
);

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = isStaffRequest(config.url)
      ? localStorage.getItem(STAFF_ACCESS_TOKEN_KEY)
      : tokenStorage.getAccessToken();
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (isStaffRequest(originalRequest.url)) {
      if (error.response?.status === 401) {
        expireStaffSession(originalRequest.url);
      }
      return Promise.reject(error);
    }

    const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
    const isAuthRequest = originalRequest.url?.includes('/api/auth/login') ||
      originalRequest.url?.includes('/api/auth/register') ||
      originalRequest.url?.includes('/api/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then((token) => {
            if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = tokenStorage.getRefreshToken();

      if (!refreshToken) {
        tokenStorage.clearAll();
        if (!isAuthPage) window.location.href = '/login';
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        tokenStorage.setAccessToken(accessToken);
        if (newRefreshToken) tokenStorage.setRefreshToken(newRefreshToken);
        processQueue(null, accessToken);
        if (originalRequest.headers) originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        tokenStorage.clearAll();
        if (!isAuthPage) window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
export { adminApiClient };

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    return axiosError.response?.data?.message ||
      axiosError.response?.data?.error ||
      axiosError.message ||
      'Đã xảy ra lỗi';
  }
  if (error instanceof Error) return error.message;
  return 'Đã xảy ra lỗi';
};
