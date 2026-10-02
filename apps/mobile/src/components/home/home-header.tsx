import { LinearGradient } from 'expo-linear-gradient';
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
  const [searchFocused, setSearchFocused] = useState(false);

  const submitSearch = () => {
    const q = search.trim();
    if (!q) return;
    router.push({ pathname: '/search', params: { q } });
  };

  const handleTrailingAction = () => {
    if (search.trim()) {
      submitSearch();
      return;
    }

    router.push('/categories');
  };

  const nameParts = userName?.trim().split(/\s+/) || [];
  const firstName = nameParts.length ? nameParts[nameParts.length - 1] : undefined;
  const hasSearch = Boolean(search.trim());
  const searchBorderColors = searchFocused
    ? (['#17141F', '#4F46E5', '#B7A9FF', '#CF30AA', '#2B1732'] as const)
    : (['#19171D', '#402FB5', '#8E83B8', '#8A2E78', '#211D28'] as const);

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

      <View style={styles.searchShell}>
        <LinearGradient
          colors={['rgba(64,47,181,0)', 'rgba(64,47,181,0.38)', 'rgba(207,48,170,0.30)', 'rgba(207,48,170,0)']}
          end={{ x: 1, y: 0.8 }}
          pointerEvents="none"
          start={{ x: 0, y: 0.2 }}
          style={[styles.searchHalo, searchFocused && styles.searchHaloFocused]}
        />

        <LinearGradient
          colors={searchBorderColors}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.searchBorder}>
          <View style={styles.searchBox}>
            <View pointerEvents="none" style={styles.pinkGlow} />
            <View pointerEvents="none" style={styles.purpleGlow} />

            <View style={styles.searchIcon}>
              <AppIcon color="#B8B2C3" name="search" size={21} />
            </View>

            <TextInput
              accessibilityLabel="Tìm kiếm sản phẩm"
              enterKeyHint="search"
              onBlur={() => setSearchFocused(false)}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onSubmitEditing={submitSearch}
              placeholder={BRAND.searchPlaceholder}
              placeholderTextColor="#AAA4B2"
              returnKeyType="search"
              selectionColor="#A78BFA"
              style={styles.input}
              value={search}
            />

            <LinearGradient
              colors={['#26213F', '#111016', '#08080B', '#262052']}
              end={{ x: 0.85, y: 1 }}
              start={{ x: 0.15, y: 0 }}
              style={styles.trailingFrame}>
              <Pressable
                accessibilityLabel={hasSearch ? 'Tìm kiếm' : 'Mở bộ lọc sản phẩm'}
                accessibilityRole="button"
                hitSlop={4}
                onPress={handleTrailingAction}
                style={({ pressed }) => [styles.trailingButton, pressed && styles.trailingPressed]}>
                <AppIcon
                  color={hasSearch ? '#D8CEFF' : '#D6D1E0'}
                  name={hasSearch ? 'arrowRight' : 'filter'}
                  size={hasSearch ? 19 : 18}
                />
              </Pressable>
            </LinearGradient>
          </View>
        </LinearGradient>
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
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    position: 'relative',
  },
  pressed: { opacity: 0.72 },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: BRAND_COLORS.danger,
    borderWidth: 2,
    borderColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  searchShell: {
    height: 58,
    justifyContent: 'center',
    position: 'relative',
  },
  searchHalo: {
    position: 'absolute',
    left: -4,
    right: -4,
    top: 2,
    bottom: 2,
    borderRadius: 21,
    opacity: 0.38,
  },
  searchHaloFocused: { opacity: 0.72 },
  searchBorder: {
    height: 56,
    borderRadius: 18,
    padding: 1.25,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  searchBox: {
    flex: 1,
    borderRadius: 17,
    backgroundColor: '#070708',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 7,
    overflow: 'hidden',
    position: 'relative',
  },
  pinkGlow: {
    position: 'absolute',
    left: 22,
    top: 17,
    width: 28,
    height: 22,
    borderRadius: 14,
    backgroundColor: '#CF30AA',
    opacity: 0.15,
    transform: [{ scaleX: 1.35 }],
  },
  purpleGlow: {
    position: 'absolute',
    right: 22,
    top: 8,
    width: 46,
    height: 38,
    borderRadius: 20,
    backgroundColor: '#402FB5',
    opacity: 0.12,
  },
  searchIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 52,
    color: '#F7F4FA',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
    paddingHorizontal: 0,
    zIndex: 1,
  },
  trailingFrame: {
    width: 42,
    height: 42,
    borderRadius: 12,
    padding: 1,
    marginLeft: 8,
    zIndex: 2,
  },
  trailingButton: {
    flex: 1,
    borderRadius: 11,
    backgroundColor: 'rgba(7,7,10,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
