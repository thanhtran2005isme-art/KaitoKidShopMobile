import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { AppIcon } from '@/components/ui/app-icon';
import { BRAND, BRAND_COLORS } from '@/constants/brand';
import { useProductGrid } from '@/hooks/use-product-grid';
import { resolveMediaUrl } from '@/services/api-client';
import { shopApi } from '@/services/home.api';
import type { Category, Product } from '@/types/shop';

const AUDIENCES = [
  { key: 'all', label: 'Tất cả', gender: undefined, ageGroup: undefined },
  { key: 'women', label: 'Nữ', gender: 'Nu', ageGroup: 'NguoiLon' },
  { key: 'men', label: 'Nam', gender: 'Nam', ageGroup: 'NguoiLon' },
  { key: 'kids', label: 'Trẻ em', gender: undefined, ageGroup: 'TreEm' },
] as const;

type AudienceKey = (typeof AUDIENCES)[number]['key'];

function getAudienceKey(gender?: string, ageGroup?: string): AudienceKey {
  const genderKey = gender?.trim().toLowerCase();
  const ageKey = ageGroup?.trim().toLowerCase();

  if (ageKey === 'treem' || ageKey === 'trẻ em') return 'kids';
  if (genderKey === 'nu' || genderKey === 'nữ') return 'women';
  if (genderKey === 'nam') return 'men';
  return 'all';
}

function StateCard({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: 'clothing' | 'warning';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.stateCard}>
      <View style={styles.stateIcon}>
        <AppIcon color={icon === 'warning' ? BRAND_COLORS.danger : BRAND_COLORS.primary} name={icon} size={28} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.stateAction, pressed && styles.pressed]}>
          <Text style={styles.stateActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function CategoriesScreen() {
  const params = useLocalSearchParams<{ category?: string; gender?: string; ageGroup?: string }>();
  const router = useRouter();
  const { cardWidth, columns, gap } = useProductGrid();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState('');
  const [audience, setAudience] = useState<AudienceKey>(() =>
    getAudienceKey(params.gender, params.ageGroup),
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [query, setQuery] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);

  const rootCategories = useMemo(
    () => categories.filter((item) => !item.parentId),
    [categories],
  );

  const audienceMeta = useMemo(
    () => AUDIENCES.find((item) => item.key === audience) || AUDIENCES[0],
    [audience],
  );

  const resultTitle = selected || (audience === 'all' ? 'Tất cả sản phẩm' : audienceMeta.label);
  const hasFilters = Boolean(selected || audience !== 'all');

  useEffect(() => {
    setAudience(getAudienceKey(params.gender, params.ageGroup));
  }, [params.ageGroup, params.gender]);

  const loadCategories = useCallback(async (showLoader = true) => {
    if (showLoader) setLoadingCategories(true);
    setCategoryError(null);

    try {
      const result = await shopApi.getCategories();
      setCategories(result);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : 'Không thể tải danh mục.');
    } finally {
      if (showLoader) setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!params.category) {
      setSelected('');
      return;
    }

    if (!categories.length) return;

    const match = categories.find(
      (item) => item.name === params.category || item.slug === params.category,
    );
    setSelected(match?.name || params.category);
  }, [categories, params.category]);

  const loadProducts = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoadingProducts(true);
      setProducts([]);
      setTotalCount(0);
    }
    setProductError(null);

    try {
      const result = await shopApi.getProducts({
        category: selected || undefined,
        gender: audienceMeta.gender,
        ageGroup: audienceMeta.ageGroup,
        page: 1,
        pageSize: 40,
      });
      setProducts(result.items || []);
      setTotalCount(result.totalCount || 0);
    } catch (error) {
      setProducts([]);
      setTotalCount(0);
      setProductError(error instanceof Error ? error.message : 'Không thể tải sản phẩm.');
    } finally {
      if (showLoader) setLoadingProducts(false);
    }
  }, [audienceMeta.ageGroup, audienceMeta.gender, selected]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadCategories(false), loadProducts(false)]);
    } finally {
      setRefreshing(false);
    }
  }, [loadCategories, loadProducts]);

  const submitSearch = useCallback(() => {
    const value = query.trim();
    if (!value) return;
    router.push({ pathname: '/search', params: { q: value } });
  }, [query, router]);

  const clearFilters = useCallback(() => {
    setSelected('');
    setAudience('all');
  }, []);

  const renderProduct = useCallback<ListRenderItem<Product>>(
    ({ item }) => <ProductCard product={item} width={cardWidth} />,
    [cardWidth],
  );

  const productState = useMemo(() => {
    if (loadingProducts) {
      return (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="small" />
          <Text style={styles.loadingText}>Đang chọn sản phẩm phù hợp cho bạn...</Text>
        </View>
      );
    }

    if (productError) {
      return (
        <StateCard
          actionLabel="Thử lại"
          icon="warning"
          message={productError}
          onAction={() => void loadProducts()}
          title="Chưa tải được sản phẩm"
        />
      );
    }

    return (
      <StateCard
        actionLabel={hasFilters ? 'Xóa bộ lọc' : undefined}
        icon="clothing"
        message={
          hasFilters
            ? 'Thử chọn đối tượng hoặc danh mục khác để xem thêm sản phẩm.'
            : 'Danh mục hiện chưa có sản phẩm đang bán.'
        }
        onAction={hasFilters ? clearFilters : undefined}
        title="Chưa có sản phẩm phù hợp"
      />
    );
  }, [clearFilters, hasFilters, loadProducts, loadingProducts, productError]);

  const header = (
    <View style={styles.headerShell}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.eyebrowPill}>
            <AppIcon color={BRAND_COLORS.primary} name="sparkles" size={16} />
            <Text style={styles.eyebrowText}>KAITOKID CATALOG</Text>
          </View>

          <Pressable
            accessibilityLabel="Mở danh sách yêu thích"
            accessibilityRole="button"
            onPress={() => router.push('/wishlist')}
            style={({ pressed }) => [styles.heroAction, pressed && styles.pressed]}>
            <AppIcon color={BRAND_COLORS.primary} name="heart" size={21} />
          </Pressable>
        </View>

        <Text style={styles.heroTitle}>Danh mục sản phẩm</Text>
        <Text style={styles.heroSubtitle}>
          Chọn đúng phong cách cho Nam, Nữ và Trẻ em từ dữ liệu cửa hàng hiện tại.
        </Text>

        <View style={styles.searchBox}>
          <AppIcon color={BRAND_COLORS.muted} name="search" size={21} />
          <TextInput
            accessibilityLabel="Tìm kiếm sản phẩm"
            enterKeyHint="search"
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            placeholder={BRAND.searchPlaceholder}
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable
              accessibilityLabel="Xóa từ khóa tìm kiếm"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => setQuery('')}
              style={styles.searchAction}>
              <AppIcon color={BRAND_COLORS.muted} name="close" size={19} />
            </Pressable>
          ) : (
            <View style={styles.searchAction}>
              <AppIcon color={BRAND_COLORS.primary} name="arrowRight" size={19} />
            </View>
          )}
        </View>
      </View>

      <View style={styles.filterSection}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.sectionEyebrow}>MUA SẮM THEO ĐỐI TƯỢNG</Text>
            <Text style={styles.sectionTitle}>Bạn đang tìm cho ai?</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          contentContainerStyle={styles.audienceList}
          showsHorizontalScrollIndicator={false}>
          {AUDIENCES.map((item) => {
            const active = item.key === audience;
            return (
              <Pressable
                key={item.key}
                accessibilityLabel={'Lọc ' + item.label}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setAudience(item.key)}
                style={({ pressed }) => [
                  styles.audienceChip,
                  active && styles.audienceChipActive,
                  pressed && styles.pressed,
                ]}>
                {active ? <AppIcon color="#FFFFFF" name="check" size={16} /> : null}
                <Text style={[styles.audienceChipText, active && styles.audienceChipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.categorySection}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.sectionEyebrow}>DANH MỤC</Text>
            <Text style={styles.sectionTitle}>Khám phá theo loại sản phẩm</Text>
          </View>
          {!loadingCategories && !categoryError ? (
            <Text style={styles.sectionCount}>{rootCategories.length} nhóm</Text>
          ) : null}
        </View>

        {loadingCategories ? (
          <ScrollView
            horizontal
            contentContainerStyle={styles.categoryList}
            showsHorizontalScrollIndicator={false}>
            {[0, 1, 2, 3].map((item) => (
              <View key={item} style={styles.categorySkeleton}>
                <View style={styles.categorySkeletonImage} />
                <View style={styles.categorySkeletonText} />
              </View>
            ))}
          </ScrollView>
        ) : categoryError ? (
          <View style={styles.categoryErrorCard}>
            <View style={styles.categoryErrorCopy}>
              <Text style={styles.categoryErrorTitle}>Chưa tải được danh mục</Text>
              <Text numberOfLines={2} style={styles.categoryErrorText}>{categoryError}</Text>
            </View>
            <Pressable
              accessibilityLabel="Tải lại danh mục"
              accessibilityRole="button"
              onPress={() => void loadCategories()}
              style={({ pressed }) => [styles.retryIconButton, pressed && styles.pressed]}>
              <AppIcon color={BRAND_COLORS.primary} name="refresh" size={20} />
            </Pressable>
          </View>
        ) : (
          <ScrollView
            horizontal
            contentContainerStyle={styles.categoryList}
            showsHorizontalScrollIndicator={false}>
            <Pressable
              accessibilityLabel="Tất cả danh mục"
              accessibilityRole="button"
              accessibilityState={{ selected: selected === '' }}
              onPress={() => setSelected('')}
              style={({ pressed }) => [
                styles.categoryCard,
                selected === '' && styles.categoryCardActive,
                pressed && styles.pressed,
              ]}>
              <View style={[styles.categoryImageWrap, styles.allCategoryImage]}>
                <AppIcon color={BRAND_COLORS.primary} name="grid" size={29} />
              </View>
              <Text
                numberOfLines={2}
                style={[styles.categoryName, selected === '' && styles.categoryNameActive]}>
                Tất cả
              </Text>
            </Pressable>

            {rootCategories.map((item) => {
              const active = item.name === selected;
              const image = resolveMediaUrl(item.image);

              return (
                <Pressable
                  key={item.id}
                  accessibilityLabel={'Danh mục ' + item.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelected(active ? '' : item.name)}
                  style={({ pressed }) => [
                    styles.categoryCard,
                    active && styles.categoryCardActive,
                    pressed && styles.pressed,
                  ]}>
                  <View style={[styles.categoryImageWrap, active && styles.categoryImageWrapActive]}>
                    {image ? (
                      <Image
                        accessibilityLabel={item.name}
                        cachePolicy="memory-disk"
                        contentFit="cover"
                        source={{ uri: image }}
                        style={styles.categoryImage}
                        transition={160}
                      />
                    ) : (
                      <AppIcon color={BRAND_COLORS.primary} name="clothing" size={28} />
                    )}
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[styles.categoryName, active && styles.categoryNameActive]}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={styles.resultsHeader}>
        <View style={styles.resultsCopy}>
          <Text style={styles.sectionEyebrow}>SẢN PHẨM</Text>
          <Text numberOfLines={2} style={styles.resultsTitle}>{resultTitle}</Text>
          <Text style={styles.resultsMeta}>
            {loadingProducts
              ? 'Đang cập nhật danh sách...'
              : totalCount.toLocaleString('vi-VN') + ' sản phẩm'}
            {audience !== 'all' ? ' · ' + audienceMeta.label : ''}
          </Text>
        </View>

        {hasFilters ? (
          <Pressable
            accessibilityLabel="Xóa bộ lọc danh mục sản phẩm"
            accessibilityRole="button"
            onPress={clearFilters}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            <AppIcon color={BRAND_COLORS.primary} name="close" size={17} />
            <Text style={styles.clearButtonText}>Đặt lại</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList
        key={'categories-grid-' + columns}
        ListEmptyComponent={productState}
        ListHeaderComponent={header}
        columnWrapperStyle={[styles.productRow, { gap }]}
        contentContainerStyle={styles.productList}
        data={products}
        initialNumToRender={8}
        keyExtractor={(item) => String(item.id)}
        numColumns={columns}
        refreshControl={
          <RefreshControl
            colors={[BRAND_COLORS.primary]}
            onRefresh={() => void refreshAll()}
            refreshing={refreshing}
            tintColor={BRAND_COLORS.primary}
          />
        }
        renderItem={renderProduct}
        showsVerticalScrollIndicator={false}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  productList: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingBottom: 36,
    flexGrow: 1,
  },
  headerShell: {
    gap: 24,
    paddingTop: 10,
    paddingBottom: 18,
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 28,
    backgroundColor: BRAND_COLORS.surface,
    padding: 18,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrowPill: {
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eyebrowText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  heroAction: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF5FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDD6FE',
  },
  heroTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 2,
  },
  heroSubtitle: {
    color: BRAND_COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 620,
  },
  searchBox: {
    minHeight: 54,
    marginTop: 6,
    borderRadius: 18,
    paddingLeft: 14,
    paddingRight: 8,
    backgroundColor: BRAND_COLORS.canvas,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  searchInput: {
    flex: 1,
    color: BRAND_COLORS.ink,
    fontSize: 14,
    paddingVertical: 12,
  },
  searchAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSection: {
    gap: 12,
  },
  categorySection: {
    gap: 12,
  },
  sectionHeading: {
    paddingHorizontal: 16,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeadingCopy: {
    flex: 1,
  },
  sectionEyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  sectionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  sectionCount: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    paddingBottom: 3,
  },
  audienceList: {
    paddingHorizontal: 16,
    gap: 9,
  },
  audienceChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  audienceChipActive: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  audienceChipText: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  audienceChipTextActive: {
    color: '#FFFFFF',
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  categoryCard: {
    width: 96,
    minHeight: 124,
    padding: 7,
    borderRadius: 22,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    alignItems: 'center',
    gap: 8,
  },
  categoryCardActive: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: '#FAF5FF',
  },
  categoryImageWrap: {
    width: 80,
    height: 80,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryImageWrapActive: {
    borderColor: '#C4B5FD',
  },
  allCategoryImage: {
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  categoryNameActive: {
    color: BRAND_COLORS.primaryDark,
  },
  categorySkeleton: {
    width: 96,
    minHeight: 124,
    padding: 7,
    borderRadius: 22,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    alignItems: 'center',
    gap: 9,
  },
  categorySkeletonImage: {
    width: 80,
    height: 80,
    borderRadius: 17,
    backgroundColor: '#E5E7EB',
  },
  categorySkeletonText: {
    width: 58,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  categoryErrorCard: {
    marginHorizontal: 16,
    minHeight: 74,
    padding: 14,
    borderRadius: 20,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryErrorCopy: {
    flex: 1,
    gap: 3,
  },
  categoryErrorTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  categoryErrorText: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
  },
  retryIconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  resultsHeader: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  resultsCopy: {
    flex: 1,
  },
  resultsTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
  },
  resultsMeta: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  clearButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  clearButtonText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '900',
  },
  productRow: {
    justifyContent: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  stateCard: {
    marginHorizontal: 16,
    marginTop: 18,
    padding: 24,
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    alignItems: 'center',
    gap: 9,
  },
  stateIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateMessage: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 420,
  },
  stateAction: {
    minHeight: 44,
    marginTop: 3,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  loadingCard: {
    marginHorizontal: 16,
    marginTop: 18,
    minHeight: 120,
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
