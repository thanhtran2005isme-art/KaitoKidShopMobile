import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { BRAND, BRAND_COLORS } from '@/constants/brand';
import { useProductGrid } from '@/hooks/use-product-grid';
import { resolveMediaUrl } from '@/services/api-client';
import { shopApi } from '@/services/home.api';
import type { Category, Product } from '@/types/shop';

export default function CategoriesScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const { cardWidth, columns, gap } = useProductGrid();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState(params.category || '');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    shopApi.getCategories()
      .then((result) => {
        if (!active) return;
        setCategories(result);
        setSelected((current) => current || result[0]?.name || '');
      })
      .catch((err: unknown) => {
        if (active) setCategoryError(err instanceof Error ? err.message : 'Không thể tải danh mục.');
      })
      .finally(() => {
        if (active) setLoadingCategories(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!params.category || !categories.length) return;
    const match = categories.find((item) => item.name === params.category || item.slug === params.category);
    if (match) setSelected(match.name);
  }, [categories, params.category]);

  useEffect(() => {
    if (!selected) return;
    let active = true;

    setLoadingProducts(true);
    setProductError(null);

    shopApi.getProductsByCategory(selected)
      .then((result) => {
        if (active) setProducts(result.items || []);
      })
      .catch((err: unknown) => {
        if (active) {
          setProducts([]);
          setProductError(err instanceof Error ? err.message : 'Không thể tải sản phẩm.');
        }
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });

    return () => {
      active = false;
    };
  }, [selected]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Danh mục</Text>
        <Text style={styles.subtitle}>{BRAND.categorySubtitle}</Text>
      </View>

      {loadingCategories ? (
        <ActivityIndicator color={BRAND_COLORS.primary} style={styles.loader} />
      ) : categoryError ? (
        <Text style={styles.error}>{categoryError}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          {categories.map((item) => {
            const active = item.name === selected;
            const image = resolveMediaUrl(item.image);
            return (
              <Pressable
                key={item.id}
                accessibilityLabel={`Danh mục ${item.name}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(item.name)}
                style={styles.categoryItem}>
                <View style={[styles.categoryImageWrap, active && styles.categoryImageActive]}>
                  {image ? (
                    <Image
                      accessibilityLabel={item.name}
                      cachePolicy="memory-disk"
                      source={{ uri: image }}
                      contentFit="cover"
                      transition={160}
                      style={styles.categoryImage}
                    />
                  ) : (
                    <Text style={styles.fallback}>K</Text>
                  )}
                </View>
                <Text numberOfLines={1} style={[styles.categoryName, active && styles.categoryNameActive]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {productError ? <Text style={styles.error}>{productError}</Text> : null}
      {loadingProducts ? (
        <ActivityIndicator color={BRAND_COLORS.primary} style={styles.loader} />
      ) : (
        <FlatList
          key={`categories-grid-${columns}`}
          contentContainerStyle={styles.productList}
          data={products}
          initialNumToRender={8}
          keyExtractor={(item) => String(item.id)}
          numColumns={columns}
          columnWrapperStyle={[styles.productRow, { gap }]}
          ListEmptyComponent={selected && !productError ? <Text style={styles.empty}>Danh mục này chưa có sản phẩm.</Text> : null}
          renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
          showsVerticalScrollIndicator={false}
          windowSize={7}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 4 },
  title: { color: BRAND_COLORS.ink, fontSize: 28, fontWeight: '900' },
  subtitle: { color: BRAND_COLORS.muted, fontSize: 13 },
  loader: { marginVertical: 26 },
  categoryList: { paddingHorizontal: 16, paddingBottom: 18, gap: 14 },
  categoryItem: { width: 74, alignItems: 'center', gap: 7 },
  categoryImageWrap: { width: 62, height: 62, borderRadius: 20, backgroundColor: '#FFFFFF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  categoryImageActive: { borderColor: BRAND_COLORS.primary },
  categoryImage: { width: '100%', height: '100%' },
  fallback: { color: BRAND_COLORS.primary, fontSize: 24, fontWeight: '900' },
  categoryName: { color: BRAND_COLORS.muted, fontSize: 11, fontWeight: '700' },
  categoryNameActive: { color: BRAND_COLORS.primary },
  error: { color: BRAND_COLORS.danger, paddingHorizontal: 16, marginBottom: 10, lineHeight: 18 },
  productList: { paddingHorizontal: 12, paddingBottom: 28, flexGrow: 1 },
  productRow: { justifyContent: 'center', marginBottom: 20 },
  empty: { color: BRAND_COLORS.muted, textAlign: 'center', marginTop: 30 },
});
