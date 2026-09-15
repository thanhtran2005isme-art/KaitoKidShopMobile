import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const fallbackApiUrl = Platform.select({
  android: 'http://10.0.2.2:5265',
  ios: 'http://localhost:5265',
  default: 'http://localhost:5265',
});

const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || '';
const runtimeApiUrl =
  typeof Constants.expoConfig?.extra?.apiUrl === 'string'
    ? Constants.expoConfig.extra.apiUrl.trim()
    : '';

const shouldPreferAndroidEmulatorFallback = Platform.OS === 'android' && !Device.isDevice && !explicitApiUrl;

export const API_BASE_URL = (
  explicitApiUrl ||
  (shouldPreferAndroidEmulatorFallback ? fallbackApiUrl : runtimeApiUrl || fallbackApiUrl) ||
  ''
).replace(/\/+$/, '');

if (__DEV__) {
  const source = explicitApiUrl
    ? 'EXPO_PUBLIC_API_URL'
    : shouldPreferAndroidEmulatorFallback
      ? 'Android emulator fallback'
      : runtimeApiUrl
        ? 'Expo LAN auto-detect'
        : 'platform fallback';

  console.log(`[KaitoKid API] ${API_BASE_URL} (${source})`);
}

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
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const wasCanceled =
      (error instanceof Error && error.name === 'AbortError') ||
      message.includes('canceled') ||
      message.includes('cancelled');

    if (wasCanceled) {
      throw new Error(
        `Kết nối tới ${API_BASE_URL} bị hủy hoặc quá thời gian. ` +
          'Hãy kiểm tra API.Customer đang chạy cổng 5265, Windows Firewall và điện thoại có thể truy cập IP LAN của máy tính.',
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        `Không thể kết nối tới ${API_BASE_URL}. ` +
          'Nếu dùng điện thoại thật, hãy đảm bảo máy tính và điện thoại cùng mạng LAN/Wi-Fi và cho phép TCP 5265 qua firewall.',
      );
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
