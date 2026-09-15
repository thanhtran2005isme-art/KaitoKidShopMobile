import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveMediaUrl } from '@/services/api-client';
import type { Product } from '@/types/shop';

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

export function ProductCard({ product, width = 168 }: { product: Product; width?: number }) {
  const router = useRouter();
  const image = resolveMediaUrl(product.image);
  const discount = product.oldPrice && product.oldPrice > product.price
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug || String(product.id) } })}
      style={[styles.card, { width }]}>
      <View style={styles.imageWrap}>
        {image ? <Image contentFit="cover" source={{ uri: image }} style={styles.image} transition={180} /> : <Text style={styles.imageFallback}>👚</Text>}
        {discount > 0 ? <View style={styles.saleBadge}><Text style={styles.saleText}>-{discount}%</Text></View> : null}
        {product.isNew ? <View style={styles.newBadge}><Text style={styles.newText}>MỚI</Text></View> : null}
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.category}>{product.category}</Text>
        <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          {product.oldPrice && product.oldPrice > product.price ? <Text style={styles.oldPrice}>{formatPrice(product.oldPrice)}</Text> : null}
        </View>
        {product.rating > 0 ? <Text style={styles.meta}>★ {product.rating.toFixed(1)} · Đã bán {product.soldCount}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 9 },
  imageWrap: { height: 210, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  imageFallback: { fontSize: 44 },
  saleBadge: { position: 'absolute', left: 8, top: 8, borderRadius: 999, backgroundColor: '#DC2626', paddingHorizontal: 8, paddingVertical: 4 },
  saleText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  newBadge: { position: 'absolute', right: 8, top: 8, borderRadius: 999, backgroundColor: '#111827', paddingHorizontal: 8, paddingVertical: 4 },
  newText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  copy: { gap: 3 },
  category: { color: '#9CA3AF', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  name: { color: '#111827', fontSize: 14, lineHeight: 19, fontWeight: '700', minHeight: 38 },
  priceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  price: { color: '#7C3AED', fontSize: 15, fontWeight: '900' },
  oldPrice: { color: '#9CA3AF', fontSize: 11, textDecorationLine: 'line-through' },
  meta: { color: '#6B7280', fontSize: 10, marginTop: 2 },
});
