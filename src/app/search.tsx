import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { shopApi } from '@/services/home.api';
import type { Product } from '@/types/shop';

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q || '');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (value: string) => {
    const q = value.trim();
    if (!q) return setProducts([]);
    setLoading(true);
    setError(null);
    try {
      const result = await shopApi.searchProducts(q);
      setProducts(result.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tìm sản phẩm.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.q) void search(params.q);
  }, [params.q]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <TextInput
          autoFocus={!params.q}
          onChangeText={setQuery}
          onSubmitEditing={() => void search(query)}
          placeholder="Tìm sản phẩm..."
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
      </View>
      {loading ? <ActivityIndicator color="#7C3AED" style={styles.loader} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && query.trim() && !products.length && !error ? <Text style={styles.empty}>Không tìm thấy sản phẩm phù hợp.</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={products}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => <ProductCard product={item} width={160} />}
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
  error: { color: '#B91C1C', paddingHorizontal: 16, marginBottom: 10 },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 34 },
  list: { paddingHorizontal: 12, paddingBottom: 28 },
  row: { justifyContent: 'space-around', marginBottom: 20 },
});
