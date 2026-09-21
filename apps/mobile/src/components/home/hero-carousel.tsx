import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import type { Banner } from '@/types/shop';

function decodeRoutePart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Banner>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const cardWidth = Math.min(width - 32, 560);
  const snapInterval = cardWidth + 12;

  useEffect(() => {
    if (banners.length < 2) return;

    const timer = setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % banners.length;
        listRef.current?.scrollToOffset({
          animated: true,
          offset: next * snapInterval,
        });
        return next;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [banners.length, snapInterval]);

  const openBanner = (link?: string | null) => {
    const target = link?.trim();
    if (!target) {
      router.push('/categories');
      return;
    }

    if (/^https?:\/\//i.test(target)) {
      void Linking.openURL(target);
      return;
    }

    const productMatch = target.match(/^\/?(?:product|products)\/([^/?#]+)/i);
    if (productMatch?.[1]) {
      router.push({ pathname: '/product/[slug]', params: { slug: decodeRoutePart(productMatch[1]) } });
      return;
    }

    const categoryMatch = target.match(/^\/?(?:category|categories)\/([^/?#]+)/i);
    if (categoryMatch?.[1]) {
      router.push({ pathname: '/categories', params: { category: decodeRoutePart(categoryMatch[1]) } });
      return;
    }

    router.push('/categories');
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / snapInterval);
    setActiveIndex(Math.max(0, Math.min(next, banners.length - 1)));
  };

  if (!banners.length) return null;

  return (
    <View style={styles.section}>
      <FlatList
        ref={listRef}
        contentContainerStyle={styles.listContent}
        data={banners}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
        horizontal
        keyExtractor={(item) => String(item.id)}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item, index }) => {
          const image = resolveMediaUrl(item.image);

          return (
            <Pressable
              accessibilityHint="Mở nội dung khuyến mãi"
              accessibilityLabel={item.title || `Banner ${index + 1}`}
              accessibilityRole="button"
              onPress={() => openBanner(item.link)}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth },
                pressed && styles.pressed,
              ]}>
              {image ? (
                <Image
                  contentFit="cover"
                  source={{ uri: image }}
                  style={StyleSheet.absoluteFill}
                  transition={250}
                />
              ) : (
                <View style={styles.imageFallback}>
                  <Text style={styles.imageFallbackText}>K</Text>
                </View>
              )}

              <View style={styles.overlay} />
              <View style={styles.copy}>
                {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
                <Text numberOfLines={2} style={styles.title}>
                  {item.title || 'Bộ sưu tập mới cho bé'}
                </Text>
                {item.description ? (
                  <Text numberOfLines={2} style={styles.description}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.cta}>
                  <Text style={styles.ctaText}>{item.primaryButton || 'Khám phá ngay'}</Text>
                  <Text style={styles.ctaArrow}>→</Text>
                </View>
              </View>

              <View style={styles.counter}>
                <Text style={styles.counterText}>
                  {index + 1}/{banners.length}
                </Text>
              </View>
            </Pressable>
          );
        }}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={snapInterval}
      />

      {banners.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Đang xem banner ${activeIndex + 1} trên ${banners.length}`}>
          {banners.map((banner, index) => (
            <View
              key={banner.id}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 11 },
  listContent: { paddingHorizontal: 16, gap: 12 },
  card: {
    height: 224,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: BRAND_COLORS.primaryDark,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  pressed: { opacity: 0.93 },
  imageFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    color: BRAND_COLORS.primary,
    fontSize: 72,
    fontWeight: '900',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.38)',
  },
  copy: {
    padding: 20,
    gap: 7,
    maxWidth: '86%',
  },
  subtitle: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  description: {
    color: '#F3F4F6',
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  ctaText: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  ctaArrow: {
    color: BRAND_COLORS.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  counter: {
    position: 'absolute',
    top: 14,
    right: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.5)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 22,
    backgroundColor: BRAND_COLORS.primary,
  },
});
