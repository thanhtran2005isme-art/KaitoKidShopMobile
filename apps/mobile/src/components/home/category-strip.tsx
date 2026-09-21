import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import type { Category } from '@/types/shop';

const PASTELS = ['#EDE9FE', '#DBEAFE', '#FEF3C7', '#FCE7F3', '#DCFCE7', '#FFE4E6'];

function fallbackIcon(name: string) {
  const value = name.toLowerCase();
  if (value.includes('quần')) return '👖';
  if (value.includes('váy') || value.includes('đầm')) return '👗';
  if (value.includes('phụ kiện')) return '🧢';
  if (value.includes('áo khoác')) return '🧥';
  return '👕';
}

export function CategoryStrip({ categories }: { categories: Category[] }) {
  const router = useRouter();

  const rootCategories = categories.filter((item) => !item.parentId);
  const visible = (rootCategories.length ? rootCategories : categories).slice(0, 8);

  if (!visible.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>DANH MỤC</Text>
          <Text style={styles.heading}>Bé đang cần gì?</Text>
        </View>
        <Pressable onPress={() => router.push('/categories')}>
          <Text style={styles.more}>Xem tất cả</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={visible}
        horizontal
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => {
          const image = resolveMediaUrl(item.image);

          return (
            <Pressable
              accessibilityLabel={item.name}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/categories', params: { category: item.slug || item.name } })
              }
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <View style={[styles.imageWrap, { backgroundColor: PASTELS[index % PASTELS.length] }]}>
                {image ? (
                  <Image
                    contentFit="cover"
                    source={{ uri: image }}
                    style={styles.image}
                    transition={180}
                  />
                ) : (
                  <Text style={styles.fallback}>{fallbackIcon(item.name)}</Text>
                )}
              </View>
              <Text numberOfLines={2} style={styles.label}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 13 },
  headingRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: { flex: 1, gap: 2 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heading: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  more: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  list: { paddingHorizontal: 16, gap: 14 },
  item: {
    width: 82,
    alignItems: 'center',
    gap: 8,
  },
  pressed: { opacity: 0.72 },
  imageWrap: {
    width: 74,
    height: 74,
    borderRadius: 23,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  image: { width: '100%', height: '100%' },
  fallback: { fontSize: 31 },
  label: {
    color: '#374151',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    fontWeight: '700',
  },
});
