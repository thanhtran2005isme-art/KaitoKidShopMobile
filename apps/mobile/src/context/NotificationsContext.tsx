import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import { notificationsApi } from '@/services/notifications.api';

type NotificationsContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  setUnreadCount: (count: number) => void;
};

const NotificationsContext =
  createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCountState] = useState(0);

  const setUnreadCount = useCallback((count: number) => {
    setUnreadCountState(Math.max(0, Math.floor(count || 0)));
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!token) {
      setUnreadCountState(0);
      return;
    }

    try {
      const result = await notificationsApi.getUnreadCount(token);
      setUnreadCountState(Math.max(0, result.unread || 0));
    } catch {
      // Badge không được phép làm hỏng navigation nếu endpoint phụ tạm lỗi.
    }
  }, [token]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  const value = useMemo(
    () => ({
      unreadCount,
      refreshUnreadCount,
      setUnreadCount,
    }),
    [refreshUnreadCount, setUnreadCount, unreadCount],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications phải nằm trong NotificationsProvider');
  }
  return context;
}
