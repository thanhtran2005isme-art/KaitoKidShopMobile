import { apiRequest } from '@/services/api-client';
import type { NotificationPage } from '@/types/notifications';

function authHeaders(token: string): HeadersInit {
  return { Authorization: 'Bearer ' + token };
}

export const notificationsApi = {
  getNotifications(token: string, page = 1, pageSize = 20) {
    return apiRequest<NotificationPage>(
      '/api/notifications?page=' + page + '&pageSize=' + pageSize,
      { headers: authHeaders(token) },
    );
  },

  getUnreadCount(token: string) {
    return apiRequest<{ unread: number }>('/api/notifications/unread-count', {
      headers: authHeaders(token),
    });
  },

  markRead(token: string, id: number) {
    return apiRequest<{ message: string }>('/api/notifications/' + id + '/read', {
      method: 'PUT',
      headers: authHeaders(token),
    });
  },

  markAllRead(token: string) {
    return apiRequest<{ updated: number }>('/api/notifications/read-all', {
      method: 'PUT',
      headers: authHeaders(token),
    });
  },

  remove(token: string, id: number) {
    return apiRequest<void>('/api/notifications/' + id, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },
};
