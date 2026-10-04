import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedLogoutButton } from '@/components/account/animated-logout-button';
import { GuestAccountExperience } from '@/components/auth/guest-account-experience';
import { AppIcon } from '@/components/ui/app-icon';
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
    if (Platform.OS === 'web') {
      if (window.confirm('Đăng xuất?\n\nBạn sẽ cần đăng nhập lại để xem dữ liệu mua sắm được bảo vệ.')) {
        void logout();
      }
      return;
    }

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
      <GuestAccountExperience
        onLogin={() => router.push('/auth/login')}
        onRegister={() => router.push('/auth/register')}
      />
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
            accessibilityLabel="Thử tải lại tài khoản"
            accessibilityRole="button"
            onPress={() => void load(false)}
            style={({ pressed }) => [styles.primaryButtonCompact, pressed && styles.pressed]}>
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
            accessibilityRole="progressbar"
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
            description="Xem lại những sản phẩm bạn đã lưu."
            onPress={() => router.push('/wishlist')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionKicker}>BẢO MẬT TÀI KHOẢN</Text>
          <Text style={styles.sectionTitle}>Phiên & dữ liệu cá nhân</Text>
          <AnimatedLogoutButton
            accessibilityLabel="Đăng xuất khỏi KaitoKid"
            label="Logout"
            onPress={confirmLogout}
          />
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
      <AppIcon color={BRAND_COLORS.primary} name="chevronRight" size={22} />
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
    gap: 14,
  },
  profileCard: {
    minHeight: 136,
    borderRadius: 20,
    backgroundColor: '#111111',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#3F3F46',
  },
  profileAvatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#52525B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: '#D4D4D8',
    fontSize: 10,
    lineHeight: 14,
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
  profileEmail: { marginTop: 4, color: '#E5E7EB', fontSize: 12, lineHeight: 17 },
  profilePhone: { marginTop: 2, color: '#A1A1AA', fontSize: 11, lineHeight: 16 },
  editButton: {
    minWidth: 52,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4D4D8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  editButtonText: { color: '#111111', fontSize: 12, lineHeight: 17, fontWeight: '900' },
  inlineError: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
  },
  inlineErrorText: { color: '#B91C1C', fontSize: 12, lineHeight: 18 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  statCard: {
    minWidth: 0,
    flex: 1,
    minHeight: 88,
    borderRadius: 16,
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
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
  },
  statLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  tierCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FAFAFA',
    padding: 14,
    gap: 10,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
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
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  nextTierLabel: {
    flex: 1,
    color: BRAND_COLORS.primaryDark,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  progressTrack: {
    height: 10,
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
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 14,
    gap: 10,
  },
  menuItem: {
    minHeight: 72,
    borderRadius: 14,
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
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  menuDescription: {
    marginTop: 3,
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, lineHeight: 14, fontWeight: '900' },
  deleteAccountButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    color: BRAND_COLORS.danger,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  primaryButtonCompact: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  stateText: {
    color: BRAND_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  errorText: {
    color: BRAND_COLORS.danger,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  pressed: { opacity: 0.72 },
  bottomSpace: { height: 30 },
});
