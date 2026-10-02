import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { ProductCard } from '@/components/product/product-card';
import { AppIcon } from '@/components/ui/app-icon';
import { BRAND, BRAND_COLORS } from '@/constants/brand';
import { useProductGrid } from '@/hooks/use-product-grid';
import { resolveMediaUrl } from '@/services/api-client';
import { shopApi } from '@/services/home.api';
import type { Category, Product } from '@/types/shop';

type AudienceKey = 'all' | 'women' | 'men' | 'kids';

type AudienceOption = {
  key: AudienceKey;
  label: string;
  title: string;
  description: string;
  gender?: string;
  ageGroup?: string;
};

const AUDIENCES: AudienceOption[] = [
  {
    key: 'all',
    label: 'Tất cả',
    title: 'Mọi phong cách',
    description: BRAND.promise,
  },
  {
    key: 'women',
    label: 'Nữ',
    title: 'Thời trang Nữ',
    description: 'Thanh lịch · hiện đại · dễ phối',
    gender: 'Nu',
    ageGroup: 'NguoiLon',
  },
  {
    key: 'men',
    label: 'Nam',
    title: 'Thời trang Nam',
    description: 'Gọn gàng · năng động · linh hoạt',
    gender: 'Nam',
    ageGroup: 'NguoiLon',
  },
  {
    key: 'kids',
    label: 'Trẻ em',
    title: 'Thời trang Trẻ em',
    description: 'Thoải mái · dễ vận động · tươi vui',
    ageGroup: 'TreEm',
  },
];

function normalize(value?: string) {
  return value?.trim().toLowerCase() || '';
}

function audienceFromParams(gender?: string, ageGroup?: string): AudienceKey {
  const genderKey = normalize(gender);
  const ageKey = normalize(ageGroup);

  if (ageKey === 'treem' || ageKey === 'trẻ em') return 'kids';
  if (genderKey === 'nu' || genderKey === 'nữ') return 'women';
  if (genderKey === 'nam') return 'men';
  return 'all';
}

function AudienceTabs({
  onSelect,
  selected,
}: {
  onSelect: (key: AudienceKey) => void;
  selected: AudienceKey;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.audienceTabs}
      horizontal
      showsHorizontalScrollIndicator={false}>
      {AUDIENCES.map((item) => {
        const active = item.key === selected;
        return (
          <Pressable
            key={item.key}
            accessibilityLabel={`Xem ${item.label}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [
              styles.audienceTab,
              active && styles.audienceTabActive,
              pressed && styles.pressed,
            ]}>
            <Text
              numberOfLines={1}
              style={[
                styles.audienceTabText,
                active && styles.audienceTabTextActive,
              ]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CategoriesSkeleton() {
  return (
    <View style={styles.categorySkeletonRow}>
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={styles.categorySkeletonCard}>
          <View style={styles.categorySkeletonImage} />
          <View style={styles.categorySkeletonLine} />
        </View>
      ))}
    </View>
  );
}

function ProductSkeletonGrid({
  cardWidth,
  columns,
}: {
  cardWidth: number;
  columns: number;
}) {
  const count = Math.max(4, columns * 2);

  return (
    <View style={styles.productSkeletonGrid}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.productSkeletonCard, { width: cardWidth }]}>
          <View style={styles.productSkeletonImage} />
          <View style={styles.productSkeletonCopy}>
            <View style={styles.productSkeletonName} />
            <View style={styles.productSkeletonMeta} />
            <View style={styles.productSkeletonPrice} />
          </View>
        </View>
      ))}
    </View>
  );
}

function InlineState({
  actionLabel,
  description,
  onAction,
  title,
}: {
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View accessibilityRole="alert" style={styles.inlineState}>
      <View style={styles.inlineStateIcon}>
        <AppIcon color={BRAND_COLORS.primary} name="clothing" size={24} />
      </View>
      <Text style={styles.inlineStateTitle}>{title}</Text>
      <Text style={styles.inlineStateDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.inlineStateAction,
            pressed && styles.pressed,
          ]}>
          <AppIcon color={BRAND_COLORS.surface} name="refresh" size={18} />
          <Text style={styles.inlineStateActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function CategoriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: string;
    gender?: string;
    ageGroup?: string;
  }>();
  const reducedMotion = useReducedMotion();
  const { cardWidth, columns, gap } = useProductGrid();

  const [categories, setCategories] = useState<Category[]>([]);
  const [audience, setAudience] = useState<AudienceKey>(() =>
    audienceFromParams(params.gender, params.ageGroup),
  );
  const [selectedRoot, setSelectedRoot] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [categoryError, setCategoryError] = useState(false);
  const [productError, setProductError] = useState(false);
  const [categoryRetryKey, setCategoryRetryKey] = useState(0);
  const [productRetryKey, setProductRetryKey] = useState(0);

  const rootCategories = useMemo(
    () =>
      categories
        .filter((item) => !item.parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );
  const activeRoot = useMemo(
    () => rootCategories.find((item) => item.name === selectedRoot) || null,
    [rootCategories, selectedRoot],
  );
  const childCategories = useMemo(
    () =>
      activeRoot
        ? categories
            .filter((item) => item.parentId === activeRoot.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [activeRoot, categories],
  );
  const audienceOption = useMemo(
    () => AUDIENCES.find((item) => item.key === audience) || AUDIENCES[0],
    [audience],
  );

  useEffect(() => {
    let active = true;
    setCategoryError(false);

    void shopApi
      .getCategories()
      .then((result) => {
        if (!active) return;
        setCategories(result);
      })
      .catch(() => {
        if (!active) return;
        setCategories([]);
        setCategoryError(true);
      })
      .finally(() => {
        if (active) setLoadingCategories(false);
      });

    return () => {
      active = false;
    };
  }, [categoryRetryKey]);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (!active) return;

      const nextAudience = audienceFromParams(params.gender, params.ageGroup);
      setAudience(nextAudience);

      if (!categories.length) return;

      const requested = params.category
        ? categories.find(
            (item) =>
              normalize(item.name) === normalize(params.category) ||
              normalize(item.slug) === normalize(params.category),
          )
        : undefined;

      if (requested) {
        if (requested.parentId) {
          const parent = categories.find((item) => item.id === requested.parentId);
          setSelectedRoot(parent?.name || '');
          setSelectedSubcategory(requested.name);
        } else {
          setSelectedRoot(requested.name);
          setSelectedSubcategory('');
        }
        return;
      }

      setSelectedSubcategory('');
      setSelectedRoot('');
    });

    return () => {
      active = false;
    };
  }, [categories, params.ageGroup, params.category, params.gender]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;

      setLoadingProducts(true);
      setProductError(false);
      setProducts([]);
      setProductTotal(0);

      try {
        const result = await shopApi.getProducts({
          category: selectedRoot || undefined,
          subcategory: selectedSubcategory || undefined,
          gender: audienceOption.gender,
          ageGroup: audienceOption.ageGroup,
          page: 1,
          pageSize: 40,
        });
        if (!active) return;
        setProducts(result.items || []);
        setProductTotal(result.totalCount || 0);
      } catch {
        if (!active) return;
        setProducts([]);
        setProductTotal(0);
        setProductError(true);
      } finally {
        if (active) setLoadingProducts(false);
      }
    });

    return () => {
      active = false;
    };
  }, [
    audience,
    audienceOption.ageGroup,
    audienceOption.gender,
    productRetryKey,
    selectedRoot,
    selectedSubcategory,
  ]);

  const startProductTransition = useCallback(() => {
    setLoadingProducts(true);
    setProductError(false);
    setProducts([]);
    setProductTotal(0);
  }, []);

  const handleAudienceSelect = useCallback(
    (key: AudienceKey) => {
      if (key === audience) return;
      startProductTransition();
      setAudience(key);
      setSelectedSubcategory('');
      setSelectedRoot('');
    },
    [audience, startProductTransition],
  );

  const handleRootSelect = useCallback(
    (item: Category) => {
      const active = item.name === selectedRoot;

      startProductTransition();
      if (active) {
        setSelectedRoot('');
        setSelectedSubcategory('');
        return;
      }

      setSelectedRoot(item.name);
      setSelectedSubcategory('');
    },
    [selectedRoot, startProductTransition],
  );

  const handleSubcategorySelect = useCallback(
    (name: string) => {
      if (name === selectedSubcategory) return;
      startProductTransition();
      setSelectedSubcategory(name);
    },
    [selectedSubcategory, startProductTransition],
  );

  const clearCategory = useCallback(() => {
    startProductTransition();
    setSelectedSubcategory('');
    setSelectedRoot('');
  }, [startProductTransition]);

  const retryCategories = useCallback(() => {
    setLoadingCategories(true);
    setCategoryError(false);
    setCategoryRetryKey((value) => value + 1);
  }, []);

  const productFilterLabel = [
    audienceOption.key === 'all' ? null : audienceOption.label,
    selectedRoot || null,
    selectedSubcategory || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const hasCategoryFilter = Boolean(selectedSubcategory) || Boolean(selectedRoot);

  const renderCategory = useCallback(
    ({ item }: { item: Category }) => {
      const active = item.name === selectedRoot;
      const image = resolveMediaUrl(item.image);

      return (
        <Pressable
          accessibilityLabel={`Danh mục ${item.name}`}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          onPress={() => handleRootSelect(item)}
          style={({ pressed }) => [
            styles.categoryCard,
            active && styles.categoryCardActive,
            pressed && styles.pressed,
          ]}>
          <View style={styles.categoryMedia}>
            {image ? (
              <Image
                accessibilityLabel={item.name}
                cachePolicy="memory-disk"
                contentFit="cover"
                source={{ uri: image }}
                style={StyleSheet.absoluteFill}
                transition={reducedMotion ? 0 : 160}
              />
            ) : (
              <View style={styles.categoryFallback}>
                <AppIcon
                  color={active ? BRAND_COLORS.primaryDark : BRAND_COLORS.primary}
                  name="clothing"
                  size={26}
                />
              </View>
            )}
          </View>
          <Text
            numberOfLines={2}
            style={[
              styles.categoryCardLabel,
              active && styles.categoryCardLabelActive,
            ]}>
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [handleRootSelect, reducedMotion, selectedRoot],
  );

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.introSection}>
        <Text style={styles.eyebrow}>KHÁM PHÁ</Text>
        <Text style={styles.introTitle}>{audienceOption.title}</Text>
        <Text style={styles.introDescription}>{audienceOption.description}</Text>
      </View>

      <View style={styles.audienceSection}>
        <Text style={styles.controlLabel}>Đối tượng</Text>
        <AudienceTabs onSelect={handleAudienceSelect} selected={audience} />
      </View>

      <View style={styles.categorySection}>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeading}>
            <Text style={styles.controlLabel}>Danh mục</Text>
            <Text style={styles.sectionTitle}>Chọn kiểu sản phẩm</Text>
          </View>
          {hasCategoryFilter ? (
            <Pressable
              accessibilityLabel="Bỏ lọc danh mục"
              accessibilityRole="button"
              onPress={clearCategory}
              style={({ pressed }) => [
                styles.clearCategory,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.clearCategoryText}>Bỏ lọc</Text>
            </Pressable>
          ) : null}
        </View>

        {loadingCategories ? (
          <CategoriesSkeleton />
        ) : categoryError ? (
          <InlineState
            actionLabel="Thử lại"
            description="Danh mục chưa tải được. Hãy thử lại sau một chút."
            onAction={retryCategories}
            title="Chưa tải được danh mục"
          />
        ) : (
          <FlatList
            contentContainerStyle={styles.categoryList}
            data={rootCategories}
            horizontal
            keyExtractor={(item) => String(item.id)}
            renderItem={renderCategory}
            showsHorizontalScrollIndicator={false}
          />
        )}

        {childCategories.length ? (
          <View style={styles.subcategorySection}>
            <Text style={styles.controlLabel}>Danh mục con</Text>
            <ScrollView
              contentContainerStyle={styles.subcategoryList}
              horizontal
              showsHorizontalScrollIndicator={false}>
              <Pressable
                accessibilityLabel={`Xem tất cả ${activeRoot?.name || ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected: !selectedSubcategory }}
                onPress={() => handleSubcategorySelect('')}
                style={({ pressed }) => [
                  styles.subcategoryChip,
                  !selectedSubcategory && styles.subcategoryChipActive,
                  pressed && styles.pressed,
                ]}>
                <Text
                  style={[
                    styles.subcategoryChipText,
                    !selectedSubcategory && styles.subcategoryChipTextActive,
                  ]}>
                  Tất cả
                </Text>
              </Pressable>

              {childCategories.map((item) => {
                const active = item.name === selectedSubcategory;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityLabel={`Danh mục con ${item.name}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => handleSubcategorySelect(item.name)}
                    style={({ pressed }) => [
                      styles.subcategoryChip,
                      active && styles.subcategoryChipActive,
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.subcategoryChipText,
                        active && styles.subcategoryChipTextActive,
                      ]}>
                      {item.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <View style={styles.productsHeading}>
        <View style={styles.productsHeadingCopy}>
          <Text style={styles.controlLabel}>Sản phẩm</Text>
          <Text numberOfLines={2} style={styles.sectionTitle}>
            {productFilterLabel || 'Khám phá KaitoKid'}
          </Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.productCount}>
          {loadingProducts ? 'Đang tải…' : `${productTotal} sản phẩm`}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Danh mục</Text>
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              {BRAND.categorySubtitle}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Tìm kiếm sản phẩm"
            accessibilityRole="button"
            onPress={() => router.push('/search')}
            style={({ pressed }) => [
              styles.searchButton,
              pressed && styles.pressed,
            ]}>
            <AppIcon color={BRAND_COLORS.ink} name="search" size={21} />
          </Pressable>
        </View>
      </View>

      <Animated.FlatList
        key={`categories-grid-${columns}`}
        ListEmptyComponent={
          loadingProducts ? (
            <ProductSkeletonGrid cardWidth={cardWidth} columns={columns} />
          ) : productError ? (
            <InlineState
              actionLabel="Thử lại"
              description="Sản phẩm chưa tải được. Hãy kiểm tra kết nối rồi thử lại."
              onAction={() => setProductRetryKey((value) => value + 1)}
              title="Chưa tải được sản phẩm"
            />
          ) : (
            <InlineState
              actionLabel={hasCategoryFilter ? 'Bỏ lọc' : undefined}
              description="Hiện chưa có sản phẩm phù hợp với lựa chọn này."
              onAction={hasCategoryFilter ? clearCategory : undefined}
              title="Chưa có sản phẩm"
            />
          )
        }
        ListHeaderComponent={listHeader}
        columnWrapperStyle={[styles.productRow, { gap }]}
        contentContainerStyle={styles.productList}
        data={products}
        initialNumToRender={8}
        keyExtractor={(item) => String(item.id)}
        numColumns={columns}
        renderItem={({ item }) => (
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(180)}
            exiting={reducedMotion ? undefined : FadeOut.duration(100)}>
            <ProductCard product={item} width={cardWidth} />
          </Animated.View>
        )}
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
  header: {
    zIndex: 20,
    backgroundColor: BRAND_COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_COLORS.line,
  },
  headerInner: {
    width: '100%',
    maxWidth: 1040,
    minHeight: 72,
    alignSelf: 'center',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  searchButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productList: {
    paddingBottom: 36,
    flexGrow: 1,
  },
  listHeader: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    gap: 24,
  },
  introSection: {
    paddingHorizontal: 16,
    gap: 4,
  },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.15,
  },
  introTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  introDescription: {
    maxWidth: 560,
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  audienceSection: {
    gap: 9,
  },
  audienceTabs: {
    paddingHorizontal: 16,
    paddingRight: 22,
    gap: 8,
  },
  audienceTab: {
    minHeight: 44,
    minWidth: 72,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
  },
  audienceTabActive: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  audienceTabText: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  audienceTabTextActive: {
    color: BRAND_COLORS.surface,
  },
  categorySection: {
    gap: 12,
  },
  sectionHeading: {
    gap: 3,
  },
  sectionHeadingRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  controlLabel: {
    paddingHorizontal: 16,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.25,
  },
  clearCategory: {
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCategoryText: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  categoryList: {
    paddingHorizontal: 16,
    paddingRight: 22,
    gap: 10,
  },
  categoryCard: {
    width: 112,
    minHeight: 128,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    overflow: 'hidden',
  },
  categoryCardActive: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: '#FCFAFF',
  },
  categoryMedia: {
    width: '100%',
    height: 82,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  categoryFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  categoryCardLabel: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 9,
    color: BRAND_COLORS.ink,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  categoryCardLabelActive: {
    color: BRAND_COLORS.primaryDark,
  },
  categorySkeletonRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
  },
  categorySkeletonCard: {
    width: 112,
    minHeight: 128,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 12,
  },
  categorySkeletonImage: {
    width: '100%',
    height: 82,
    backgroundColor: '#E2E8F0',
  },
  categorySkeletonLine: {
    width: 64,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  subcategorySection: {
    gap: 8,
  },
  subcategoryList: {
    paddingHorizontal: 16,
    paddingRight: 22,
    gap: 8,
  },
  subcategoryChip: {
    minHeight: 44,
    minWidth: 64,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcategoryChipActive: {
    backgroundColor: BRAND_COLORS.primarySoft,
    borderColor: '#C4B5FD',
  },
  subcategoryChipText: {
    color: BRAND_COLORS.ink,
    fontSize: 11,
    fontWeight: '800',
  },
  subcategoryChipTextActive: {
    color: BRAND_COLORS.primaryDark,
  },
  productsHeading: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
  },
  productsHeadingCopy: {
    flex: 1,
    gap: 3,
  },
  productCount: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    paddingBottom: 3,
  },
  productRow: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  productSkeletonGrid: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  productSkeletonCard: {
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    overflow: 'hidden',
  },
  productSkeletonImage: {
    width: '100%',
    aspectRatio: 0.8,
    backgroundColor: '#E2E8F0',
  },
  productSkeletonCopy: {
    padding: 10,
    gap: 8,
  },
  productSkeletonName: {
    width: '82%',
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  productSkeletonMeta: {
    width: '62%',
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  productSkeletonPrice: {
    width: '50%',
    height: 14,
    borderRadius: 7,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  inlineState: {
    width: 'auto',
    maxWidth: 680,
    alignSelf: 'center',
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    gap: 8,
  },
  inlineStateIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inlineStateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  inlineStateDescription: {
    maxWidth: 380,
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  inlineStateAction: {
    minHeight: 46,
    marginTop: 5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: BRAND_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  inlineStateActionText: {
    color: BRAND_COLORS.surface,
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: { opacity: 0.72 },
});
