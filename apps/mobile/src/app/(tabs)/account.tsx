import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { accountApi } from '@/services/account.api';
import { resolveMediaUrl } from '@/services/api-client';
import type { AccountProfile } from '@/types/account';

function money(value: number) {
  return Math.round(Math.max(0, value || 0)).toLocaleString('vi-VN') + 'đ';
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AccountScreen() {
  const router = useRouter();
  const { token, loading: authLoading, logout } = useAuth();
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!token) {
      setProfile(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [nextProfile] = await Promise.all([
        accountApi.getProfile(token),
        refreshUnreadCount(),
      ]);
      setProfile(nextProfile);
    } catch (loadError) {
      setError(messageFrom(loadError, 'Không thể tải thông tin tài khoản.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshUnreadCount, token]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) void load(false);
    }, [authLoading, load]),
  );

  const confirmLogout = () => {
    Alert.alert(
      'Đăng xuất?',
      'Bạn sẽ cần đăng nhập lại để xem dữ liệu mua sắm được bảo vệ.',
      [
        { text: 'Ở lại', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: () => void logout(),
        },
      ],
    );
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateText}>Đang kiểm tra tài khoản...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.guestContainer}>
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>K</Text>
          </View>
          <Text style={styles.guestTitle}>Tài khoản KaitoKid</Text>
          <Text style={styles.guestDescription}>
            Đăng nhập để quản lý đơn hàng, đánh giá, thông báo, điểm thành viên và voucher.
          </Text>
          <Pressable
            accessibilityLabel="Đăng nhập tài khoản KaitoKid"
            accessibilityRole="button"
            onPress={() => router.push('/auth/login')}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Tạo tài khoản KaitoKid mới"
            accessibilityRole="button"
            onPress={() => router.push('/auth/register')}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.secondaryButtonText}>Tạo tài khoản mới</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateText}>Đang tải hồ sơ thành viên...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Không tải được tài khoản</Text>
          <Text style={styles.errorText}>{error || 'Vui lòng thử lại.'}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load(false)}
            style={styles.primaryButtonCompact}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const avatarUrl = resolveMediaUrl(profile.avatar);
  const initial = profile.name.trim().charAt(0).toUpperCase() || 'K';
  const nextTierProgress =
    profile.nextTierAt > 0
      ? Math.min(1, Math.max(0, profile.totalSpent / profile.nextTierAt))
      : 1;
  const progressWidth = (
    Math.round(nextTierProgress * 100) + '%'
  ) as `${number}%`;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={BRAND_COLORS.primary}
            onRefresh={() => void load(true)}
          />
        }
        contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          {avatarUrl ? (
            <Image
              accessibilityLabel={'Ảnh đại diện của ' + profile.name}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: avatarUrl }}
              style={styles.profileAvatar}
            />
          ) : (
            <View style={styles.profileAvatarFallback}>
              <Text style={styles.profileAvatarText}>{initial}</Text>
            </View>
          )}

          <View style={styles.profileCopy}>
            <Text style={styles.eyebrow}>THÀNH VIÊN {profile.memberTier.toUpperCase()}</Text>
            <Text numberOfLines={2} style={styles.profileName}>
              {profile.name}
            </Text>
            <Text numberOfLines={1} style={styles.profileEmail}>
              {profile.email}
            </Text>
            <Text numberOfLines={1} style={styles.profilePhone}>
              {profile.phone || 'Chưa cập nhật số điện thoại'}
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Chỉnh sửa hồ sơ"
            accessibilityRole="button"
            onPress={() => router.push('/account/profile')}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.editButtonText}>Sửa</Text>
          </Pressable>
        </View>

        {error ? (
          <View accessibilityRole="alert" style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard label="Điểm hiện có" value={profile.loyaltyPoints.toLocaleString('vi-VN')} />
          <StatCard label="Tổng đơn" value={String(profile.totalOrders)} />
          <StatCard label="Đã chi tiêu" value={money(profile.totalSpent)} wide />
        </View>

        <View style={styles.tierCard}>
          <View style={styles.tierHeader}>
            <View>
              <Text style={styles.sectionKicker}>HẠNG THÀNH VIÊN</Text>
              <Text style={styles.sectionTitle}>{profile.memberTier}</Text>
            </View>
            <Text style={styles.nextTierLabel}>
              {profile.amountToNextTier > 0
                ? 'Còn ' + money(profile.amountToNextTier) + ' đến ' + profile.nextTier
                : 'Đã đạt mốc ' + profile.nextTier}
            </Text>
          </View>
          <View
            accessibilityLabel={'Tiến độ hạng thành viên ' + Math.round(nextTierProgress * 100) + '%'}
            style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: progressWidth },
              ]}
            />
          </View>
          <Text style={styles.tierHint}>
            Tổng chi tiêu được backend dùng để xác định tiến độ hạng thành viên.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionKicker}>MUA SẮM & HẬU MÃI</Text>
          <Text style={styles.sectionTitle}>Quản lý hoạt động</Text>

          <MenuItem
            title="Đơn hàng của tôi"
            description="Lịch sử, tracking, hủy đơn, mua lại và viết đánh giá."
            onPress={() => router.push('/orders')}
          />
          <MenuItem
            badge={unreadCount}
            title="Thông báo"
            description="Cập nhật đơn hàng, vận chuyển, thanh toán và ưu đãi."
            onPress={() => router.push('/notifications')}
          />
          <MenuItem
            title="Điểm thành viên"
            description="Xem lịch sử điểm và đổi điểm thành voucher."
            onPress={() => router.push('/account/points')}
          />
          <MenuItem
            title="Voucher của tôi"
            description="Voucher đổi điểm và quà sinh nhật đang còn hiệu lực."
            onPress={() => router.push('/account/vouchers')}
          />
          <MenuItem
            title="Sổ địa chỉ"
            description="Quản lý địa chỉ giao hàng đã lưu."
            onPress={() => router.push('/checkout/address')}
          />
          <MenuItem
            title="Danh sách yêu thích"
            description="Xem lại những sản phẩm đã lưu cho bé."
            onPress={() => router.push('/wishlist')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionKicker}>BẢO MẬT TÀI KHOẢN</Text>
          <Text style={styles.sectionTitle}>Phiên & dữ liệu cá nhân</Text>
          <Pressable
            accessibilityLabel="Đăng xuất khỏi KaitoKid"
            accessibilityRole="button"
            onPress={confirmLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Mở màn hình hủy tài khoản"
            accessibilityRole="button"
            onPress={() => router.push('/account/delete')}
            style={({ pressed }) => [
              styles.deleteAccountButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.deleteAccountText}>Hủy tài khoản</Text>
          </Pressable>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.statCard, wide && styles.statCardWide]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({
  title,
  description,
  onPress,
  badge = 0,
}: {
  title: string;
  description: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityLabel={
        title + (badge > 0 ? ', ' + badge + ' chưa đọc' : '')
      }
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.pressed,
      ]}>
      <View style={styles.menuCopy}>
        <View style={styles.menuTitleRow}>
          <Text style={styles.menuTitle}>{title}</Text>
          {badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.menuDescription}>{description}</Text>
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 13,
  },
  guestContainer: {
    flex: 1,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 13,
  },
  avatarFallback: {
    width: 78,
    height: 78,
    borderRadius: 25,
    backgroundColor: BRAND_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  guestTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  guestDescription: {
    maxWidth: 420,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 5,
  },
  profileCard: {
    minHeight: 128,
    borderRadius: 24,
    backgroundColor: '#111827',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: '#374151',
  },
  profileAvatarFallback: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: '#C4B5FD',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  profileName: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  profileEmail: { marginTop: 3, color: '#D1D5DB', fontSize: 9 },
  profilePhone: { marginTop: 2, color: '#9CA3AF', fontSize: 8 },
  editButton: {
    minWidth: 48,
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: '#312E81',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  editButtonText: { color: '#EDE9FE', fontSize: 9, fontWeight: '900' },
  inlineError: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 11,
  },
  inlineErrorText: { color: '#B91C1C', fontSize: 9, lineHeight: 14 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  statCard: {
    minWidth: 0,
    flex: 1,
    minHeight: 84,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 13,
    justifyContent: 'center',
    gap: 4,
  },
  statCardWide: { flexBasis: '100%' },
  statValue: {
    color: BRAND_COLORS.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  statLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    fontWeight: '700',
  },
  tierCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#FDFBFF',
    padding: 14,
    gap: 9,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
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
    fontWeight: '900',
  },
  nextTierLabel: {
    flex: 1,
    color: BRAND_COLORS.primaryDark,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.primary,
  },
  tierHint: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 14,
    gap: 9,
  },
  menuItem: {
    minHeight: 70,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#FAFAFB',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuCopy: { flex: 1 },
  menuTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  menuTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  menuDescription: {
    marginTop: 3,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
  },
  menuArrow: {
    color: BRAND_COLORS.primary,
    fontSize: 25,
    lineHeight: 28,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRAND_COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  logoutButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  deleteAccountButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    color: BRAND_COLORS.danger,
    fontSize: 10,
    fontWeight: '900',
  },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonCompact: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  secondaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 9,
  },
  stateText: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorText: {
    color: BRAND_COLORS.danger,
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
  },
  pressed: { opacity: 0.78 },
  bottomSpace: { height: 30 },
});
