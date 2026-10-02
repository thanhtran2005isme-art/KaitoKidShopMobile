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
        colors={['#4B3EC8', '#1C191C', '#1C191C', '#B42A94']}
        end={{ x: 1, y: 0.65 }}
        start={{ x: 0, y: 0.35 }}
        style={styles.border}>
        <View style={styles.main}>
          <View pointerEvents="none" style={styles.searchIcon}>
            <AppIcon color="#C8C0CA" name="search" size={24} />
          </View>

          <TextInput
            accessibilityLabel="Tìm kiếm sản phẩm"
            enterKeyHint="search"
            onBlur={() => setFocused(false)}
            onChangeText={setSearch}
            onFocus={() => setFocused(true)}
            onSubmitEditing={submitSearch}
            placeholder="Tìm kiếm..."
            placeholderTextColor="#C0B9C0"
            returnKeyType="search"
            selectionColor="#DFA2DA"
            style={styles.input}
            value={search}
          />

          <View pointerEvents="none" style={styles.filterBorder}>
            <Animated.View style={[styles.filterRotor, { transform: [{ rotate: filterRotation }] }]}>
              <LinearGradient
                colors={['rgba(0,0,0,0)', '#514D67', 'rgba(0,0,0,0)', '#514D67', 'rgba(0,0,0,0)']}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>

          <LinearGradient
            colors={['#161329', '#000000', '#1D1B4B']}
            end={{ x: 0.5, y: 1 }}
            start={{ x: 0.5, y: 0 }}
            style={styles.filterFrame}>
            <Pressable
              accessibilityLabel="Mở bộ lọc sản phẩm"
              accessibilityRole="button"
              onPress={() => router.push('/categories')}
              style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
              <AppIcon color="#D6D6E6" name="filter" size={27} />
            </Pressable>
          </LinearGradient>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { height: 70, position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  glow: { position: 'absolute', top: 7, width: 92, height: 56, borderRadius: 18, opacity: 0.72 },
  leftGlow: {
    left: -4,
    backgroundColor: 'rgba(64,47,181,0.13)',
    shadowColor: '#402FB5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.92,
    shadowRadius: 18,
    elevation: 9,
  },
  rightGlow: {
    right: -4,
    backgroundColor: 'rgba(207,48,170,0.13)',
    shadowColor: '#CF30AA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.92,
    shadowRadius: 18,
    elevation: 9,
  },
  focusedGlow: { opacity: 1 },
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
    borderColor: 'rgba(81,77,103,0.78)',
    zIndex: 3,
    shadowColor: '#402FB5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  filterButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
});
