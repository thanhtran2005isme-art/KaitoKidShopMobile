export type NotificationItem = {
  id: number;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
};

export type NotificationPage = {
  total: number;
  unread: number;
  items: NotificationItem[];
};
