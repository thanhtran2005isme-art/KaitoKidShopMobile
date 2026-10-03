import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '@/components/product/product-card';
import { BRAND_COLORS } from '@/constants/brand';
import type { Product } from '@/types/shop';

export function CartCrossSell({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.title}>Gợi ý thêm</Text>
        <Text style={styles.helper}>
          Chọn sản phẩm để xem màu và size phù hợp.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} width={172} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    marginHorizontal: -16,
    paddingTop: 2,
  },
  heading: {
    paddingHorizontal: 16,
    gap: 3,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  helper: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  list: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 6,
  },
});
