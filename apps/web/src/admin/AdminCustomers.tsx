import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminIcon from '../components/admin/AdminIcon';
import { useAdminUi } from '../components/admin/AdminUiProvider';
import { customerApi } from '../services/api';
import type {
  CustomerDTO,
  CustomerOrderStatus,
  CustomerPurchaseAnalyticsDTO,
  CustomerSummaryDTO,
} from '../services/api/customerApi';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatCurrency, formatDate } from '../utils/format';
import toast from 'react-hot-toast';
import {
  getDefaultCareStatus,
  readStoredCustomerProfiles,
  saveStoredCustomerProfiles,
  type CustomerCareStatus,
  type CustomerTier,
} from '../utils/customerProfiles';

interface AdminCustomerView extends CustomerDTO {
  tier: CustomerTier;
  careStatus: CustomerCareStatus;
  note: string;
  tags: string[];
}

const CARE_OPTIONS: Array<{ value: CustomerCareStatus; label: string; detail: string }> = [
  { value: 'new-lead', label: 'Khách mới', detail: 'Cần chào mừng và dẫn dắt mua đơn đầu.' },
  { value: 'following', label: 'Đang chăm sóc', detail: 'Nhóm đang tương tác đều, nên giữ nhịp liên hệ.' },
  { value: 'vip-care', label: 'Chăm sóc VIP', detail: 'Ưu tiên ưu đãi riêng, hỗ trợ nhanh và cá nhân hóa.' },
  { value: 'reactivation', label: 'Kích hoạt lại', detail: 'Khách có dấu hiệu rời bỏ, cần tái tiếp cận.' },
];

const TIER_LABELS: Record<CustomerTier, string> = {
  new: 'Mới',
  regular: 'Thường xuyên',
  vip: 'VIP',
  'at-risk': 'Nguy cơ rời bỏ',
};

const ORDER_STATUS_LABELS: Record<CustomerOrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  returned: 'Đã trả hàng',
};

function deriveCustomerTier(customer: CustomerDTO): CustomerTier {
  if (customer.totalSpent >= 5_000_000 || customer.completedOrders >= 8) {
    return 'vip';
  }

  if (customer.lastCompletedOrderAt) {
    const inactiveDays = (Date.now() - new Date(customer.lastCompletedOrderAt).getTime()) / 86_400_000;
    if (inactiveDays >= 90) {
      return 'at-risk';
    }
  }

  if (customer.createdAt) {
    const accountAgeDays = (Date.now() - new Date(customer.createdAt).getTime()) / 86_400_000;
    if (accountAgeDays <= 30) {
      return 'new';
    }
  }

  return 'regular';
}

function getCareLabel(status: CustomerCareStatus) {
  return CARE_OPTIONS.find((option) => option.value === status)?.label || 'Đang chăm sóc';
}

function getCareDetail(status: CustomerCareStatus) {
  return CARE_OPTIONS.find((option) => option.value === status)?.detail || '';
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'KH';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function AdminCustomers() {
  const [searchParams] = useSearchParams();
  const { confirm, notify } = useAdminUi();
  const [users, setUsers] = useState<CustomerDTO[]>([]);
  const [summary, setSummary] = useState<CustomerSummaryDTO | null>(null);
  const [customersError, setCustomersError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [profiles, setProfiles] = useState(() => readStoredCustomerProfiles());
  const [analyticsByCustomerId, setAnalyticsByCustomerId] = useState<Record<number, CustomerPurchaseAnalyticsDTO>>({});
  const [analyticsLoadingId, setAnalyticsLoadingId] = useState<number | null>(null);
  const [analyticsError, setAnalyticsError] = useState('');
  const [analyticsReloadToken, setAnalyticsReloadToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const searchKeyword = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(searchKeyword);
  const [tierFilter, setTierFilter] = useState<'all' | CustomerTier>('all');
  const [careFilter, setCareFilter] = useState<'all' | CustomerCareStatus>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [detailCareStatus, setDetailCareStatus] = useState<CustomerCareStatus>('following');
  const [detailNote, setDetailNote] = useState('');
  const [detailTags, setDetailTags] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const [response, summaryResponse] = await Promise.all([
        customerApi.getAllCustomers(),
        customerApi.getSummary(),
      ]);

      if (response.success && response.data) {
        setUsers(response.data);
        setCustomersError('');
      } else {
        const message = response.error || 'Không thể tải danh sách khách hàng.';
        setCustomersError(message);
        toast.error(message);
      }

      if (summaryResponse.success && summaryResponse.data) {
        setSummary(summaryResponse.data);
        setSummaryError('');
      } else {
        setSummaryError(summaryResponse.error || 'Không thể tải thống kê khách hàng.');
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      setCustomersError('Không thể kết nối API khách hàng. Kiểm tra Node :5300 và quyền customers.view.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    setSearchTerm(searchKeyword);
  }, [searchKeyword]);

  const customers = useMemo<AdminCustomerView[]>(() => users.map((customer) => {
    const tier = deriveCustomerTier(customer);
    const storedProfile = profiles[customer.email.toLowerCase()];

    return {
      ...customer,
      tier,
      careStatus: storedProfile?.careStatus || getDefaultCareStatus(tier),
      note: storedProfile?.note || '',
      tags: storedProfile?.tags || [],
    };
  }).sort((left, right) => right.totalSpent - left.totalSpent || right.completedOrders - left.completedOrders), [profiles, users]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        customer.name.toLowerCase().includes(normalizedSearch) ||
        customer.email.toLowerCase().includes(normalizedSearch) ||
        customer.phone.includes(normalizedSearch) ||
        customer.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));
      const matchesTier = tierFilter === 'all' || customer.tier === tierFilter;
      const matchesCare = careFilter === 'all' || customer.careStatus === careFilter;

      return matchesSearch && matchesTier && matchesCare;
    });
  }, [careFilter, customers, searchTerm, tierFilter]);

  useEffect(() => {
    if (filteredCustomers.length === 0) {
      setSelectedCustomerId(null);
      return;
    }

    if (!selectedCustomerId || !filteredCustomers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(filteredCustomers[0].id);
    }
  }, [filteredCustomers, selectedCustomerId]);

  const stats = useMemo(
    () => ({
      total: summary?.totalCustomers ?? customers.length,
      vip: customers.filter((customer) => customer.tier === 'vip').length,
      newCustomers: customers.filter((customer) => customer.tier === 'new').length,
      atRisk: customers.filter((customer) => customer.tier === 'at-risk').length,
      repeated: summary?.repeatCustomers ?? customers.filter((customer) => customer.completedOrders >= 2).length,
      withOrders: summary?.customersWithOrders ?? customers.filter((customer) => customer.orderCount > 0).length,
      withoutOrders: summary?.customersWithoutOrders ?? customers.filter((customer) => customer.orderCount === 0).length,
      completedOrders: summary?.completedOrders ?? customers.reduce((sum, customer) => sum + customer.completedOrders, 0),
      cancelledOrders: summary?.cancelledOrders ?? customers.reduce((sum, customer) => sum + customer.cancelledOrders, 0),
      tagged: customers.filter((customer) => customer.tags.length > 0).length,
      noPhone: customers.filter((customer) => !customer.phone).length,
      totalRevenue: summary?.totalRevenue ?? customers.reduce((sum, customer) => sum + customer.totalSpent, 0),
    }),
    [customers, summary],
  );

  const careCounts = useMemo(
    () =>
      CARE_OPTIONS.map((option) => ({
        ...option,
        count: customers.filter((customer) => customer.careStatus === option.value).length,
      })),
    [customers],
  );

  const selectedCustomer =
    (selectedCustomerId && customers.find((customer) => customer.id === selectedCustomerId)) || null;

  const selectedAnalytics = selectedCustomer ? analyticsByCustomerId[selectedCustomer.id] : undefined;
  const selectedAnalyticsLoading = Boolean(selectedCustomer && analyticsLoadingId === selectedCustomer.id);
  const selectedOrders = selectedAnalytics?.orders ?? [];

  useEffect(() => {
    if (!selectedCustomer || analyticsByCustomerId[selectedCustomer.id]) {
      setAnalyticsError('');
      return;
    }

    let cancelled = false;
    const customerId = selectedCustomer.id;
    setAnalyticsLoadingId(customerId);
    setAnalyticsError('');

    void customerApi.getPurchaseAnalytics(customerId).then((response) => {
      if (cancelled) return;
      if (response.success && response.data) {
        setAnalyticsByCustomerId((current) => ({ ...current, [customerId]: response.data! }));
        return;
      }
      setAnalyticsError(response.error || 'Không thể tải lịch sử mua hàng');
    }).catch((error) => {
      if (cancelled) return;
      console.error('Failed to fetch customer analytics:', error);
      setAnalyticsError('Không thể tải lịch sử mua hàng');
    }).finally(() => {
      if (!cancelled) {
        setAnalyticsLoadingId((current) => current === customerId ? null : current);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [analyticsByCustomerId, analyticsReloadToken, selectedCustomer]);

  useEffect(() => {
    if (!selectedCustomer) {
      return;
    }

    setDetailCareStatus(selectedCustomer.careStatus);
    setDetailNote(selectedCustomer.note);
    setDetailTags(selectedCustomer.tags.join(', '));
  }, [selectedCustomer]);

  const selectedProfileUpdatedAt = selectedCustomer
    ? profiles[selectedCustomer.email.toLowerCase()]?.updatedAt
    : undefined;

  const selectedRank = selectedCustomer
    ? customers.findIndex((customer) => customer.id === selectedCustomer.id) + 1
    : 0;

  const selectedRevenueShare = selectedCustomer && stats.totalRevenue > 0
    ? Number(((selectedCustomer.totalSpent / stats.totalRevenue) * 100).toFixed(1))
    : 0;

  const persistProfiles = (
    nextProfiles: ReturnType<typeof readStoredCustomerProfiles>,
    message: string,
  ) => {
    const saved = saveStoredCustomerProfiles(nextProfiles);
    setProfiles(saved);
    notify({ message, tone: 'success' });
  };

  const saveSelectedCustomerProfile = () => {
    if (!selectedCustomer) {
      return;
    }

    const customerKey = selectedCustomer.email.toLowerCase();
    persistProfiles(
      {
        ...profiles,
        [customerKey]: {
          email: selectedCustomer.email,
          careStatus: detailCareStatus,
          note: detailNote.trim(),
          tags: detailTags.split(',').map((tag) => tag.trim()).filter(Boolean),
          updatedAt: new Date().toISOString(),
        },
      },
      'Đã lưu hồ sơ chăm sóc khách hàng.',
    );
  };

  const handleToggleStatus = async (customer: AdminCustomerView) => {
    const locking = customer.isActive;
    const accepted = await confirm({
      title: locking ? 'Khóa tài khoản khách hàng' : 'Mở khóa tài khoản khách hàng',
      message: locking
        ? `Tài khoản ${customer.name} sẽ bị khóa. Bạn có thể mở khóa lại sau.`
        : `Tài khoản ${customer.name} sẽ được kích hoạt lại.`,
      confirmLabel: locking ? 'Khóa tài khoản' : 'Mở khóa',
      tone: locking ? 'danger' : 'success',
      icon: locking ? 'fa-user-slash' : 'fa-check-circle',
    });

    if (!accepted) {
      return;
    }

    try {
      const response = await customerApi.toggleStatus(customer.id);
      
      if (response.success) {
        notify({ message: 'Đã cập nhật trạng thái khách hàng.', tone: 'success' });
        await fetchCustomers();
      } else {
        notify({ message: response.error || 'Không thể cập nhật trạng thái.', tone: 'error' });
      }
    } catch (error) {
      console.error('Failed to toggle customer status:', error);
      notify({ message: 'Không thể cập nhật trạng thái khách hàng.', tone: 'error' });
    }
  };

  return (
    <div className="customers-admin-page customers-concierge-page">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="customers-concierge-shell">
        <aside className="customers-sideboard">
          <section className="customers-brand-card">
            {customersError ? (
              <div role="alert" className="customers-dossier-empty">
                <strong>Không tải được dữ liệu khách hàng</strong>
                <p>{customersError}</p>
                <button type="button" className="customers-ghost-btn" onClick={() => void fetchCustomers()}>Thử tải lại</button>
              </div>
            ) : null}
            <span className="customers-overline">Quản lý khách hàng</span>
            <h1>Khách hàng</h1>
            <p>
              Quản lý tệp khách, lọc phân khúc và mở nhanh hồ sơ chăm sóc trên cùng một màn hình.
            </p>
          </section>

          <section className="customers-side-panel customers-snapshot-panel">
            <div className="customers-side-head">
              <span className="customers-overline">Tổng quan</span>
              <strong>{stats.total} hồ sơ</strong>
            </div>

            <div className="customers-stat-stack">
              <article className="customers-stat-card">
                <div className="customers-stat-icon"><AdminIcon name="fa-users" /></div>
                <div><span>Tổng khách hàng</span><strong>{stats.total}</strong></div>
              </article>
              <article className="customers-stat-card">
                <div className="customers-stat-icon is-vip"><AdminIcon name="fa-star" /></div>
                <div><span>Khách VIP</span><strong>{stats.vip}</strong></div>
              </article>
              <article className="customers-stat-card">
                <div className="customers-stat-icon is-new"><AdminIcon name="fa-user-plus" /></div>
                <div><span>Khách mới</span><strong>{stats.newCustomers}</strong></div>
              </article>
              <article className="customers-stat-card">
                <div className="customers-stat-icon is-risk"><AdminIcon name="fa-refresh" /></div>
                <div><span>Cần kích hoạt lại</span><strong>{stats.atRisk}</strong></div>
              </article>
            </div>

            <div className="customers-money-block">
              <span className="customers-overline">Tổng chi tiêu</span>
              <strong>{formatCurrency(stats.totalRevenue)}</strong>
              <p>Doanh thu chỉ tính từ đơn đã hoàn thành.</p>
              <p>{stats.repeated} khách mua lại, {stats.tagged} hồ sơ có gắn tag.</p>
            </div>

            {summaryError ? (
              <div className="customers-mini-note" role="alert">
                <span>{summaryError} Đang dùng số liệu danh sách đã tải.</span>
                <button type="button" className="customers-ghost-btn" onClick={() => void fetchCustomers()}>Thử lại</button>
              </div>
            ) : null}
            <div className="customers-detail-list">
              <div><span>Khách đã đặt hàng</span><strong>{stats.withOrders}</strong></div>
              <div><span>Khách chưa đặt hàng</span><strong>{stats.withoutOrders}</strong></div>
              <div><span>Đơn hoàn thành</span><strong>{stats.completedOrders}</strong></div>
              <div><span>Đơn đã hủy</span><strong>{stats.cancelledOrders}</strong></div>
            </div>
          </section>

          <section className="customers-side-panel customers-filter-panel">
            <div className="customers-side-head">
              <span className="customers-overline">Bộ lọc</span>
              <strong>Lọc & tìm nhanh</strong>
            </div>

            <label className="customers-field">
              <span>Tìm kiếm</span>
              <div className="customers-search-wrap">
                <AdminIcon name="fa-search" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tên, email, số điện thoại, tag..."
                />
              </div>
            </label>

            <label className="customers-field">
              <span>Phân nhóm</span>
              <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value as 'all' | CustomerTier)}>
                <option value="all">Tất cả phân nhóm</option>
                {Object.entries(TIER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="customers-field">
              <span>Chăm sóc</span>
              <select value={careFilter} onChange={(event) => setCareFilter(event.target.value as 'all' | CustomerCareStatus)}>
                <option value="all">Tất cả trạng thái</option>
                {CARE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <div className="customers-mini-note">
              <strong>{filteredCustomers.length}</strong>
              <span>khách phù hợp bộ lọc hiện tại</span>
            </div>
          </section>

          <section className="customers-side-panel customers-care-panel">
            <div className="customers-side-head">
              <span className="customers-overline">Nhịp chăm sóc</span>
              <strong>Nhịp chăm sóc</strong>
            </div>

            <div className="customers-care-list">
              {careCounts.map((item) => (
                <div key={item.value} className="customers-care-row">
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <span>{item.count}</span>
                </div>
              ))}
            </div>

            <div className="customers-side-footnote">
              <AdminIcon name="fa-circle-info" />
              <span>{stats.noPhone} khách chưa có số điện thoại để chăm sóc trực tiếp.</span>
            </div>
          </section>
        </aside>

        <section className="customers-roster-stage">
          <div className="customers-stage-head">
            <div>
              <span className="customers-overline">Danh sách</span>
              <h2>Danh sách khách hàng</h2>
              <p>Chọn một hồ sơ để mở panel chăm sóc chi tiết ở bên phải.</p>
            </div>
            <div className="customers-stage-badges">
              <span>{filteredCustomers.length} kết quả</span>
              <span>{stats.repeated} khách quay lại</span>
            </div>
          </div>

          <div className="customers-roster-list">
            {filteredCustomers.length === 0 ? (
              <div className="customers-roster-empty">
                <div className="customers-roster-empty-icon">
                  <AdminIcon name="fa-users" />
                </div>
                <strong>Không có khách hàng phù hợp</strong>
                <p>Hãy thử nới bộ lọc hoặc tìm với từ khóa ngắn hơn để xem thêm hồ sơ.</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const isSelected = selectedCustomerId === customer.id;

                return (
                  <article
                    key={customer.email}
                    className={`customers-roster-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedCustomerId(customer.id)}
                  >
                    <div className="customers-roster-main">
                      <div className="customers-roster-avatar">{getInitials(customer.name)}</div>

                      <div className="customers-roster-copy">
                        <div className="customers-roster-topline">
                          <h3>{customer.name}</h3>
                          <div className="customers-pill-row">
                            <span className={`customer-tier-pill ${customer.tier}`}>{TIER_LABELS[customer.tier]}</span>
                            <span className={`customer-care-pill ${customer.careStatus}`}>{getCareLabel(customer.careStatus)}</span>
                          </div>
                        </div>

                        <div className="customers-meta-line">
                          <span>{customer.email}</span>
                          <span>{customer.phone || 'Chưa có số điện thoại'}</span>
                          <span>{customer.lastOrderAt ? `Mua gần nhất ${formatDate(customer.lastOrderAt)}` : 'Chưa có đơn hàng'}</span>
                        </div>

                        <div className="customers-metric-grid">
                          <div>
                            <span>Tổng chi tiêu</span>
                            <strong>{formatCurrency(customer.totalSpent)}</strong>
                          </div>
                          <div>
                            <span>Đơn hàng</span>
                            <strong>{customer.orderCount}</strong>
                          </div>
                          <div>
                            <span>Đơn hoàn thành</span>
                            <strong>{customer.completedOrders}</strong>
                          </div>
                          <div>
                            <span>Giá trị TB</span>
                            <strong>{formatCurrency(customer.averageOrderValue)}</strong>
                          </div>
                        </div>

                        {customer.tags.length > 0 ? (
                          <div className="customers-tag-strip">
                            {customer.tags.map((tag) => (
                              <span key={tag} className="customers-tag-chip">{tag}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="customers-roster-actions">
                      <button type="button" className="customers-card-btn" onClick={(event) => {
                        event.stopPropagation();
                        setSelectedCustomerId(customer.id);
                      }}>
                        <AdminIcon name="fa-eye" />
                        <span>Mở hồ sơ</span>
                      </button>
                      <button type="button" className={`customers-card-btn ${customer.isActive ? 'is-danger' : ''}`} onClick={(event) => {
                        event.stopPropagation();
                        void handleToggleStatus(customer);
                      }}>
                        <AdminIcon name={customer.isActive ? 'fa-ban' : 'fa-check-circle'} />
                        <span>{customer.isActive ? 'Khóa' : 'Mở khóa'}</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <aside className="customers-dossier">
          {selectedCustomer ? (
            <>
              <section className="customers-dossier-hero">
                <div className="customers-dossier-avatar">{getInitials(selectedCustomer.name)}</div>
                <div className="customers-dossier-copy">
                  <span className="customers-overline">Hồ sơ khách hàng</span>
                  <h2>{selectedCustomer.name}</h2>
                  <p>{selectedCustomer.email} • {selectedCustomer.phone || 'Chưa có số điện thoại'}</p>
                  <div className="customers-pill-row">
                    <span className={`customer-tier-pill ${selectedCustomer.tier}`}>{TIER_LABELS[selectedCustomer.tier]}</span>
                    <span className={`customer-care-pill ${selectedCustomer.careStatus}`}>{getCareLabel(selectedCustomer.careStatus)}</span>
                  </div>
                </div>
              </section>

              <section className="customers-dossier-card">
                <div className="customers-dossier-head">
                  <div>
                    <span className="customers-overline">Tổng quan</span>
                    <h3>Tổng quan hồ sơ</h3>
                  </div>
                  <span className="customers-rank-badge">#{selectedRank || '--'} theo doanh thu</span>
                </div>

                <div className="customers-dossier-metrics">
                  <article><span>Tổng chi tiêu</span><strong>{formatCurrency(selectedCustomer.totalSpent)}</strong></article>
                  <article><span>Đơn hàng</span><strong>{selectedCustomer.orderCount}</strong></article>
                  <article><span>Đơn hoàn thành</span><strong>{selectedCustomer.completedOrders}</strong></article>
                  <article><span>Tỷ trọng doanh thu</span><strong>{selectedRevenueShare}%</strong></article>
                </div>

                <div className="customers-detail-list">
                  <div><span>Đơn đầu tiên</span><strong>{selectedCustomer.firstOrderAt ? formatDate(selectedCustomer.firstOrderAt) : '--'}</strong></div>
                  <div><span>Đơn gần nhất</span><strong>{selectedCustomer.lastOrderAt ? formatDate(selectedCustomer.lastOrderAt) : '--'}</strong></div>
                  <div><span>Trạng thái gần nhất</span><strong>{selectedCustomer.lastOrderStatus ? ORDER_STATUS_LABELS[selectedCustomer.lastOrderStatus] : 'Chưa có'}</strong></div>
                  <div><span>Tham gia</span><strong>{selectedCustomer.createdAt ? formatDate(selectedCustomer.createdAt) : '--'}</strong></div>
                  <div><span>Lần cập nhật hồ sơ</span><strong>{selectedProfileUpdatedAt ? formatDate(selectedProfileUpdatedAt) : 'Chưa cập nhật'}</strong></div>
                </div>
              </section>

              <section className="customers-dossier-card">
                <div className="customers-dossier-head">
                  <div>
                    <span className="customers-overline">Chăm sóc</span>
                    <h3>Chăm sóc & ghi chú</h3>
                  </div>
                </div>

                <label className="customers-field">
                  <span>Trạng thái chăm sóc</span>
                  <select value={detailCareStatus} onChange={(event) => setDetailCareStatus(event.target.value as CustomerCareStatus)}>
                    {CARE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <small>{getCareDetail(detailCareStatus)}</small>
                </label>

                <label className="customers-field">
                  <span>Tags nội bộ</span>
                  <input
                    value={detailTags}
                    onChange={(event) => setDetailTags(event.target.value)}
                    placeholder="vip, quay lại, cần gọi lại"
                  />
                </label>

                <label className="customers-field">
                  <span>Ghi chú chăm sóc</span>
                  <textarea
                    rows={5}
                    value={detailNote}
                    onChange={(event) => setDetailNote(event.target.value)}
                    placeholder="Ghi chú về nhu cầu, ưu tiên, phản hồi, dịp cần liên hệ lại..."
                  />
                </label>

                <div className="customers-dossier-actions">
                  <button type="button" className="customers-primary-btn" onClick={saveSelectedCustomerProfile}>
                    <AdminIcon name="fa-save" />
                    <span>Lưu hồ sơ</span>
                  </button>
                  <button type="button" className={`customers-ghost-btn ${selectedCustomer.isActive ? 'is-danger' : ''}`} onClick={() => void handleToggleStatus(selectedCustomer)}>
                    <AdminIcon name={selectedCustomer.isActive ? 'fa-ban' : 'fa-check-circle'} />
                    <span>{selectedCustomer.isActive ? 'Khóa khách hàng' : 'Mở khóa khách hàng'}</span>
                  </button>
                </div>
              </section>

              <section className="customers-dossier-card">
                <div className="customers-dossier-head">
                  <div>
                    <span className="customers-overline">Sở thích</span>
                    <h3>Sở thích & danh mục</h3>
                  </div>
                </div>

                {selectedAnalyticsLoading ? (
                  <div className="customers-dossier-empty"><p>Đang tải dữ liệu mua hàng...</p></div>
                ) : analyticsError ? (
                  <div className="customers-dossier-empty">
                    <p>{analyticsError}</p>
                    <button type="button" className="customers-ghost-btn" onClick={() => setAnalyticsReloadToken((value) => value + 1)}>
                      Thử lại
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="customers-interest-block">
                      <span>Danh mục mua nhiều</span>
                      <div className="customer-tag-list">
                        {(selectedAnalytics?.topCategories.length ? selectedAnalytics.topCategories : ['Chưa có dữ liệu']).map((category) => (
                          <span key={category} className="customer-tag">{category}</span>
                        ))}
                      </div>
                    </div>

                    <div className="customers-interest-block">
                      <span>Sản phẩm mua nhiều</span>
                      <div className="customer-tag-list">
                        {(selectedAnalytics?.purchasedProducts.length ? selectedAnalytics.purchasedProducts : ['Chưa có dữ liệu']).map((product) => (
                          <span key={product} className="customer-tag subtle">{product}</span>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedCustomer.tags.length > 0 ? (
                  <div className="customers-interest-block">
                    <span>Tags đã lưu</span>
                    <div className="customer-tag-list">
                      {selectedCustomer.tags.map((tag) => (
                        <span key={tag} className="customer-tag info">{tag}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="customers-dossier-card">
                <div className="customers-dossier-head">
                  <div>
                    <span className="customers-overline">Lịch sử đơn</span>
                    <h3>Lịch sử đơn hàng</h3>
                  </div>
                </div>

                {selectedAnalyticsLoading ? (
                  <div className="customers-dossier-empty"><p>Đang tải lịch sử đơn hàng...</p></div>
                ) : analyticsError ? (
                  <div className="customers-dossier-empty"><p>{analyticsError}</p></div>
                ) : selectedOrders.length === 0 ? (
                  <div className="customers-dossier-empty">
                    <AdminIcon name="fa-shopping-bag" />
                    <p>Khách hàng này chưa có đơn hàng nào.</p>
                  </div>
                ) : (
                  <div className="customer-order-list">
                    {selectedOrders.map((order) => (
                      <article key={order.id} className="customer-order-item">
                        <div>
                          <strong>{order.orderCode || `#${order.id}`}</strong>
                          <span>{formatDate(order.createdAt)} • {order.itemCount} sản phẩm</span>
                        </div>
                        <div className="customer-order-meta">
                          <span className={`customer-order-status ${order.status}`}>{ORDER_STATUS_LABELS[order.status]}</span>
                          <strong>{formatCurrency(order.total)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="customers-dossier-empty">
              <AdminIcon name="fa-user" />
              <strong>Chưa có hồ sơ nào được chọn</strong>
              <p>Hãy chọn một khách hàng trong danh sách để mở dossier chăm sóc chi tiết.</p>
            </section>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}
