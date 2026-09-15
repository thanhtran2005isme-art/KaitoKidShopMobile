import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { resolveMediaUrl } from '@/services/api-client';
import type { Banner } from '@/types/shop';

function decodeRoutePart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 32, 560);

  const openBanner = (link?: string | null) => {
    const target = link?.trim();
    if (!target) {
      router.push('/categories');
      return;
    }

    if (/^https?:\/\//i.test(target)) {
      void Linking.openURL(target);
      return;
    }

    const productMatch = target.match(/^\/?(?:product|products)\/([^/?#]+)/i);
    if (productMatch?.[1]) {
      router.push({ pathname: '/product/[slug]', params: { slug: decodeRoutePart(productMatch[1]) } });
      return;
    }

    const categoryMatch = target.match(/^\/?(?:category|categories)\/([^/?#]+)/i);
    if (categoryMatch?.[1]) {
      router.push({ pathname: '/categories', params: { category: decodeRoutePart(categoryMatch[1]) } });
      return;
    }

    router.push('/categories');
  };

  if (!banners.length) return null;

  return (
    <FlatList
      contentContainerStyle={styles.listContent}
      data={banners}
      decelerationRate="fast"
      horizontal
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => {
        const image = resolveMediaUrl(item.image);
        return (
          <Pressable
            accessibilityHint="Mở nội dung khuyến mãi"
            accessibilityRole="button"
            onPress={() => openBanner(item.link)}
            style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.pressed]}>
            {image ? <Image contentFit="cover" source={{ uri: image }} style={StyleSheet.absoluteFill} transition={250} /> : null}
            <View style={styles.overlay} />
            <View style={styles.copy}>
              {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
              <Text numberOfLines={2} style={styles.title}>{item.title || 'Bộ sưu tập mới'}</Text>
              {item.description ? <Text numberOfLines={2} style={styles.description}>{item.description}</Text> : null}
              <View style={styles.cta}><Text style={styles.ctaText}>{item.primaryButton || 'Khám phá ngay'}</Text></View>
            </View>
          </Pressable>
        );
      }}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + 12}
    />
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, gap: 12 },
  card: { height: 220, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1F2937', justifyContent: 'flex-end' },
  pressed: { opacity: 0.9 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  copy: { padding: 20, gap: 8, maxWidth: '82%' },
  subtitle: { color: '#FDE68A', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 26, lineHeight: 30, fontWeight: '900' },
  description: { color: '#F3F4F6', fontSize: 13, lineHeight: 18 },
  cta: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 15, paddingVertical: 9 },
  ctaText: { color: '#111827', fontSize: 12, fontWeight: '800' },
});
