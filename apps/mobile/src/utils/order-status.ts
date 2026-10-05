import type {
  CustomerOrder,
  OrderFilter,
  StatusTone,
} from '@/types/orders';

export const ORDER_FILTERS: { key: OrderFilter; label: string }[] = [
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
    case 'returned':
      return { label: 'Đã trả hàng', tone: 'danger' };
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
    case 'lalamove_placing':
      return { label: 'Đang tạo vận đơn Lalamove', tone: 'warning' };
    case 'lalamove_place_unknown':
      return { label: 'Cần đối soát vận đơn Lalamove', tone: 'warning' };
    case 'lalamove_place_failed':
      return { label: 'Tạo vận đơn Lalamove thất bại', tone: 'danger' };
    case 'ready_to_pick':
      return { label: 'Đã tạo vận đơn', tone: 'primary' };
    case 'picking':
      return { label: 'Đang lấy hàng', tone: 'warning' };
    case 'picked':
      return { label: 'Đã lấy hàng', tone: 'info' };
    case 'lalamove_on_going':
      return { label: 'Tài xế đã nhận đơn', tone: 'info' };
    case 'delivering':
    case 'shipping':
      return { label: 'Đang giao', tone: 'info' };
    case 'delivered':
    case 'completed':
      return { label: 'Đã giao hàng', tone: 'success' };
    case 'received_by_customer':
      return { label: 'Bạn đã xác nhận nhận hàng', tone: 'success' };
    case 'delivery_disputed':
      return { label: 'Đang đối soát chưa nhận hàng', tone: 'warning' };
    case 'returned':
      return { label: 'Đã trả hàng', tone: 'danger' };
    case 'carrier_cancelled':
      return { label: 'Đã hủy vận đơn', tone: 'danger' };
    case 'cancelled':
      return { label: 'Đã hủy', tone: 'danger' };
    case 'failed':
      return { label: 'Giao hàng thất bại', tone: 'danger' };
    case 'pending':
      return { label: 'Chờ vận chuyển', tone: 'warning' };
    default:
      return { label: status?.trim() || 'Đang cập nhật', tone: 'neutral' };
  }
}

export function afterSalesStatusMeta(order: CustomerOrder): {
  label: string;
  description: string;
  tone: StatusTone;
} | null {
  if (order.refundStatus === 'completed') {
    return {
      label: 'Đã ghi nhận hoàn tiền',
      description: 'KaitoKid đã xác nhận hoàn tiền thủ công cho yêu cầu hậu mãi này.',
      tone: 'success',
    };
  }

  if (order.refundStatus === 'pending') {
    const disposition =
      order.returnStatus === 'received_quarantine'
        ? 'Hàng hoàn đã được tiếp nhận và đưa vào khu cách ly kiểm tra.'
        : order.returnStatus === 'received_restock'
          ? 'Hàng hoàn đã được tiếp nhận và nhập lại tồn bán được.'
          : 'Hàng hoàn đã được tiếp nhận.';
    return {
      label: 'Đang chờ hoàn tiền',
      description: disposition + ' Hoàn tiền đang chờ xử lý xác nhận.',
      tone: 'warning',
    };
  }

  switch (order.returnStatus) {
    case 'requested':
      return {
        label: 'Yêu cầu hoàn hàng đang chờ duyệt',
        description: 'KaitoKid đang kiểm tra yêu cầu. Chưa có thay đổi tồn kho hoặc hoàn tiền.',
        tone: 'warning',
      };
    case 'approved':
      return {
        label: 'Yêu cầu hoàn hàng đã được duyệt',
        description: 'Vui lòng hoàn trả hàng theo hướng dẫn. Tồn kho chỉ cập nhật sau khi KaitoKid thực nhận hàng.',
        tone: 'info',
      };
    case 'rejected':
      return {
        label: 'Yêu cầu hoàn hàng bị từ chối',
        description: 'Yêu cầu đã được KaitoKid xử lý và không tiếp tục sang bước nhận hàng hoàn.',
        tone: 'danger',
      };
    case 'received_restock':
      return {
        label: 'Đã nhận hàng hoàn',
        description: 'Hàng hoàn đã được kiểm tra và nhập lại tồn bán được.',
        tone: 'success',
      };
    case 'received_quarantine':
      return {
        label: 'Đã nhận hàng hoàn · đang cách ly',
        description: 'Hàng hoàn đã được tiếp nhận nhưng không cộng vào tồn bán được.',
        tone: 'warning',
      };
    default:
      return null;
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
      return status === 'completed' || status === 'returned';
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

  return order.status === 'completed' || order.status === 'returned'
    ? 'Đã thanh toán khi nhận hàng'
    : 'Thanh toán khi nhận hàng';
}

export function canResumeAtmPayment(order: CustomerOrder) {
  if ((order.paymentMethod || '').toUpperCase() !== 'ATM') return false;
  if (order.paidAt || order.status === 'cancelled' || order.status === 'returned') return false;
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
