import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { BRAND_COLORS } from '@/constants/brand';
import { useProductGrid } from '@/hooks/use-product-grid';
import { shopApi } from '@/services/home.api';
import type { Product } from '@/types/shop';

const SEARCH_DEBOUNCE_MS = 350;

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { cardWidth, columns, gap } = useProductGrid();
  const requestId = useRef(0);
  const [query, setQuery] = useState(params.q || '');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (value: string) => {
    const q = value.trim();
    const currentRequest = ++requestId.current;

    if (!q) {
      setProducts([]);
      setError(null);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const result = await shopApi.searchProducts(q);
      if (currentRequest === requestId.current) setProducts(result.items || []);
    } catch (err) {
      if (currentRequest === requestId.current) {
        setProducts([]);
        setError(err instanceof Error ? err.message : 'Không thể tìm sản phẩm.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setQuery(params.q?.trim() || '');
  }, [params.q]);

  useEffect(() => {
    const q = query.trim();

    if (!q) {
      requestId.current += 1;
      setProducts([]);
      setError(null);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      void search(q);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Quay lại"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <TextInput
          accessibilityLabel="Tìm sản phẩm"
          autoFocus={!params.q}
          onChangeText={setQuery}
          onSubmitEditing={() => void search(query)}
          placeholder="Tìm sản phẩm..."
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
      </View>

      {loading ? <ActivityIndicator color={BRAND_COLORS.primary} style={styles.loader} /> : null}

      {error ? (
        <View accessibilityRole="alert" style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void search(query)}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && hasSearched && !products.length && !error ? (
        <Text style={styles.empty}>Không tìm thấy sản phẩm phù hợp.</Text>
      ) : null}

      <FlatList
        key={`search-grid-${columns}`}
        contentContainerStyle={styles.list}
        data={products}
        initialNumToRender={8}
        keyExtractor={(item) => String(item.id)}
        numColumns={columns}
        columnWrapperStyle={[styles.row, { gap }]}
        renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  back: {
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
  input: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.surface,
    paddingHorizontal: 14,
    color: BRAND_COLORS.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  loader: { marginVertical: 20 },
  errorCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
    gap: 9,
    alignItems: 'flex-start',
  },
  error: { color: BRAND_COLORS.danger, lineHeight: 18 },
  retry: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  empty: { color: BRAND_COLORS.muted, textAlign: 'center', marginVertical: 34 },
  list: { paddingHorizontal: 12, paddingBottom: 28, flexGrow: 1 },
  row: { justifyContent: 'center', marginBottom: 20 },
  pressed: { opacity: 0.78 },
});
