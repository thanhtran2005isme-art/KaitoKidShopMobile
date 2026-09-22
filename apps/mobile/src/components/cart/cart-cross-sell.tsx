import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '@/components/product/product-card';
import { BRAND_COLORS } from '@/constants/brand';
import type { Product } from '@/types/shop';

export function CartCrossSell({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>GỢI Ý THÊM</Text>
        <Text style={styles.title}>Có thể bé cũng thích</Text>
        <Text style={styles.helper}>
          Mở sản phẩm để chọn đúng màu và size trước khi thêm vào giỏ.
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
  },
  heading: {
    paddingHorizontal: 16,
    gap: 3,
  },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 19,
    fontWeight: '900',
  },
  helper: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
});
