import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { useProductGrid } from '@/hooks/use-product-grid';
import { shopApi } from '@/services/home.api';
import type { Product } from '@/types/shop';

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
    const initialQuery = params.q?.trim();
    if (!initialQuery) return;
    setQuery(initialQuery);
    void search(initialQuery);
  }, [params.q, search]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <TextInput
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

      {loading ? <ActivityIndicator color="#7C3AED" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && hasSearched && !products.length && !error ? (
        <Text style={styles.empty}>Không tìm thấy sản phẩm phù hợp.</Text>
      ) : null}

      <FlatList
        key={`search-grid-${columns}`}
        contentContainerStyle={styles.list}
        data={products}
        keyExtractor={(item) => String(item.id)}
        numColumns={columns}
        columnWrapperStyle={[styles.row, { gap }]}
        renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#111827', fontSize: 34, lineHeight: 36 },
  input: { flex: 1, height: 46, borderRadius: 15, backgroundColor: '#FFFFFF', paddingHorizontal: 14, color: '#111827', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  loader: { marginVertical: 20 },
  error: { color: '#B91C1C', paddingHorizontal: 16, marginBottom: 10, lineHeight: 18 },
  empty: { color: '#6B7280', textAlign: 'center', marginVertical: 34 },
  list: { paddingHorizontal: 12, paddingBottom: 28, flexGrow: 1 },
  row: { justifyContent: 'center', marginBottom: 20 },
});
