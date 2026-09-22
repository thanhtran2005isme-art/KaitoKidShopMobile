import type {
  CustomerOrder,
  OrderFilter,
  StatusTone,
} from '@/types/orders';

export const ORDER_FILTERS: Array<{ key: OrderFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'processing', label: 'Chờ xử lý' },
  { key: 'shipping', label: 'Đang giao' },
  { key: 'completed', label: 'Hoàn tất' },
  { key: 'cancelled', label: 'Đã hủy' },
];

export function orderStatusMeta(status?: string | null): {
  label: string;
  tone: StatusTone;
} {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return { label: 'Chờ xử lý', tone: 'warning' };
    case 'confirmed':
      return { label: 'Đã xác nhận', tone: 'primary' };
    case 'shipping':
      return { label: 'Đang giao', tone: 'info' };
    case 'completed':
      return { label: 'Hoàn tất', tone: 'success' };
    case 'cancelled':
      return { label: 'Đã hủy', tone: 'danger' };
    default:
      return { label: status?.trim() || 'Đang cập nhật', tone: 'neutral' };
  }
}

export function shippingStatusMeta(status?: string | null): {
  label: string;
  tone: StatusTone;
} {
  switch ((status || '').toLowerCase()) {
    case 'order_placed':
      return { label: 'Đã đặt hàng', tone: 'primary' };
    case 'ready_to_pick':
      return { label: 'Đã tạo vận đơn', tone: 'primary' };
    case 'picking':
      return { label: 'Đang lấy hàng', tone: 'warning' };
    case 'picked':
      return { label: 'Đã lấy hàng', tone: 'info' };
    case 'delivering':
    case 'shipping':
      return { label: 'Đang giao', tone: 'info' };
    case 'delivered':
    case 'completed':
      return { label: 'Đã giao hàng', tone: 'success' };
    case 'cancelled':
      return { label: 'Đã hủy', tone: 'danger' };
    case 'pending':
      return { label: 'Chờ vận chuyển', tone: 'warning' };
    default:
      return { label: status?.trim() || 'Đang cập nhật', tone: 'neutral' };
  }
}

export function matchesOrderFilter(order: CustomerOrder, filter: OrderFilter) {
  const status = (order.status || '').toLowerCase();

  switch (filter) {
    case 'all':
      return true;
    case 'processing':
      return status === 'pending' || status === 'confirmed';
    case 'shipping':
      return status === 'shipping';
    case 'completed':
      return status === 'completed';
    case 'cancelled':
      return status === 'cancelled';
  }
}

export function formatMoney(value: number) {
  return Math.round(Math.max(0, value || 0)).toLocaleString('vi-VN') + 'đ';
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Đang cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Đang cập nhật';

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value?: string | null) {
  if (!value) return 'Đang cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Đang cập nhật';

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function paymentLabel(order: CustomerOrder) {
  if (order.paidAt) return 'Đã thanh toán';

  if ((order.paymentMethod || '').toUpperCase() === 'ATM') {
    if (order.status === 'cancelled') return 'Đã hủy / chưa thanh toán';
    return 'Chờ chuyển khoản';
  }

  return order.status === 'completed'
    ? 'Đã thanh toán khi nhận hàng'
    : 'Thanh toán khi nhận hàng';
}

export function canResumeAtmPayment(order: CustomerOrder) {
  if ((order.paymentMethod || '').toUpperCase() !== 'ATM') return false;
  if (order.paidAt || order.status === 'cancelled') return false;
  if (!order.paymentExpiresAt) return order.status === 'pending';

  return new Date(order.paymentExpiresAt).getTime() > Date.now();
}

export function estimatedDeliveryText(
  createdAt?: string | null,
  leadTimeHours?: number | null,
) {
  if (!createdAt || !leadTimeHours || leadTimeHours <= 0) return null;
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return null;

  const eta = new Date(start.getTime() + leadTimeHours * 60 * 60 * 1000);
  return formatDateTime(eta.toISOString());
}
