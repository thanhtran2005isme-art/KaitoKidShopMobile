import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  login as loginApi,
  loginWithGoogle as googleLoginApi,
  refreshAccessToken,
  type AuthTokenResponse,
  type GoogleLoginCredential,
} from '@/services/auth.service';
import { setUnauthorizedHandler } from '@/services/api-client';

const TOKEN_KEY = 'kaitokid_access_token';
const REFRESH_KEY = 'kaitokid_refresh_token';
const USER_KEY = 'kaitokid_user';
const EXPIRES_KEY = 'kaitokid_access_token_expires_at';
const REFRESH_EARLY_MS = 60_000;

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
  loginWithGoogle: (credential: GoogleLoginCredential) => Promise<any>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const sessionGenerationRef = useRef(0);

  const clearSession = useCallback(async () => {
    sessionGenerationRef.current += 1;

    await Promise.all([
      removeStorageItem(TOKEN_KEY),
      removeStorageItem(REFRESH_KEY),
      removeStorageItem(USER_KEY),
      removeStorageItem(EXPIRES_KEY),
    ]);

    setToken(null);
    setUser(null);
    setExpiresAt(null);
  }, []);

  const persistTokenResponse = useCallback(async (result: AuthTokenResponse) => {
    const accessToken = result.accessToken || result.token;
    if (!accessToken) {
      throw new Error('API.Auth không trả access token.');
    }

    await setStorageItem(TOKEN_KEY, accessToken);

    if (result.refreshToken) {
      await setStorageItem(REFRESH_KEY, result.refreshToken);
    }

    if (result.expiresAt) {
      await setStorageItem(EXPIRES_KEY, result.expiresAt);
      setExpiresAt(result.expiresAt);
    } else {
      await removeStorageItem(EXPIRES_KEY);
      setExpiresAt(null);
    }

    if (result.user) {
      await setStorageItem(USER_KEY, JSON.stringify(result.user));
      setUser(result.user);
    }

    setToken(accessToken);
    return accessToken;
  }, []);

  const refreshSession = useCallback(async () => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const refreshGeneration = sessionGenerationRef.current;
    const refreshPromise = (async () => {
      const savedRefreshToken = await getStorageItem(REFRESH_KEY);

      if (!savedRefreshToken) {
        await clearSession();
        return null;
      }

      try {
        const result = await refreshAccessToken(savedRefreshToken);
        if (refreshGeneration !== sessionGenerationRef.current) {
          return null;
        }
        return await persistTokenResponse(result);
      } catch {
        await clearSession();
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [clearSession, persistTokenResponse]);

  useEffect(() => {
    setUnauthorizedHandler(refreshSession);
    return () => setUnauthorizedHandler(null);
  }, [refreshSession]);

  const restoreSession = useCallback(async () => {
    const [savedToken, savedRefreshToken, savedUser, savedExpiresAt] = await Promise.all([
      getStorageItem(TOKEN_KEY),
      getStorageItem(REFRESH_KEY),
      getStorageItem(USER_KEY),
      getStorageItem(EXPIRES_KEY),
    ]);

    const parsedExpiry = savedExpiresAt ? Date.parse(savedExpiresAt) : Number.NaN;
    const shouldRefresh =
      Boolean(savedRefreshToken) &&
      (!savedToken ||
        !Number.isFinite(parsedExpiry) ||
        parsedExpiry <= Date.now() + REFRESH_EARLY_MS);

    if (shouldRefresh) {
      await refreshSession();
      setLoading(false);
      return;
    }

    setToken(savedToken);
    setUser(savedUser ? JSON.parse(savedUser) : null);
    setExpiresAt(savedExpiresAt);
    setLoading(false);
  }, [refreshSession]);

  useEffect(() => {
    void Promise.resolve().then(restoreSession);
  }, [restoreSession]);

  useEffect(() => {
    if (!token || !expiresAt) return;

    const expiryTime = Date.parse(expiresAt);
    if (!Number.isFinite(expiryTime)) return;

    const delay = Math.max(0, expiryTime - Date.now() - REFRESH_EARLY_MS);
    const timer = setTimeout(() => {
      void refreshSession();
    }, delay);

    return () => clearTimeout(timer);
  }, [expiresAt, refreshSession, token]);

  async function login(email: string, password: string) {
    const result = await loginApi({ email, password });
    await persistTokenResponse(result);
    return result;
  }

  async function loginWithGoogle(credential: GoogleLoginCredential) {
    const result = await googleLoginApi(credential);
    await persistTokenResponse(result);
    return result;
  }

  async function logout() {
    await clearSession();
  }

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải nằm trong AuthProvider');
  return context;
}
