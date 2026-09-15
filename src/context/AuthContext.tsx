import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { login as loginApi } from '@/services/auth.service';

const TOKEN_KEY = 'kaitokid_access_token';
const REFRESH_KEY = 'kaitokid_refresh_token';

async function getStorageItem(key: string) {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function setStorageItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function removeStorageItem(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

type AuthContextType = {
  token: string | null;
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    const savedToken = await getStorageItem(TOKEN_KEY);
    const savedUser = await getStorageItem('kaitokid_user');

    setToken(savedToken);
    setUser(savedUser ? JSON.parse(savedUser) : null);
    setLoading(false);
  }

  async function login(email: string, password: string) {
    const result: any = await loginApi({ email, password });
    const accessToken = result.accessToken || result.token;

    await setStorageItem(TOKEN_KEY, accessToken);

    if (result.refreshToken) {
      await setStorageItem(REFRESH_KEY, result.refreshToken);
    }

    if (result.user) {
      await setStorageItem('kaitokid_user', JSON.stringify(result.user));
      setUser(result.user);
    }

    setToken(accessToken);
    return result;
  }

  async function logout() {
    await removeStorageItem(TOKEN_KEY);
    await removeStorageItem(REFRESH_KEY);
    await removeStorageItem('kaitokid_user');

    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải nằm trong AuthProvider');
  return context;
}
