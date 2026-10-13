import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { ApiTransportError, fetchWithTransportRetry } from './network-retry';

const fallbackApiUrl = Platform.select({
  android: 'http://10.0.2.2:5300',
  ios: 'http://localhost:5300',
  default: 'http://localhost:5300',
});

const explicitApiUrl = (process.env.EXPO_PUBLIC_NODE_API_URL || process.env.EXPO_PUBLIC_API_URL)?.trim() || '';
const runtimeApiUrl = typeof Constants.expoConfig?.extra?.apiUrl === 'string'
  ? Constants.expoConfig.extra.apiUrl.trim()
  : '';
const shouldPreferAndroidEmulatorFallback = Platform.OS === 'android' && !Device.isDevice && !explicitApiUrl;

type UnauthorizedHandler = () => Promise<string | null>;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export const API_BASE_URL = (
  explicitApiUrl ||
  (shouldPreferAndroidEmulatorFallback ? fallbackApiUrl : runtimeApiUrl || fallbackApiUrl) ||
  ''
).replace(/\/+$/, '');

if (__DEV__) console.log(`[KaitoKid API] ${API_BASE_URL}`);

async function getErrorMessage(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return `API trả về HTTP ${response.status}`;
  try {
    const payload = JSON.parse(text) as { detail?: string; error?: string; message?: string; title?: string };
    return payload.message || payload.detail || payload.error || payload.title || text;
  } catch {
    return text;
  }
}

function safeRequestLabel(path: string) {
  const parts = path.split('?')[0].split('/').filter(Boolean);
  // Omit order IDs, search queries and other potentially private path parameters.
  return '/' + parts.slice(0, 2).join('/');
}

async function fetchWithTimeout(path: string, init: RequestInit | undefined, timeoutMs: number) {
  return fetchWithTransportRetry(
    `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`,
    path.startsWith('/') ? path : `/${path}`,
    init,
    timeoutMs,
  );
}

export async function apiRequest<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const started = Date.now();
  try {
    let response = await fetchWithTimeout(path, init, timeoutMs);
    const requestHeaders = new Headers(init?.headers);
    const authorization = requestHeaders.get('Authorization');

    if (response.status === 401 && authorization?.toLowerCase().startsWith('bearer ') && unauthorizedHandler) {
      const refreshedToken = await unauthorizedHandler();
      if (refreshedToken) {
        requestHeaders.set('Authorization', `Bearer ${refreshedToken}`);
        response = await fetchWithTimeout(path, { ...init, headers: requestHeaders }, timeoutMs);
      }
    }

    if (__DEV__ && Date.now() - started >= 4000) {
      console.warn(`[KaitoKid API Slow] ${(init?.method ?? 'GET').toUpperCase()} ${safeRequestLabel(path)} HTTP ${response.status} ${Date.now() - started}ms`);
    }

    if (!response.ok) {
      if (response.status === 401 && authorization) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      throw new Error(await getErrorMessage(response));
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiTransportError) {
      if (__DEV__) {
        console.warn(`[KaitoKid API Transport] ${error.kind} ${safeRequestLabel(path)} after ${error.attempts} attempt(s)`);
      }
      if (error.kind === 'timeout') {
        throw new Error(`Node API ${API_BASE_URL} không phản hồi trong ${Math.round(timeoutMs / 1000)} giây mỗi lần gọi. Kiểm tra kết nối LAN và log request chậm của NestJS.`);
      }
      if (error.kind === 'canceled') {
        throw new Error('Yêu cầu đã bị hủy. Vui lòng thử tải lại.');
      }
      throw new Error(`Không thể kết nối ổn định tới ${API_BASE_URL}. Kiểm tra Wi-Fi/LAN và Node API cổng 5300.`);
    }
    if (error instanceof TypeError) throw new Error(`Không thể xử lý phản hồi từ ${API_BASE_URL}. Kiểm tra trạng thái API trong Network.`);
    throw error;
  }
}

export function resolveMediaUrl(value?: string | null) {
  if (!value) return undefined;
  const url = value.trim();
  if (!url) return undefined;
  if (/^(https?:|data:|file:)/i.test(url)) return url;
  return `${API_BASE_URL}/${url.replace(/^\/+/, '')}`;
}
