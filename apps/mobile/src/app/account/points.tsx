import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { accountApi } from '@/services/account.api';
import type { AccountProfile, PointsHistoryItem } from '@/types/account';
import { formatDateTime } from '@/utils/order-status';

const PAGE_SIZE = 20;

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function pointsText(value: number) {
  const prefix = value > 0 ? '+' : '';
  return prefix + value.toLocaleString('vi-VN') + ' điểm';
}

function typeLabel(type: string) {
  switch ((type || '').toLowerCase()) {
    case 'earn':
      return 'Tích điểm';
    case 'redeem':
      return 'Đổi điểm';
    case 'bonus':
      return 'Thưởng';
    case 'expire':
      return 'Hết hạn';
    default:
      return 'Điểm thành viên';
  }
}

export default function AccountPointsScreen() {
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [items, setItems] = useState<PointsHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [redeemText, setRedeemText] = useState('100');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const redeemLock = useRef(false);

  const load = useCallback(
    async (nextPage = 1, append = false) => {
      if (!token) {
        setLoading(false);
        return;
      }

      if (append) setLoadingMore(true);
      else if (nextPage === 1) setLoading(true);
      setError(null);

      try {
        const [nextProfile, history] = await Promise.all([
          accountApi.getProfile(token),
          accountApi.getPointsHistory(token, nextPage, PAGE_SIZE),
        ]);
        setProfile(nextProfile);
        setItems((current) =>
          append
            ? [
                ...current,
                ...history.filter(
                  (incoming) => !current.some((item) => item.id === incoming.id),
                ),
              ]
            : history,
        );
        setPage(nextPage);
        setHasMore(history.length === PAGE_SIZE);
      } catch (loadError) {
        setError(messageFrom(loadError, 'Không thể tải lịch sử điểm.'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setSuccess(null);
    await load(1, false);
  };

  const redeem = async () => {
    if (!token || !profile || redeeming || redeemLock.current) return;

    const points = Number(redeemText.replace(/\D/g, ''));
    if (!Number.isInteger(points) || points <= 0 || points % 100 !== 0) {
      setError('Số điểm đổi phải là bội số của 100.');
      return;
    }
    if (points > profile.loyaltyPoints) {
      setError('Bạn không có đủ điểm để thực hiện đổi thưởng này.');
      return;
    }

    redeemLock.current = true;
    setRedeeming(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await accountApi.redeemPoints(token, points);
      setSuccess(
        'Đã đổi ' +
          points.toLocaleString('vi-VN') +
          ' điểm thành voucher ' +
          result.couponCode +
          '.',
      );
      setRedeemText('100');
      await load(1, false);
    } catch (redeemError) {
      setError(messageFrom(redeemError, 'Không thể đổi điểm lúc này.'));
    } finally {
      redeemLock.current = false;
      setRedeeming(false);
    }
  };

  if (authLoading || (loading && !profile)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang tải điểm thành viên</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Bạn cần đăng nhập</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/auth/login')}
            style={styles.primaryCompact}>
            <Text style={styles.primaryText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
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
              <Text style={styles.eyebrow}>KAITOKID LOYALTY</Text>
              <Text style={styles.title}>Điểm thành viên</Text>
              <Text style={styles.subtitle}>
                100 điểm đổi được voucher giảm 10.000đ.
              </Text>
            </View>
          </View>

          {profile ? (
            <View style={styles.balanceCard}>
              <View style={styles.balanceCopy}>
                <Text style={styles.balanceLabel}>Số dư hiện tại</Text>
                <Text style={styles.balanceValue}>
                  {profile.loyaltyPoints.toLocaleString('vi-VN')} điểm
                </Text>
                <Text style={styles.balanceTier}>
                  {'Hạng ' + profile.memberTier}
                </Text>
              </View>
              <View style={styles.redeemBox}>
                <Text style={styles.redeemLabel}>Điểm muốn đổi</Text>
                <TextInput
                  accessibilityLabel="Số điểm muốn đổi"
                  keyboardType="number-pad"
                  onChangeText={(value) => {
                    setRedeemText(value.replace(/\D/g, ''));
                    if (error) setError(null);
                  }}
                  placeholder="100"
                  placeholderTextColor="#9CA3AF"
                  style={styles.redeemInput}
                  value={redeemText}
                />
                <Pressable
                  accessibilityLabel="Đổi điểm thành voucher"
                  accessibilityRole="button"
                  disabled={redeeming || profile.loyaltyPoints < 100}
                  onPress={() => void redeem()}
                  style={({ pressed }) => [
                    styles.redeemButton,
                    pressed && styles.pressed,
                    (redeeming || profile.loyaltyPoints < 100) &&
                      styles.disabled,
                  ]}>
                  {redeeming ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.redeemButtonText}>Đổi điểm</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {success ? (
            <View accessibilityRole="alert" style={styles.successCard}>
              <Text style={styles.successText}>{success}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/account/vouchers')}
                style={styles.successLink}>
                <Text style={styles.successLinkText}>Xem voucher ›</Text>
              </Pressable>
            </View>
          ) : null}

          {error ? (
            <View accessibilityRole="alert" style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.historyTitle}>Lịch sử điểm</Text>

          <FlatList
            contentContainerStyle={[
              styles.listContent,
              items.length === 0 && styles.listEmpty,
            ]}
            data={items}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Chưa có lịch sử điểm</Text>
                  <Text style={styles.emptyText}>
                    Khi hệ thống ghi nhận tích điểm, đổi điểm hoặc bonus, lịch sử sẽ hiển thị tại đây.
                  </Text>
                </View>
              ) : null
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator color={BRAND_COLORS.primary} />
                </View>
              ) : null
            }
            onEndReached={() => {
              if (hasMore && !loadingMore) void load(page + 1, true);
            }}
            onEndReachedThreshold={0.35}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor={BRAND_COLORS.primary}
                onRefresh={() => void refresh()}
              />
            }
            renderItem={({ item }) => (
              <View style={styles.historyCard}>
                <View style={styles.historyTop}>
                  <View>
                    <Text style={styles.historyType}>{typeLabel(item.type)}</Text>
                    <Text style={styles.historyDate}>
                      {formatDateTime(item.createdAt)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.historyPoints,
                      item.points >= 0
                        ? styles.historyPointsPositive
                        : styles.historyPointsNegative,
                    ]}>
                    {pointsText(item.points)}
                  </Text>
                </View>
                {item.description ? (
                  <Text style={styles.historyDescription}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.historyBottom}>
                  {item.orderCode ? (
                    <Text style={styles.orderCode}>
                      {'Đơn ' + item.orderCode}
                    </Text>
                  ) : (
                    <View />
                  )}
                  <Text style={styles.balanceAfter}>
                    {'Số dư: ' + item.balanceAfter.toLocaleString('vi-VN')}
                  </Text>
                </View>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            windowSize={7}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    gap: 12,
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
  headerCopy: { flex: 1 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: { color: BRAND_COLORS.ink, fontSize: 22, fontWeight: '900' },
  subtitle: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
  },
  balanceCard: {
    borderRadius: 22,
    backgroundColor: '#111827',
    padding: 15,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  balanceCopy: { flex: 1, justifyContent: 'center' },
  balanceLabel: { color: '#9CA3AF', fontSize: 8, fontWeight: '700' },
  balanceValue: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  balanceTier: {
    marginTop: 4,
    color: '#C4B5FD',
    fontSize: 9,
    fontWeight: '800',
  },
  redeemBox: {
    width: 142,
    borderRadius: 16,
    backgroundColor: '#1F2937',
    padding: 10,
    gap: 6,
  },
  redeemLabel: { color: '#D1D5DB', fontSize: 7, fontWeight: '800' },
  redeemInput: {
    height: 40,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    color: BRAND_COLORS.ink,
    paddingHorizontal: 10,
    fontSize: 10,
    fontWeight: '800',
  },
  redeemButton: {
    minHeight: 42,
    borderRadius: 11,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  successCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 9,
  },
  successText: {
    flex: 1,
    color: '#047857',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '700',
  },
  successLink: { minHeight: 44, justifyContent: 'center' },
  successLinkText: {
    color: '#047857',
    fontSize: 8,
    fontWeight: '900',
  },
  errorCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 11,
    marginBottom: 9,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '800',
  },
  historyTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 9,
  },
  listContent: { paddingBottom: 30 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  separator: { height: 8 },
  historyCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 12,
    gap: 7,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyType: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  historyDate: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 7,
  },
  historyPoints: { fontSize: 11, fontWeight: '900' },
  historyPointsPositive: { color: BRAND_COLORS.success },
  historyPointsNegative: { color: BRAND_COLORS.danger },
  historyDescription: {
    color: '#4B5563',
    fontSize: 9,
    lineHeight: 14,
  },
  historyBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  orderCode: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '800',
  },
  balanceAfter: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    fontWeight: '700',
  },
  emptyCard: {
    paddingHorizontal: 28,
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 5,
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 15,
    textAlign: 'center',
  },
  footerLoading: { paddingVertical: 14 },
  centerState: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  primaryCompact: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
});
