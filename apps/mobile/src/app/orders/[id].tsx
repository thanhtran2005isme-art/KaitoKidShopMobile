import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { AppIcon } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { resolveMediaUrl } from '@/services/api-client';
import { ordersApi } from '@/services/orders.api';
import type { CustomerOrder } from '@/types/orders';
import {
  afterSalesStatusMeta,
  canResumeAtmPayment,
  formatDateTime,
  formatMoney,
  paymentLabel,
  shippingStatusMeta,
} from '@/utils/order-status';

type OrderAction =
  | 'cancel'
  | 'reorder'
  | 'confirm-received'
  | 'report-not-received'
  | 'return-request';

type DeliveryDecision = 'confirm-received' | 'report-not-received';

const LALAMOVE_POLL_MS = 10_000;
const LALAMOVE_TERMINAL_SHIPPING_STATUSES = new Set([
  'delivered',
  'completed',
  'received_by_customer',
  'delivery_disputed',
  'returned',
  'carrier_cancelled',
  'cancelled',
  'failed',
]);

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function shouldPollLalamove(order: CustomerOrder | null) {
  if (!order) return false;
  if ((order.shippingProvider || '').toLowerCase() !== 'lalamove') return false;
  if (!order.trackingCode) return false;
  if (['cancelled', 'completed', 'returned'].includes((order.status || '').toLowerCase())) return false;
  return !LALAMOVE_TERMINAL_SHIPPING_STATUSES.has((order.shippingStatus || '').toLowerCase());
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const orderId = Number(rawId);

  const { token, loading: authLoading } = useAuth();
  const { refreshCart } = useShopping();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionBusy, setActionBusy] = useState<OrderAction | null>(null);
  const [deliveryDecision, setDeliveryDecision] = useState<DeliveryDecision | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const deliverySubmissionLock = useRef(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const livePollInFlight = useRef(false);

  const loadOrder = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!token || !Number.isInteger(orderId) || orderId <= 0) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        setOrder(await ordersApi.getOrder(token, orderId));
      } catch (loadError) {
        setError(messageFrom(loadError, 'Không thể tải chi tiết đơn hàng.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId, token],
  );

  useEffect(() => {
    if (!authLoading) void loadOrder('initial');
  }, [authLoading, loadOrder]);

  useEffect(() => {
    if (!token || actionBusy || !shouldPollLalamove(order)) return;

    let disposed = false;
    const syncLiveLalamove = async () => {
      if (
        disposed ||
        livePollInFlight.current ||
        AppState.currentState !== 'active' ||
        !order
      ) return;

      livePollInFlight.current = true;
      try {
        await ordersApi.getTracking(token, order.orderCode);
        if (disposed) return;
        const nextOrder = await ordersApi.getOrder(token, order.id);
        if (!disposed) setOrder(nextOrder);
      } catch {
        // Webhook là nguồn chính; giữ dữ liệu và lỗi thao tác hiện có nếu fallback thất bại.
      } finally {
        livePollInFlight.current = false;
      }
    };

    const interval = setInterval(() => void syncLiveLalamove(), LALAMOVE_POLL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncLiveLalamove();
    });
    return () => {
      disposed = true;
      clearInterval(interval);
      subscription.remove();
    };
  }, [actionBusy, order, token]);

  const cancelOrder = () => {
    if (!token || !order || !order.canCancel || actionBusy) return;

    Alert.alert(
      'Hủy đơn hàng?',
      'KaitoKid sẽ hoàn tồn kho và cập nhật đơn sang trạng thái đã hủy. Thao tác này không thể hoàn tác.',
      [
        { text: 'Giữ đơn', style: 'cancel' },
        {
          text: 'Hủy đơn',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setActionBusy('cancel');
              setError(null);
              try {
                await ordersApi.cancelOrder(token, order.id);
                await loadOrder('refresh');
              } catch (cancelError) {
                setError(
                  messageFrom(
                    cancelError,
                    'Không thể hủy đơn ở trạng thái hiện tại.',
                  ),
                );
              } finally {
                setActionBusy(null);
              }
            })();
          },
        },
      ],
    );
  };

  const openDeliveryDecision = (decision: DeliveryDecision) => {
    if (!token || !order || actionBusy || deliverySubmissionLock.current) return;
    if (decision === 'confirm-received' && !order.canConfirmReceived) return;
    if (decision === 'report-not-received' && !order.canReportNotReceived) return;
    setError(null);
    setDeliveryDecision(decision);
  };

  const submitDeliveryDecision = async () => {
    if (!token || !order || !deliveryDecision || actionBusy || deliverySubmissionLock.current) return;

    const decision = deliveryDecision;
    // Backend là nguồn sự thật cuối cùng; kiểm tra lại quyền từ đơn đang hiển thị.
    if (decision === 'confirm-received' && !order.canConfirmReceived) return;
    if (decision === 'report-not-received' && !order.canReportNotReceived) return;

    deliverySubmissionLock.current = true;
    setActionBusy(decision);
    setActionNotice(null);
    setError(null);

    try {
      const result = decision === 'confirm-received'
        ? await ordersApi.confirmReceived(token, order.id)
        : await ordersApi.reportNotReceived(token, order.id);
      setDeliveryDecision(null);
      setActionNotice(
        decision === 'confirm-received' && result.returnDeadline
          ? 'Đã xác nhận nhận hàng. Có thể yêu cầu hoàn hàng đến ' +
            formatDateTime(result.returnDeadline) + '.'
          : result.message,
      );
      // Đồng bộ quyền thao tác và trạng thái từ API thật.
      try {
        setOrder(await ordersApi.getOrder(token, order.id));
      } catch (refreshError) {
        setError(
          'Đã ghi nhận thao tác, nhưng chưa tải lại được trạng thái đơn. ' +
            messageFrom(refreshError, 'Vui lòng kéo xuống để làm mới.'),
        );
      }
    } catch (actionError) {
      setDeliveryDecision(null);
      setError(
        messageFrom(
          actionError,
          decision === 'confirm-received'
            ? 'Không thể xác nhận đã nhận hàng.'
            : 'Không thể gửi báo cáo chưa nhận hàng.',
        ),
      );
    } finally {
      deliverySubmissionLock.current = false;
      setActionBusy(null);
    }
  };

  const submitReturnRequest = async () => {
    if (!token || !order || !order.canRequestReturn || actionBusy) return;

    const reason = returnReason.trim();
    if (reason.length < 5) {
      setError('Vui lòng mô tả lỗi hoặc lý do hoàn hàng ít nhất 5 ký tự.');
      return;
    }

    setActionBusy('return-request');
    setError(null);
    try {
      const result = await ordersApi.requestReturn(token, order.id, reason);
      setReturnReason('');
      setShowReturnForm(false);
      await loadOrder('refresh');
      Alert.alert('Đã gửi yêu cầu hoàn hàng', result.message);
    } catch (actionError) {
      setError(messageFrom(actionError, 'Không thể gửi yêu cầu hoàn hàng.'));
    } finally {
      setActionBusy(null);
    }
  };

  const reorder = async () => {
    if (!token || !order || actionBusy) return;

    setActionBusy('reorder');
    setError(null);

    try {
      const result = await ordersApi.reorder(token, order.id);
      await refreshCart();

      const skippedPreview = result.skippedNames.slice(0, 3).join(', ');
      const skippedText =
        result.skipped > 0
          ? '\nBỏ qua ' +
            result.skipped +
            ' sản phẩm' +
            (skippedPreview ? ': ' + skippedPreview : '') +
            (result.skippedNames.length > 3 ? '…' : '')
          : '';

      if (result.added > 0) {
        Alert.alert(
          'Đã thêm lại vào giỏ',
          'Đã thêm ' +
            result.added +
            ' sản phẩm từ đơn cũ.' +
            skippedText +
            '\n\nHãy kiểm tra lại size, màu và tồn kho trước khi checkout.',
          [
            { text: 'Ở lại', style: 'cancel' },
            {
              text: 'Mở giỏ hàng',
              onPress: () => router.push('/cart'),
            },
          ],
        );
      } else {
        Alert.alert(
          'Chưa thể mua lại',
          'Không có sản phẩm nào từ đơn này có thể thêm vào giỏ lúc này.' +
            skippedText,
        );
      }
    } catch (reorderError) {
      setError(
        messageFrom(
          reorderError,
          'Không thể thêm lại sản phẩm từ đơn này.',
        ),
      );
    } finally {
      setActionBusy(null);
    }
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang tải chi tiết đơn</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Bạn cần đăng nhập</Text>
          <Text style={styles.stateText}>
            Chi tiết đơn hàng chỉ hiển thị cho chính chủ tài khoản.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: '/auth/login',
                params: { redirect: '/orders' },
              })
            }
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!Number.isInteger(orderId) || orderId <= 0 || (!order && !error)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Đơn hàng không hợp lệ</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/orders')}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Về danh sách đơn</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Không tìm thấy đơn hàng</Text>
          <Text style={styles.stateText}>
            Đơn không tồn tại hoặc không thuộc tài khoản hiện tại.
          </Text>
          {error ? <Text style={styles.centerError}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadOrder('initial')}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/orders')}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Về danh sách đơn</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const shippingMeta = shippingStatusMeta(order.shippingStatus);
  const afterSalesMeta = afterSalesStatusMeta(order);
  const canResumePayment = canResumeAtmPayment(order);
  const showAfterSales =
    Boolean(order.canConfirmReceived) ||
    Boolean(order.canReportNotReceived) ||
    Boolean(order.deliveryIssueReported) ||
    Boolean(order.customerReceiptConfirmed) ||
    Boolean(order.canRequestReturn) ||
    Boolean(afterSalesMeta);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={BRAND_COLORS.primary}
              onRefresh={() => void loadOrder('refresh')}
            />
          }
          contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Quay lại danh sách đơn hàng"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.replace('/orders')}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}>
              <AppIcon color={BRAND_COLORS.ink} name="arrowLeft" size={22} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>CHI TIẾT ĐƠN HÀNG</Text>
              <Text style={styles.title}>{order.orderCode}</Text>
              <Text style={styles.subtitle}>
                {'Đặt lúc ' + formatDateTime(order.createdAt)}
              </Text>
            </View>
            <OrderStatusBadge status={order.status} />
          </View>

          {error ? (
            <View style={styles.errorCard} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {actionNotice ? (
            <View style={[styles.noticeCard, styles.noticeSuccess]} accessibilityRole="alert">
              <Text style={styles.noticeText}>{actionNotice}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionKicker}>TRẠNG THÁI</Text>
                <Text style={styles.sectionTitle}>Xử lý & vận chuyển</Text>
              </View>
              <OrderStatusBadge
                kind="shipping"
                status={order.shippingStatus}
              />
            </View>

            <View style={styles.statusSummary}>
              <Text style={styles.statusLabel}>Vận chuyển hiện tại</Text>
              <Text style={styles.statusValue}>{shippingMeta.label}</Text>
            </View>

            {order.trackingCode ? (
              <SummaryRow label="Mã vận đơn" value={order.trackingCode} />
            ) : null}
            {order.shippingProvider ? (
              <SummaryRow
                label="Nhà vận chuyển"
                value={order.shippingProvider.toUpperCase()}
              />
            ) : null}
            {order.shippingServiceCode ? (
              <SummaryRow
                label="Dịch vụ"
                value={order.shippingServiceCode}
              />
            ) : null}

            <Pressable
              accessibilityLabel="Theo dõi vận chuyển của đơn hàng"
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/orders/[id]/tracking',
                  params: { id: String(order.id) },
                })
              }
              style={({ pressed }) => [
                styles.trackButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.trackButtonText}>Theo dõi hành trình</Text>
              <AppIcon color={BRAND_COLORS.primary} name="chevronRight" size={20} />
            </Pressable>
          </View>

          {showAfterSales ? (
            <View style={styles.section}>
              <Text style={styles.sectionKicker}>SAU GIAO HÀNG</Text>
              <Text style={styles.sectionTitle}>Xác nhận & hậu mãi</Text>

              {order.deliveryIssueReported ? (
                <View style={[styles.noticeCard, styles.noticeDanger]}>
                  <Text style={styles.noticeTitle}>Đã báo chưa nhận được hàng</Text>
                  <Text style={styles.noticeText}>
                    KaitoKid sẽ đối soát với đơn vị vận chuyển. Nếu sau đó bạn nhận được hàng, hãy xác nhận bên dưới.
                  </Text>
                </View>
              ) : null}

              {order.customerReceiptConfirmed ? (
                <View style={[styles.noticeCard, styles.noticeSuccess]}>
                  <Text style={styles.noticeTitle}>Bạn đã xác nhận nhận hàng</Text>
                  <Text style={styles.noticeText}>
                    {order.receivedAt
                      ? 'Xác nhận lúc ' + formatDateTime(order.receivedAt) + '.'
                      : 'Mốc nhận hàng đã được backend xác nhận.'}
                  </Text>
                  {order.returnDeadline ? (
                    <Text style={styles.noticeText}>
                      {'Có thể yêu cầu hoàn hàng nếu có lỗi đến ' +
                        formatDateTime(order.returnDeadline) +
                        '.'}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {afterSalesMeta ? (
                <View
                  style={[
                    styles.noticeCard,
                    afterSalesMeta.tone === 'success'
                      ? styles.noticeSuccess
                      : afterSalesMeta.tone === 'danger'
                        ? styles.noticeDanger
                        : afterSalesMeta.tone === 'info'
                          ? styles.noticeInfo
                          : styles.noticeWarning,
                  ]}>
                  <Text style={styles.noticeTitle}>{afterSalesMeta.label}</Text>
                  <Text style={styles.noticeText}>{afterSalesMeta.description}</Text>
                </View>
              ) : null}

              {order.canConfirmReceived ? (
                <Pressable
                  accessibilityLabel="Xác nhận đã nhận hàng"
                  accessibilityRole="button"
                  disabled={actionBusy !== null}
                  onPress={() => openDeliveryDecision('confirm-received')}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    pressed && styles.pressed,
                    actionBusy !== null && styles.disabled,
                  ]}>
                  {actionBusy === 'confirm-received' ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryActionText}>Đã nhận hàng</Text>
                  )}
                </Pressable>
              ) : null}

              {order.canReportNotReceived ? (
                <Pressable
                  accessibilityLabel="Báo chưa nhận được hàng"
                  accessibilityRole="button"
                  disabled={actionBusy !== null}
                  onPress={() => openDeliveryDecision('report-not-received')}
                  style={({ pressed }) => [
                    styles.cancelAction,
                    pressed && styles.pressed,
                    actionBusy !== null && styles.disabled,
                  ]}>
                  {actionBusy === 'report-not-received' ? (
                    <ActivityIndicator color={BRAND_COLORS.danger} />
                  ) : (
                    <Text style={styles.cancelActionText}>Chưa nhận được hàng</Text>
                  )}
                </Pressable>
              ) : null}

              {order.canRequestReturn ? (
                <>
                  <Pressable
                    accessibilityLabel="Mở form yêu cầu hoàn hàng"
                    accessibilityRole="button"
                    disabled={actionBusy !== null}
                    onPress={() => setShowReturnForm((current) => !current)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.pressed,
                      actionBusy !== null && styles.disabled,
                    ]}>
                    <Text style={styles.secondaryButtonText}>
                      {showReturnForm ? 'Đóng yêu cầu hoàn hàng' : 'Yêu cầu hoàn hàng trong 7 ngày'}
                    </Text>
                  </Pressable>

                  {showReturnForm ? (
                    <View style={styles.returnForm}>
                      <Text style={styles.returnLabel}>Lý do hoàn hàng *</Text>
                      <TextInput
                        accessibilityLabel="Lý do hoàn hàng"
                        maxLength={500}
                        multiline
                        onChangeText={(value) => {
                          setReturnReason(value);
                          if (error) setError(null);
                        }}
                        placeholder="Ví dụ: sản phẩm lỗi đường may, sai hàng, hư hỏng khi nhận..."
                        placeholderTextColor="#9CA3AF"
                        style={styles.returnInput}
                        textAlignVertical="top"
                        value={returnReason}
                      />
                      <Text style={styles.returnCounter}>{returnReason.length}/500</Text>
                      <Pressable
                        accessibilityLabel="Gửi yêu cầu hoàn hàng"
                        accessibilityRole="button"
                        disabled={actionBusy !== null}
                        onPress={() => void submitReturnRequest()}
                        style={({ pressed }) => [
                          styles.primaryAction,
                          pressed && styles.pressed,
                          actionBusy !== null && styles.disabled,
                        ]}>
                        {actionBusy === 'return-request' ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryActionText}>Gửi yêu cầu hoàn hàng</Text>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionKicker}>SẢN PHẨM</Text>
            <Text style={styles.sectionTitle}>
              {'Sản phẩm trong đơn (' +
                order.items.reduce((sum, item) => sum + item.quantity, 0) +
                ')'}
            </Text>

            <View style={styles.itemList}>
              {order.items.map((item, index) => (
                <View
                  key={item.productId + ':' + index}
                  style={styles.itemRow}>
                  <Image
                    accessibilityLabel={item.productName}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    source={resolveMediaUrl(item.productImage)}
                    style={styles.itemImage}
                  />
                  <View style={styles.itemCopy}>
                    <Text numberOfLines={2} style={styles.itemName}>
                      {item.productName}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {'Size ' +
                        item.size +
                        ' · ' +
                        item.color +
                        ' · SL ' +
                        item.quantity}
                    </Text>
                    {order.canReview === true ? (
                      item.hasReviewed ? (
                        <Text style={[styles.reviewMeta, styles.reviewMetaDone]}>
                          Đã đánh giá
                        </Text>
                      ) : (
                        <Pressable
                          accessibilityLabel={'Viết đánh giá cho ' + item.productName}
                          accessibilityRole="button"
                          onPress={() =>
                            router.push({
                              pathname: '/review/create',
                              params: {
                                orderId: String(order.id),
                                productId: String(item.productId),
                                size: item.size,
                                color: item.color,
                              },
                            })
                          }
                          style={({ pressed }) => [
                            styles.reviewButton,
                            pressed && styles.pressed,
                          ]}>
                          <Text style={styles.reviewButtonText}>Viết đánh giá</Text>
                        </Pressable>
                      )
                    ) : null}
                  </View>
                  <Text style={styles.itemPrice}>
                    {formatMoney(item.price * item.quantity)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker}>NGƯỜI NHẬN</Text>
            <Text style={styles.sectionTitle}>Thông tin giao hàng</Text>
            <SummaryRow label="Họ tên" value={order.customerName} />
            <SummaryRow label="Điện thoại" value={order.customerPhone} />
            <View style={styles.longRow}>
              <Text style={styles.summaryLabel}>Địa chỉ</Text>
              <Text style={styles.longValue}>{order.customerAddress}</Text>
            </View>
            {order.note ? (
              <View style={styles.longRow}>
                <Text style={styles.summaryLabel}>Ghi chú</Text>
                <Text style={styles.longValue}>{order.note}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker}>THANH TOÁN</Text>
            <Text style={styles.sectionTitle}>Trạng thái thanh toán</Text>
            <SummaryRow
              label="Phương thức"
              value={
                order.paymentMethod.toUpperCase() === 'ATM'
                  ? 'Chuyển khoản / VietQR'
                  : 'Thanh toán khi nhận hàng'
              }
            />
            <SummaryRow label="Trạng thái" value={paymentLabel(order)} />
            {order.paidAt ? (
              <SummaryRow
                label="Thanh toán lúc"
                value={formatDateTime(order.paidAt)}
              />
            ) : null}

            {canResumePayment ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/checkout/payment',
                    params: { orderCode: order.orderCode },
                  })
                }
                style={({ pressed }) => [
                  styles.paymentButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.paymentButtonText}>
                  Tiếp tục thanh toán
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker}>TỔNG KẾT</Text>
            <Text style={styles.sectionTitle}>Chi tiết thanh toán</Text>
            <SummaryRow label="Tạm tính" value={formatMoney(order.subtotal)} />
            <SummaryRow
              label="Phí vận chuyển"
              value={formatMoney(order.shippingFee)}
            />
            {order.discount > 0 ? (
              <SummaryRow
                label={order.couponCode ? 'Ưu đãi / ' + order.couponCode : 'Ưu đãi'}
                value={'−' + formatMoney(order.discount)}
                success
              />
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tổng thanh toán</Text>
              <Text style={styles.totalValue}>{formatMoney(order.total)}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Mua lại sản phẩm từ đơn này"
              accessibilityRole="button"
              disabled={actionBusy !== null}
              onPress={() => void reorder()}
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.pressed,
                actionBusy !== null && styles.disabled,
              ]}>
              {actionBusy === 'reorder' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryActionText}>Mua lại đơn này</Text>
              )}
            </Pressable>

            {order.canCancel ? (
              <Pressable
                accessibilityLabel="Hủy đơn hàng"
                accessibilityRole="button"
                disabled={actionBusy !== null}
                onPress={cancelOrder}
                style={({ pressed }) => [
                  styles.cancelAction,
                  pressed && styles.pressed,
                  actionBusy !== null && styles.disabled,
                ]}>
                {actionBusy === 'cancel' ? (
                  <ActivityIndicator color={BRAND_COLORS.danger} />
                ) : (
                  <Text style={styles.cancelActionText}>Hủy đơn hàng</Text>
                )}
              </Pressable>
            ) : null}
          </View>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!deliverySubmissionLock.current) setDeliveryDecision(null);
        }}
        transparent
        visible={deliveryDecision !== null}>
        <View style={styles.deliveryModalBackdrop}>
          <View style={styles.deliveryModalCard} accessibilityViewIsModal>
            <Text style={styles.deliveryModalTitle}>
              {deliveryDecision === 'confirm-received'
                ? 'Xác nhận đã nhận hàng?'
                : 'Bạn chưa nhận được hàng?'}
            </Text>
            <Text style={styles.deliveryModalText}>
              {deliveryDecision === 'confirm-received'
                ? 'Chỉ xác nhận khi bạn thực sự đã nhận được hàng. Thời hạn yêu cầu hoàn hàng ' +
                  (order.returnWindowDays ?? 7) + ' ngày sẽ bắt đầu từ thời điểm này.'
                : 'Đơn vị vận chuyển đang báo giao thành công. KaitoKid sẽ ghi nhận khiếu nại để đối soát; đơn không tự hủy hoặc hoàn tồn kho.'}
            </Text>
            <View style={styles.deliveryModalActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng hộp xác nhận giao hàng"
                disabled={actionBusy !== null}
                onPress={() => setDeliveryDecision(null)}
                style={({ pressed }) => [
                  styles.deliveryModalCancel,
                  pressed && styles.pressed,
                  actionBusy !== null && styles.disabled,
                ]}>
                <Text style={styles.deliveryModalCancelText}>Để sau</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={deliveryDecision === 'confirm-received'
                  ? 'Xác nhận tôi đã nhận hàng'
                  : 'Xác nhận báo chưa nhận hàng'}
                disabled={actionBusy !== null}
                onPress={() => void submitDeliveryDecision()}
                style={({ pressed }) => [
                  styles.deliveryModalConfirm,
                  deliveryDecision === 'report-not-received' && styles.deliveryModalDanger,
                  pressed && styles.pressed,
                  actionBusy !== null && styles.disabled,
                ]}>
                {actionBusy === 'confirm-received' || actionBusy === 'report-not-received' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.deliveryModalConfirmText}>
                    {deliveryDecision === 'confirm-received' ? 'Đã nhận hàng' : 'Báo chưa nhận'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  success = false,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        selectable
        style={[
          styles.summaryValue,
          success && styles.summaryValueSuccess,
        ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  deliveryModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    paddingHorizontal: 20,
  },
  deliveryModalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.surface,
    padding: 20,
    gap: 16,
  },
  deliveryModalTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 26,
  },
  deliveryModalText: {
    color: BRAND_COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  deliveryModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  deliveryModalCancel: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryModalCancelText: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  deliveryModalConfirm: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryModalDanger: { backgroundColor: BRAND_COLORS.danger },
  deliveryModalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 14,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  sectionKicker: {
    color: BRAND_COLORS.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionTitle: {
    marginTop: 2,
    color: BRAND_COLORS.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  statusSummary: {
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    padding: 12,
  },
  statusLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  statusValue: {
    marginTop: 3,
    color: BRAND_COLORS.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  trackButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primarySoft,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackButtonText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  noticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  noticeSuccess: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  noticeWarning: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  noticeDanger: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  noticeInfo: { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  noticeTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  noticeText: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  returnForm: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    paddingTop: 10,
    gap: 8,
  },
  returnLabel: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  returnInput: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#F9FAFB',
    color: BRAND_COLORS.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    lineHeight: 18,
  },
  returnCounter: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
  },
  itemList: { gap: 10 },
  itemRow: {
    minHeight: 82,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemImage: {
    width: 56,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  itemMeta: {
    marginTop: 3,
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  reviewMeta: {
    marginTop: 4,
    color: '#9A3412',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
  },
  reviewMetaDone: { color: BRAND_COLORS.success },
  reviewButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: BRAND_COLORS.primarySoft,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewButtonText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  itemPrice: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  summaryRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  summaryValue: {
    flex: 1,
    color: BRAND_COLORS.ink,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  summaryValueSuccess: { color: BRAND_COLORS.success },
  longRow: {
    minHeight: 46,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    gap: 5,
  },
  longValue: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  paymentButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BRAND_COLORS.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  totalLabel: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  totalValue: {
    color: BRAND_COLORS.accent,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  actions: { gap: 8 },
  primaryAction: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  cancelAction: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionText: {
    color: BRAND_COLORS.danger,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  centerState: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
  },
  stateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: BRAND_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 380,
  },
  centerError: {
    color: BRAND_COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
  bottomSpace: { height: 30 },
});