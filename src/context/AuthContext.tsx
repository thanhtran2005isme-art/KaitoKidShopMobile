import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState } from 'react';

import { login as loginApi } from '@/services/auth.service';

const TOKEN_KEY = 'kaitokid_access_token';
const REFRESH_KEY = 'kaitokid_refresh_token';

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
    const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
    const savedUser = await SecureStore.getItemAsync('kaitokid_user');
    setToken(savedToken);
    setUser(savedUser ? JSON.parse(savedUser) : null);
    setLoading(false);
  }

  async function login(email: string, password: string) {
    const result: any = await loginApi({ email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, result.accessToken || result.token);
    if (result.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_KEY, result.refreshToken);
    }
    if (result.user) {
      await SecureStore.setItemAsync('kaitokid_user', JSON.stringify(result.user));
      setUser(result.user);
    }
    setToken(result.accessToken || result.token);
    return result;
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync('kaitokid_user');
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
