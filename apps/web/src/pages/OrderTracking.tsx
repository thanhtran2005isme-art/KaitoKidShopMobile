// Trang đơn hàng của tôi — đã refactor:
// - Filter tabs theo trạng thái
// - hasReviewed lấy từ backend (persist qua F5)
// - Upload media review thật (multipart)
// - Nút Mua lại + Xuất hoá đơn
// - Xác nhận nhận hàng / báo chưa nhận / hoàn hàng 7 ngày

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  customerOrderApi, shippingApi, cartApi,
  type CustomerOrderDTO, type CustomerOrderItemDTO, type ShippingTracking,
} from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import { openInvoicePrintWindow } from '../utils/invoicePrint';
import OrderStatusFilter, { type OrderStatusFilterValue } from '../components/order/OrderStatusFilter';
import ReviewModal from '../components/order/ReviewModal';
import toast from 'react-hot-toast';

const statusMap: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao hàng',
  completed: 'Hoàn thành',
  return_requested: 'Đang xử lý hoàn hàng',
  returned: 'Đã hoàn hàng',
  cancelled: 'Đã huỷ',
};

const shippingStatusMap: Record<string, string> = {
  order_placed: 'Đã đặt hàng',
  ready_to_pick: 'Đã tạo vận đơn',
  picking: 'Đang lấy hàng',
  picked: 'Đã lấy hàng',
  lalamove_on_going: 'Tài xế đã nhận đơn',
  delivering: 'Đang giao hàng',
  shipping: 'Đang giao hàng',
  delivered: 'Đơn vị vận chuyển báo đã giao',
  completed: 'Đơn vị vận chuyển báo đã giao',
  received_by_customer: 'Khách đã xác nhận nhận hàng',
  delivery_disputed: 'Khách báo chưa nhận được hàng',
  return_requested: 'Đã gửi yêu cầu hoàn hàng',
  returned: 'Đã hoàn hàng',
  carrier_cancelled: 'Đã hủy vận đơn',
  cancelled: 'Đã hủy',
  failed: 'Giao hàng thất bại',
  pending: 'Chờ vận chuyển',
  payment_confirmed: 'Đã xác nhận thanh toán',
};

const providerMap: Record<string, string> = {
  ghn: 'Giao Hàng Nhanh',
  ghtk: 'Giao Hàng Tiết Kiệm',
  mock: 'KaitoKid (Mock)',
  lalamove: 'Lalamove',
};

type AfterSalesTone = 'warning' | 'info' | 'success' | 'danger';

function afterSalesState(order: CustomerOrderDTO): {
  title: string;
  detail: string;
  tone: AfterSalesTone;
} | null {
  if (order.refundStatus === 'completed') {
    return {
      title: 'Đã ghi nhận hoàn tiền',
      detail: 'KaitoKid đã xác nhận hoàn tiền thủ công cho yêu cầu hậu mãi này.',
      tone: 'success',
    };
  }

  if (order.refundStatus === 'pending') {
    const disposition = order.returnStatus === 'received_quarantine'
      ? 'Hàng hoàn đã được tiếp nhận và đưa vào khu cách ly kiểm tra.'
      : order.returnStatus === 'received_restock'
        ? 'Hàng hoàn đã được tiếp nhận và nhập lại tồn bán được.'
        : 'Hàng hoàn đã được tiếp nhận.';
    return {
      title: 'Đang chờ hoàn tiền',
      detail: `${disposition} Hoàn tiền đang chờ xử lý xác nhận.`,
      tone: 'warning',
    };
  }

  switch (order.returnStatus) {
    case 'requested':
      return {
        title: 'Yêu cầu hoàn hàng đang chờ duyệt',
        detail: 'KaitoKid đang kiểm tra yêu cầu. Chưa có thay đổi tồn kho hoặc hoàn tiền.',
        tone: 'warning',
      };
    case 'approved':
      return {
        title: 'Yêu cầu hoàn hàng đã được duyệt',
        detail: 'Vui lòng hoàn trả hàng theo hướng dẫn. Tồn kho chỉ cập nhật sau khi KaitoKid thực nhận hàng.',
        tone: 'info',
      };
    case 'rejected':
      return {
        title: 'Yêu cầu hoàn hàng bị từ chối',
        detail: 'Yêu cầu đã được KaitoKid xử lý và không tiếp tục sang bước nhận hàng hoàn.',
        tone: 'danger',
      };
    case 'received_restock':
      return {
        title: 'Đã nhận hàng hoàn',
        detail: 'Hàng hoàn đã được kiểm tra và nhập lại tồn bán được.',
        tone: 'success',
      };
    case 'received_quarantine':
      return {
        title: 'Đã nhận hàng hoàn · đang cách ly',
        detail: 'Hàng hoàn đã được tiếp nhận nhưng không cộng vào tồn bán được.',
        tone: 'warning',
      };
    default:
      return null;
  }
}

function AfterSalesNotice({ order }: { order: CustomerOrderDTO }) {
  const state = afterSalesState(order);
  if (!state) return null;

  const palette: Record<AfterSalesTone, { background: string; border: string; color: string }> = {
    warning: { background: '#fffbeb', border: '#fde68a', color: '#92400e' },
    info: { background: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
    success: { background: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
    danger: { background: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  };
  const tone = palette[state.tone];

  return (
    <div style={{ margin: '0 16px 12px', padding: '10px 12px', background: tone.background, border: `1px solid ${tone.border}`, borderRadius: 8, color: tone.color, fontSize: 13 }}>
      <div style={{ fontWeight: 700 }}>{state.title}</div>
      <div style={{ marginTop: 3, lineHeight: 1.45 }}>{state.detail}</div>
    </div>
  );
}

function shippingStatusLabel(status?: string | null) {
  const key = (status || '').toLowerCase();
  return shippingStatusMap[key] || status?.trim() || 'Đang cập nhật';
}

function statusGroup(status: string): OrderStatusFilterValue {
  if (status === 'pending' || status === 'confirmed') return 'pending';
  if (status === 'shipping') return 'shipping';
  if (status === 'completed' || status === 'return_requested' || status === 'returned') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'all';
}

function firstUnreviewedItem(order: CustomerOrderDTO) {
  return order.items.find((item) => !item.hasReviewed) ?? null;
}

export default function OrderTracking() {
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<CustomerOrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatusFilterValue>('all');
  const [selected, setSelected] = useState<CustomerOrderDTO | null>(null);
  const [reviewingItem, setReviewingItem] = useState<{ order: CustomerOrderDTO; item: CustomerOrderItemDTO } | null>(null);
  const [tracking, setTracking] = useState<ShippingTracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [afterSalesOrderId, setAfterSalesOrderId] = useState<number | null>(null);
  const [returningOrder, setReturningOrder] = useState<CustomerOrderDTO | null>(null);
  const [returnReason, setReturnReason] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    const result = await customerOrderApi.getMyOrders();
    if (result.success && result.data) {
      const sorted = [...result.data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setOrders(sorted);
    } else {
      setOrders([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void loadOrders();
    const tick = () => {
      if (document.visibilityState === 'visible') void loadOrders();
    };
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [user]);

  const counts = useMemo(() => {
    const c: Record<OrderStatusFilterValue, number> = {
      all: orders.length, pending: 0, shipping: 0, completed: 0, cancelled: 0,
    };
    for (const o of orders) {
      const g = statusGroup(o.status);
      if (g !== 'all') c[g]++;
    }
    return c;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter((o) => statusGroup(o.status) === filter);
  }, [orders, filter]);

  const pendingReviewCount = useMemo(() => {
    return orders
      .filter((o) => (o.status === 'completed' || o.status === 'return_requested') && o.canReview !== false)
      .reduce((acc, o) => acc + o.items.filter((i) => !i.hasReviewed).length, 0);
  }, [orders]);

  const openTracking = async (orderCode: string) => {
    setTrackingLoading(true);
    setTracking(null);
    const result = await shippingApi.track(orderCode);
    if (result.success && result.data) {
      setTracking(result.data);
      await loadOrders();
    } else {
      toast.error(result.error || 'Không lấy được tracking');
    }
    setTrackingLoading(false);
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    const result = await customerOrderApi.cancel(orderId);
    if (result.success) {
      toast.success(result.data?.message || 'Đã hủy đơn hàng');
      setSelected(null);
      await loadOrders();
    } else {
      toast.error(result.error || 'Không thể hủy đơn hàng');
    }
  };

  const handleConfirmReceived = async (order: CustomerOrderDTO) => {
    if (!window.confirm('Xác nhận bạn đã thực sự nhận được hàng? Mốc hoàn hàng 7 ngày sẽ bắt đầu từ thời điểm này.')) return;
    setAfterSalesOrderId(order.id);
    const result = await customerOrderApi.confirmReceived(order.id);
    setAfterSalesOrderId(null);
    if (!result.success) {
      toast.error(result.error || 'Không thể xác nhận nhận hàng');
      return;
    }
    toast.success(result.data?.message || 'Đã xác nhận nhận hàng');
    setSelected(null);
    await loadOrders();
  };

  const handleReportNotReceived = async (order: CustomerOrderDTO) => {
    if (!window.confirm('Đơn vị vận chuyển báo đã giao nhưng bạn chưa nhận được hàng? KaitoKid sẽ ghi nhận để đối soát.')) return;
    setAfterSalesOrderId(order.id);
    const result = await customerOrderApi.reportNotReceived(order.id);
    setAfterSalesOrderId(null);
    if (!result.success) {
      toast.error(result.error || 'Không thể gửi báo cáo');
      return;
    }
    toast.success(result.data?.message || 'Đã ghi nhận báo chưa nhận được hàng');
    setSelected(null);
    await loadOrders();
  };

  const openReturnRequest = (order: CustomerOrderDTO) => {
    setSelected(null);
    setReturnReason('');
    setReturningOrder(order);
  };

  const submitReturnRequest = async () => {
    if (!returningOrder) return;
    if (returnReason.trim().length < 5) {
      toast.error('Vui lòng mô tả lỗi hoặc lý do hoàn hàng ít nhất 5 ký tự');
      return;
    }
    setAfterSalesOrderId(returningOrder.id);
    const result = await customerOrderApi.requestReturn(returningOrder.id, returnReason.trim());
    setAfterSalesOrderId(null);
    if (!result.success) {
      toast.error(result.error || 'Không thể gửi yêu cầu hoàn hàng');
      return;
    }
    toast.success(result.data?.message || 'Đã gửi yêu cầu hoàn hàng');
    setReturningOrder(null);
    setReturnReason('');
    await loadOrders();
  };

  const handleReorder = async (orderId: number) => {
    setReorderingId(orderId);
    const r = await cartApi.reorder(orderId);
    setReorderingId(null);
    if (!r.success || !r.data) {
      toast.error(r.error || 'Không thể mua lại đơn này');
      return;
    }
    await refreshCart();
    if (r.data.added > 0) toast.success(`Đã thêm ${r.data.added} sản phẩm vào giỏ`);
    if (r.data.skipped > 0) {
      toast.error(`Đã bỏ qua ${r.data.skipped} sản phẩm hết hàng${r.data.skippedNames.length ? ': ' + r.data.skippedNames.join(', ') : ''}`);
    }
    if (r.data.added > 0) navigate('/cart');
  };

  const handleSubmittedReview = (orderId: number, productId: number) => {
    setOrders((prev) => prev.map((o) => o.id !== orderId ? o : {
      ...o,
      items: o.items.map((i) => i.productId === productId ? { ...i, hasReviewed: true } : i),
    }));
    setReviewingItem(null);
  };

  if (!user) {
    return (
      <div className="order-tracking-page">
        <div className="login-required-box">
          <i className="fa fa-lock"></i>
          <h3>Vui lòng đăng nhập</h3>
          <p>Bạn cần đăng nhập để xem đơn hàng</p>
          <Link to="/login" className="btn-login"><i className="fa fa-sign-in-alt"></i> Đăng nhập</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="order-tracking-page">
      <div className="user-section">
        <div className="user-info-box">
          <div className="user-avatar"><i className="fa fa-user"></i></div>
          <div className="user-details"><h3>{user.name}</h3><p>{user.email}</p></div>
        </div>
      </div>

      {pendingReviewCount > 0 && (
        <div className="review-nudge">
          <i className="fa fa-star"></i>
          <div style={{ flex: 1 }}>
            Bạn còn <strong>{pendingReviewCount}</strong> sản phẩm chưa đánh giá. Hãy chia sẻ trải nghiệm để giúp khách hàng khác lựa chọn nhé!
          </div>
          <button className="btn-view-order" style={{ background: '#f59e0b', color: '#fff' }} onClick={() => setFilter('completed')}>
            Xem đơn cần đánh giá
          </button>
        </div>
      )}

      <div className="orders-section">
        <h3><i className="fa fa-box"></i> Đơn hàng của tôi</h3>
        <OrderStatusFilter value={filter} onChange={setFilter} counts={counts} />

        {loading ? (
          <div className="empty-orders"><i className="fa fa-spinner fa-spin"></i><p>Đang tải đơn hàng...</p></div>
        ) : visibleOrders.length === 0 ? (
          <div className="empty-orders"><i className="fa fa-inbox"></i><p>{filter === 'all' ? 'Chưa có đơn hàng nào' : 'Không có đơn nào trong nhóm này'}</p></div>
        ) : (
          visibleOrders.map((order) => {
            const firstReviewItem = firstUnreviewedItem(order);
            return (
              <div key={order.id} className="order-card">
                <div className="order-card-header">
                  <div>
                    <span className="order-id">#{order.orderCode || order.id}</span>
                    <span className="order-date">{formatDate(order.createdAt)}</span>
                  </div>
                  <span className={`order-status ${order.status}`}>{statusMap[order.status] || order.status}</span>
                </div>

                <div className="order-items-preview">
                  {order.items.slice(0, 4).map((item, i) => (
                    <img key={i} src={item.productImage} alt={item.productName} loading="lazy" decoding="async" />
                  ))}
                  {order.items.length > 4 && <span>+{order.items.length - 4}</span>}
                </div>

                {(order.canConfirmReceived || order.deliveryIssueReported) && (
                  <div style={{ margin: '0 16px 12px', padding: '10px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, color: '#9a3412', fontSize: 13 }}>
                    <i className="fa fa-info-circle" style={{ marginRight: 6 }}></i>
                    {order.deliveryIssueReported
                      ? 'Bạn đã báo chưa nhận được hàng. KaitoKid đang chờ đối soát với đơn vị vận chuyển.'
                      : 'Đơn vị vận chuyển báo đã giao. Vui lòng xác nhận khi bạn thực sự nhận được hàng.'}
                  </div>
                )}

                <AfterSalesNotice order={order} />

                <div className="order-card-footer">
                  <span className="order-total">{formatCurrency(order.total)}</span>
                  <div className="order-actions">
                    <button className="btn-view-order" onClick={() => setSelected(order)}><i className="fa fa-eye"></i> Chi tiết</button>
                    <button className="btn-view-order" style={{ marginLeft: 8, background: '#dbeafe', color: '#1d4ed8' }} onClick={() => void openTracking(order.orderCode || String(order.id))}>
                      <i className="fa fa-truck"></i> Theo dõi
                    </button>
                    {order.canConfirmReceived && (
                      <button className="btn-view-order" style={{ marginLeft: 8, background: '#dcfce7', color: '#15803d' }} disabled={afterSalesOrderId === order.id} onClick={() => void handleConfirmReceived(order)}>
                        <i className="fa fa-check-circle"></i> {afterSalesOrderId === order.id ? 'Đang xử lý...' : 'Đã nhận hàng'}
                      </button>
                    )}
                    {order.canReportNotReceived && (
                      <button className="btn-view-order" style={{ marginLeft: 8, background: '#ffedd5', color: '#c2410c' }} disabled={afterSalesOrderId === order.id} onClick={() => void handleReportNotReceived(order)}>
                        <i className="fa fa-exclamation-triangle"></i> Chưa nhận được hàng
                      </button>
                    )}
                    {(order.status === 'completed' || order.status === 'return_requested') && order.canReview !== false && firstReviewItem && (
                      <button className="btn-review" onClick={() => setReviewingItem({ order, item: firstReviewItem })}>
                        <i className="fa fa-star"></i> Đánh giá
                      </button>
                    )}
                    {order.canRequestReturn && (
                      <button className="btn-view-order" style={{ marginLeft: 8, background: '#fef3c7', color: '#92400e' }} onClick={() => openReturnRequest(order)}>
                        <i className="fa fa-undo"></i> Hoàn hàng
                      </button>
                    )}
                    {order.status === 'completed' && (
                      <button className="btn-reorder" onClick={() => void handleReorder(order.id)} disabled={reorderingId === order.id}>
                        <i className="fa fa-redo"></i> {reorderingId === order.id ? 'Đang thêm...' : 'Mua lại'}
                      </button>
                    )}
                    {(order.status === 'completed' || order.status === 'shipping' || order.status === 'confirmed' || order.status === 'return_requested') && (
                      <button className="btn-invoice" onClick={() => openInvoicePrintWindow(order)}><i className="fa fa-file-invoice"></i> Xuất hoá đơn</button>
                    )}
                    {order.canCancel && (
                      <button className="btn-view-order" style={{ marginLeft: 8, background: '#fee2e2', color: '#dc2626' }} onClick={() => void handleCancelOrder(order.id)}>
                        <i className="fa fa-times"></i> Hủy đơn
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <div className="modal active" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết đơn #{selected.orderCode || selected.id}</h3>
              <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row"><span className="detail-label">Trạng thái</span><span className={`order-status ${selected.status}`}>{statusMap[selected.status] || selected.status}</span></div>
              <div className="detail-row"><span className="detail-label">Ngày đặt</span><span className="detail-value">{formatDate(selected.createdAt)}</span></div>
              <div className="detail-row"><span className="detail-label">Thanh toán</span><span className="detail-value">{selected.paymentMethod}</span></div>
              {selected.receivedAt && <div className="detail-row"><span className="detail-label">Đã nhận hàng</span><span className="detail-value">{formatDate(selected.receivedAt)}</span></div>}
              {selected.returnDeadline && selected.canRequestReturn && <div className="detail-row"><span className="detail-label">Hạn yêu cầu hoàn</span><span className="detail-value">{formatDate(selected.returnDeadline)}</span></div>}
              {selected.customerAddress && <div className="detail-row"><span className="detail-label">Địa chỉ</span><span className="detail-value">{selected.customerAddress}</span></div>}

              {(selected.canConfirmReceived || selected.deliveryIssueReported) && (
                <div style={{ marginTop: 14, padding: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, color: '#9a3412', fontSize: 13 }}>
                  {selected.deliveryIssueReported
                    ? 'Đã ghi nhận báo chưa nhận được hàng. Nếu sau đó bạn thực sự nhận được hàng, bạn vẫn có thể xác nhận Đã nhận hàng.'
                    : 'Đơn vị vận chuyển đã báo giao thành công. KaitoKid chỉ tính đơn hoàn thành sau khi bạn xác nhận đã nhận.'}
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <AfterSalesNotice order={selected} />
              </div>

              <h4 style={{ margin: '20px 0 12px' }}>Sản phẩm ({selected.items.length})</h4>
              {selected.items.map((item, i) => (
                <div key={i} className="order-item">
                  <img src={item.productImage} alt={item.productName} loading="lazy" decoding="async" />
                  <div className="order-item-info">
                    <div className="order-item-name">{item.productName}</div>
                    <div className="order-item-variant">{item.color}{item.size && `, ${item.size}`} × {item.quantity}</div>
                    <div className="order-item-price">{formatCurrency(item.price)}</div>
                    {(selected.status === 'completed' || selected.status === 'return_requested') && selected.canReview !== false && (
                      <div style={{ marginTop: '8px' }}>
                        {item.hasReviewed ? (
                          <span style={{ color: '#10b981', fontSize: '14px' }}><i className="fa fa-check-circle"></i> Đã đánh giá</span>
                        ) : (
                          <button className="btn-review" onClick={() => { setReviewingItem({ order: selected, item }); setSelected(null); }}>
                            <i className="fa fa-star"></i> Đánh giá
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '2px solid #eee' }}>
                <div className="summary-row"><span>Tạm tính:</span><span>{formatCurrency(selected.subtotal)}</span></div>
                <div className="summary-row"><span>Phí ship:</span><span>{selected.shippingFee === 0 ? 'Miễn phí' : formatCurrency(selected.shippingFee)}</span></div>
                {selected.discount > 0 && <div className="summary-row"><span>Giảm giá:</span><span>-{formatCurrency(selected.discount)}</span></div>}
                <div className="summary-row total"><span>Tổng:</span><span>{formatCurrency(selected.total)}</span></div>
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {selected.canConfirmReceived && <button className="btn-view-order" style={{ background: '#16a34a', color: '#fff' }} disabled={afterSalesOrderId === selected.id} onClick={() => void handleConfirmReceived(selected)}><i className="fa fa-check-circle"></i> Đã nhận hàng</button>}
                {selected.canReportNotReceived && <button className="btn-view-order" style={{ background: '#ea580c', color: '#fff' }} disabled={afterSalesOrderId === selected.id} onClick={() => void handleReportNotReceived(selected)}><i className="fa fa-exclamation-triangle"></i> Chưa nhận được hàng</button>}
                {selected.canRequestReturn && <button className="btn-view-order" style={{ background: '#f59e0b', color: '#fff' }} onClick={() => openReturnRequest(selected)}><i className="fa fa-undo"></i> Hoàn hàng</button>}
                <button className="btn-invoice" onClick={() => openInvoicePrintWindow(selected)}><i className="fa fa-file-invoice"></i> Xuất hoá đơn</button>
                {selected.status === 'completed' && <button className="btn-reorder" onClick={() => { setSelected(null); void handleReorder(selected.id); }}><i className="fa fa-redo"></i> Mua lại</button>}
                {selected.canCancel && <button className="btn-view-order" style={{ background: '#dc2626', color: '#fff' }} onClick={() => void handleCancelOrder(selected.id)}><i className="fa fa-times"></i> Hủy đơn hàng</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {returningOrder && (
        <div className="modal active" onClick={() => setReturningOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header"><h3>Yêu cầu hoàn hàng</h3><button className="modal-close" onClick={() => setReturningOrder(null)}>×</button></div>
            <div className="modal-body">
              <p style={{ margin: '0 0 12px', color: '#475569', fontSize: 14 }}>Bạn có thể gửi yêu cầu trong 7 ngày kể từ lúc xác nhận đã nhận hàng. Hãy mô tả lỗi sản phẩm hoặc lý do cần hoàn.</p>
              {returningOrder.returnDeadline && <p style={{ margin: '0 0 12px', color: '#92400e', fontSize: 13 }}>Hạn yêu cầu: <strong>{formatDate(returningOrder.returnDeadline)}</strong></p>}
              <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} maxLength={500} rows={5} placeholder="Ví dụ: sản phẩm lỗi đường may, rách, sai sản phẩm..." style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 8, padding: 12, resize: 'vertical', font: 'inherit' }} />
              <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>Gửi yêu cầu không tự động hoàn tiền hoặc nhập lại kho. KaitoKid sẽ kiểm tra trước khi xử lý.</div>
              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn-view-order" onClick={() => setReturningOrder(null)}>Đóng</button>
                <button className="btn-view-order" style={{ background: '#f59e0b', color: '#fff' }} disabled={afterSalesOrderId === returningOrder.id} onClick={() => void submitReturnRequest()}>
                  <i className="fa fa-undo"></i> {afterSalesOrderId === returningOrder.id ? 'Đang gửi...' : 'Gửi yêu cầu hoàn'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reviewingItem && (
        <ReviewModal order={reviewingItem.order} item={reviewingItem.item} onClose={() => setReviewingItem(null)} onSubmitted={() => handleSubmittedReview(reviewingItem.order.id, reviewingItem.item.productId)} />
      )}

      {(tracking || trackingLoading) && (
        <div className="modal active" onClick={() => setTracking(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3><i className="fa fa-truck" style={{ marginRight: 8, color: '#1d4ed8' }}></i>Theo dõi vận chuyển</h3>
              <button className="modal-close" onClick={() => setTracking(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              {trackingLoading && <p style={{ textAlign: 'center', color: '#64748b' }}>Đang tải...</p>}
              {tracking && (
                <>
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: '#64748b', fontSize: 13 }}>Mã đơn hàng:</span><strong>{tracking.orderCode}</strong></div>
                    {tracking.maVanDon && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: '#64748b', fontSize: 13 }}>Mã vận đơn:</span><strong style={{ color: '#1d4ed8' }}>{tracking.maVanDon}</strong></div>}
                    {tracking.nhaVanChuyen && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: '#64748b', fontSize: 13 }}>Đơn vị vận chuyển:</span><strong>{providerMap[tracking.nhaVanChuyen.toLowerCase()] || tracking.nhaVanChuyen}</strong></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b', fontSize: 13 }}>Trạng thái:</span><strong style={{ color: '#16a34a' }}>{shippingStatusLabel(tracking.trangThaiVanChuyen)}</strong></div>
                  </div>

                  <h4 style={{ margin: '0 0 12px', fontSize: 15, color: '#0f172a' }}>Lịch sử vận chuyển</h4>
                  {tracking.history.length === 0 ? (
                    <p style={{ color: '#64748b' }}>Chưa có cập nhật.</p>
                  ) : (
                    <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: 20, marginLeft: 8 }}>
                      {tracking.history.slice().reverse().map((h, idx) => (
                        <div key={h.id} style={{ marginBottom: 16, position: 'relative' }}>
                          <div style={{ position: 'absolute', left: -28, top: 4, width: 12, height: 12, borderRadius: '50%', background: idx === 0 ? '#16a34a' : '#cbd5e1', border: '2px solid #fff', boxShadow: idx === 0 ? '0 0 0 3px #bbf7d0' : 'none' }} />
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{h.moTa || shippingStatusLabel(h.trangThai)}</div>
                          {h.viTri && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}><i className="fa fa-map-marker-alt" style={{ marginRight: 4 }}></i>{h.viTri}</div>}
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{formatDate(h.thoiGian)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
