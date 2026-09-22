import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { resolveMediaUrl } from '@/services/api-client';
import { ordersApi } from '@/services/orders.api';
import type { CustomerOrder } from '@/types/orders';
import {
  canResumeAtmPayment,
  formatDateTime,
  formatMoney,
  paymentLabel,
  shippingStatusMeta,
} from '@/utils/order-status';

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
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
  const [actionBusy, setActionBusy] =
    useState<'cancel' | 'reorder' | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  const canResumePayment = canResumeAtmPayment(order);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
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
            <Text style={styles.backText}>‹</Text>
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
            <Text style={styles.trackArrow}>›</Text>
          </Pressable>
        </View>

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
                  {order.status === 'completed' ? (
                    <Text
                      style={[
                        styles.reviewMeta,
                        item.hasReviewed && styles.reviewMetaDone,
                      ]}>
                      {item.hasReviewed ? 'Đã đánh giá' : 'Chưa đánh giá'}
                    </Text>
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
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 13,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: BRAND_COLORS.ink,
    fontSize: 30,
    lineHeight: 32,
    marginTop: -2,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 8,
  },
  section: {
    borderRadius: 20,
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
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionTitle: {
    marginTop: 2,
    color: BRAND_COLORS.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
  },
  statusSummary: {
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    padding: 11,
  },
  statusLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    fontWeight: '700',
  },
  statusValue: {
    marginTop: 2,
    color: BRAND_COLORS.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  trackButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primarySoft,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackButtonText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
  },
  trackArrow: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 22,
    fontWeight: '700',
  },
  itemList: { gap: 9 },
  itemRow: {
    minHeight: 76,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  itemImage: {
    width: 52,
    height: 66,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '900',
  },
  itemMeta: {
    marginTop: 3,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 12,
  },
  reviewMeta: {
    marginTop: 4,
    color: '#9A3412',
    fontSize: 8,
    fontWeight: '800',
  },
  reviewMetaDone: { color: BRAND_COLORS.success },
  itemPrice: {
    color: BRAND_COLORS.ink,
    fontSize: 9,
    fontWeight: '900',
  },
  summaryRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  summaryValue: {
    flex: 1,
    color: BRAND_COLORS.ink,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '900',
    textAlign: 'right',
  },
  summaryValueSuccess: { color: BRAND_COLORS.success },
  longRow: {
    minHeight: 42,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    gap: 4,
  },
  longValue: {
    color: BRAND_COLORS.ink,
    fontSize: 9,
    lineHeight: 15,
    fontWeight: '800',
  },
  paymentButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  totalRow: {
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: BRAND_COLORS.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  totalLabel: {
    color: BRAND_COLORS.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  totalValue: {
    color: BRAND_COLORS.accent,
    fontSize: 19,
    fontWeight: '900',
  },
  actions: { gap: 8 },
  primaryAction: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  cancelAction: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelActionText: {
    color: BRAND_COLORS.danger,
    fontSize: 10,
    fontWeight: '900',
  },
  errorCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 11,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 9,
    lineHeight: 14,
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
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    maxWidth: 380,
  },
  centerError: {
    color: BRAND_COLORS.danger,
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  bottomSpace: { height: 30 },
});
