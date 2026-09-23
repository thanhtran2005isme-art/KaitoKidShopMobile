import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import { discoveryApi } from '@/services/discovery.api';
import type { Lookbook, LookbookFilters } from '@/types/shop';

export default function LookbooksScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const columns = width >= 860 ? 2 : 1;
  const [filters, setFilters] = useState<LookbookFilters>({ seasons: [], styles: [] });
  const [season, setSeason] = useState('');
  const [style, setStyle] = useState('');
  const [items, setItems] = useState<Lookbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    discoveryApi.getLookbookFilters()
      .then((result) => {
        if (active) setFilters(result);
      })
      .catch(() => {
        if (active) setFilters({ seasons: [], styles: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      setItems(await discoveryApi.getLookbooks({
        season: season || undefined,
        style: style || undefined,
      }));
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải lookbook.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [season, style]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const hasFilters = filters.seasons.length > 0 || filters.styles.length > 0;
  const header = useMemo(() => (
    <View style={styles.headerContent}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Quay lại"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>SHOP THE LOOK</Text>
          <Text style={styles.title}>Lookbook KaitoKid</Text>
          <Text style={styles.subtitle}>Chọn phong cách rồi chạm hotspot để xem từng món đồ</Text>
        </View>
      </View>

      {hasFilters ? (
        <View style={styles.filters}>
          {filters.seasons.length ? (
            <FilterRow
              label="Mùa"
              value={season}
              values={filters.seasons}
              onChange={setSeason}
            />
          ) : null}
          {filters.styles.length ? (
            <FilterRow
              label="Phong cách"
              value={style}
              values={filters.styles}
              onChange={setStyle}
            />
          ) : null}
        </View>
      ) : null}

      {error ? (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  ), [error, filters.seasons, filters.styles, hasFilters, router, season, style]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {loading && !items.length ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateText}>Đang tải lookbook...</Text>
        </View>
      ) : (
        <FlatList
          key={`lookbooks-${columns}`}
          contentContainerStyle={styles.list}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          data={items}
          keyExtractor={(item) => String(item.id)}
          numColumns={columns}
          ListHeaderComponent={header}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Chưa có lookbook phù hợp</Text>
                <Text style={styles.stateText}>Thử chọn mùa hoặc phong cách khác.</Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={BRAND_COLORS.primary}
              onRefresh={() => void load(true)}
            />
          }
          renderItem={({ item }) => (
            <LookbookCard item={item} onPress={() => router.push(`/lookbooks/${item.id}`)} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function FilterRow({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}>
        <FilterChip label="Tất cả" active={!value} onPress={() => onChange('')} />
        {values.map((item) => (
          <FilterChip
            key={item}
            label={item}
            active={value === item}
            onPress={() => onChange(item)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LookbookCard({ item, onPress }: { item: Lookbook; onPress: () => void }) {
  const image = resolveMediaUrl(item.image);
  return (
    <Pressable
      accessibilityLabel={`Mở lookbook ${item.title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {image ? (
        <Image
          accessibilityLabel={item.title}
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
        <View style={styles.metaRow}>
          {item.season ? <Text style={styles.metaPill}>{item.season}</Text> : null}
          {item.style ? <Text style={styles.metaPill}>{item.style}</Text> : null}
          {item.hotspots.length ? (
            <Text style={styles.hotspotCount}>{item.hotspots.length} sản phẩm</Text>
          ) : null}
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {item.subtitle ? <Text style={styles.cardSubtitle}>{item.subtitle}</Text> : null}
        {item.description ? (
          <Text numberOfLines={2} style={styles.cardDescription}>{item.description}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  list: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 34,
    gap: 14,
    flexGrow: 1,
  },
  row: { gap: 14 },
  headerContent: { gap: 16, paddingBottom: 12 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 8 },
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
  eyebrow: { color: BRAND_COLORS.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: BRAND_COLORS.ink, fontSize: 26, fontWeight: '900' },
  subtitle: { color: BRAND_COLORS.muted, fontSize: 12, lineHeight: 18 },
  filters: { gap: 12 },
  filterGroup: { gap: 7 },
  filterLabel: { color: BRAND_COLORS.ink, fontSize: 12, fontWeight: '800' },
  filterList: { gap: 8 },
  filterChip: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 15,
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  filterChipActive: { backgroundColor: BRAND_COLORS.primary, borderColor: BRAND_COLORS.primary },
  filterChipText: { color: BRAND_COLORS.muted, fontSize: 11, fontWeight: '800' },
  filterChipTextActive: { color: '#FFFFFF' },
  inlineError: { padding: 12, borderRadius: 14, backgroundColor: '#FEF2F2' },
  inlineErrorText: { color: BRAND_COLORS.danger, fontSize: 11, lineHeight: 17, fontWeight: '700' },
  card: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    marginBottom: 14,
  },
  cardImage: { width: '100%', aspectRatio: 1.15, backgroundColor: '#E5E7EB' },
  cardFallback: {
    width: '100%',
    aspectRatio: 1.15,
    backgroundColor: BRAND_COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFallbackText: { color: BRAND_COLORS.accent, fontSize: 52, fontWeight: '900' },
  cardCopy: { padding: 15, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  metaPill: {
    color: BRAND_COLORS.primaryDark,
    backgroundColor: BRAND_COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: '800',
  },
  hotspotCount: { color: BRAND_COLORS.muted, fontSize: 9, fontWeight: '700' },
  cardTitle: { color: BRAND_COLORS.ink, fontSize: 19, fontWeight: '900' },
  cardSubtitle: { color: BRAND_COLORS.primary, fontSize: 11, fontWeight: '800' },
  cardDescription: { color: BRAND_COLORS.muted, fontSize: 11, lineHeight: 17 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 28 },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyTitle: { color: BRAND_COLORS.ink, fontSize: 18, fontWeight: '900' },
  stateText: { color: BRAND_COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  pressed: { opacity: 0.78 },
});
