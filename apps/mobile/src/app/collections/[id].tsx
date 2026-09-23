import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { BRAND_COLORS } from '@/constants/brand';
import { useProductGrid } from '@/hooks/use-product-grid';
import { resolveMediaUrl } from '@/services/api-client';
import { discoveryApi } from '@/services/discovery.api';
import type { Collection, Product } from '@/types/shop';

const SORT_OPTIONS = [
  { label: 'Nổi bật', value: '' },
  { label: 'Mới nhất', value: 'newest' },
  { label: 'Bán chạy', value: 'bestseller' },
  { label: 'Giá tăng', value: 'price-asc' },
  { label: 'Giá giảm', value: 'price-desc' },
] as const;

export default function CollectionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const collectionId = Number(params.id);
  const { cardWidth, columns, gap } = useProductGrid();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sortBy, setSortBy] = useState('');
  const [loadingCollection, setLoadingCollection] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCollection = useCallback(async () => {
    if (!Number.isInteger(collectionId) || collectionId <= 0) {
      setError('Bộ sưu tập không hợp lệ.');
      setLoadingCollection(false);
      return;
    }

    setLoadingCollection(true);
    setError(null);
    try {
      setCollection(await discoveryApi.getCollection(collectionId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải bộ sưu tập.');
    } finally {
      setLoadingCollection(false);
    }
  }, [collectionId]);

  const loadProducts = useCallback(async () => {
    if (!Number.isInteger(collectionId) || collectionId <= 0) {
      setLoadingProducts(false);
      return;
    }

    setLoadingProducts(true);
    try {
      const result = await discoveryApi.getCollectionProducts(collectionId, {
        sortBy: sortBy || undefined,
        pageSize: 40,
      });
      setProducts(result.items || []);
    } catch (loadError) {
      setProducts([]);
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải sản phẩm trong bộ sưu tập.');
    } finally {
      setLoadingProducts(false);
    }
  }, [collectionId, sortBy]);

  useEffect(() => {
    void loadCollection();
  }, [loadCollection]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  if (loadingCollection && !collection) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateText}>Đang mở bộ sưu tập...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!collection) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Không mở được bộ sưu tập</Text>
          <Text style={styles.stateText}>{error || 'Bộ sưu tập không tồn tại hoặc đã ẩn.'}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.retryButton}>
            <Text style={styles.retryText}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const heroImage = resolveMediaUrl(collection.image);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList
        key={`collection-products-${columns}`}
        contentContainerStyle={styles.list}
        columnWrapperStyle={columns > 1 ? [styles.row, { gap }] : undefined}
        data={products}
        keyExtractor={(item) => String(item.id)}
        numColumns={columns}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.topBar}>
              <Pressable
                accessibilityLabel="Quay lại"
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Text style={styles.backText}>‹</Text>
              </Pressable>
              <Text style={styles.topTitle}>Bộ sưu tập</Text>
            </View>

            {heroImage ? (
              <Image
                accessibilityLabel={collection.name}
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: heroImage }}
                style={styles.hero}
                transition={180}
              />
            ) : (
              <View style={styles.heroFallback}>
                <Text style={styles.heroFallbackText}>KaitoKid</Text>
              </View>
            )}

            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>PHỐI ĐỒ THEO CHỦ ĐỀ</Text>
              <Text style={styles.title}>{collection.name}</Text>
              {collection.description ? (
                <Text style={styles.description}>{collection.description}</Text>
              ) : null}
            </View>

            <View style={styles.sortBlock}>
              <Text style={styles.sortLabel}>Sắp xếp sản phẩm</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sortList}>
                {SORT_OPTIONS.map((option) => {
                  const active = option.value === sortBy;
                  return (
                    <Pressable
                      key={option.value || 'default'}
                      accessibilityLabel={`Sắp xếp: ${option.label}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSortBy(option.value)}
                      style={({ pressed }) => [
                        styles.sortChip,
                        active && styles.sortChipActive,
                        pressed && styles.pressed,
                      ]}>
                      <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {error ? (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>{error}</Text>
              </View>
            ) : null}

            {loadingProducts ? (
              <View style={styles.productLoading}>
                <ActivityIndicator color={BRAND_COLORS.primary} />
                <Text style={styles.stateText}>Đang tải sản phẩm...</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loadingProducts ? (
            <View style={styles.emptyState}>
              <Text style={styles.errorTitle}>Chưa có sản phẩm</Text>
              <Text style={styles.stateText}>Bộ sưu tập này chưa có sản phẩm đang bán.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  list: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingBottom: 36,
    flexGrow: 1,
  },
  row: { justifyContent: 'center', marginBottom: 20 },
  headerContent: { gap: 16, paddingBottom: 18 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 8 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  backText: { color: BRAND_COLORS.ink, fontSize: 34, lineHeight: 36 },
  topTitle: { color: BRAND_COLORS.ink, fontSize: 18, fontWeight: '900' },
  hero: { width: '100%', aspectRatio: 1.8, borderRadius: 26, backgroundColor: '#E5E7EB' },
  heroFallback: {
    width: '100%',
    aspectRatio: 1.8,
    borderRadius: 26,
    backgroundColor: BRAND_COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFallbackText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  heroCopy: { paddingHorizontal: 4, gap: 5 },
  eyebrow: { color: BRAND_COLORS.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: BRAND_COLORS.ink, fontSize: 28, fontWeight: '900' },
  description: { color: BRAND_COLORS.muted, fontSize: 13, lineHeight: 20, maxWidth: 760 },
  sortBlock: { gap: 8 },
  sortLabel: { color: BRAND_COLORS.ink, fontSize: 12, fontWeight: '800', paddingHorizontal: 4 },
  sortList: { gap: 8, paddingHorizontal: 4 },
  sortChip: {
    minHeight: 44,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.surface,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  sortChipActive: { backgroundColor: BRAND_COLORS.primary, borderColor: BRAND_COLORS.primary },
  sortChipText: { color: BRAND_COLORS.muted, fontSize: 11, fontWeight: '800' },
  sortChipTextActive: { color: '#FFFFFF' },
  inlineError: { borderRadius: 14, padding: 12, backgroundColor: '#FEF2F2' },
  inlineErrorText: { color: BRAND_COLORS.danger, fontSize: 11, lineHeight: 17, fontWeight: '700' },
  productLoading: { alignItems: 'center', gap: 8, paddingVertical: 10 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 28 },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 46 },
  stateText: { color: BRAND_COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorTitle: { color: BRAND_COLORS.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  retryButton: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.primary,
  },
  retryText: { color: '#FFFFFF', fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
