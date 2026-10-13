import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
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
import { productSearchApi, type SearchFacets, type SearchFilters, type SearchSort } from '@/services/product-search.api';
import type { Product } from '@/types/shop';

const DEBOUNCE_MS = 350;
const PAGE_SIZE = 20;
const EMPTY_FACETS: SearchFacets = { categories: {}, sizes: {}, colors: {}, priceRanges: {} };

const SORTS: { id: SearchSort; label: string }[] = [
  { id: 'newest', label: 'Mới nhất' },
  { id: 'price-asc', label: 'Giá tăng' },
  { id: 'price-desc', label: 'Giá giảm' },
  { id: 'bestseller', label: 'Bán chạy' },
  { id: 'rating', label: 'Đánh giá' },
];

type PriceBand = 'all' | 'under-200' | '200-500' | 'over-500';
const PRICE_BANDS: { id: PriceBand; label: string; minPrice?: number; maxPrice?: number }[] = [
  { id: 'all', label: 'Mọi mức giá' },
  { id: 'under-200', label: 'Dưới 200k', maxPrice: 199_999 },
  { id: '200-500', label: '200–500k', minPrice: 200_000, maxPrice: 500_000 },
  { id: 'over-500', label: 'Trên 500k', minPrice: 500_001 },
];

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Không thể tìm kiếm sản phẩm.';
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { cardWidth, columns, gap } = useProductGrid();
  const inputRef = useRef<TextInput>(null);
  const searchGeneration = useRef(0);
  const suggestionGeneration = useRef(0);
  const pageInFlight = useRef(false);

  const [keyword, setKeyword] = useState(params.q || '');
  const [activeQuery, setActiveQuery] = useState((params.q || '').trim());
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SearchSort>('newest');
  const [priceBand, setPriceBand] = useState<PriceBand>('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [facets, setFacets] = useState<SearchFacets>(EMPTY_FACETS);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setKeyword(params.q || '');
  }, [params.q]);

  useEffect(() => {
    const timer = setTimeout(() => setActiveQuery(keyword.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    const value = keyword.trim();
    const generation = ++suggestionGeneration.current;
    if (!focused || value.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      void productSearchApi.suggest(value).then((result) => {
        if (generation === suggestionGeneration.current) {
          setSuggestions(result.suggestions || []);
        }
      }).catch(() => {
        if (generation === suggestionGeneration.current) setSuggestions([]);
      });
    }, 250);
    return () => {
      clearTimeout(timer);
      suggestionGeneration.current += 1;
    };
  }, [focused, keyword]);

  const getFilters = useCallback((q: string, nextPage: number): SearchFilters => {
    const price = PRICE_BANDS.find((item) => item.id === priceBand) || PRICE_BANDS[0];
    return {
      query: q,
      category: category || undefined,
      minPrice: price.minPrice,
      maxPrice: price.maxPrice,
      sortBy: sort,
      page: nextPage,
      pageSize: PAGE_SIZE,
    };
  }, [category, priceBand, sort]);

  useEffect(() => {
    const generation = ++searchGeneration.current;
    pageInFlight.current = false;
    setLoadingMore(false);
    setMoreError(null);
    setProducts([]);
    setTotal(0);
    setFacets(EMPTY_FACETS);
    setPage(1);
    setDidYouMean(null);
    setError(null);
    if (!activeQuery) {
      setLoading(false);
      setFacets(EMPTY_FACETS);
      return;
    }

    setLoading(true);
    void productSearchApi.search(getFilters(activeQuery, 1)).then((response) => {
      if (generation !== searchGeneration.current) return;
      setProducts(response.items || []);
      setTotal(response.total);
      setPage(response.page);
      setFacets(response.facets || EMPTY_FACETS);
      setDidYouMean(response.didYouMean || null);
    }).catch((reason) => {
      if (generation === searchGeneration.current) setError(errorText(reason));
    }).finally(() => {
      if (generation === searchGeneration.current) setLoading(false);
    });
    return () => {
      searchGeneration.current += 1;
    };
  }, [activeQuery, getFilters, retryKey]);

  const loadMore = useCallback(async (retry = false) => {
    if (pageInFlight.current || loading || loadingMore || error || !activeQuery || products.length >= total || (moreError && !retry)) return;
    const generation = searchGeneration.current;
    const nextPage = page + 1;
    pageInFlight.current = true;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const response = await productSearchApi.search(getFilters(activeQuery, nextPage));
      if (generation !== searchGeneration.current) return;
      setProducts((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...response.items.filter((item) => !seen.has(item.id))];
      });
      setTotal(response.total);
      setPage(response.page);
    } catch (reason) {
      if (generation === searchGeneration.current) setMoreError(errorText(reason));
    } finally {
      if (generation === searchGeneration.current) {
        pageInFlight.current = false;
        setLoadingMore(false);
      }
    }
  }, [activeQuery, error, getFilters, loading, loadingMore, moreError, page, products.length, total]);

  const submitKeyword = (value: string) => {
    const next = value.trim();
    setKeyword(next);
    setActiveQuery(next);
    Keyboard.dismiss();
    setFocused(false);
  };

  const clearKeyword = () => {
    setKeyword('');
    setActiveQuery('');
    setCategory('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const pendingQuery = keyword.trim() !== activeQuery;
  const idle = !keyword.trim();
  const waiting = !idle && (pendingQuery || loading);
  const hasMore = products.length > 0 && products.length < total;
  const categoryOptions = Object.entries(facets.categories).filter(([name]) => name.trim());

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <Pressable
            accessibilityLabel="Quay lại"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <AppIcon color={BRAND_COLORS.ink} name="arrowLeft" size={22} />
          </Pressable>
          <View style={styles.searchField}>
            <AppIcon color={BRAND_COLORS.muted} name="search" size={20} />
            <TextInput
              ref={inputRef}
              accessibilityLabel="Nhập từ khóa sản phẩm"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={!params.q}
              onBlur={() => setFocused(false)}
              onChangeText={setKeyword}
              onFocus={() => setFocused(true)}
              onSubmitEditing={() => submitKeyword(keyword)}
              placeholder={BRAND.searchPlaceholder}
              placeholderTextColor={BRAND_COLORS.muted}
              returnKeyType="search"
              style={styles.input}
              value={keyword}
            />
            {keyword.length ? (
              <Pressable
                accessibilityLabel="Xóa từ khóa"
                accessibilityRole="button"
                onPress={clearKeyword}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
                <AppIcon color={BRAND_COLORS.muted} name="close" size={18} />
              </Pressable>
            ) : null}
          </View>
        </View>
        {focused && suggestions.length > 0 ? (
          <View style={styles.suggestionBox}>
            <Text style={styles.filterHeading}>Gợi ý tìm kiếm</Text>
            {suggestions.slice(0, 6).map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                accessibilityLabel={'Tìm ' + suggestion}
                onPress={() => submitKeyword(suggestion)}
                style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}>
                <AppIcon color={BRAND_COLORS.muted} name="search" size={17} />
                <Text numberOfLines={1} style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {!idle ? (
          <>
            <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {SORTS.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === item.id }}
                  onPress={() => setSort(item.id)}
                  style={({ pressed }) => [styles.chip, sort === item.id && styles.chipActive, pressed && styles.pressed]}>
                  <Text style={[styles.chipText, sort === item.id && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {PRICE_BANDS.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: priceBand === item.id }}
                  onPress={() => setPriceBand(item.id)}
                  style={({ pressed }) => [styles.chip, priceBand === item.id && styles.chipActive, pressed && styles.pressed]}>
                  <Text style={[styles.chipText, priceBand === item.id && styles.chipTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {categoryOptions.length || category ? (
              <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === '' }}
                  onPress={() => setCategory('')}
                  style={({ pressed }) => [styles.chip, !category && styles.chipActive, pressed && styles.pressed]}>
                  <Text style={[styles.chipText, !category && styles.chipTextActive]}>Tất cả danh mục</Text>
                </Pressable>
                {categoryOptions.map(([name, count]) => (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityState={{ selected: category === name }}
                    onPress={() => setCategory(name)}
                    style={({ pressed }) => [styles.chip, category === name && styles.chipActive, pressed && styles.pressed]}>
                    <Text style={[styles.chipText, category === name && styles.chipTextActive]}>{name} ({count})</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </>
        ) : null}
      </View>

      <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
        {idle ? 'Tìm kiếm sản phẩm KaitoKid' :
          waiting ? 'Đang tìm sản phẩm…' :
            error ? 'Tìm kiếm chưa thành công' :
              total ? total + ' sản phẩm phù hợp' : 'Không tìm thấy sản phẩm'}
      </Text>

      {idle ? (
        <View style={styles.state}>
          <AppIcon color={BRAND_COLORS.primary} name="search" size={32} />
          <Text style={styles.stateTitle}>Bạn muốn tìm sản phẩm nào?</Text>
          <Text style={styles.stateDescription}>Nhập tên sản phẩm, kiểu dáng hoặc mã sản phẩm để tìm trong cửa hàng.</Text>
        </View>
      ) : waiting ? (
        <View style={styles.state}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang tìm kiếm</Text>
        </View>
      ) : error ? (
        <View accessibilityRole="alert" style={styles.state}>
          <AppIcon color={BRAND_COLORS.danger} name="warning" size={30} />
          <Text style={styles.stateTitle}>Không thể tìm sản phẩm</Text>
          <Text style={styles.stateDescription}>{error}</Text>
          <Pressable
            accessibilityLabel="Thử tìm kiếm lại"
            accessibilityRole="button"
            onPress={() => setRetryKey((value) => value + 1)}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : total === 0 ? (
        <View style={styles.state}>
          <AppIcon color={BRAND_COLORS.muted} name="search" size={30} />
          <Text style={styles.stateTitle}>Chưa tìm thấy sản phẩm</Text>
          <Text style={styles.stateDescription}>Thử từ khóa khác hoặc bỏ một số điều kiện lọc.</Text>
          {didYouMean ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={'Tìm từ khóa gợi ý ' + didYouMean}
              onPress={() => submitKeyword(didYouMean)}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Có phải bạn muốn tìm “{didYouMean}”?</Text>
            </Pressable>
          ) : null}
          {category || priceBand !== 'all' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => { setCategory(''); setPriceBand('all'); }}
              style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
              <Text style={styles.resetText}>Xóa bộ lọc</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          key={'product-search-' + columns}
          columnWrapperStyle={[styles.gridRow, { gap }]}
          contentContainerStyle={styles.productList}
          data={products}
          initialNumToRender={8}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => String(item.id)}
          numColumns={columns}
          renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
          showsVerticalScrollIndicator={false}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={hasMore ? (
            <View style={styles.footer}>
              {loadingMore ? (
                <ActivityIndicator color={BRAND_COLORS.primary} />
              ) : moreError ? (
                <>
                  <Text style={styles.stateDescription}>{moreError}</Text>
                  <Pressable accessibilityRole="button" onPress={() => void loadMore(true)} style={styles.retryButton}>
                    <Text style={styles.retryText}>Tải thêm lần nữa</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => void loadMore()} style={styles.resetButton}>
                  <Text style={styles.resetText}>Xem thêm ({products.length}/{total})</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  header: { backgroundColor: BRAND_COLORS.surface, borderBottomWidth: 1, borderBottomColor: BRAND_COLORS.line, paddingVertical: 10, gap: 8 },
  searchRow: { paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  searchField: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: BRAND_COLORS.line, paddingLeft: 12, backgroundColor: BRAND_COLORS.canvas, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, height: 48, paddingHorizontal: 8, color: BRAND_COLORS.ink, fontSize: 14 },
  clearButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  suggestionBox: { paddingHorizontal: 16, paddingBottom: 6, gap: 2 },
  filterHeading: { color: BRAND_COLORS.muted, fontWeight: '700', fontSize: 12, paddingVertical: 6 },
  suggestionRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  suggestionText: { flex: 1, fontSize: 14, color: BRAND_COLORS.ink },
  filters: { paddingHorizontal: 14, gap: 8, alignItems: 'center', minHeight: 44 },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: BRAND_COLORS.line, justifyContent: 'center', backgroundColor: BRAND_COLORS.surface },
  chipActive: { backgroundColor: BRAND_COLORS.primary, borderColor: BRAND_COLORS.primary },
  chipText: { color: BRAND_COLORS.ink, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: BRAND_COLORS.surface },
  resultCount: { minHeight: 40, paddingHorizontal: 16, paddingVertical: 12, color: BRAND_COLORS.muted, fontSize: 13, fontWeight: '700' },
  productList: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: 12, paddingBottom: 24, flexGrow: 1 },
  gridRow: { marginBottom: 14, justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 12, paddingVertical: 20, paddingHorizontal: 16 },
  state: { flex: 1, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', maxWidth: 560, padding: 24, gap: 12 },
  stateTitle: { color: BRAND_COLORS.ink, fontSize: 18, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  stateDescription: { color: BRAND_COLORS.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retryButton: { minHeight: 44, borderRadius: 12, backgroundColor: BRAND_COLORS.primary, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: BRAND_COLORS.surface, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  resetButton: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  resetText: { color: BRAND_COLORS.primary, fontWeight: '800', fontSize: 13 },
  pressed: { opacity: 0.7 },
});
