import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';

type ProductGalleryProps = {
  images: string[];
};

export function ProductGallery({ images }: ProductGalleryProps) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const galleryWidth = Math.min(width, 680);

  const sources = Array.from(
    new Set(
      images
        .map((item) => resolveMediaUrl(item))
        .filter((item): item is string => Boolean(item)),
    ),
  );

  const visibleSources = sources.length ? sources : [''];

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / galleryWidth);
    setActiveIndex(Math.max(0, Math.min(next, visibleSources.length - 1)));
  };

  const selectImage = (index: number) => {
    setActiveIndex(index);
    listRef.current?.scrollToOffset({
      animated: true,
      offset: index * galleryWidth,
    });
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={visibleSources}
        getItemLayout={(_, index) => ({
          length: galleryWidth,
          offset: galleryWidth * index,
          index,
        })}
        horizontal
        keyExtractor={(item, index) => item || `fallback-${index}`}
        onMomentumScrollEnd={handleMomentumEnd}
        pagingEnabled
        renderItem={({ item, index }) => (
          <View style={[styles.hero, { width: galleryWidth }]}>
            {item ? (
              <Image
                contentFit="cover"
                source={{ uri: item }}
                style={styles.heroImage}
                transition={180}
              />
            ) : (
              <View style={styles.fallback}>
                <Text style={styles.fallbackIcon}>👕</Text>
                <Text style={styles.fallbackText}>Ảnh sản phẩm đang cập nhật</Text>
              </View>
            )}

            {visibleSources.length > 1 ? (
              <View style={styles.counter}>
                <Text style={styles.counterText}>
                  {index + 1}/{visibleSources.length}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        showsHorizontalScrollIndicator={false}
      />

      {visibleSources.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnails}>
          {visibleSources.map((source, index) => (
            <Pressable
              accessibilityLabel={`Xem ảnh ${index + 1}`}
              key={`${source}-${index}`}
              onPress={() => selectImage(index)}
              style={[
                styles.thumbnail,
                index === activeIndex && styles.thumbnailActive,
              ]}>
              {source ? (
                <Image
                  contentFit="cover"
                  source={{ uri: source }}
                  style={styles.thumbnailImage}
                  transition={120}
                />
              ) : (
                <Text style={styles.thumbnailFallback}>👕</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {visibleSources.length > 1 ? (
        <View style={styles.dots}>
          {visibleSources.map((source, index) => (
            <View
              key={`dot-${source}-${index}`}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  hero: {
    height: 430,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.primarySoft,
    gap: 10,
  },
  fallbackIcon: { fontSize: 58 },
  fallbackText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  counter: {
    position: 'absolute',
    right: 16,
    bottom: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.58)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  thumbnails: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  thumbnail: {
    width: 58,
    height: 70,
    borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailActive: {
    borderColor: BRAND_COLORS.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: { fontSize: 24 },
  dots: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    width: 18,
    backgroundColor: BRAND_COLORS.primary,
  },
});
