import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '@/components/product/product-card';
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

export function ProductSection({
  title,
  subtitle,
  products,
  badge,
  badgeTone = 'primary',
}: ProductSectionProps) {
  const router = useRouter();
  if (!products.length) return null;

  const badgeColors = BADGE_COLORS[badgeTone];

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

        <Pressable onPress={() => router.push('/categories')}>
          <Text style={styles.more}>Xem tất cả</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={products.slice(0, 8)}
        horizontal
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ProductCard product={item} width={174} />}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  headingRow: {
    paddingHorizontal: 16,
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
  list: { paddingHorizontal: 16, gap: 12 },
});
