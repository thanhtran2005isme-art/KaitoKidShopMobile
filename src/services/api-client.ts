import { Platform } from 'react-native';

const fallbackApiUrl = Platform.select({
  android: 'http://10.0.2.2:5265',
  ios: 'http://localhost:5265',
  default: 'http://localhost:5265',
});

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || fallbackApiUrl || '').replace(/\/+$/, '');

async function getErrorMessage(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return `API trả về HTTP ${response.status}`;

  try {
    const payload = JSON.parse(text) as {
      detail?: string;
      error?: string;
      message?: string;
      title?: string;
    };

    return payload.message || payload.detail || payload.error || payload.title || text;
  } catch {
    return text;
  }
}

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
      throw new Error(await getErrorMessage(response));
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Kết nối API quá thời gian (${API_BASE_URL}). Hãy kiểm tra backend và địa chỉ EXPO_PUBLIC_API_URL.`);
    }

    if (error instanceof TypeError) {
      throw new Error(`Không thể kết nối tới ${API_BASE_URL}. Nếu dùng điện thoại thật, hãy đặt EXPO_PUBLIC_API_URL bằng IP LAN của máy chạy backend.`);
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
