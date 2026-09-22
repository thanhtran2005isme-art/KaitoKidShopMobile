import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OrderCard } from '@/components/orders/order-card';
import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { ordersApi } from '@/services/orders.api';
import type { CustomerOrder, OrderFilter } from '@/types/orders';
import {
  matchesOrderFilter,
  ORDER_FILTERS,
} from '@/utils/order-status';

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [filter, setFilter] = useState<OrderFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!token) {
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        setOrders(await ordersApi.getOrders(token));
      } catch (loadError) {
        setError(
          messageFrom(loadError, 'Không thể tải lịch sử đơn hàng.'),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!authLoading) void loadOrders('initial');
  }, [authLoading, loadOrders]);

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesOrderFilter(order, filter)),
    [filter, orders],
  );

  const counts = useMemo(() => {
    const map = new Map<OrderFilter, number>();
    ORDER_FILTERS.forEach(({ key }) => {
      map.set(
        key,
        orders.filter((order) => matchesOrderFilter(order, key)).length,
      );
    });
    return map;
  }, [orders]);

  const openOrder = useCallback(
    (order: CustomerOrder) => {
      router.push({
        pathname: '/orders/[id]',
        params: { id: String(order.id) },
      });
    },
    [router],
  );

  const renderOrder = useCallback(
    ({ item }: { item: CustomerOrder }) => (
      <OrderCard order={item} onPress={() => openOrder(item)} />
    ),
    [openOrder],
  );

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang kiểm tra tài khoản</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Đăng nhập để xem đơn hàng</Text>
          <Text style={styles.stateText}>
            Lịch sử mua hàng và theo dõi vận chuyển chỉ hiển thị cho chính chủ tài khoản.
          </Text>
          <Pressable
            accessibilityLabel="Đăng nhập để xem đơn hàng"
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

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Quay lại tài khoản"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.replace('/account')}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ĐƠN HÀNG CỦA TÔI</Text>
            <Text style={styles.title}>Lịch sử mua hàng</Text>
            <Text style={styles.subtitle}>
              Theo dõi xử lý, vận chuyển và mua lại đơn cũ.
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}>
          {ORDER_FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.filterText,
                    active && styles.filterTextActive,
                  ]}>
                  {item.label}
                </Text>
                <View
                  style={[
                    styles.filterCount,
                    active && styles.filterCountActive,
                  ]}>
                  <Text
                    style={[
                      styles.filterCountText,
                      active && styles.filterCountTextActive,
                    ]}>
                    {counts.get(item.key) || 0}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? (
          <View style={styles.errorCard} accessibilityRole="alert">
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Chưa tải được đơn hàng</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <Pressable
              accessibilityLabel="Thử tải lại đơn hàng"
              accessibilityRole="button"
              onPress={() => void loadOrders('initial')}
              style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={BRAND_COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải đơn hàng...</Text>
          </View>
        ) : (
          <FlatList
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              filteredOrders.length === 0 && styles.listContentEmpty,
            ]}
            data={filteredOrders}
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {orders.length === 0
                    ? 'Bạn chưa có đơn hàng nào'
                    : 'Không có đơn ở trạng thái này'}
                </Text>
                <Text style={styles.emptyText}>
                  {orders.length === 0
                    ? 'Khi checkout thành công, đơn hàng sẽ xuất hiện tại đây.'
                    : 'Chọn bộ lọc khác để xem các đơn còn lại.'}
                </Text>
                {orders.length === 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.replace('/')}
                    style={styles.emptyButton}>
                    <Text style={styles.emptyButtonText}>
                      Tiếp tục mua sắm
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={BRAND_COLORS.primary}
                onRefresh={() => void loadOrders('refresh')}
              />
            }
            renderItem={renderOrder}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            initialNumToRender={8}
            windowSize={7}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
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
    letterSpacing: 1.1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
  },
  filters: {
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    minHeight: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  filterChipActive: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  filterText: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
  },
  filterTextActive: {
    color: BRAND_COLORS.primaryDark,
    fontWeight: '900',
  },
  filterCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterCountActive: {
    backgroundColor: BRAND_COLORS.primary,
  },
  filterCountText: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    fontWeight: '900',
  },
  filterCountTextActive: { color: '#FFFFFF' },
  list: { flex: 1 },
  listContent: {
    paddingBottom: 34,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: { height: 10 },
  loadingCard: {
    minHeight: 180,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  loadingText: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  errorCard: {
    marginBottom: 12,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorCopy: { flex: 1 },
  errorTitle: {
    color: '#991B1B',
    fontSize: 10,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 2,
    color: '#B91C1C',
    fontSize: 8,
    lineHeight: 13,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  retryText: {
    color: BRAND_COLORS.danger,
    fontSize: 9,
    fontWeight: '900',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  emptyTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 6,
    maxWidth: 360,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
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
  pressed: { opacity: 0.78 },
});
