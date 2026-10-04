import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import type { HomepageBlock } from '@/types/shop';
import { releaseWebFocus } from '@/utils/web-focus';

function decodeRoutePart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseQuery(value: string) {
  const result: Record<string, string> = {};
  value
    .split('&')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [rawKey, ...rest] = part.split('=');
      const rawValue = rest.join('=');
      if (!rawKey || !rawValue) return;
      result[decodeRoutePart(rawKey)] = decodeRoutePart(rawValue.replace(/\+/g, ' '));
    });
  return result;
}

export function DiscoveryTiles({ items }: { items?: HomepageBlock[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tiles = items?.slice(0, 4) || [];

  if (!tiles.length) return null;

  const tileWidth = Math.min((width - 44) / 2, 270);

  const openAllCategories = () => {
    releaseWebFocus();
    router.push('/categories');
  };

  const open = (link?: string | null) => {
    releaseWebFocus();

    const target = link?.trim();
    if (!target) {
      router.push('/categories');
      return;
    }

    const [pathPart, queryPart = ''] = target.split('?');
    const categoryMatch = pathPart.match(/^\/?(?:category|categories)\/([^/?#]+)/i);
    const routeIsCategories = /^\/?(?:category|categories)\/?$/i.test(pathPart);
    const query = parseQuery(queryPart);

    if (categoryMatch?.[1] || routeIsCategories) {
      router.push({
        pathname: '/categories',
        params: {
          ...(categoryMatch?.[1] ? { category: decodeRoutePart(categoryMatch[1]) } : {}),
          ...(query.gender ? { gender: query.gender } : {}),
          ...(query.ageGroup ? { ageGroup: query.ageGroup } : {}),
        },
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
          <Text style={styles.heading}>Chọn nhanh theo phong cách</Text>
        </View>
        <Pressable
          accessibilityLabel="Xem tất cả danh mục"
          accessibilityRole="button"
          onPress={openAllCategories}>
          <Text style={styles.more}>Xem tất cả</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {tiles.map((item) => {
          const image = resolveMediaUrl(item.image);
          return (
            <Pressable
              key={item.id}
              accessibilityLabel={item.title || 'Khám phá sản phẩm'}
              accessibilityRole="button"
              onPress={() => open(item.link)}
              style={({ pressed }) => [
                styles.tile,
                { width: tileWidth },
                pressed && styles.pressed,
              ]}>
              {image ? (
                <Image
                  accessibilityLabel={item.title || 'KaitoKid'}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: image }}
                  style={StyleSheet.absoluteFill}
                  transition={180}
                />
              ) : (
                <View style={styles.fallback}>
                  <AppIcon color={BRAND_COLORS.primary} name="sparkles" size={34} />
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
    ...StyleSheet.absoluteFill,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
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
