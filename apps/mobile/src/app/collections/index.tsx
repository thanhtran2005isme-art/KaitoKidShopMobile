import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import { discoveryApi } from '@/services/discovery.api';
import type { Collection } from '@/types/shop';

export default function CollectionsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const columns = width >= 760 ? 2 : 1;
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await discoveryApi.getCollections();
      setItems([...result].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải bộ sưu tập.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Quay lại"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>KHÁM PHÁ</Text>
          <Text style={styles.title}>Bộ sưu tập KaitoKid</Text>
          <Text style={styles.subtitle}>Trang phục theo từng dịp trong ngày của bé</Text>
        </View>
      </View>

      {loading && !items.length ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateText}>Đang tải bộ sưu tập...</Text>
        </View>
      ) : null}

      {error && !items.length ? (
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Chưa tải được bộ sưu tập</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load(false)}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading || items.length ? (
        <FlatList
          key={`collections-${columns}`}
          contentContainerStyle={styles.list}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          data={items}
          keyExtractor={(item) => String(item.id)}
          numColumns={columns}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={BRAND_COLORS.primary}
              onRefresh={() => void load(true)}
            />
          }
          renderItem={({ item }) => {
            const image = resolveMediaUrl(item.image);
            return (
              <Pressable
                accessibilityLabel={`Mở bộ sưu tập ${item.name}`}
                accessibilityRole="button"
                onPress={() => router.push(`/collections/${item.id}`)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                {image ? (
                  <Image
                    accessibilityLabel={item.name}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    source={{ uri: image }}
                    style={styles.cardImage}
                    transition={180}
                  />
                ) : (
                  <View style={styles.cardFallback}>
                    <Text style={styles.cardFallbackText}>K</Text>
                  </View>
                )}
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text numberOfLines={2} style={styles.cardDescription}>
                    {item.description || 'Khám phá những mẫu được chọn theo cùng chủ đề.'}
                  </Text>
                  <Text style={styles.cardAction}>Xem sản phẩm</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            !loading && !error ? (
              <View style={styles.centerState}>
                <Text style={styles.errorTitle}>Chưa có bộ sưu tập</Text>
                <Text style={styles.stateText}>Các bộ sưu tập mới sẽ xuất hiện tại đây.</Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  topBar: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
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
  heading: { flex: 1, gap: 3 },
  eyebrow: { color: BRAND_COLORS.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: BRAND_COLORS.ink, fontSize: 25, fontWeight: '900' },
  subtitle: { color: BRAND_COLORS.muted, fontSize: 12, lineHeight: 18 },
  list: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
    flexGrow: 1,
  },
  row: { gap: 14 },
  card: {
    flex: 1,
    minHeight: 320,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    marginBottom: 14,
  },
  cardImage: { width: '100%', aspectRatio: 1.5 },
  cardFallback: {
    width: '100%',
    aspectRatio: 1.5,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFallbackText: { color: BRAND_COLORS.primary, fontSize: 52, fontWeight: '900' },
  cardCopy: { padding: 16, gap: 6 },
  cardTitle: { color: BRAND_COLORS.ink, fontSize: 19, fontWeight: '900' },
  cardDescription: { color: BRAND_COLORS.muted, fontSize: 12, lineHeight: 18 },
  cardAction: { color: BRAND_COLORS.primary, fontSize: 12, fontWeight: '900', marginTop: 3 },
  centerState: {
    flex: 1,
    minHeight: 260,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: { color: BRAND_COLORS.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  errorTitle: { color: BRAND_COLORS.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  retryButton: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.primary,
  },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
