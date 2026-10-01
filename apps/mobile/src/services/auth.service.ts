import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const fallbackAuthApiUrl = Platform.select({
  android: 'http://10.0.2.2:5300',
  ios: 'http://localhost:5300',
  default: 'http://localhost:5300',
});

const explicitAuthApiUrl = (process.env.EXPO_PUBLIC_NODE_API_URL || process.env.EXPO_PUBLIC_API_URL)?.trim() || '';
const runtimeAuthApiUrl = typeof Constants.expoConfig?.extra?.authApiUrl === 'string'
  ? Constants.expoConfig.extra.authApiUrl.trim()
  : '';
const shouldPreferAndroidEmulatorFallback = Platform.OS === 'android' && !Device.isDevice && !explicitAuthApiUrl;
const API_URL = (
  explicitAuthApiUrl ||
  (shouldPreferAndroidEmulatorFallback ? fallbackAuthApiUrl : runtimeAuthApiUrl || fallbackAuthApiUrl) ||
  ''
).replace(/\/+$/, '');

if (__DEV__) console.log(`[KaitoKid Auth API] ${API_URL}`);

export type LoginRequest = { email: string; password: string };
export type RegisterRequest = { fullName: string; email: string; phoneNumber: string; password: string };
export type RegistrationPendingResponse = { message: string; email: string; expiresAt: string; requiresEmailVerification: boolean };
export type AuthTokenResponse = { accessToken: string; refreshToken?: string; expiresAt?: string; user?: unknown; token?: string };
export type GoogleLoginCredential = { idToken?: string; accessToken?: string };

async function request<T>(url: string, options: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
    });
    const raw = await response.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!response.ok) {
      if (__DEV__) console.error('[KaitoKid Auth Error]', { status: response.status, url: `${API_URL}${url}`, response: data });
      throw new Error(data?.message || data?.title || (typeof data === 'string' ? data : 'Có lỗi xảy ra'));
    }
    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error(`Kết nối tới Node API ${API_URL} quá thời gian. Kiểm tra cổng 5300.`);
    if (error instanceof TypeError) {
      throw new Error(Platform.OS === 'web'
        ? `Không thể gọi Node API ${API_URL}. Kiểm tra API đang chạy và CORS cho Expo Web.`
        : `Không thể kết nối tới Node API ${API_URL}. Kiểm tra LAN/Wi-Fi hoặc USB ADB reverse cổng 5300.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function login(data: LoginRequest) {
  return request<AuthTokenResponse>('/api/Auth/login', { method: 'POST', body: JSON.stringify({ identifier: data.email, password: data.password }) });
}
export function refreshAccessToken(refreshToken: string) {
  return request<AuthTokenResponse>('/api/Auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
}
export function register(data: RegisterRequest) {
  return request<RegistrationPendingResponse>('/api/Auth/register', { method: 'POST', body: JSON.stringify({ name: data.fullName, email: data.email, phone: data.phoneNumber, password: data.password }) });
}
export function loginWithGoogle(credential: GoogleLoginCredential) {
  return request<AuthTokenResponse>('/api/Auth/google', { method: 'POST', body: JSON.stringify(credential) });
}
export function requestPasswordReset(email: string) {
  return request<{ message?: string }>('/api/Auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
}
