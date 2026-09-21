import { Animated, StyleSheet, View } from 'react-native';
import { useEffect, useRef } from 'react';

export function ProductDetailSkeleton() {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: false,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <View style={styles.hero} />
      <View style={styles.content}>
        <View style={styles.category} />
        <View style={styles.title} />
        <View style={styles.titleShort} />
        <View style={styles.price} />
        <View style={styles.meta} />
        <View style={styles.block} />
        <View style={styles.block} />
        <View style={styles.description} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  hero: {
    height: 430,
    backgroundColor: '#E5E7EB',
  },
  content: {
    padding: 18,
    gap: 12,
  },
  category: {
    width: 90,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  title: {
    width: '88%',
    height: 24,
    borderRadius: 8,
    backgroundColor: '#D1D5DB',
  },
  titleShort: {
    width: '62%',
    height: 24,
    borderRadius: 8,
    backgroundColor: '#D1D5DB',
  },
  price: {
    width: 150,
    height: 25,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  meta: {
    width: 210,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  block: {
    width: '100%',
    height: 86,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  description: {
    width: '100%',
    height: 150,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
});
