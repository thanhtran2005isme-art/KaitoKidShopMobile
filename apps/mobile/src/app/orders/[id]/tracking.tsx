import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ordersApi } from '@/services/orders.api';
import type { CustomerOrder, ShippingTracking } from '@/types/orders';
import {
  estimatedDeliveryText,
  formatDateTime,
  shippingStatusMeta,
} from '@/utils/order-status';

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function OrderTrackingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const orderId = Number(rawId);

  const { token, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [tracking, setTracking] = useState<ShippingTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
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
        const nextOrder = await ordersApi.getOrder(token, orderId);
        const nextTracking = await ordersApi.getTracking(
          token,
          nextOrder.orderCode,
        );
        setOrder(nextOrder);
        setTracking(nextTracking);
      } catch (loadError) {
        setError(
          messageFrom(
            loadError,
            'Không thể tải hành trình vận chuyển của đơn này.',
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId, token],
  );

  useEffect(() => {
    if (!authLoading) void load('initial');
  }, [authLoading, load]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang tải hành trình đơn hàng</Text>
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
            Tracking đơn hàng chỉ hiển thị cho chính chủ tài khoản.
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

  if (!order || !tracking) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Chưa xem được tracking</Text>
          <Text style={styles.stateText}>
            {error ||
              'Đơn không tồn tại, không thuộc tài khoản này hoặc dữ liệu vận chuyển chưa sẵn sàng.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load('initial')}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Number.isInteger(orderId) && orderId > 0
                ? router.replace({
                    pathname: '/orders/[id]',
                    params: { id: String(orderId) },
                  })
                : router.replace('/orders')
            }
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const currentMeta = shippingStatusMeta(tracking.trangThaiVanChuyen);
  const eta = estimatedDeliveryText(
    tracking.createdAt,
    tracking.leadTimeHours,
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={BRAND_COLORS.primary}
            onRefresh={() => void load('refresh')}
          />
        }
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Quay lại chi tiết đơn hàng"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() =>
              router.replace({
                pathname: '/orders/[id]',
                params: { id: String(order.id) },
              })
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>THEO DÕI VẬN CHUYỂN</Text>
            <Text style={styles.title}>{tracking.orderCode}</Text>
            <Text style={styles.subtitle}>
              Timeline bên dưới chỉ hiển thị sự kiện backend đã ghi nhận.
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>TRẠNG THÁI HIỆN TẠI</Text>
              <Text style={styles.heroTitle}>{currentMeta.label}</Text>
            </View>
            <OrderStatusBadge
              kind="shipping"
              status={tracking.trangThaiVanChuyen}
            />
          </View>

          {tracking.maVanDon ? (
            <InfoRow label="Mã vận đơn" value={tracking.maVanDon} />
          ) : null}
          {tracking.nhaVanChuyen ? (
            <InfoRow
              label="Nhà vận chuyển"
              value={tracking.nhaVanChuyen.toUpperCase()}
            />
          ) : null}
          {eta ? (
            <InfoRow label="Dự kiến theo ETA" value={eta} />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionKicker}>HÀNH TRÌNH</Text>
          <Text style={styles.sectionTitle}>Lịch sử vận chuyển</Text>

          {tracking.history.length > 0 ? (
            <View style={styles.timeline}>
              {tracking.history.map((event, index) => {
                const meta = shippingStatusMeta(event.trangThai);
                const last = index === tracking.history.length - 1;

                return (
                  <View key={event.id} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View
                        style={[
                          styles.timelineDot,
                          last && styles.timelineDotCurrent,
                        ]}>
                        <Text
                          style={[
                            styles.timelineDotText,
                            last && styles.timelineDotTextCurrent,
                          ]}>
                          {index + 1}
                        </Text>
                      </View>
                      {!last ? <View style={styles.timelineLine} /> : null}
                    </View>

                    <View style={styles.timelineCard}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineTitle}>{meta.label}</Text>
                        <Text style={styles.timelineTime}>
                          {formatDateTime(event.thoiGian)}
                        </Text>
                      </View>
                      {event.moTa ? (
                        <Text style={styles.timelineDescription}>
                          {event.moTa}
                        </Text>
                      ) : null}
                      {event.viTri ? (
                        <Text style={styles.timelineLocation}>
                          {'Vị trí: ' + event.viTri}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyTimeline}>
              <Text style={styles.emptyTitle}>
                Chưa có sự kiện vận chuyển
              </Text>
              <Text style={styles.emptyText}>
                Hệ thống chưa ghi nhận thêm lịch sử cho đơn này. Kéo xuống để kiểm tra lại.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Trạng thái đơn hàng</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Đơn hàng</Text>
            <OrderStatusBadge status={tracking.trangThaiDonHang} />
          </View>
          <Text style={styles.infoText}>
            Thời gian giao dự kiến là dữ liệu tham khảo từ lựa chọn shipping lúc checkout; timeline thực tế luôn lấy từ lịch sử backend.
          </Text>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text selectable style={styles.dataValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 13,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  headerCopy: { flex: 1 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
  },
  heroCard: {
    borderRadius: 22,
    backgroundColor: '#111827',
    padding: 16,
    gap: 9,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroCopy: { flex: 1 },
  heroKicker: {
    color: '#C4B5FD',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  heroTitle: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  dataRow: {
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#374151',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  dataLabel: {
    color: '#9CA3AF',
    fontSize: 8,
    fontWeight: '700',
  },
  dataValue: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'right',
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 14,
    gap: 10,
  },
  sectionKicker: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  timeline: { paddingTop: 2 },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timelineRail: {
    width: 34,
    alignItems: 'center',
  },
  timelineDot: {
    width: 26,
    height: 26,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#C4B5FD',
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotCurrent: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primary,
  },
  timelineDotText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 8,
    fontWeight: '900',
  },
  timelineDotTextCurrent: { color: '#FFFFFF' },
  timelineLine: {
    flex: 1,
    width: 2,
    minHeight: 42,
    backgroundColor: '#DDD6FE',
  },
  timelineCard: {
    flex: 1,
    marginLeft: 7,
    paddingBottom: 18,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 9,
  },
  timelineTitle: {
    flex: 1,
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  timelineTime: {
    color: BRAND_COLORS.muted,
    fontSize: 7,
    textAlign: 'right',
  },
  timelineDescription: {
    marginTop: 4,
    color: '#4B5563',
    fontSize: 9,
    lineHeight: 14,
  },
  timelineLocation: {
    marginTop: 4,
    color: BRAND_COLORS.primaryDark,
    fontSize: 8,
    lineHeight: 13,
    fontWeight: '800',
  },
  emptyTimeline: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 4,
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#FDFBFF',
    padding: 13,
    gap: 9,
  },
  infoTitle: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '900',
  },
  infoRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  infoText: {
    color: '#6D28D9',
    fontSize: 8,
    lineHeight: 13,
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
    maxWidth: 380,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
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
  bottomSpace: { height: 30 },
});
