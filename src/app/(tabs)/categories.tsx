import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { resolveMediaUrl } from '@/services/api-client';
import { shopApi } from '@/services/home.api';
import type { Category, Product } from '@/types/shop';

export default function CategoriesScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState(params.category || '');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    shopApi.getCategories()
      .then((result) => {
        setCategories(result);
        setSelected((current) => current || result[0]?.name || '');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không thể tải danh mục.'))
      .finally(() => setLoadingCategories(false));
  }, []);

  useEffect(() => {
    if (!params.category || !categories.length) return;
    const match = categories.find((item) => item.name === params.category || item.slug === params.category);
    if (match) setSelected(match.name);
  }, [categories, params.category]);

  useEffect(() => {
    if (!selected) return;
    setLoadingProducts(true);
    setError(null);
    shopApi.getProductsByCategory(selected)
      .then((result) => setProducts(result.items || []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không thể tải sản phẩm.'))
      .finally(() => setLoadingProducts(false));
  }, [selected]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Danh mục</Text>
        <Text style={styles.subtitle}>Chọn nhóm sản phẩm phù hợp với bé</Text>
      </View>

      {loadingCategories ? <ActivityIndicator color="#7C3AED" style={styles.loader} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          {categories.map((item) => {
            const active = item.name === selected;
            const image = resolveMediaUrl(item.image);
            return (
              <Pressable key={item.id} onPress={() => setSelected(item.name)} style={styles.categoryItem}>
                <View style={[styles.categoryImageWrap, active && styles.categoryImageActive]}>
                  {image ? <Image source={{ uri: image }} contentFit="cover" transition={160} style={styles.categoryImage} /> : <Text style={styles.fallback}>👕</Text>}
                </View>
                <Text numberOfLines={1} style={[styles.categoryName, active && styles.categoryNameActive]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loadingProducts ? <ActivityIndicator color="#7C3AED" style={styles.loader} /> : (
        <FlatList
          contentContainerStyle={styles.productList}
          data={products}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          ListEmptyComponent={<Text style={styles.empty}>Danh mục này chưa có sản phẩm.</Text>}
          renderItem={({ item }) => <ProductCard product={item} width={160} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 4 },
  title: { color: '#111827', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#6B7280', fontSize: 13 },
  loader: { marginVertical: 26 },
  categoryList: { paddingHorizontal: 16, paddingBottom: 18, gap: 14 },
  categoryItem: { width: 74, alignItems: 'center', gap: 7 },
  categoryImageWrap: { width: 62, height: 62, borderRadius: 20, backgroundColor: '#FFFFFF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  categoryImageActive: { borderColor: '#7C3AED' },
  categoryImage: { width: '100%', height: '100%' },
  fallback: { fontSize: 26 },
  categoryName: { color: '#6B7280', fontSize: 11, fontWeight: '700' },
  categoryNameActive: { color: '#7C3AED' },
  error: { color: '#B91C1C', paddingHorizontal: 16, marginBottom: 10 },
  productList: { paddingHorizontal: 12, paddingBottom: 28 },
  productRow: { justifyContent: 'space-around', marginBottom: 20 },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 30 },
});
