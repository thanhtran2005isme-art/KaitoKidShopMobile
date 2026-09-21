import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';

export default function CartScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { cartCount, refreshCartCount } = useShopping();

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🛍️</Text>
          </View>
          <Text style={styles.title}>Giỏ hàng của bạn</Text>
          <Text style={styles.description}>
            Đăng nhập để lưu sản phẩm trong giỏ và đồng bộ với tài khoản KaitoKid.
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/auth/login',
                params: { redirect: '/cart' },
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🛍️</Text>
        </View>
        <Text style={styles.title}>Giỏ hàng</Text>
        <Text style={styles.count}>
          {cartCount == null
            ? 'Đang đồng bộ...'
            : cartCount > 0
              ? `${cartCount} sản phẩm trong giỏ`
              : 'Giỏ hàng đang trống'}
        </Text>
        <Text style={styles.description}>
          {cartCount && cartCount > 0
            ? 'Sản phẩm trong giỏ đã được đồng bộ và đang được giữ tồn kho trong thời gian giới hạn.'
            : 'Hãy chọn màu, size và thêm những món phù hợp cho bé vào giỏ hàng.'}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={() => void refreshCartCount()}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Làm mới</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/')}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Tiếp tục mua sắm</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    gap: 11,
  },
  iconWrap: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 42 },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 26,
    fontWeight: '900',
  },
  count: {
    color: BRAND_COLORS.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  description: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 360,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
  },
});
