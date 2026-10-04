import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';

export function HomeSearchBar() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [focused, setFocused] = useState(false);
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

  const filterRotation = filterProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.stage}>
      <View pointerEvents="none" style={[styles.glow, styles.leftGlow, focused && styles.focusedGlow]} />
      <View pointerEvents="none" style={[styles.glow, styles.rightGlow, focused && styles.focusedGlow]} />

      <LinearGradient
        colors={['#6B7280', '#111111', '#111111', '#D1D5DB']}
        end={{ x: 1, y: 0.65 }}
        start={{ x: 0, y: 0.35 }}
        style={styles.border}>
        <View style={styles.main}>
          <View pointerEvents="none" style={styles.searchIcon}>
            <AppIcon color="#D1D5DB" name="search" size={24} />
          </View>

          <TextInput
            accessibilityLabel="Tìm kiếm sản phẩm"
            enterKeyHint="search"
            onBlur={() => setFocused(false)}
            onChangeText={setSearch}
            onFocus={() => setFocused(true)}
            onSubmitEditing={submitSearch}
            placeholder="Tìm kiếm..."
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            selectionColor="#FFFFFF"
            style={styles.input}
            value={search}
          />

          <View pointerEvents="none" style={styles.filterBorder}>
            <Animated.View style={[styles.filterRotor, { transform: [{ rotate: filterRotation }] }]}>
              <LinearGradient
                colors={['rgba(0,0,0,0)', '#6B7280', 'rgba(0,0,0,0)', '#D1D5DB', 'rgba(0,0,0,0)']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          <LinearGradient
            colors={['#1F2937', '#000000', '#111827']}
            end={{ x: 0.5, y: 1 }}
            start={{ x: 0.5, y: 0 }}
            style={styles.filterFrame}>
            <Pressable
              accessibilityLabel="Mở bộ lọc sản phẩm"
              accessibilityRole="button"
              onPress={() => router.push('/categories')}
              style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
              <AppIcon color="#F3F4F6" name="filter" size={27} />
            </Pressable>
          </LinearGradient>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { height: 70, position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  glow: { position: 'absolute', top: 7, width: 92, height: 56, borderRadius: 18, opacity: 0.5 },
  leftGlow: {
    left: -4,
    backgroundColor: 'rgba(17,24,39,0.10)',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 7,
  },
  rightGlow: {
    right: -4,
    backgroundColor: 'rgba(209,213,219,0.12)',
    shadowColor: '#9CA3AF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 7,
  },
  focusedGlow: { opacity: 0.78 },
  border: { position: 'absolute', left: 5, right: 5, height: 60, borderRadius: 12, padding: 2 },
  main: { flex: 1, borderRadius: 10, backgroundColor: '#010201', overflow: 'hidden', position: 'relative' },
  input: {
    width: '100%',
    height: 56,
    color: '#FFFFFF',
    paddingLeft: 59,
    paddingRight: 59,
    paddingVertical: 0,
    fontSize: 18,
    fontWeight: '500',
    backgroundColor: 'transparent',
  },
  searchIcon: { position: 'absolute', left: 20, top: 15, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  filterBorder: { position: 'absolute', width: 40, height: 42, top: 7, right: 7, borderRadius: 10, overflow: 'hidden', zIndex: 2 },
  filterRotor: { position: 'absolute', width: 104, height: 104, left: -32, top: -31 },
  filterFrame: {
    position: 'absolute',
    width: 38,
    height: 40,
    top: 8,
    right: 8,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(156,163,175,0.72)',
    zIndex: 3,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  filterButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
