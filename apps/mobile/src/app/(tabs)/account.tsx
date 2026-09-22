import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

function displayName(user: any) {
  return (
    user?.name ||
    user?.fullName ||
    user?.hoTen ||
    user?.email ||
    'Khách hàng KaitoKid'
  );
}

function displayEmail(user: any) {
  return user?.email || '';
}

export default function AccountScreen() {
  const router = useRouter();
  const { token, user, loading, logout } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateText}>Đang tải tài khoản...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.guestContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>K</Text>
          </View>

          <Text style={styles.title}>Tài khoản KaitoKid</Text>
          <Text style={styles.description}>
            Đăng nhập để quản lý đơn hàng, địa chỉ nhận hàng, wishlist và các ưu đãi dành cho bạn.
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

  const name = displayName(user);
  const email = displayEmail(user);
  const initial = name.trim().charAt(0).toUpperCase() || 'K';

  const confirmLogout = () => {
    Alert.alert(
      'Đăng xuất?',
      'Bạn sẽ cần đăng nhập lại để xem đơn hàng và dữ liệu mua sắm.',
      [
        { text: 'Ở lại', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: () => {
            void logout();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{initial}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.eyebrow}>TÀI KHOẢN KAITOKID</Text>
            <Text numberOfLines={2} style={styles.profileName}>
              {name}
            </Text>
            {email ? <Text style={styles.profileEmail}>{email}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionKicker}>MUA SẮM</Text>
          <Text style={styles.sectionTitle}>Quản lý sau checkout</Text>

          <MenuItem
            title="Đơn hàng của tôi"
            description="Xem lịch sử, trạng thái, tracking, hủy đơn và mua lại."
            onPress={() => router.push('/orders')}
          />

          <MenuItem
            title="Giỏ hàng"
            description="Kiểm tra sản phẩm đang giữ trước khi thanh toán."
            onPress={() => router.push('/cart')}
          />

          <MenuItem
            title="Danh sách yêu thích"
            description="Xem lại những sản phẩm bạn đã lưu."
            onPress={() => router.push('/wishlist')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionKicker}>TÀI KHOẢN</Text>
          <Text style={styles.sectionTitle}>Phiên đăng nhập</Text>
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
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.pressed,
      ]}>
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuDescription}>{description}</Text>
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
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
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 25,
    backgroundColor: BRAND_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    maxWidth: 420,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 5,
  },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
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
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 13,
  },
  profileCard: {
    minHeight: 126,
    borderRadius: 24,
    backgroundColor: '#111827',
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  profileAvatar: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '900',
  },
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
  profileEmail: {
    marginTop: 3,
    color: '#D1D5DB',
    fontSize: 9,
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 14,
    gap: 9,
  },
  sectionKicker: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
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
  logoutButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: BRAND_COLORS.danger,
    fontSize: 10,
    fontWeight: '900',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  stateText: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  pressed: { opacity: 0.78 },
  bottomSpace: { height: 30 },
});
