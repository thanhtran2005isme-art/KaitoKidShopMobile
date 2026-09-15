import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resolveMediaUrl } from '@/services/api-client';
import { shopApi } from '@/services/home.api';
import type { ProductDetail } from '@/types/shop';

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    shopApi.getProduct(slug)
      .then(setProduct)
      .catch((err) => setError(err instanceof Error ? err.message : 'Không thể tải sản phẩm.'));
  }, [slug]);

  if (!product && !error) {
    return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#7C3AED" /></SafeAreaView>;
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>{error || 'Không tìm thấy sản phẩm.'}</Text>
        <Pressable onPress={() => router.back()} style={styles.darkButton}><Text style={styles.darkButtonText}>Quay lại</Text></Pressable>
      </SafeAreaView>
    );
  }

  const heroImage = resolveMediaUrl(product.images?.[0] || product.image);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {heroImage ? <Image source={{ uri: heroImage }} contentFit="cover" transition={200} style={styles.heroImage} /> : null}
          <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        </View>
        <View style={styles.content}>
          <Text style={styles.category}>{product.category}</Text>
          <Text style={styles.title}>{product.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            {product.oldPrice && product.oldPrice > product.price ? <Text style={styles.oldPrice}>{formatPrice(product.oldPrice)}</Text> : null}
          </View>
          <Text style={styles.meta}>★ {product.rating.toFixed(1)} · Đã bán {product.soldCount} · Còn {product.stock}</Text>

          {product.colors?.length ? <OptionGroup label="Màu sắc" values={product.colors} /> : null}
          {product.sizes?.length ? <OptionGroup label="Kích cỡ" values={product.sizes} /> : null}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Mô tả sản phẩm</Text>
          <Text style={styles.description}>{product.description || product.shortDescription || 'Thông tin sản phẩm đang được cập nhật.'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OptionGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.optionLabel}>{label}</Text>
      <View style={styles.chips}>
        {values.map((value) => <View key={value} style={styles.chip}><Text style={styles.chipText}>{value}</Text></View>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  error: { color: '#B91C1C', textAlign: 'center' },
  hero: { height: 430, backgroundColor: '#F3F4F6' },
  heroImage: { width: '100%', height: '100%' },
  back: { position: 'absolute', top: 12, left: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#111827', fontSize: 34, lineHeight: 36 },
  content: { padding: 18, gap: 9 },
  category: { color: '#7C3AED', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { color: '#111827', fontSize: 25, lineHeight: 31, fontWeight: '900' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  price: { color: '#7C3AED', fontSize: 23, fontWeight: '900' },
  oldPrice: { color: '#9CA3AF', fontSize: 14, textDecorationLine: 'line-through' },
  meta: { color: '#6B7280', fontSize: 12 },
  optionGroup: { marginTop: 12, gap: 8 },
  optionLabel: { color: '#111827', fontSize: 14, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 13, paddingVertical: 8 },
  chipText: { color: '#374151', fontSize: 12, fontWeight: '700' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginVertical: 10 },
  sectionTitle: { color: '#111827', fontSize: 18, fontWeight: '900' },
  description: { color: '#4B5563', fontSize: 14, lineHeight: 22 },
  darkButton: { backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  darkButtonText: { color: '#FFFFFF', fontWeight: '800' },
});
