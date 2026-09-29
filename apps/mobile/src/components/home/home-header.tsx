import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND, BRAND_COLORS } from '@/constants/brand';

type HomeHeaderProps = {
  cartCount?: number | null;
  userName?: string | null;
};

export function HomeHeader({ cartCount, userName }: HomeHeaderProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const submitSearch = () => {
    const q = search.trim();
    if (!q) return;
    router.push({ pathname: '/search', params: { q } });
  };

  const nameParts = userName?.trim().split(/\s+/) || [];
  const firstName = nameParts.length ? nameParts[nameParts.length - 1] : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.brandCopy}>
          <Text style={styles.eyebrow}>
            {firstName ? `CHÀO ${firstName.toUpperCase()}` : BRAND.tagline}
          </Text>
          <Text style={styles.brand}>{BRAND.name}</Text>
          <Text style={styles.promise}>{BRAND.promise}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityLabel="Tài khoản"
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <AppIcon color={BRAND_COLORS.ink} name="user" size={23} />
          </Pressable>
          <Pressable
            accessibilityLabel="Danh sách yêu thích"
            accessibilityRole="button"
            onPress={() => router.push('/wishlist')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <AppIcon color={BRAND_COLORS.primary} name="heart" size={23} />
          </Pressable>
          <Pressable
            accessibilityLabel="Giỏ hàng"
            accessibilityRole="button"
            onPress={() => router.push('/cart')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <AppIcon color={BRAND_COLORS.ink} name="bag" size={22} />
            {typeof cartCount === 'number' && cartCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={styles.searchBox}>
        <View style={styles.searchIcon}>
          <AppIcon color={BRAND_COLORS.muted} name="search" size={21} />
        </View>
        <TextInput
          accessibilityLabel="Tìm kiếm sản phẩm"
          enterKeyHint="search"
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          placeholder={BRAND.searchPlaceholder}
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          style={styles.input}
          value={search}
        />
        {search.length > 0 ? (
          <Pressable
            accessibilityLabel="Xóa từ khóa"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setSearch('')}
            style={styles.trailingButton}>
            <AppIcon color={BRAND_COLORS.muted} name="close" size={20} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityLabel="Tìm kiếm"
            accessibilityRole="button"
            hitSlop={8}
            onPress={submitSearch}
            style={styles.trailingButton}>
            <AppIcon color={BRAND_COLORS.primary} name="arrowRight" size={20} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  brandCopy: { flex: 1 },
  eyebrow: { color: BRAND_COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  brand: { color: BRAND_COLORS.ink, fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 2 },
  promise: { color: BRAND_COLORS.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 44, height: 44, borderRadius: 16, backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line, position: 'relative',
  },
  pressed: { opacity: 0.72 },
  cartBadge: {
    position: 'absolute', top: -5, right: -5, minWidth: 19, height: 19, paddingHorizontal: 4,
    borderRadius: 10, backgroundColor: BRAND_COLORS.danger, borderWidth: 2,
    borderColor: BRAND_COLORS.surface, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  searchBox: {
    minHeight: 52, borderRadius: 18, paddingHorizontal: 14, backgroundColor: BRAND_COLORS.surface,
    flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  searchIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  input: { flex: 1, color: BRAND_COLORS.ink, fontSize: 14, paddingVertical: 11 },
  trailingButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
