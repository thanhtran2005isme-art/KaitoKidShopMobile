const API_URL = process.env.EXPO_PUBLIC_AUTH_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5053';

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
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'Có lỗi xảy ra');
  }

  return data;
}

export function login(data: LoginRequest) {
  return request('/api/Auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function register(data: RegisterRequest) {
  return request('/api/Auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
