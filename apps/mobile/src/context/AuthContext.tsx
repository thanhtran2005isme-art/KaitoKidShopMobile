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
  AuthHttpError,
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

  // Serialize SecureStore/localStorage mutations; old refresh responses must never
  // overwrite a newly logged-in session or erase it after a late 401.
  const storageWriteRef = useRef<Promise<void>>(Promise.resolve());
  const runSessionWrite = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    const operation = storageWriteRef.current.then(action, action);
    storageWriteRef.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, []);

  const clearSession = useCallback(async () => {
    const generation = ++sessionGenerationRef.current;
    await runSessionWrite(async () => {
      if (generation !== sessionGenerationRef.current) return;

      await Promise.all([
        removeStorageItem(TOKEN_KEY),
        removeStorageItem(REFRESH_KEY),
        removeStorageItem(USER_KEY),
        removeStorageItem(EXPIRES_KEY),
      ]);

      if (generation !== sessionGenerationRef.current) return;
      setToken(null);
      setUser(null);
      setExpiresAt(null);
    });
  }, [runSessionWrite]);

  const persistTokenResponse = useCallback(async (
    result: AuthTokenResponse,
    expectedGeneration: number,
  ): Promise<string | null> => {
    const accessToken = result.accessToken || result.token;
    if (!accessToken) {
      throw new Error('API.Auth không trả access token.');
    }

    await runSessionWrite(async () => {
      if (expectedGeneration !== sessionGenerationRef.current) return;
      await setStorageItem(TOKEN_KEY, accessToken);

      if (result.refreshToken) {
        await setStorageItem(REFRESH_KEY, result.refreshToken);
      } else {
        // Không giữ lại refresh token của account/phiên trước.
        await removeStorageItem(REFRESH_KEY);
      }

      if (result.expiresAt) {
        await setStorageItem(EXPIRES_KEY, result.expiresAt);
      } else {
        await removeStorageItem(EXPIRES_KEY);
      }

      if (result.user) {
        await setStorageItem(USER_KEY, JSON.stringify(result.user));
      } else {
        await removeStorageItem(USER_KEY);
      }

      if (expectedGeneration !== sessionGenerationRef.current) return;
      setExpiresAt(result.expiresAt || null);
      setUser(result.user || null);
      setToken(accessToken);
    });

    return expectedGeneration === sessionGenerationRef.current ? accessToken : null;
  }, [runSessionWrite]);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const refreshGeneration = sessionGenerationRef.current;
    const refreshPromise: Promise<string | null> = (async () => {
      let savedRefreshToken: string | null = null;
      try {
        savedRefreshToken = await getStorageItem(REFRESH_KEY);
        if (refreshGeneration !== sessionGenerationRef.current) return null;

        if (!savedRefreshToken) {
          await clearSession();
          return null;
        }

        const result = await refreshAccessToken(savedRefreshToken);
        if (refreshGeneration !== sessionGenerationRef.current) return null;
        return await persistTokenResponse(result, refreshGeneration);
      } catch (error) {
        if (refreshGeneration !== sessionGenerationRef.current) return null;

        // 401: refresh token đã hết hạn / bị thay thế -> trở về guest và đăng nhập lại.
        // Network/5xx: giữ storage để có thể thử lại, không xóa phiên do lỗi mạng.
        if (error instanceof AuthHttpError && error.status === 401) {
          // Tab khác có thể vừa xoay refresh token trong localStorage.
          const latestToken = await getStorageItem(REFRESH_KEY).catch(() => null);
          if (latestToken === savedRefreshToken && refreshGeneration === sessionGenerationRef.current) {
            await clearSession();
          }
        }
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
    const restoreGeneration = sessionGenerationRef.current;
    try {
      const [savedToken, savedRefreshToken, savedUser, savedExpiresAt] = await Promise.all([
        getStorageItem(TOKEN_KEY),
        getStorageItem(REFRESH_KEY),
        getStorageItem(USER_KEY),
        getStorageItem(EXPIRES_KEY),
      ]);
      if (restoreGeneration !== sessionGenerationRef.current) return;

      const parsedExpiry = savedExpiresAt ? Date.parse(savedExpiresAt) : Number.NaN;
      const shouldRefresh =
        Boolean(savedRefreshToken) &&
        (!savedToken ||
          !Number.isFinite(parsedExpiry) ||
          parsedExpiry <= Date.now() + REFRESH_EARLY_MS);

      if (shouldRefresh) {
        await refreshSession();
        return;
      }

      if (savedToken && !savedRefreshToken && Number.isFinite(parsedExpiry) && parsedExpiry <= Date.now()) {
        await clearSession();
        return;
      }

      if (restoreGeneration !== sessionGenerationRef.current) return;
      let storedUser: unknown = null;
      if (savedToken && savedUser) {
        try {
          storedUser = JSON.parse(savedUser);
        } catch {
          // User cache lỗi không được xóa access/refresh token còn hợp lệ.
        }
      }
      setToken(savedToken);
      setUser(storedUser);
      setExpiresAt(savedExpiresAt);
    } catch {
      // Lỗi storage trên một nền tảng không được giữ splash/loading vô hạn.
    } finally {
      setLoading(false);
    }
  }, [clearSession, refreshSession]);

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
    const generation = ++sessionGenerationRef.current;
    const result = await loginApi({ email, password });
    const applied = await persistTokenResponse(result, generation);
    if (!applied) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
    return result;
  }

  async function loginWithGoogle(credential: GoogleLoginCredential) {
    const generation = ++sessionGenerationRef.current;
    const result = await googleLoginApi(credential);
    const applied = await persistTokenResponse(result, generation);
    if (!applied) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
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
