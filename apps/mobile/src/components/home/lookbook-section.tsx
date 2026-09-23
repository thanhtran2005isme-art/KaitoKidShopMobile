import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import type { Lookbook } from '@/types/shop';

export function LookbookSection({ lookbooks }: { lookbooks: Lookbook[] }) {
  const router = useRouter();
  if (!lookbooks.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>SHOP THE LOOK</Text>
          <Text style={styles.heading}>Phối đồ theo cảm hứng</Text>
          <Text style={styles.subtitle}>Chạm các điểm trên ảnh để xem từng sản phẩm</Text>
        </View>
        <Pressable
          accessibilityLabel="Xem tất cả lookbook"
          accessibilityRole="button"
          onPress={() => router.push('/lookbooks')}
          style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
          <Text style={styles.more}>Xem tất cả</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}>
        {lookbooks.slice(0, 4).map((lookbook) => {
          const image = resolveMediaUrl(lookbook.image);
          return (
            <Pressable
              key={lookbook.id}
              accessibilityLabel={`Mở lookbook ${lookbook.title}`}
              accessibilityRole="button"
              onPress={() => router.push(`/lookbooks/${lookbook.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              {image ? (
                <Image
                  accessibilityLabel={lookbook.title}
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
              <View style={styles.topMeta}>
                {lookbook.hotspots.length ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{lookbook.hotspots.length} sản phẩm</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.bottomCopy}>
                <Text numberOfLines={1} style={styles.title}>{lookbook.title}</Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {[lookbook.season, lookbook.style].filter(Boolean).join(' · ') || 'Cảm hứng KaitoKid'}
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
  eyebrow: { color: BRAND_COLORS.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  heading: { color: BRAND_COLORS.ink, fontSize: 20, fontWeight: '900' },
  subtitle: { color: BRAND_COLORS.muted, fontSize: 11 },
  moreButton: { minHeight: 44, justifyContent: 'center', paddingLeft: 10 },
  more: { color: BRAND_COLORS.primary, fontSize: 12, fontWeight: '800' },
  list: { paddingHorizontal: 16, gap: 12 },
  card: {
    width: 224,
    height: 286,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: BRAND_COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: { color: BRAND_COLORS.accent, fontSize: 46, fontWeight: '900' },
  topMeta: { position: 'absolute', top: 12, right: 12 },
  countBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(17,24,39,0.78)',
  },
  countText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  bottomCopy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    gap: 3,
    backgroundColor: 'rgba(17,24,39,0.72)',
  },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  meta: { color: '#E5E7EB', fontSize: 10, fontWeight: '600' },
  pressed: { opacity: 0.82 },
});
