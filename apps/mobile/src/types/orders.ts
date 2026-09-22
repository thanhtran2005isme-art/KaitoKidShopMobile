import type { CreatedOrder } from '@/types/checkout';

export type CustomerOrder = CreatedOrder & {
  canCancel: boolean;
  trackingCode?: string | null;
  trackingUrl?: string | null;
  shippingStatus?: string | null;
};

export type ReorderResult = {
  added: number;
  skipped: number;
  skippedNames: string[];
};

export type ShippingHistoryItem = {
  id: number;
  trangThai: string;
  moTa?: string | null;
  viTri?: string | null;
  thoiGian: string;
};

export type ShippingTracking = {
  orderId: number;
  orderCode: string;
  maVanDon?: string | null;
  nhaVanChuyen?: string | null;
  linkTracking?: string | null;
  trangThaiVanChuyen: string;
  trangThaiDonHang: string;
  leadTimeHours?: number | null;
  createdAt: string;
  history: ShippingHistoryItem[];
};

export type OrderFilter =
  | 'all'
  | 'processing'
  | 'shipping'
  | 'completed'
  | 'cancelled';

export type StatusTone =
  | 'neutral'
  | 'warning'
  | 'info'
  | 'success'
  | 'danger'
  | 'primary';
