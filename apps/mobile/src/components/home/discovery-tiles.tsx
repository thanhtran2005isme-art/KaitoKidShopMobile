import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import type { HomepageBlock } from '@/types/shop';

function decodeRoutePart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function DiscoveryTiles({ items }: { items?: HomepageBlock[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tiles = items?.slice(0, 4) || [];

  if (!tiles.length) return null;

  const tileWidth = Math.min((width - 44) / 2, 270);

  const open = (link?: string | null) => {
    const target = link?.trim();
    const categoryMatch = target?.match(/^\/?(?:category|categories)\/([^/?#]+)/i);

    if (categoryMatch?.[1]) {
      router.push({
        pathname: '/categories',
        params: { category: decodeRoutePart(categoryMatch[1]) },
      });
      return;
    }

    router.push('/categories');
  };

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>KHÁM PHÁ</Text>
          <Text style={styles.heading}>Chọn nhanh cho bé</Text>
        </View>
        <Pressable onPress={() => router.push('/categories')}>
          <Text style={styles.more}>Xem tất cả</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {tiles.map((item) => {
          const image = resolveMediaUrl(item.image);
          return (
            <Pressable
              key={item.id}
              onPress={() => open(item.link)}
              style={({ pressed }) => [
                styles.tile,
                { width: tileWidth },
                pressed && styles.pressed,
              ]}>
              {image ? (
                <Image
                  contentFit="cover"
                  source={{ uri: image }}
                  style={StyleSheet.absoluteFill}
                  transition={180}
                />
              ) : (
                <View style={styles.fallback}>
                  <Text style={styles.fallbackIcon}>✦</Text>
                </View>
              )}
              <View style={styles.overlay} />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.title}>
                  {item.title || 'KaitoKid'}
                </Text>
                {item.subtitle ? (
                  <Text numberOfLines={1} style={styles.subtitle}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, gap: 13 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: { flex: 1, gap: 2 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heading: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  more: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  tile: {
    height: 126,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: BRAND_COLORS.primarySoft,
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.88 },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: {
    color: BRAND_COLORS.primary,
    fontSize: 34,
    fontWeight: '900',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.26)',
  },
  copy: { padding: 12 },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: '#F3F4F6',
    fontSize: 10,
    marginTop: 2,
  },
});
