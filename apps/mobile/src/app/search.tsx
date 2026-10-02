import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { AppIcon } from '@/components/ui/app-icon';
import { BRAND, BRAND_COLORS } from '@/constants/brand';
import { useProductGrid } from '@/hooks/use-product-grid';
import { shopApi } from '@/services/home.api';
import type { Product } from '@/types/shop';

const SEARCH_DEBOUNCE_MS = 350;

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { cardWidth, columns, gap } = useProductGrid();
  const requestId = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState(params.q || '');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (value: string) => {
    const q = value.trim();
    const currentRequest = ++requestId.current;

    if (!q) {
      setProducts([]);
      setError(null);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const result = await shopApi.searchProducts(q);
      if (currentRequest === requestId.current) setProducts(result.items || []);
    } catch (err) {
      if (currentRequest === requestId.current) {
        setProducts([]);
        setError(err instanceof Error ? err.message : 'Không thể tìm sản phẩm.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setQuery(params.q?.trim() || '');
  }, [params.q]);

  useEffect(() => {
    const q = query.trim();

    if (!q) {
      requestId.current += 1;
      setProducts([]);
      setError(null);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      void search(q);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, search]);

  const clearSearch = useCallback(() => {
    requestId.current += 1;
    setQuery('');
    setProducts([]);
    setError(null);
    setHasSearched(false);
    setLoading(false);
    inputRef.current?.focus();
  }, []);

  const state = !query.trim()
    ? 'idle'
    : loading && !products.length
      ? 'loading'
      : error
        ? 'error'
        : hasSearched && !products.length
          ? 'empty'
          : 'results';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityLabel="Quay lại"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <AppIcon color={BRAND_COLORS.ink} name="arrowLeft" size={22} />
          </Pressable>

          <View style={styles.searchField}>
            <View pointerEvents="none" style={styles.searchIcon}>
              <AppIcon color={BRAND_COLORS.muted} name="search" size={19} />
            </View>
            <TextInput
              ref={inputRef}
              accessibilityLabel="Tìm sản phẩm"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={!params.q}
              onChangeText={setQuery}
              onSubmitEditing={() => void search(query)}
              placeholder={BRAND.searchPlaceholder}
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              style={styles.input}
              value={query}
            />
            {query.length ? (
              <Pressable
                accessibilityLabel="Xóa nội dung tìm kiếm"
                accessibilityRole="button"
                hitSlop={4}
                onPress={clearSearch}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
                <AppIcon color={BRAND_COLORS.muted} name="close" size={18} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>TÌM KIẾM</Text>
          <Text style={styles.title}>Tìm đúng món đồ bạn cần</Text>
          <Text style={styles.subtitle}>
            Tìm theo tên sản phẩm, kiểu dáng hoặc từ khóa thời trang.
          </Text>
        </View>
      </View>

      <View style={styles.resultBar}>
        <Text accessibilityLiveRegion="polite" style={styles.resultText}>
          {loading
            ? 'Đang tìm sản phẩm…'
            : query.trim() && hasSearched && !error
              ? `${products.length} sản phẩm phù hợp`
              : 'KaitoKid Fashion'}
        </Text>
      </View>

      {state === 'idle' ? (
        <View style={styles.stateCard}>
          <View style={styles.stateIcon}>
            <AppIcon color={BRAND_COLORS.primary} name="search" size={28} />
          </View>
          <Text style={styles.stateTitle}>Bắt đầu với một từ khóa</Text>
          <Text style={styles.stateDescription}>
            Ví dụ: áo sơ mi, váy, quần jean hoặc phụ kiện. Kết quả chỉ dùng dữ liệu thật từ hệ thống.
          </Text>
        </View>
      ) : state === 'loading' ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang tìm sản phẩm</Text>
          <Text style={styles.stateDescription}>Kết quả sẽ xuất hiện ngay khi tải xong.</Text>
        </View>
      ) : state === 'error' ? (
        <View accessibilityRole="alert" style={styles.stateCard}>
          <View style={[styles.stateIcon, styles.errorIcon]}>
            <AppIcon color={BRAND_COLORS.danger} name="warning" size={26} />
          </View>
          <Text style={styles.stateTitle}>Chưa thể tìm kiếm</Text>
          <Text style={styles.stateDescription}>{error}</Text>
          <Pressable
            accessibilityLabel="Thử tìm lại"
            accessibilityRole="button"
            onPress={() => void search(query)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <AppIcon color={BRAND_COLORS.surface} name="refresh" size={18} />
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : state === 'empty' ? (
        <View style={styles.stateCard}>
          <View style={styles.stateIcon}>
            <AppIcon color={BRAND_COLORS.primary} name="clothing" size={28} />
          </View>
          <Text style={styles.stateTitle}>Chưa có sản phẩm phù hợp</Text>
          <Text style={styles.stateDescription}>
            Thử từ khóa ngắn hơn hoặc xóa tìm kiếm để nhập từ khóa khác.
          </Text>
          <Pressable
            accessibilityLabel="Xóa tìm kiếm"
            accessibilityRole="button"
            onPress={clearSearch}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Xóa tìm kiếm</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          key={`search-grid-${columns}`}
          columnWrapperStyle={[styles.row, { gap }]}
          contentContainerStyle={styles.list}
          data={products}
          initialNumToRender={8}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => String(item.id)}
          numColumns={columns}
          renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
          showsVerticalScrollIndicator={false}
          windowSize={7}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  header: {
    backgroundColor: BRAND_COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_COLORS.line,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
  },
  searchField: {
    flex: 1,
    minHeight: 48,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    zIndex: 2,
    left: 14,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.surface,
    paddingLeft: 42,
    paddingRight: 48,
    color: BRAND_COLORS.ink,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  clearButton: {
    position: 'absolute',
    right: 4,
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 4,
  },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  subtitle: {
    maxWidth: 560,
    color: BRAND_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  resultBar: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  resultText: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  stateCard: {
    width: 'auto',
    maxWidth: 560,
    alignSelf: 'center',
    marginHorizontal: 16,
    marginTop: 18,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    gap: 9,
  },
  stateIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  errorIcon: {
    backgroundColor: '#FEF2F2',
  },
  stateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateDescription: {
    maxWidth: 390,
    color: BRAND_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 46,
    marginTop: 7,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: BRAND_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primaryButtonText: {
    color: BRAND_COLORS.surface,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 46,
    marginTop: 7,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  list: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingBottom: 32,
    flexGrow: 1,
  },
  row: {
    justifyContent: 'center',
    marginBottom: 14,
  },
  pressed: {
    opacity: 0.72,
  },
});
