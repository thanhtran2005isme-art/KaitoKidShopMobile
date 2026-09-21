import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveMediaUrl } from '@/services/api-client';
import type { Category } from '@/types/shop';

export function CategoryStrip({ categories }: { categories: Category[] }) {
  const router = useRouter();
  if (!categories.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Danh mục</Text>
        <Pressable onPress={() => router.push('/categories')}><Text style={styles.more}>Xem tất cả</Text></Pressable>
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={categories.slice(0, 10)}
        horizontal
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => {
          const image = resolveMediaUrl(item.image);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/categories', params: { category: item.name } })}
              style={styles.item}>
              <View style={styles.imageWrap}>
                {image ? <Image contentFit="cover" source={{ uri: image }} style={styles.image} transition={180} /> : <Text style={styles.fallback}>👕</Text>}
              </View>
              <Text numberOfLines={2} style={styles.label}>{item.name}</Text>
            </Pressable>
          );
        }}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  headingRow: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: '#111827', fontSize: 20, fontWeight: '900' },
  more: { color: '#7C3AED', fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: 16, gap: 14 },
  item: { width: 76, alignItems: 'center', gap: 8 },
  imageWrap: { width: 68, height: 68, borderRadius: 22, overflow: 'hidden', backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  fallback: { fontSize: 28 },
  label: { color: '#374151', fontSize: 12, lineHeight: 16, textAlign: 'center', fontWeight: '600' },
});
