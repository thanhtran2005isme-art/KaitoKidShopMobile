import { Platform } from 'react-native';

const fallbackApiUrl = Platform.select({
  android: 'http://10.0.2.2:5265',
  ios: 'http://localhost:5265',
  default: 'http://localhost:5265',
});

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || fallbackApiUrl || '').replace(/\/+$/, '');

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || `API trả về HTTP ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Kết nối API quá thời gian. Hãy kiểm tra địa chỉ backend.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function resolveMediaUrl(value?: string | null) {
  if (!value) return undefined;
  const url = value.trim();
  if (!url) return undefined;
  if (/^(https?:|data:|file:)/i.test(url)) return url;
  return `${API_BASE_URL}/${url.replace(/^\/+/, '')}`;
}
