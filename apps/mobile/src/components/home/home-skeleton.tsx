import { Animated, StyleSheet, View } from 'react-native';
import { useEffect, useRef } from 'react';

import { BRAND_COLORS } from '@/constants/brand';

export function HomeSkeleton() {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.hero} />

      <View style={styles.promoRow}>
        <View style={styles.promo} />
        <View style={styles.promo} />
      </View>

      <View style={styles.headingRow}>
        <View style={styles.heading} />
        <View style={styles.link} />
      </View>

      <View style={styles.categoryRow}>
        {Array.from({ length: 5 }).map((_, index) => (
          <View key={index} style={styles.category}>
            <View style={styles.categoryImage} />
            <View style={styles.categoryLabel} />
          </View>
        ))}
      </View>

      <View style={styles.headingRow}>
        <View style={styles.headingWide} />
        <View style={styles.link} />
      </View>

      <View style={styles.productRow}>
        <View style={styles.product} />
        <View style={styles.product} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20, paddingBottom: 14 },
  hero: {
    marginHorizontal: 16,
    height: 224,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
  },
  promoRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  promo: {
    width: 220,
    height: 76,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
  },
  headingRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    width: 92,
    height: 20,
    borderRadius: 8,
    backgroundColor: '#D1D5DB',
  },
  headingWide: {
    width: 150,
    height: 20,
    borderRadius: 8,
    backgroundColor: '#D1D5DB',
  },
  link: {
    width: 58,
    height: 13,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  category: { width: 78, gap: 8, alignItems: 'center' },
  categoryImage: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  categoryLabel: {
    width: 58,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  productRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  product: {
    width: 170,
    height: 280,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
});
