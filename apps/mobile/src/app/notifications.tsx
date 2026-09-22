import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { notificationsApi } from '@/services/notifications.api';
import type { NotificationItem } from '@/types/notifications';
import { formatDateTime } from '@/utils/order-status';

const PAGE_SIZE = 20;

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function typeLabel(type: string) {
  switch ((type || '').toLowerCase()) {
    case 'order':
      return 'Đơn hàng';
    case 'shipping':
      return 'Vận chuyển';
    case 'payment':
      return 'Thanh toán';
    case 'promotion':
    case 'coupon':
      return 'Ưu đãi';
    default:
      return 'Hệ thống';
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const { unreadCount, refreshUnreadCount, setUnreadCount } = useNotifications();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (!token) return;

      if (replace) {
        if (nextPage === 1) setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const result = await notificationsApi.getNotifications(
          token,
          nextPage,
          PAGE_SIZE,
        );

        setItems((current) =>
          replace
            ? result.items
            : [
                ...current,
                ...result.items.filter(
                  (incoming) => !current.some((item) => item.id === incoming.id),
                ),
              ],
        );
        setTotal(result.total);
        setUnreadCount(result.unread);
        setPage(nextPage);
        setHasMore(nextPage * PAGE_SIZE < result.total);
      } catch (loadError) {
        setError(
          messageFrom(loadError, 'Không thể tải thông báo. Vui lòng thử lại.'),
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [setUnreadCount, token],
  );

  useEffect(() => {
    if (authLoading || !token) {
      if (!authLoading) setLoading(false);
      return;
    }
    void loadPage(1, true);
  }, [authLoading, loadPage, token]);

  const refresh = async () => {
    if (!token || refreshing) return;
    setRefreshing(true);
    await loadPage(1, true);
  };

  const openNotification = async (notification: NotificationItem) => {
    if (!token || busyId != null) return;

    setBusyId(notification.id);
    setError(null);

    try {
      if (!notification.isRead) {
        await notificationsApi.markRead(token, notification.id);
        setItems((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, isRead: true } : item,
          ),
        );
        setUnreadCount(Math.max(0, unreadCount - 1));
      }

      const link = notification.link?.trim();
      if (link && link.startsWith('/') && !link.startsWith('//')) {
        router.push(link as any);
      }
    } catch (openError) {
      setError(messageFrom(openError, 'Không thể cập nhật thông báo.'));
      await refreshUnreadCount();
    } finally {
      setBusyId(null);
    }
  };

  const markAll = async () => {
    if (!token || markingAll || unreadCount <= 0) return;

    setMarkingAll(true);
    setError(null);

    try {
      await notificationsApi.markAllRead(token);
      setItems((current) =>
        current.map((item) => ({ ...item, isRead: true })),
      );
      setUnreadCount(0);
    } catch (markError) {
      setError(messageFrom(markError, 'Không thể đánh dấu tất cả đã đọc.'));
      await refreshUnreadCount();
    } finally {
      setMarkingAll(false);
    }
  };

  const remove = (notification: NotificationItem) => {
    if (!token || busyId != null) return;

    Alert.alert(
      'Xóa thông báo?',
      'Thông báo này sẽ bị xóa khỏi trung tâm thông báo của bạn.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(notification.id);
              setError(null);
              try {
                await notificationsApi.remove(token, notification.id);
                setItems((current) =>
                  current.filter((item) => item.id !== notification.id),
                );
                setTotal((current) => Math.max(0, current - 1));
                if (!notification.isRead) {
                  setUnreadCount(Math.max(0, unreadCount - 1));
                }
              } catch (removeError) {
                setError(
                  messageFrom(removeError, 'Không thể xóa thông báo.'),
                );
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
      const busy = busyId === item.id;
      return (
        <View style={[styles.card, !item.isRead && styles.cardUnread]}>
          <Pressable
            accessibilityLabel={
              (item.isRead ? '' : 'Chưa đọc. ') + item.title + '. ' + item.body
            }
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void openNotification(item)}
            style={({ pressed }) => [
              styles.cardMain,
              pressed && styles.pressed,
            ]}>
            <View style={styles.cardTop}>
              <View style={styles.typeRow}>
                {!item.isRead ? <View style={styles.unreadDot} /> : null}
                <Text style={styles.type}>{typeLabel(item.type)}</Text>
              </View>
              <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            {item.link?.startsWith('/') && !item.link.startsWith('//') ? (
              <Text style={styles.linkHint}>Mở nội dung liên quan ›</Text>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityLabel={'Xóa thông báo ' + item.title}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => remove(item)}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
            ]}>
            {busy ? (
              <ActivityIndicator color={BRAND_COLORS.danger} size="small" />
            ) : (
              <Text style={styles.deleteText}>Xóa</Text>
            )}
          </Pressable>
        </View>
      );
  };

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
          <Text style={styles.stateTitle}>Đăng nhập để xem thông báo</Text>
          <Text style={styles.stateText}>
            Thông báo đơn hàng, vận chuyển và ưu đãi chỉ hiển thị cho tài khoản của bạn.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: '/auth/login',
                params: { redirect: '/notifications' },
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
            onPress={() => router.back()}
            style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TRUNG TÂM THÔNG BÁO</Text>
            <Text style={styles.title}>Thông báo của bạn</Text>
            <Text style={styles.subtitle}>
              {unreadCount > 0
                ? unreadCount + ' thông báo chưa đọc'
                : 'Bạn đã đọc hết thông báo'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Đánh dấu tất cả thông báo đã đọc"
            accessibilityRole="button"
            disabled={markingAll || unreadCount <= 0}
            onPress={() => void markAll()}
            style={({ pressed }) => [
              styles.markAllButton,
              pressed && styles.pressed,
              (markingAll || unreadCount <= 0) && styles.disabled,
            ]}>
            <Text style={styles.markAllText}>
              {markingAll ? 'Đang xử lý' : 'Đọc tất cả'}
            </Text>
          </Pressable>
        </View>

        {error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={BRAND_COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải thông báo...</Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={[
              styles.listContent,
              items.length === 0 && styles.listEmpty,
            ]}
            data={items}
            initialNumToRender={10}
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
                <Text style={styles.emptyText}>
                  Khi có cập nhật đơn hàng, vận chuyển hoặc ưu đãi, KaitoKid sẽ hiển thị tại đây.
                </Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator color={BRAND_COLORS.primary} />
                </View>
              ) : items.length > 0 && items.length >= total ? (
                <Text style={styles.endText}>Bạn đã xem hết thông báo.</Text>
              ) : null
            }
            onEndReached={() => {
              if (hasMore && !loadingMore) {
                void loadPage(page + 1, false);
              }
            }}
            onEndReachedThreshold={0.35}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={BRAND_COLORS.primary}
                onRefresh={() => void refresh()}
              />
            }
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            windowSize={7}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
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
    gap: 10,
    marginBottom: 12,
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
  backText: { color: BRAND_COLORS.ink, fontSize: 30, lineHeight: 32 },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: { color: BRAND_COLORS.ink, fontSize: 21, fontWeight: '900' },
  subtitle: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 8,
  },
  markAllButton: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: BRAND_COLORS.primarySoft,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 8,
    fontWeight: '900',
  },
  listContent: { paddingBottom: 32 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  separator: { height: 9 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    overflow: 'hidden',
  },
  cardUnread: {
    borderColor: '#C4B5FD',
    backgroundColor: '#FDFBFF',
  },
  cardMain: { padding: 13, gap: 5 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_COLORS.primary,
  },
  type: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  date: { color: BRAND_COLORS.muted, fontSize: 7 },
  cardTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
  },
  body: {
    color: '#4B5563',
    fontSize: 9,
    lineHeight: 15,
  },
  linkHint: {
    marginTop: 2,
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
  },
  deleteButton: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: BRAND_COLORS.danger,
    fontSize: 8,
    fontWeight: '900',
  },
  errorCard: {
    marginBottom: 10,
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
  loadingCard: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  emptyTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 5,
    maxWidth: 360,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
  },
  footerLoading: { paddingVertical: 16 },
  endText: {
    paddingVertical: 16,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    textAlign: 'center',
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
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
});
