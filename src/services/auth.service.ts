const API_URL =
  process.env.EXPO_PUBLIC_AUTH_API_URL ||
  'http://127.0.0.1:5053';

console.log('[KaitoKid Auth API]', API_URL);

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

  const raw = await response.text();
  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    console.error('[KaitoKid Auth Error]', {
      status: response.status,
      url: `${API_URL}${url}`,
      response: data,
    });

    throw new Error(
      data?.message ||
      data?.title ||
      (typeof data === 'string' ? data : 'Có lỗi xảy ra')
    );
  }

  return data as T;
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
