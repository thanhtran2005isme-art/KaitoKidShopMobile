import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import { discoveryApi } from '@/services/discovery.api';
import type { Lookbook, LookbookHotspot } from '@/types/shop';

const PIN_SIZE = 44;

function formatPrice(value: number) {
  return `${Math.round(value || 0).toLocaleString('vi-VN')}đ`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function LookbookDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const lookbookId = Number(params.id);
  const [item, setItem] = useState<Lookbook | null>(null);
  const [selected, setSelected] = useState<LookbookHotspot | null>(null);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [imageAspectRatio, setImageAspectRatio] = useState(0.8);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(lookbookId) || lookbookId <= 0) {
      setError('Lookbook không hợp lệ.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await discoveryApi.getLookbook(lookbookId);
      setItem(result);
      setSelected(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải lookbook.');
    } finally {
      setLoading(false);
    }
  }, [lookbookId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setImageLayout({ width, height });
  };

  if (loading && !item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateText}>Đang mở lookbook...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Không mở được lookbook</Text>
          <Text style={styles.stateText}>{error || 'Lookbook không tồn tại hoặc đã ẩn.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const image = resolveMediaUrl(item.image);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Quay lại"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.topCopy}>
            <Text style={styles.eyebrow}>SHOP THE LOOK</Text>
            <Text numberOfLines={1} style={styles.topTitle}>{item.title}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          {item.season ? <Text style={styles.metaPill}>{item.season}</Text> : null}
          {item.style ? <Text style={styles.metaPill}>{item.style}</Text> : null}
          <Text style={styles.hotspotSummary}>{item.hotspots.length} sản phẩm có thể khám phá</Text>
        </View>

        <View
          onLayout={handleLayout}
          style={[styles.imageStage, { aspectRatio: imageAspectRatio }]}>
          {image ? (
            <Image
              accessibilityLabel={item.title}
              cachePolicy="memory-disk"
              contentFit="cover"
              onLoad={(event) => {
                const width = event.source.width || 0;
                const height = event.source.height || 0;
                if (width > 0 && height > 0) {
                  setImageAspectRatio(width / height);
                }
              }}
              source={{ uri: image }}
              style={styles.heroImage}
              transition={180}
            />
          ) : (
            <View style={styles.imageFallback}>
              <Text style={styles.imageFallbackText}>KaitoKid</Text>
            </View>
          )}

          {imageLayout.width > 0 && imageLayout.height > 0
            ? item.hotspots.map((hotspot, index) => {
                const x = clamp(Number(hotspot.x) || 0, 0, 100) / 100;
                const y = clamp(Number(hotspot.y) || 0, 0, 100) / 100;
                const left = clamp(imageLayout.width * x - PIN_SIZE / 2, 0, imageLayout.width - PIN_SIZE);
                const top = clamp(imageLayout.height * y - PIN_SIZE / 2, 0, imageLayout.height - PIN_SIZE);
                const active = selected?.id === hotspot.id;

                return (
                  <Pressable
                    key={hotspot.id}
                    accessibilityLabel={`Sản phẩm ${index + 1}: ${hotspot.productName}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelected(hotspot)}
                    style={({ pressed }) => [
                      styles.pin,
                      { left, top },
                      active && styles.pinActive,
                      pressed && styles.pinPressed,
                    ]}>
                    <Text style={[styles.pinText, active && styles.pinTextActive]}>{index + 1}</Text>
                  </Pressable>
                );
              })
            : null}
        </View>

        <Text style={styles.instruction}>
          Chạm vào các điểm đánh số trên ảnh để xem sản phẩm tương ứng.
        </Text>

        {selected ? (
          <SelectedProductCard
            hotspot={selected}
            onOpen={() => router.push(`/product/${selected.productId}`)}
          />
        ) : item.hotspots.length ? (
          <View style={styles.selectionHint}>
            <Text style={styles.selectionHintTitle}>Chọn một điểm trên ảnh</Text>
            <Text style={styles.stateText}>Thông tin sản phẩm sẽ hiện ngay bên dưới.</Text>
          </View>
        ) : null}

        <View style={styles.copyBlock}>
          <Text style={styles.title}>{item.title}</Text>
          {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        </View>

        {error ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SelectedProductCard({
  hotspot,
  onOpen,
}: {
  hotspot: LookbookHotspot;
  onOpen: () => void;
}) {
  const productImage = resolveMediaUrl(hotspot.productImage);
  return (
    <Pressable
      accessibilityLabel={`Xem sản phẩm ${hotspot.productName}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}>
      {productImage ? (
        <Image
          accessibilityLabel={hotspot.productName}
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: productImage }}
          style={styles.productImage}
          transition={160}
        />
      ) : (
        <View style={styles.productImageFallback}>
          <Text style={styles.productImageFallbackText}>K</Text>
        </View>
      )}
      <View style={styles.productCopy}>
        <Text numberOfLines={2} style={styles.productName}>{hotspot.productName}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(hotspot.productPrice)}</Text>
          {hotspot.productOldPrice && hotspot.productOldPrice > hotspot.productPrice ? (
            <Text style={styles.oldPrice}>{formatPrice(hotspot.productOldPrice)}</Text>
          ) : null}
        </View>
        {hotspot.note ? <Text numberOfLines={2} style={styles.note}>{hotspot.note}</Text> : null}
        <Text style={styles.productAction}>Xem chi tiết sản phẩm</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 14,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  backText: { color: BRAND_COLORS.ink, fontSize: 34, lineHeight: 36 },
  topCopy: { flex: 1, gap: 2 },
  eyebrow: { color: BRAND_COLORS.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  topTitle: { color: BRAND_COLORS.ink, fontSize: 20, fontWeight: '900' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  metaPill: {
    color: BRAND_COLORS.primaryDark,
    backgroundColor: BRAND_COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: '800',
  },
  hotspotSummary: { color: BRAND_COLORS.muted, fontSize: 10, fontWeight: '700' },
  imageStage: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    position: 'relative',
  },
  heroImage: { width: '100%', height: '100%' },
  imageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.accentSoft,
  },
  imageFallbackText: { color: BRAND_COLORS.accent, fontSize: 32, fontWeight: '900' },
  pin: {
    position: 'absolute',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 3,
    borderColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinActive: { backgroundColor: BRAND_COLORS.primary, borderColor: '#FFFFFF' },
  pinPressed: { opacity: 0.74 },
  pinText: { color: BRAND_COLORS.primaryDark, fontSize: 13, fontWeight: '900' },
  pinTextActive: { color: '#FFFFFF' },
  instruction: { color: BRAND_COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  selectionHint: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  selectionHintTitle: { color: BRAND_COLORS.ink, fontSize: 14, fontWeight: '900' },
  productCard: {
    minHeight: 148,
    borderRadius: 22,
    padding: 10,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    flexDirection: 'row',
    gap: 13,
  },
  productImage: { width: 100, height: 128, borderRadius: 16, backgroundColor: '#E5E7EB' },
  productImageFallback: {
    width: 100,
    height: 128,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImageFallbackText: { color: BRAND_COLORS.primary, fontSize: 32, fontWeight: '900' },
  productCopy: { flex: 1, justifyContent: 'center', gap: 7 },
  productName: { color: BRAND_COLORS.ink, fontSize: 15, lineHeight: 20, fontWeight: '900' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  price: { color: BRAND_COLORS.primary, fontSize: 17, fontWeight: '900' },
  oldPrice: { color: '#9CA3AF', fontSize: 11, textDecorationLine: 'line-through' },
  note: { color: BRAND_COLORS.muted, fontSize: 10, lineHeight: 15 },
  productAction: { color: BRAND_COLORS.primary, fontSize: 11, fontWeight: '900' },
  copyBlock: { gap: 6, paddingVertical: 4 },
  title: { color: BRAND_COLORS.ink, fontSize: 25, fontWeight: '900' },
  subtitle: { color: BRAND_COLORS.primary, fontSize: 13, fontWeight: '800' },
  description: { color: BRAND_COLORS.muted, fontSize: 13, lineHeight: 21 },
  inlineError: { borderRadius: 14, padding: 12, backgroundColor: '#FEF2F2' },
  inlineErrorText: { color: BRAND_COLORS.danger, fontSize: 11, lineHeight: 17, fontWeight: '700' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 28 },
  stateText: { color: BRAND_COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorTitle: { color: BRAND_COLORS.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  retryButton: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.primary,
  },
  retryText: { color: '#FFFFFF', fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
