import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';

type ProductGalleryProps = {
  images: string[];
};

export function ProductGallery({ images }: ProductGalleryProps) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const galleryWidth = Math.min(Math.max(280, width - 32), 680);
  const galleryHeight = Math.min(Math.round(galleryWidth * 1.24), 620);

  const sources = Array.from(
    new Set(
      images
        .map((item) => resolveMediaUrl(item))
        .filter((item): item is string => Boolean(item)),
    ),
  );
  const visibleSources = sources.length ? sources : [''];

  const selectImage = (index: number) => {
    const next = Math.max(0, Math.min(index, visibleSources.length - 1));
    setActiveIndex(next);
    listRef.current?.scrollToOffset({
      animated: true,
      offset: next * galleryWidth,
    });
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / galleryWidth);
    setActiveIndex(Math.max(0, Math.min(next, visibleSources.length - 1)));
  };

  return (
    <View style={[styles.container, { width: galleryWidth }]}>
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
        renderItem={({ item }) => (
          <View style={[styles.hero, { width: galleryWidth, height: galleryHeight }]}>
            {item ? (
              <Image
                accessibilityLabel="Ảnh sản phẩm"
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: item }}
                style={styles.heroImage}
                transition={180}
              />
            ) : (
              <View style={styles.fallback}>
                <AppIcon color={BRAND_COLORS.primary} name="image" size={54} />
                <Text style={styles.fallbackText}>Ảnh sản phẩm đang cập nhật</Text>
              </View>
            )}
          </View>
        )}
        showsHorizontalScrollIndicator={false}
      />

      {visibleSources.length > 1 ? (
        <>
          <Pressable
            accessibilityLabel="Ảnh trước"
            accessibilityRole="button"
            disabled={activeIndex === 0}
            onPress={() => selectImage(activeIndex - 1)}
            style={({ pressed }) => [
              styles.arrow,
              styles.arrowLeft,
              activeIndex === 0 && styles.arrowDisabled,
              pressed && styles.pressed,
            ]}>
            <AppIcon color="#FFFFFF" name="arrowLeft" size={18} />
          </Pressable>

          <Pressable
            accessibilityLabel="Ảnh tiếp theo"
            accessibilityRole="button"
            disabled={activeIndex === visibleSources.length - 1}
            onPress={() => selectImage(activeIndex + 1)}
            style={({ pressed }) => [
              styles.arrow,
              styles.arrowRight,
              activeIndex === visibleSources.length - 1 && styles.arrowDisabled,
              pressed && styles.pressed,
            ]}>
            <AppIcon color="#FFFFFF" name="arrowRight" size={18} />
          </Pressable>

          <View pointerEvents="none" style={styles.dots}>
            {visibleSources.map((source, index) => (
              <View
                key={`dot-${source}-${index}`}
                style={[styles.dot, index === activeIndex && styles.dotActive]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  hero: {
    backgroundColor: '#F3F4F6',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  fallbackText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  arrow: {
    position: 'absolute',
    top: '47%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17,24,39,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  arrowLeft: { left: 10 },
  arrowRight: { right: 10 },
  arrowDisabled: { opacity: 0.28 },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.48)',
  },
  dotActive: {
    width: 20,
    backgroundColor: '#FFFFFF',
  },
  pressed: { opacity: 0.78 },
});
