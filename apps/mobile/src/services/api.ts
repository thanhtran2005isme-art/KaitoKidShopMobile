import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5265';
const TOKEN_KEY = 'kaitokid_access_token';

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'API request thất bại');
  }

  return data;
}
