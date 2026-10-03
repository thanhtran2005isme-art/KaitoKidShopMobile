import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { useProductGrid } from '@/hooks/use-product-grid';
import { BRAND, BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import { shopApi } from '@/services/home.api';
import type { Category, Product } from '@/types/shop';

const COLORS = {
  background: BRAND_COLORS.canvas,
  surface: BRAND_COLORS.surface,
  ink: BRAND_COLORS.ink,
  dark: '#24113D',
  darkSoft: '#3B1B63',
  secondary: '#4B5563',
  muted: BRAND_COLORS.muted,
  line: BRAND_COLORS.line,
  accent: BRAND_COLORS.primary,
  accentSoft: BRAND_COLORS.primarySoft,
  accentDeep: BRAND_COLORS.primaryDark,
  warm: BRAND_COLORS.accent,
  warmSoft: BRAND_COLORS.accentSoft,
  success: BRAND_COLORS.success,
  danger: BRAND_COLORS.danger,
  white: BRAND_COLORS.surface,
} as const;

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  web: 'Georgia',
  default: undefined,
});

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
    title: 'Khám phá KaitoKid',
    description: BRAND.promise,
  },
  {
    key: 'women',
    label: 'Nữ',
    title: 'Thời trang Nữ',
    description: 'Thanh lịch · hiện đại · linh hoạt',
    gender: 'Nu',
    ageGroup: 'NguoiLon',
  },
  {
    key: 'men',
    label: 'Nam',
    title: 'Thời trang Nam',
    description: 'Gọn gàng · năng động · dễ phối',
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
    <View accessibilityLabel="Đang tải danh mục" style={styles.categorySkeletonRow}>
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
    <View accessibilityLabel="Đang tải sản phẩm" style={styles.productSkeletonGrid}>
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
        <AppIcon color={COLORS.accent} name="clothing" size={24} />
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
          <AppIcon color={COLORS.white} name="refresh" size={18} />
          <Text style={styles.inlineStateActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

const EditorialProductCard = memo(function EditorialProductCard({
  product,
  width,
}: {
  product: Product;
  width: number;
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { token } = useAuth();
  const { isWishlisted, toggleWishlist } = useShopping();
  const [wishlistBusy, setWishlistBusy] = useState(false);

  const image = resolveMediaUrl(product.image);
  const wished = isWishlisted(product.id);
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;

  const openProduct = () => {
    router.push({
      pathname: '/product/[slug]',
      params: { slug: product.slug || String(product.id) },
    });
  };

  const handleWishlist = async () => {
    if (wishlistBusy) return;
    if (!token) {
      router.push({
        pathname: '/auth/login',
        params: { redirect: `/product/${product.slug || product.id}` },
      });
      return;
    }

    try {
      setWishlistBusy(true);
      await toggleWishlist(product.id);
    } catch (error) {
      Alert.alert(
        'Danh sách yêu thích',
        error instanceof Error ? error.message : 'Không thể cập nhật danh sách yêu thích.',
      );
    } finally {
      setWishlistBusy(false);
    }
  };

  return (
    <View style={[styles.editorialProductCard, { width }]}>
      <View style={styles.editorialProductMedia}>
        <Pressable
          accessibilityLabel={`Xem ${product.name}`}
          accessibilityRole="button"
          onPress={openProduct}
          style={({ pressed }) => [styles.productImagePressable, pressed && styles.productPressed]}>
          {image ? (
            <Image
              accessibilityLabel={product.name}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: image }}
              style={StyleSheet.absoluteFill}
              transition={reducedMotion ? 0 : 180}
            />
          ) : (
            <LinearGradient colors={['#F4F4F5', '#E4E4E7']} style={styles.productImageFallback}>
              <AppIcon color={COLORS.secondary} name="image" size={30} />
              <Text style={styles.productImageFallbackText}>CHƯA CÓ ẢNH</Text>
            </LinearGradient>
          )}
        </Pressable>

        <View pointerEvents="none" style={styles.editorialBadges}>
          {product.isNew ? (
            <View style={[styles.editorialBadge, styles.newBadge]}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          ) : null}
          {product.isBestSeller ? (
            <View style={[styles.editorialBadge, styles.bestBadge]}>
              <Text style={styles.bestBadgeText}>BEST</Text>
            </View>
          ) : null}
          {discount > 0 ? (
            <View style={[styles.editorialBadge, styles.saleBadge]}>
              <Text style={styles.saleBadgeText}>-{discount}%</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityLabel={wished ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
          accessibilityRole="button"
          accessibilityState={{ disabled: wishlistBusy, selected: wished }}
          disabled={wishlistBusy}
          onPress={() => void handleWishlist()}
          style={({ pressed }) => [
            styles.editorialWishlist,
            wished && styles.editorialWishlistActive,
            pressed && styles.productPressed,
          ]}>
          {wishlistBusy ? (
            <ActivityIndicator color={COLORS.ink} size="small" />
          ) : (
            <AppIcon
              color={wished ? COLORS.accent : COLORS.ink}
              name={wished ? 'heartFilled' : 'heart'}
              size={19}
            />
          )}
        </Pressable>
      </View>

      <Pressable
        accessibilityLabel={`Mở ${product.name}`}
        accessibilityRole="button"
        onPress={openProduct}
        style={({ pressed }) => [styles.editorialProductCopy, pressed && styles.productPressed]}>
        <Text numberOfLines={1} style={styles.editorialProductCategory}>
          {product.subcategory || product.category || 'KAITOKID'}
        </Text>
        <Text numberOfLines={2} style={styles.editorialProductName}>
          {product.name}
        </Text>
        <View style={styles.editorialPriceRow}>
          <Text numberOfLines={1} style={styles.editorialPrice}>
            {formatPrice(product.price)}
          </Text>
          {product.oldPrice && product.oldPrice > product.price ? (
            <Text numberOfLines={1} style={styles.editorialOldPrice}>
              {formatPrice(product.oldPrice)}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
});

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
          accessibilityHint={active ? 'Chạm để bỏ lọc danh mục này' : 'Chạm để lọc sản phẩm theo danh mục này'}
          accessibilityLabel={`Danh mục ${item.name}`}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          onPress={() => handleRootSelect(item)}
          style={({ pressed }) => [
            styles.categoryCard,
            pressed && styles.pressed,
          ]}>
          <View style={[styles.categoryMedia, active && styles.categoryMediaActive]}>
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
              <View style={[styles.categoryFallback, active && styles.categoryFallbackActive]}>
                <AppIcon
                  color={active ? COLORS.white : COLORS.ink}
                  name="clothing"
                  size={26}
                />
              </View>
            )}
            {active ? (
              <View style={styles.categorySelectedBadge}>
                <AppIcon color={COLORS.white} name="check" size={14} />
              </View>
            ) : null}
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
      <LinearGradient colors={['#2E1065', '#4C1D95', '#24113D']} style={styles.catalogHero}>
        <View pointerEvents="none" style={styles.heroGlowPink} />
        <View pointerEvents="none" style={styles.heroGlowWhite} />

        <View style={styles.catalogHeroTop}>
          <View style={styles.catalogHeroIcon}>
            <AppIcon color={COLORS.accent} name="sparkles" size={22} />
          </View>
          <View style={styles.catalogHeroCopy}>
            <Text style={styles.heroEyebrow}>KAITOKID / DANH MỤC</Text>
            <Text style={styles.heroTitle}>{audienceOption.title}</Text>
            <Text style={styles.heroDescription}>{audienceOption.description}</Text>
          </View>
        </View>
        <AudienceTabs onSelect={handleAudienceSelect} selected={audience} />
      </LinearGradient>

      <View style={styles.categorySection}>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionEyebrow}>01 / DANH MỤC</Text>
            <Text style={styles.sectionTitle}>Chọn kiểu bạn thích</Text>
          </View>
          {hasCategoryFilter ? (
            <Pressable
              accessibilityLabel="Xóa danh mục đã chọn"
              accessibilityRole="button"
              onPress={clearCategory}
              style={({ pressed }) => [
                styles.clearCategory,
                pressed && styles.pressed,
              ]}>
              <AppIcon color={COLORS.ink} name="close" size={15} />
              <Text style={styles.clearCategoryText}>BỎ LỌC</Text>
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
        ) : rootCategories.length ? (
          <FlatList
            contentContainerStyle={styles.categoryList}
            data={rootCategories}
            horizontal
            keyExtractor={(item) => String(item.id)}
            renderItem={renderCategory}
            showsHorizontalScrollIndicator={false}
          />
        ) : (
          <InlineState
            description="Hiện chưa có danh mục sản phẩm để hiển thị."
            title="Chưa có danh mục"
          />
        )}

        {childCategories.length ? (
          <View style={styles.subcategorySection}>
            <Text style={styles.subcategoryLabel}>LỌC CHI TIẾT</Text>
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
          <Text style={styles.sectionEyebrow}>02 / SẢN PHẨM</Text>
          <Text numberOfLines={2} style={styles.sectionTitle}>
            {productFilterLabel || 'Gợi ý dành cho bạn'}
          </Text>
        </View>
        <View style={styles.productCountPill}>
          <Text accessibilityLiveRegion="polite" style={styles.productCount}>
            {loadingProducts ? 'Đang tải…' : `${productTotal} sản phẩm`}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerKicker}>KAITOKID / CATALOG</Text>
            <Text style={styles.headerTitle}>Danh mục</Text>
          </View>
          <Pressable
            accessibilityLabel="Tìm kiếm sản phẩm"
            accessibilityRole="button"
            onPress={() => router.push('/search')}
            style={({ pressed }) => [
              styles.searchButton,
              pressed && styles.pressed,
            ]}>
            <AppIcon color={COLORS.white} name="search" size={20} />
          </Pressable>
        </View>
      </View>

      <Animated.FlatList
        accessibilityLabel="Danh sách sản phẩm theo danh mục"
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
            <EditorialProductCard product={item} width={cardWidth} />
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
    backgroundColor: COLORS.background,
  },
  header: {
    zIndex: 20,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.line,
  },
  headerInner: {
    width: '100%',
    maxWidth: 1040,
    minHeight: 74,
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
    color: COLORS.ink,
    fontFamily: DISPLAY_FONT,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  headerKicker: {
    color: COLORS.accentDeep,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  searchButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.ink,
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
    paddingTop: 14,
    paddingBottom: 22,
    gap: 22,
  },
  catalogHero: {
    marginHorizontal: 16,
    padding: 18,
    borderRadius: 28,
    backgroundColor: COLORS.ink,
    borderWidth: 1,
    borderColor: COLORS.darkSoft,
    gap: 18,
    overflow: 'hidden',
  },
  heroGlowPink: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(249,115,22,0.24)',
    right: -62,
    top: -92,
  },
  heroGlowWhite: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.08)',
    left: -30,
    bottom: -48,
  },
  catalogHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catalogHeroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroEyebrow: {
    color: '#FDBA74',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: COLORS.white,
    fontFamily: DISPLAY_FONT,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.45,
  },
  heroDescription: {
    color: '#D4D4D8',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  audienceTabs: {
    paddingRight: 4,
    gap: 8,
  },
  audienceTab: {
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: 14,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  audienceTabActive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.white,
  },
  audienceTabText: {
    color: '#E4E4E7',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  audienceTabTextActive: {
    color: COLORS.ink,
  },
  categorySection: {
    gap: 13,
  },
  sectionHeading: {
    gap: 3,
  },
  sectionHeadingRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionEyebrow: {
    color: COLORS.accent,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.05,
  },
  sectionTitle: {
    color: COLORS.ink,
    fontFamily: DISPLAY_FONT,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  clearCategory: {
    minHeight: 44,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  clearCategoryText: {
    color: COLORS.accent,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  categoryList: {
    paddingHorizontal: 16,
    paddingRight: 22,
    gap: 14,
  },
  categoryCard: {
    width: 92,
    minHeight: 118,
    alignItems: 'center',
    gap: 8,
  },
  categoryMedia: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  categoryMediaActive: {
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  categoryFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
  },
  categoryFallbackActive: {
    backgroundColor: COLORS.accent,
  },
  categorySelectedBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardLabel: {
    minHeight: 32,
    paddingHorizontal: 2,
    color: COLORS.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  categoryCardLabelActive: {
    color: COLORS.accentDeep,
  },
  categorySkeletonRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 14,
  },
  categorySkeletonCard: {
    width: 92,
    minHeight: 118,
    alignItems: 'center',
    gap: 9,
  },
  categorySkeletonImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#E2E8F0',
  },
  categorySkeletonLine: {
    width: 64,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
  },
  subcategorySection: {
    gap: 8,
  },
  subcategoryLabel: {
    paddingHorizontal: 16,
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subcategoryChipActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: '#A78BFA',
  },
  subcategoryChipText: {
    color: COLORS.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  subcategoryChipTextActive: {
    color: COLORS.accentDeep,
  },
  productsHeading: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  productsHeadingCopy: {
    flex: 1,
    gap: 3,
  },
  productCount: {
    color: COLORS.accentDeep,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  productCountPill: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorialProductCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  editorialProductMedia: {
    width: '100%',
    aspectRatio: 0.78,
    backgroundColor: '#F4F4F5',
    overflow: 'hidden',
  },
  productImagePressable: {
    flex: 1,
  },
  productImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  productImageFallbackText: {
    color: COLORS.secondary,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.25,
  },
  editorialBadges: {
    position: 'absolute',
    left: 8,
    top: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    maxWidth: '72%',
  },
  editorialBadge: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadge: {
    backgroundColor: COLORS.ink,
  },
  newBadgeText: {
    color: COLORS.white,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bestBadge: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(9,9,11,0.12)',
  },
  bestBadgeText: {
    color: COLORS.ink,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  saleBadge: {
    backgroundColor: COLORS.warm,
  },
  saleBadgeText: {
    color: COLORS.white,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  editorialWishlist: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(9,9,11,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorialWishlistActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: '#C4B5FD',
  },
  editorialProductCopy: {
    minHeight: 116,
    paddingHorizontal: 11,
    paddingTop: 11,
    paddingBottom: 12,
    gap: 5,
  },
  editorialProductCategory: {
    color: COLORS.muted,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  editorialProductName: {
    minHeight: 38,
    color: COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  editorialPriceRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  editorialPrice: {
    color: COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  editorialOldPrice: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  productPressed: {
    opacity: 0.78,
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
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
    backgroundColor: COLORS.accentSoft,
  },
  inlineState: {
    width: 'auto',
    maxWidth: 680,
    alignSelf: 'center',
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    gap: 8,
  },
  inlineStateIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inlineStateTitle: {
    color: COLORS.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    textAlign: 'center',
  },
  inlineStateDescription: {
    maxWidth: 380,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  inlineStateAction: {
    minHeight: 48,
    marginTop: 5,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  inlineStateActionText: {
    color: COLORS.surface,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  pressed: { opacity: 0.72 },
});
