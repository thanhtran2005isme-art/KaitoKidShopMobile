import { useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { HomeProductCard } from '@/components/home/home-product-card';
import { BRAND_COLORS } from '@/constants/brand';
import type { Product } from '@/types/shop';

type ProductSectionProps = {
  title: string;
  subtitle?: string;
  products: Product[];
  badge?: string;
  badgeTone?: 'primary' | 'hot' | 'sale';
};

const BADGE_COLORS = {
  primary: { backgroundColor: '#EDE9FE', color: '#6D28D9' },
  hot: { backgroundColor: '#FFF7ED', color: '#C2410C' },
  sale: { backgroundColor: '#FEF2F2', color: '#B91C1C' },
} as const;

const HORIZONTAL_PADDING = 16;
const CARD_GAP = 10;
const MIN_CARD_WIDTH = 154;
const MAX_CARD_WIDTH = 188;

export function ProductSection({
  title,
  subtitle,
  products,
  badge,
  badgeTone = 'primary',
}: ProductSectionProps) {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();

  if (!products.length) return null;

  const badgeColors = BADGE_COLORS[badgeTone];
  const twoColumnWidth = Math.floor(
    (viewportWidth - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2,
  );
  const cardWidth = Math.min(
    MAX_CARD_WIDTH,
    Math.max(MIN_CARD_WIDTH, twoColumnWidth),
  );

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <View style={styles.titleRow}>
            <Text style={styles.heading}>{title}</Text>
            {badge ? (
              <View style={[styles.badge, { backgroundColor: badgeColors.backgroundColor }]}>
                <Text style={[styles.badgeText, { color: badgeColors.color }]}>{badge}</Text>
              </View>
            ) : null}
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <Pressable
          accessibilityLabel={`Xem tất cả ${title}`}
          accessibilityRole="button"
          onPress={() => router.push('/categories')}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.more}>Xem tất cả</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={products.slice(0, 8)}
        decelerationRate="fast"
        horizontal
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <HomeProductCard product={item} width={cardWidth} />
        )}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={cardWidth + CARD_GAP}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  headingRow: {
    paddingHorizontal: HORIZONTAL_PADDING,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: { flex: 1, gap: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  heading: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  subtitle: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
  },
  more: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingRight: HORIZONTAL_PADDING + 6,
    gap: CARD_GAP,
  },
  pressed: { opacity: 0.72 },
});
