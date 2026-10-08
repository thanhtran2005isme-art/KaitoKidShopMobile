import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminIcon from '../components/admin/AdminIcon';
import AdminAfterSalesPanel from './AdminAfterSalesPanel';
import { orderApi } from '../services/api';
import type { AdminAfterSalesCase } from '../services/api/orderApi';
import type { OrderDTO } from '../types/api';
import { formatCurrency, formatDate } from '../utils/format';

type AdminOrderStatus = 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled' | 'returned';
type StatusFilter = 'all' | AdminOrderStatus;

type AdminOrder = Omit<OrderDTO, 'status'> & {
  status: AdminOrderStatus;
  numericId: number;
};

const STATUS_META: Record<
  AdminOrderStatus,
  { label: string; icon: string; tone: 'pending' | 'confirmed' | 'shipping' | 'completed' | 'cancelled' }
> = {
  pending: { label: 'Chờ xác nhận', icon: 'fa-clock', tone: 'pending' },
  confirmed: { label: 'Đã xác nhận', icon: 'fa-check-circle', tone: 'confirmed' },
  shipping: { label: 'Đang giao', icon: 'fa-truck', tone: 'shipping' },
  completed: { label: 'Khách đã nhận', icon: 'fa-check-circle', tone: 'completed' },
  cancelled: { label: 'Đã hủy', icon: 'fa-ban', tone: 'cancelled' },
  returned: { label: 'Đã trả hàng', icon: 'fa-rotate-left', tone: 'cancelled' },
};

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'shipping', label: 'Đang giao' },
  { value: 'completed', label: 'Khách đã nhận' },
  { value: 'returned', label: 'Đã trả hàng' },
  { value: 'cancelled', label: 'Đã hủy' },
];

function normalizeStatus(value: unknown): AdminOrderStatus {
  const status = String(value ?? '').trim().toLowerCase();
  if (
    status === 'confirmed' ||
    status === 'shipping' ||
    status === 'completed' ||
    status === 'cancelled' ||
    status === 'returned'
  ) return status;
  return 'pending';
}

function mapOrder(raw: any): AdminOrder {
  return {
    id: raw.maDonHang || raw.id?.toString() || '',
    numericId: Number(raw.id),
    customerName: raw.tenNguoiNhan || '',
    customerPhone: raw.soDienThoai || '',
    customerEmail: raw.email || '',
    customerAddress: raw.diaChiGiao || '',
    items: (raw.chiTiet || []).map((item: any) => ({
      id: item.id,
      productId: item.sanPhamId,
      productName: item.tenSanPham,
      image: item.hinhAnhSP,
      color: item.mauSac,
      size: item.kichCo,
      quantity: Number(item.soLuong || 0),
      price: Number(item.donGia || 0),
      subtotal: Number(item.donGia || 0) * Number(item.soLuong || 0),
    })),
    subtotal: Number(raw.tamTinh || 0),
    shippingFee: Number(raw.phiVanChuyen || 0),
    discount: Number(raw.giamGia || 0),
    total: Number(raw.tongTien || 0),
    paymentMethod: raw.phuongThucThanhToan || 'COD',
    status: normalizeStatus(raw.trangThai),
    note: raw.ghiChu,
    adminNote: raw.ghiChuAdmin,
    createdAt: raw.ngayTao,
    updatedAt: raw.ngayCapNhat,
  } as AdminOrder;
}

function getStatusFilter(value: string | null): StatusFilter {
  return FILTERS.some((item) => item.value === value) ? (value as StatusFilter) : 'all';
}

function getPaymentMeta(method?: string) {
  const normalized = (method || '').toLowerCase();
  if (normalized.includes('cod')) return { label: 'COD', icon: 'fa-wallet', tone: 'cod' as const };
  if (normalized.includes('momo')) return { label: 'MoMo', icon: 'fa-credit-card', tone: 'momo' as const };
  if (normalized.includes('bank') || normalized.includes('atm') || normalized.includes('chuyển')) {
    return { label: 'Chuyển khoản', icon: 'fa-credit-card', tone: 'bank' as const };
  }
  return { label: method || 'Thanh toán', icon: 'fa-receipt', tone: 'bank' as const };
}

function getCustomerInitial(name?: string) {
  return (name || 'K')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getOrderItemCount(order: AdminOrder) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

function dateKey(value?: string) {
  return value?.split('T')[0] || '';
}

function writableTransitions(status: AdminOrderStatus): AdminOrderStatus[] {
  if (status === 'pending') return ['confirmed', 'cancelled'];
  if (status === 'confirmed') return ['shipping', 'cancelled'];
  return [];
}

function afterSalesLabel(item?: AdminAfterSalesCase) {
  if (!item) return null;
  if (item.deliveryIssueOpen) return { label: 'Khách báo chưa nhận', tone: 'danger' };
  if (item.returnStatus === 'requested') return { label: 'Chờ duyệt hoàn', tone: 'warning' };
  if (item.returnStatus === 'approved') return { label: 'Chờ hàng hoàn', tone: 'warning' };
  if (item.refundStatus === 'pending') return { label: 'Chờ hoàn tiền', tone: 'warning' };
  if (item.returnStatus === 'received_quarantine') return { label: 'Quarantine', tone: 'danger' };
  if (item.returnStatus === 'received_restock') return { label: 'Đã nhập lại tồn', tone: 'success' };
  if (item.returnStatus === 'rejected') return { label: 'Hoàn hàng bị từ chối', tone: 'neutral' };
  if (item.refundStatus === 'completed') return { label: 'Đã hoàn tiền', tone: 'success' };
  return null;
}

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [afterSales, setAfterSales] = useState<Map<number, AdminAfterSalesCase>>(new Map());
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const statusFilter = getStatusFilter(searchParams.get('status'));

  const reload = async (keepSelectedId?: number) => {
    setLoading(true);
    try {
      const [response, cases] = await Promise.all([
        orderApi.getOrders({ page: 1, pageSize: 200 }),
        orderApi.getAfterSalesCases(),
      ]);
      const mapped = (response.items || [])
        .map((raw: any) => mapOrder(raw))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(mapped);
      setAfterSales(new Map(cases.map((item) => [item.orderId, item])));
      if (keepSelectedId) {
        setSelected(mapped.find((item) => item.numericId === keepSelectedId) || null);
      }
    } catch (error) {
      console.error(error);
      toast.error('Không thể tải danh sách đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  const setStatusFilter = (value: StatusFilter) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('status');
    else next.set('status', value);
    setSearchParams(next);
  };

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSearch =
        !keyword ||
        order.id.toLowerCase().includes(keyword) ||
        order.customerName.toLowerCase().includes(keyword) ||
        order.customerPhone.toLowerCase().includes(keyword) ||
        order.customerEmail.toLowerCase().includes(keyword);
      const key = dateKey(order.createdAt);
      return matchesStatus && matchesSearch && (!dateFrom || key >= dateFrom) && (!dateTo || key <= dateTo);
    });
  }, [orders, statusFilter, search, dateFrom, dateTo]);

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((order) => order.status === 'pending').length,
    shipping: orders.filter((order) => order.status === 'confirmed' || order.status === 'shipping').length,
    completed: orders.filter((order) => order.status === 'completed').length,
    returned: orders.filter((order) => order.status === 'returned').length,
    cancelled: orders.filter((order) => order.status === 'cancelled').length,
    attention: Array.from(afterSales.values()).filter((item) => item.requiresAttention).length,
  }), [orders, afterSales]);

  const visibleRevenue = filteredOrders
    .filter((order) => !['cancelled', 'returned'].includes(order.status))
    .reduce((sum, order) => sum + order.total, 0);

  const updateStatus = async (order: AdminOrder, nextStatus: AdminOrderStatus) => {
    if (!writableTransitions(order.status).includes(nextStatus)) {
      toast.error('Trạng thái này phải được tạo bởi luồng nghiệp vụ tương ứng, không được đặt thủ công.');
      return;
    }
    setBusyOrderId(order.numericId);
    try {
      await orderApi.updateOrderStatus(order.numericId.toString(), {
        trangThai: nextStatus as OrderDTO['status'],
      });
      toast.success('Cập nhật trạng thái thành công');
      await reload(selected?.numericId);
    } catch (error) {
      console.error(error);
      toast.error('Không thể cập nhật trạng thái');
    } finally {
      setBusyOrderId(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setSearchParams({});
  };

  return (
    <div className="orders-admin-page">
      <div className="page-header orders-page-header">
        <div className="orders-page-copy">
          <span className="orders-page-eyebrow">Order operations</span>
          <h1>Quản lý đơn hàng & hậu mãi</h1>
          <p>
            Carrier báo giao không đồng nghĩa khách đã nhận. Hoàn hàng, kiểm hàng, quarantine và hoàn tiền được xử lý theo workflow riêng để không lệch tồn kho.
          </p>
        </div>
        <div className="page-actions orders-page-actions">
          <button type="button" className="orders-header-button primary" onClick={() => void reload(selected?.numericId)}>
            <AdminIcon name="fa-rotate" /> <span>Làm mới</span>
          </button>
        </div>
      </div>

      <section className="orders-hero">
        <div className="orders-hero-main">
          <span className="orders-hero-badge"><AdminIcon name="fa-shield-halved" /> Business-state safe</span>
          <h2>{filteredOrders.length} đơn đang hiển thị · {formatCurrency(visibleRevenue)} doanh thu thuần đang tính.</h2>
          <p>
            Có {stats.attention} case hậu mãi cần chú ý. Đơn returned không được tính vào doanh thu hiển thị và hàng quarantine không quay lại tồn bán được.
          </p>
        </div>
        <div className="orders-hero-side">
          <div className={`orders-spotlight-card ${stats.attention > 0 ? 'tone-warning' : 'tone-success'}`}>
            <div className="orders-card-kicker">Cần xử lý</div>
            <div className="orders-spotlight-icon"><AdminIcon name={stats.attention > 0 ? 'fa-triangle-exclamation' : 'fa-check-circle'} /></div>
            <h3>{stats.attention > 0 ? `${stats.attention} case hậu mãi đang mở` : 'Không có case hậu mãi tồn'}</h3>
            <p>{stats.attention > 0 ? 'Mở chi tiết đơn để duyệt hoàn, nhận hàng thực tế hoặc đối soát hoàn tiền.' : 'Luồng hậu mãi hiện không có việc tồn.'}</p>
          </div>
        </div>
      </section>

      <div className="orders-overview-grid">
        {[
          ['all', 'Tất cả', stats.total, 'fa-shopping-bag', 'all'],
          ['pending', 'Chờ xác nhận', stats.pending, 'fa-clock', 'pending'],
          ['shipping', 'Đang xử lý/giao', stats.shipping, 'fa-truck', 'shipping'],
          ['completed', 'Khách đã nhận', stats.completed, 'fa-check-circle', 'completed'],
          ['returned', 'Đã trả hàng', stats.returned, 'fa-rotate-left', 'cancelled'],
          ['cancelled', 'Đã hủy', stats.cancelled, 'fa-ban', 'cancelled'],
        ].map(([key, label, value, icon, tone]) => (
          <button
            key={String(key)}
            type="button"
            className={`orders-overview-card ${tone} ${statusFilter === key ? 'active' : ''}`}
            onClick={() => setStatusFilter(key as StatusFilter)}
          >
            <div className={`orders-overview-icon ${tone}`}><AdminIcon name={String(icon)} /></div>
            <div className="orders-overview-copy"><span>{label}</span><strong>{value}</strong></div>
          </button>
        ))}
      </div>

      <section className="orders-filter-panel">
        <div className="orders-filter-row">
          <label className="orders-search-shell">
            <AdminIcon name="fa-search" />
            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Mã đơn, tên, SĐT hoặc email..."
            />
          </label>
          <label className="orders-date-shell">
            <span className="orders-date-label">Từ ngày</span>
            <input type="date" className="date-input" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="orders-date-shell">
            <span className="orders-date-label">Đến ngày</span>
            <input type="date" className="date-input" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <button type="button" className="btn-filter-reset" onClick={clearFilters}>
            <AdminIcon name="fa-rotate-left" /> <span>Xóa bộ lọc</span>
          </button>
        </div>
        <div className="orders-filter-footer">
          <div className="orders-preset-group">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`orders-preset-button ${statusFilter === filter.value ? 'active' : ''}`}
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="table-card orders-table-card">
        <div className="table-toolbar orders-table-toolbar">
          <div className="orders-table-toolbar-copy">
            <span className="orders-table-toolbar-eyebrow">Order list</span>
            <h2>Hiển thị {filteredOrders.length} / {orders.length} đơn</h2>
            <p>`completed` và `returned` là outcome của workflow, không phải trạng thái Admin được chọn thủ công.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table orders-table">
            <thead>
              <tr>
                <th>Đơn hàng</th><th>Khách hàng</th><th>Thời gian</th><th>Thanh toán</th><th>Trạng thái</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const statusMeta = STATUS_META[order.status];
                const paymentMeta = getPaymentMeta(order.paymentMethod);
                const caseItem = afterSales.get(order.numericId);
                const afterSalesMeta = afterSalesLabel(caseItem);
                const transitions = writableTransitions(order.status);
                return (
                  <tr key={order.numericId}>
                    <td>
                      <div className="order-code-block">
                        <span className="order-id">#{order.id}</span>
                        <span className="order-item-count">{getOrderItemCount(order)} sản phẩm</span>
                        {afterSalesMeta && <span className={`after-sales-attention ${afterSalesMeta.tone}`}>{afterSalesMeta.label}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="customer-cell">
                        <div className="customer-avatar">{getCustomerInitial(order.customerName)}</div>
                        <div className="customer-info">
                          <span className="customer-name">{order.customerName}</span>
                          <span className="customer-phone">{order.customerPhone}</span>
                          <span className="customer-email">{order.customerEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td><div className="order-time-block"><span className="order-date">{formatDate(order.createdAt)}</span></div></td>
                    <td>
                      <div className="payment-cell">
                        <span className={`payment-badge ${paymentMeta.tone}`}><AdminIcon name={paymentMeta.icon} /> {paymentMeta.label}</span>
                        <span className="order-price">{formatCurrency(order.total)}</span>
                      </div>
                    </td>
                    <td><span className={`status-badge ${statusMeta.tone}`}><AdminIcon name={statusMeta.icon} /> {statusMeta.label}</span></td>
                    <td>
                      <div className="action-buttons">
                        <button type="button" className="btn-action view" title="Xem chi tiết" onClick={() => setSelected(order)}>
                          <AdminIcon name="fa-eye" />
                        </button>
                        {transitions.map((next) => (
                          <button
                            key={next}
                            type="button"
                            className={`btn-action ${next === 'cancelled' ? 'delete' : 'advance'}`}
                            disabled={busyOrderId === order.numericId}
                            title={`Chuyển sang ${STATUS_META[next].label}`}
                            onClick={() => void updateStatus(order, next)}
                          >
                            <AdminIcon name={STATUS_META[next].icon} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {loading && <div className="orders-empty-state"><h3>Đang tải đơn hàng…</h3></div>}
          {!loading && filteredOrders.length === 0 && <div className="orders-empty-state"><h3>Không có đơn phù hợp</h3><p>Thử thay đổi bộ lọc hoặc từ khóa.</p></div>}
        </div>
      </div>

      {selected && (
        <div className="modal active orders-modal" onClick={() => setSelected(null)}>
          <div className="modal-dialog modal-lg orders-modal-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-content orders-modal-content">
              <div className="modal-header orders-modal-header">
                <div className="orders-modal-heading">
                  <span className="orders-modal-kicker">Order workspace</span>
                  <h3>Đơn hàng #{selected.id}</h3>
                  <p>{formatDate(selected.createdAt)} · {getOrderItemCount(selected)} sản phẩm</p>
                </div>
                <div className="orders-modal-header-actions">
                  <span className={`status-badge ${STATUS_META[selected.status].tone}`}>
                    <AdminIcon name={STATUS_META[selected.status].icon} /> {STATUS_META[selected.status].label}
                  </span>
                  <button type="button" className="modal-close" onClick={() => setSelected(null)}><AdminIcon name="fa-times" /></button>
                </div>
              </div>

              <div className="modal-body orders-modal-body">
                <div className="orders-modal-summary">
                  <div className="orders-modal-summary-card highlight"><span>Tổng thanh toán</span><strong>{formatCurrency(selected.total)}</strong></div>
                  <div className="orders-modal-summary-card"><span>Thanh toán</span><strong>{getPaymentMeta(selected.paymentMethod).label}</strong></div>
                  <div className="orders-modal-summary-card"><span>Phí vận chuyển</span><strong>{selected.shippingFee === 0 ? 'Miễn phí' : formatCurrency(selected.shippingFee)}</strong></div>
                </div>

                {writableTransitions(selected.status).length > 0 && (
                  <div className="orders-modal-controls">
                    <div className="orders-status-actions">
                      {writableTransitions(selected.status).map((next) => (
                        <button
                          key={next}
                          type="button"
                          className={`orders-status-action tone-${STATUS_META[next].tone}`}
                          disabled={busyOrderId === selected.numericId}
                          onClick={() => void updateStatus(selected, next)}
                        >
                          <AdminIcon name={STATUS_META[next].icon} /> <span>{STATUS_META[next].label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="order-detail-grid">
                  <div className="detail-section">
                    <h4>Thông tin khách hàng</h4>
                    <div className="detail-row"><span className="detail-label">Tên khách</span><span className="detail-value">{selected.customerName}</span></div>
                    <div className="detail-row"><span className="detail-label">Số điện thoại</span><span className="detail-value">{selected.customerPhone}</span></div>
                    <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{selected.customerEmail}</span></div>
                    <div className="detail-row"><span className="detail-label">Địa chỉ</span><span className="detail-value">{selected.customerAddress}</span></div>
                  </div>
                  <div className="detail-section">
                    <h4>Thông tin đơn hàng</h4>
                    <div className="detail-row"><span className="detail-label">Trạng thái</span><span className="detail-value">{STATUS_META[selected.status].label}</span></div>
                    <div className="detail-row"><span className="detail-label">Ngày tạo</span><span className="detail-value">{formatDate(selected.createdAt)}</span></div>
                    <div className="detail-row"><span className="detail-label">Quy tắc</span><span className="detail-value">Admin không tự đặt completed/returned</span></div>
                  </div>
                </div>

                {selected.note && <div className="orders-note-card"><div className="orders-card-kicker">Ghi chú từ khách</div><p>{selected.note}</p></div>}

                <AdminAfterSalesPanel
                  orderId={selected.numericId}
                  onChanged={() => reload(selected.numericId)}
                />

                <div className="order-items">
                  <h4>Sản phẩm trong đơn ({selected.items.length})</h4>
                  {selected.items.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="order-item">
                      <img src={item.image} alt={item.productName} className="item-image" />
                      <div className="item-info">
                        <div className="item-name">{item.productName}</div>
                        <div className="item-variant">{item.color} · {item.size || 'N/A'} · SL {item.quantity}</div>
                        <div className="item-price">{formatCurrency(item.price * item.quantity)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="order-total-summary">
                  <div className="detail-row"><span className="detail-label">Tạm tính</span><span className="detail-value">{formatCurrency(selected.subtotal)}</span></div>
                  <div className="detail-row"><span className="detail-label">Phí ship</span><span className="detail-value">{formatCurrency(selected.shippingFee)}</span></div>
                  {selected.discount > 0 && <div className="detail-row"><span className="detail-label">Giảm giá</span><span className="detail-value">-{formatCurrency(selected.discount)}</span></div>}
                  <div className="detail-row total-row"><span>Tổng cộng</span><span className="grand-total-value">{formatCurrency(selected.total)}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
