import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import type { Collection } from '@/types/shop';

export function CollectionSection({ collections }: { collections: Collection[] }) {
  const router = useRouter();
  if (!collections.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>BỘ SƯU TẬP</Text>
          <Text style={styles.heading}>Bộ sưu tập nổi bật</Text>
          <Text style={styles.subtitle}>Chọn nhanh một chủ đề phù hợp cho bé</Text>
        </View>
        <Pressable
          accessibilityLabel="Xem tất cả bộ sưu tập"
          accessibilityRole="button"
          onPress={() => router.push('/collections')}
          style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
          <Text style={styles.more}>Xem tất cả</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}>
        {collections.slice(0, 4).map((collection) => {
          const image = resolveMediaUrl(collection.image);
          return (
            <Pressable
              key={collection.id}
              accessibilityLabel={`Mở bộ sưu tập ${collection.name}`}
              accessibilityRole="button"
              onPress={() => router.push(`/collections/${collection.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              {image ? (
                <Image
                  accessibilityLabel={collection.name}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: image }}
                  style={styles.image}
                  transition={180}
                />
              ) : (
                <View style={styles.imageFallback}>
                  <Text style={styles.imageFallbackText}>K</Text>
                </View>
              )}
              <View style={styles.overlay} />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.name}>{collection.name}</Text>
                <Text numberOfLines={2} style={styles.description}>
                  {collection.description || 'Khám phá các mẫu phối sẵn cho bé.'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  headingRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  heading: { color: BRAND_COLORS.ink, fontSize: 20, fontWeight: '900' },
  subtitle: { color: BRAND_COLORS.muted, fontSize: 11 },
  moreButton: { minHeight: 44, justifyContent: 'center', paddingLeft: 10 },
  more: { color: BRAND_COLORS.primary, fontSize: 12, fontWeight: '800' },
  list: { paddingHorizontal: 16, gap: 12 },
  card: {
    width: 248,
    height: 178,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: BRAND_COLORS.primarySoft,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    color: BRAND_COLORS.primary,
    fontSize: 46,
    fontWeight: '900',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.26)',
  },
  copy: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    gap: 4,
  },
  name: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  description: { color: '#F3F4F6', fontSize: 10, lineHeight: 15, fontWeight: '600' },
  pressed: { opacity: 0.82 },
});
