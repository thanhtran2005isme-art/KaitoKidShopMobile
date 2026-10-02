import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
  const focusProgress = useRef(new Animated.Value(0)).current;
  const filterProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(filterProgress, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [filterProgress]);

  const submitSearch = () => {
    const q = search.trim();
    if (!q) return;
    router.push({ pathname: '/search', params: { q } });
  };

  const animateFocus = (focused: boolean) => {
    setSearchFocused(focused);
    Animated.timing(focusProgress, {
      toValue: focused ? 1 : 0,
      duration: focused ? 4000 : 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const nameParts = userName?.trim().split(/\s+/) || [];
  const firstName = nameParts.length ? nameParts[nameParts.length - 1] : undefined;
  const filterRotation = filterProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const glowOpacity = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 0.95],
  });
  const frameScale = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.006],
  });

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

      <View style={styles.searchStage}>
        <Animated.View
          pointerEvents="none"
          style={[styles.edgeGlow, styles.leftGlow, { opacity: glowOpacity }]}>
          <LinearGradient
            colors={['rgba(64,47,181,0)', 'rgba(64,47,181,0.78)', 'rgba(160,153,216,0.24)', 'rgba(64,47,181,0)']}
            end={{ x: 1, y: 0.5 }}
            locations={[0, 0.34, 0.58, 1]}
            start={{ x: 0, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[styles.edgeGlow, styles.rightGlow, { opacity: glowOpacity }]}>
          <LinearGradient
            colors={['rgba(207,48,170,0)', 'rgba(207,48,170,0.78)', 'rgba(223,162,218,0.26)', 'rgba(207,48,170,0)']}
            end={{ x: 0, y: 0.5 }}
            locations={[0, 0.34, 0.58, 1]}
            start={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View style={[styles.searchFrameWrap, { transform: [{ scale: frameScale }] }]}>
          <LinearGradient
            colors={['#5B4CE8', '#2D2458', '#1C191C', '#1C191C', '#72245F', '#E04ABC']}
            end={{ x: 1, y: 0.58 }}
            locations={[0, 0.1, 0.24, 0.62, 0.84, 1]}
            start={{ x: 0, y: 0.42 }}
            style={styles.outerBorder}>
            <LinearGradient
              colors={['#A099D8', '#201A2D', '#111014', '#25172B', '#DFA2DA']}
              end={{ x: 1, y: 0.62 }}
              locations={[0, 0.08, 0.42, 0.86, 1]}
              start={{ x: 0, y: 0.38 }}
              style={styles.whiteBorder}>
              <View style={styles.searchMain}>
                <LinearGradient
                  colors={['rgba(207,48,170,0)', 'rgba(207,48,170,0.16)', 'rgba(207,48,170,0)']}
                  end={{ x: 1, y: 0.5 }}
                  pointerEvents="none"
                  start={{ x: 0, y: 0.5 }}
                  style={styles.pinkMask}
                />

                {!searchFocused ? (
                  <LinearGradient
                    colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.62)', 'rgba(0,0,0,0)']}
                    end={{ x: 1, y: 0 }}
                    locations={[0, 0.68, 1]}
                    pointerEvents="none"
                    start={{ x: 0, y: 0 }}
                    style={styles.inputMask}
                  />
                ) : null}

                <View pointerEvents="none" style={styles.searchIcon}>
                  <AppIcon color="#C8C0CA" name="search" size={24} />
                </View>

                <TextInput
                  accessibilityLabel="Tìm kiếm sản phẩm"
                  enterKeyHint="search"
                  onBlur={() => animateFocus(false)}
                  onChangeText={setSearch}
                  onFocus={() => animateFocus(true)}
                  onSubmitEditing={submitSearch}
                  placeholder="Tìm kiếm..."
                  placeholderTextColor="#C0B9C0"
                  returnKeyType="search"
                  selectionColor="#DFA2DA"
                  style={styles.input}
                  value={search}
                />

                <View pointerEvents="none" style={styles.filterBorder}>
                  <Animated.View
                    style={[
                      styles.filterRotor,
                      {
                        transform: [{ rotate: filterRotation }],
                      },
                    ]}>
                    <LinearGradient
                      colors={[
                        'rgba(0,0,0,0)',
                        '#514D67',
                        'rgba(0,0,0,0)',
                        'rgba(0,0,0,0)',
                        '#514D67',
                        'rgba(0,0,0,0)',
                      ]}
                      end={{ x: 1, y: 1 }}
                      locations={[0, 0.18, 0.48, 0.5, 0.7, 1]}
                      start={{ x: 0, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                </View>

                <LinearGradient
                  colors={['#161329', '#050507', '#000000', '#1D1B4B']}
                  end={{ x: 0.5, y: 1 }}
                  locations={[0, 0.35, 0.66, 1]}
                  start={{ x: 0.5, y: 0 }}
                  style={styles.filterIconFrame}>
                  <Pressable
                    accessibilityLabel="Mở bộ lọc sản phẩm"
                    accessibilityRole="button"
                    onPress={() => router.push('/categories')}
                    style={({ pressed }) => [styles.filterButton, pressed && styles.filterPressed]}>
                    <AppIcon color="#D6D6E6" name="filter" size={27} />
                  </Pressable>
                </LinearGradient>
              </View>
            </LinearGradient>
          </LinearGradient>
        </Animated.View>
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

  searchStage: {
    height: 70,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  edgeGlow: {
    position: 'absolute',
    top: 5,
    width: 112,
    height: 60,
    borderRadius: 18,
  },
  leftGlow: {
    left: 0,
    shadowColor: '#5B4CE8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 16,
    elevation: 8,
  },
  rightGlow: {
    right: 0,
    shadowColor: '#CF30AA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 16,
    elevation: 8,
  },
  searchFrameWrap: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 5,
    height: 60,
    borderRadius: 12,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 6,
    elevation: 4,
  },
  outerBorder: {
    flex: 1,
    borderRadius: 12,
    padding: 1,
  },
  whiteBorder: {
    flex: 1,
    borderRadius: 11,
    padding: 1,
  },
  searchMain: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#010201',
    position: 'relative',
  },
  input: {
    width: '100%',
    height: 56,
    borderRadius: 10,
    color: '#FFFFFF',
    paddingLeft: 59,
    paddingRight: 59,
    paddingVertical: 0,
    fontSize: 18,
    fontWeight: '500',
    backgroundColor: 'transparent',
  },
  inputMask: {
    position: 'absolute',
    width: 96,
    height: 20,
    top: 18,
    left: 70,
    zIndex: 1,
    opacity: 0.34,
  },
  pinkMask: {
    position: 'absolute',
    width: 70,
    height: 42,
    top: 7,
    left: -13,
    borderRadius: 21,
    zIndex: 0,
    opacity: 0.72,
  },
  searchIcon: {
    position: 'absolute',
    left: 20,
    top: 15,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  filterBorder: {
    position: 'absolute',
    width: 40,
    height: 42,
    top: 7,
    right: 7,
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 2,
  },
  filterRotor: {
    position: 'absolute',
    width: 104,
    height: 104,
    left: -32,
    top: -31,
  },
  filterIconFrame: {
    position: 'absolute',
    width: 38,
    height: 40,
    top: 8,
    right: 8,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(81,77,103,0.78)',
    zIndex: 3,
    shadowColor: '#402FB5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  filterButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  filterPressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
