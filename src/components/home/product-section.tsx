import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ProductCard } from '@/components/product/product-card';
import type { Product } from '@/types/shop';

export function ProductSection({ title, subtitle, products }: { title: string; subtitle?: string; products: Product[] }) {
  const router = useRouter();
  if (!products.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.heading}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <Pressable onPress={() => router.push('/categories')}><Text style={styles.more}>Xem tất cả</Text></Pressable>
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={products}
        horizontal
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ProductCard product={item} />}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  headingRow: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1, gap: 3 },
  heading: { color: '#111827', fontSize: 20, fontWeight: '900' },
  subtitle: { color: '#6B7280', fontSize: 12 },
  more: { color: '#7C3AED', fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: 16, gap: 12 },
});
