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
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND, BRAND_COLORS } from '@/constants/brand';

type HomeHeaderProps = {
  cartCount?: number | null;
  userName?: string | null;
};

type EffectLayerProps = {
  progress: Animated.Value;
  from: number;
  to: number;
  colors: readonly [string, string, ...string[]];
  locations?: readonly number[];
  style: StyleProp<ViewStyle>;
  opacity?: number;
};

function EffectLayer({
  progress,
  from,
  to,
  colors,
  locations,
  style,
  opacity = 1,
}: EffectLayerProps) {
  const rotation = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${from}deg`, `${to}deg`],
  });

  return (
    <View pointerEvents="none" style={[styles.effectLayer, style]}>
      <Animated.View
        style={[
          styles.effectRotor,
          {
            opacity,
            transform: [{ rotate: rotation }],
          },
        ]}>
        <LinearGradient
          colors={colors as [string, string, ...string[]]}
          end={{ x: 1, y: 1 }}
          locations={locations as number[] | undefined}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

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
      duration: focused ? 4000 : 2000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  };

  const nameParts = userName?.trim().split(/\s+/) || [];
  const firstName = nameParts.length ? nameParts[nameParts.length - 1] : undefined;
  const filterRotation = filterProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
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
        <EffectLayer
          colors={[
            '#000000',
            '#402FB5',
            '#000000',
            '#000000',
            '#CF30AA',
            '#000000',
            '#000000',
          ]}
          from={60}
          locations={[0, 0.05, 0.38, 0.5, 0.6, 0.87, 1]}
          opacity={0.4}
          progress={focusProgress}
          style={styles.glow}
          to={420}
        />

        <EffectLayer
          colors={[
            'rgba(0,0,0,0)',
            '#18116A',
            'rgba(0,0,0,0)',
            'rgba(0,0,0,0)',
            '#6E1B60',
            'rgba(0,0,0,0)',
          ]}
          from={82}
          locations={[0, 0.05, 0.1, 0.5, 0.56, 0.6]}
          progress={focusProgress}
          style={styles.darkBorderBg}
          to={442}
        />
        <EffectLayer
          colors={[
            'rgba(0,0,0,0)',
            '#18116A',
            'rgba(0,0,0,0)',
            'rgba(0,0,0,0)',
            '#6E1B60',
            'rgba(0,0,0,0)',
          ]}
          from={82}
          locations={[0, 0.05, 0.1, 0.5, 0.56, 0.6]}
          opacity={0.92}
          progress={focusProgress}
          style={styles.darkBorderBg}
          to={442}
        />
        <EffectLayer
          colors={[
            'rgba(0,0,0,0)',
            '#18116A',
            'rgba(0,0,0,0)',
            'rgba(0,0,0,0)',
            '#6E1B60',
            'rgba(0,0,0,0)',
          ]}
          from={82}
          locations={[0, 0.05, 0.1, 0.5, 0.56, 0.6]}
          opacity={0.84}
          progress={focusProgress}
          style={styles.darkBorderBg}
          to={442}
        />

        <EffectLayer
          colors={[
            'rgba(0,0,0,0)',
            '#A099D8',
            'rgba(0,0,0,0)',
            'rgba(0,0,0,0)',
            '#DFA2DA',
            'rgba(0,0,0,0)',
          ]}
          from={83}
          locations={[0, 0.04, 0.08, 0.5, 0.54, 0.58]}
          progress={focusProgress}
          style={styles.whiteLayer}
          to={443}
        />

        <EffectLayer
          colors={['#1C191C', '#402FB5', '#1C191C', '#1C191C', '#CF30AA', '#1C191C']}
          from={70}
          locations={[0, 0.05, 0.14, 0.5, 0.6, 0.64]}
          progress={focusProgress}
          style={styles.borderLayer}
          to={430}
        />

        <View style={styles.searchMain}>
          <View pointerEvents="none" style={styles.pinkMask} />

          {!searchFocused ? (
            <LinearGradient
              colors={['rgba(0,0,0,0)', '#000000']}
              end={{ x: 1, y: 0 }}
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
                  '#3D3A4F',
                  'rgba(0,0,0,0)',
                  'rgba(0,0,0,0)',
                  '#3D3A4F',
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
            colors={['#161329', '#000000', '#1D1B4B']}
            end={{ x: 0.5, y: 1 }}
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
  },
  effectLayer: {
    position: 'absolute',
    overflow: 'hidden',
  },
  effectRotor: {
    position: 'absolute',
    width: 600,
    height: 600,
    left: '50%',
    top: '50%',
    marginLeft: -300,
    marginTop: -300,
  },
  glow: {
    left: -20,
    right: -20,
    top: 0,
    height: 70,
    borderRadius: 12,
    shadowColor: '#CF30AA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
  },
  darkBorderBg: {
    left: 1,
    right: 1,
    top: 2.5,
    height: 65,
    borderRadius: 12,
  },
  whiteLayer: {
    left: 3.5,
    right: 3.5,
    top: 3.5,
    height: 63,
    borderRadius: 10,
    shadowColor: '#DFA2DA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 5,
  },
  borderLayer: {
    left: 5.5,
    right: 5.5,
    top: 5.5,
    height: 59,
    borderRadius: 11,
  },
  searchMain: {
    position: 'absolute',
    left: 6.5,
    right: 6.5,
    top: 7,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#010201',
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
    pointerEvents: 'none',
    position: 'absolute',
    width: 100,
    height: 20,
    top: 18,
    left: 70,
    zIndex: 2,
  },
  pinkMask: {
    pointerEvents: 'none',
    position: 'absolute',
    width: 30,
    height: 20,
    top: 10,
    left: 5,
    borderRadius: 12,
    backgroundColor: '#CF30AA',
    opacity: 0.8,
    shadowColor: '#CF30AA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
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
    width: 160,
    height: 160,
    left: -60,
    top: -59,
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
    borderColor: 'rgba(61,58,79,0.7)',
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
