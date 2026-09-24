import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const fallbackAuthApiUrl = Platform.select({
  android: 'http://10.0.2.2:5053',
  ios: 'http://localhost:5053',
  default: 'http://localhost:5053',
});

const explicitAuthApiUrl = process.env.EXPO_PUBLIC_AUTH_API_URL?.trim() || '';
const runtimeAuthApiUrl =
  typeof Constants.expoConfig?.extra?.authApiUrl === 'string'
    ? Constants.expoConfig.extra.authApiUrl.trim()
    : '';

const shouldPreferAndroidEmulatorFallback =
  Platform.OS === 'android' && !Device.isDevice && !explicitAuthApiUrl;

const API_URL = (
  explicitAuthApiUrl ||
  (shouldPreferAndroidEmulatorFallback
    ? fallbackAuthApiUrl
    : runtimeAuthApiUrl || fallbackAuthApiUrl) ||
  ''
).replace(/\/+$/, '');

if (__DEV__) {
  const source = explicitAuthApiUrl
    ? 'EXPO_PUBLIC_AUTH_API_URL'
    : shouldPreferAndroidEmulatorFallback
      ? 'Android emulator fallback'
      : runtimeAuthApiUrl
        ? 'Expo LAN auto-detect'
        : 'platform fallback';

  console.log(`[KaitoKid Auth API] ${API_URL} (${source})`);
}

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
};

async function request<T>(url: string, options: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const raw = await response.text();
    let data: any = null;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }

    if (!response.ok) {
      if (__DEV__) {
        console.error('[KaitoKid Auth Error]', {
          status: response.status,
          url: `${API_URL}${url}`,
          response: data,
        });
      }

      throw new Error(
        data?.message ||
          data?.title ||
          (typeof data === 'string' ? data : 'Có lỗi xảy ra'),
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Kết nối tới API.Auth ${API_URL} quá thời gian. Kiểm tra cổng 5053, ADB reverse hoặc kết nối LAN/Wi-Fi.`,
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        `Không thể kết nối tới API.Auth ${API_URL}. Nếu dùng điện thoại thật, hãy kiểm tra LAN/Wi-Fi hoặc USB ADB reverse cổng 5053.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function login(data: LoginRequest) {
  return request('/api/Auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: data.email,
      password: data.password,
    }),
  });
}

export function register(data: RegisterRequest) {
  return request('/api/Auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: data.fullName,
      email: data.email,
      phone: data.phoneNumber,
      password: data.password,
    }),
  });
}
