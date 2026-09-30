import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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

function MotionPressable({
  children,
  label,
  onPress,
  selected,
  style,
}: {
  children: ReactNode;
  label: string;
  onPress: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const animatedStyle = useAnimatedStyle(
    () => ({
      opacity: reducedMotion
        ? pressed
          ? 0.82
          : 1
        : withTiming(pressed ? 0.82 : 1, {
            duration: pressed ? 120 : 160,
          }),
      transform: [
        {
          scale: reducedMotion
            ? 1
            : withTiming(pressed ? 0.985 : 1, {
                duration: pressed ? 120 : 160,
              }),
        },
      ],
    }),
    [pressed, reducedMotion],
  );

  return (
    <Animated.View style={[style, animatedStyle]}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={styles.motionPressableInner}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

function AudienceTabs({
  onSelect,
  selected,
}: {
  onSelect: (key: AudienceKey) => void;
  selected: AudienceKey;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <View style={styles.audienceTabs}>
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
              pressed && styles.audienceTabPressed,
            ]}>
            {active ? (
              <Animated.View
                entering={reducedMotion ? undefined : FadeIn.duration(180)}
                exiting={reducedMotion ? undefined : FadeOut.duration(120)}
                pointerEvents="none"
                style={styles.audienceIndicator}
              />
            ) : null}
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
    </View>
  );
}

function CategoriesSkeleton() {
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(180)}
      exiting={reducedMotion ? undefined : FadeOut.duration(120)}
      style={styles.categorySkeletonRow}>
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={styles.categorySkeletonCard}>
          <View style={styles.categorySkeletonImage} />
          <View style={styles.categorySkeletonLine} />
        </View>
      ))}
    </Animated.View>
  );
}

function ProductSkeletonGrid({
  cardWidth,
  columns,
}: {
  cardWidth: number;
  columns: number;
}) {
  const reducedMotion = useReducedMotion();
  const count = Math.max(4, columns * 2);

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(170)}
      exiting={reducedMotion ? undefined : FadeOut.duration(120)}
      style={styles.productSkeletonGrid}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={index} style={[styles.productSkeletonCard, { width: cardWidth }]}>
          <View style={styles.productSkeletonImage} />
          <View style={styles.productSkeletonCopy}>
            <View style={styles.productSkeletonKicker} />
            <View style={styles.productSkeletonName} />
            <View style={styles.productSkeletonPrice} />
          </View>
        </View>
      ))}
    </Animated.View>
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
        <MotionPressable
          label={actionLabel}
          onPress={onAction}
          style={styles.inlineStateAction}>
          <View style={styles.inlineStateActionContent}>
            <AppIcon color={BRAND_COLORS.surface} name="refresh" size={18} />
            <Text style={styles.inlineStateActionText}>{actionLabel}</Text>
          </View>
        </MotionPressable>
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

  const scrollY = useSharedValue(0);

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
  const activeSubcategory = useMemo(
    () =>
      childCategories.find((item) => item.name === selectedSubcategory) ||
      null,
    [childCategories, selectedSubcategory],
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
      setSelectedRoot(nextAudience === 'all' ? rootCategories[0]?.name || '' : '');
    });

    return () => {
      active = false;
    };
  }, [categories, params.ageGroup, params.category, params.gender, rootCategories]);

  useEffect(() => {
    if (audience === 'all' && !selectedRoot) return;

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

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerTitleStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : 1,
    transform: [
      {
        translateY: reducedMotion
          ? 0
          : interpolate(
          scrollY.value,
          [0, 70],
          [0, -3],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: reducedMotion
          ? 1
          : interpolate(
          scrollY.value,
          [0, 70],
          [1, 0.92],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const headerSubtitleStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion
      ? 1
      : interpolate(
      scrollY.value,
      [0, 44],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: reducedMotion
          ? 0
          : interpolate(
          scrollY.value,
          [0, 44],
          [0, -4],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const heroParallaxStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: reducedMotion
          ? 0
          : interpolate(
          scrollY.value,
          [0, 190],
          [0, 10],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: reducedMotion
          ? 1
          : interpolate(
          scrollY.value,
          [0, 190],
          [1.02, 1.07],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const retryCategories = useCallback(() => {
    setLoadingCategories(true);
    setCategoryError(false);
    setCategoryRetryKey((value) => value + 1);
  }, []);

  const startProductTransition = useCallback(() => {
    setLoadingProducts(true);
    setProductError(false);
    setProducts([]);
    setProductTotal(0);
  }, []);

  const handleAudienceSelect = useCallback(
    (key: AudienceKey) => {
      startProductTransition();
      setAudience(key);
      setSelectedSubcategory('');
      setSelectedRoot(key === 'all' ? rootCategories[0]?.name || '' : '');
    },
    [rootCategories, startProductTransition],
  );

  const handleRootSelect = useCallback(
    (item: Category) => {
      startProductTransition();
      const active = item.name === selectedRoot;
      if (active && audience !== 'all') {
        setSelectedRoot('');
        setSelectedSubcategory('');
        return;
      }

      setSelectedRoot(item.name);
      setSelectedSubcategory('');
    },
    [audience, selectedRoot, startProductTransition],
  );

  const handleSubcategorySelect = useCallback(
    (name: string) => {
      startProductTransition();
      setSelectedSubcategory(name);
    },
    [startProductTransition],
  );

  const clearCategory = useCallback(() => {
    startProductTransition();
    setSelectedRoot('');
    setSelectedSubcategory('');
  }, [startProductTransition]);

  const heroProduct = products.find((item) => Boolean(item.image?.trim()));
  const heroImage = resolveMediaUrl(
    activeSubcategory?.image || activeRoot?.image || heroProduct?.image,
  );
  const heroTitle =
    activeSubcategory?.name || activeRoot?.name || audienceOption.title;
  const heroDescription =
    activeSubcategory?.description ||
    activeRoot?.description ||
    audienceOption.description;
  const productFilterLabel = [
    audienceOption.key === 'all' ? null : audienceOption.label,
    selectedRoot || null,
    selectedSubcategory || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const renderCategory = useCallback(
    ({ item, index }: { item: Category; index: number }) => {
      const active = item.name === selectedRoot;
      const image = resolveMediaUrl(item.image);

      return (
        <Animated.View
          entering={
            reducedMotion
              ? undefined
              : FadeInDown.duration(240).delay(Math.min(index * 34, 180))
          }
          layout={reducedMotion ? undefined : LinearTransition.duration(180)}>
          <MotionPressable
            label={`Danh mục ${item.name}`}
            onPress={() => handleRootSelect(item)}
            selected={active}
            style={[
              styles.categoryCard,
              active && styles.categoryCardActive,
            ]}>
            <View style={styles.categoryMedia}>
              {image ? (
                <Animated.View
                  entering={reducedMotion ? undefined : FadeIn.duration(220)}
                  style={StyleSheet.absoluteFill}>
                  <Image
                    accessibilityLabel={item.name}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    source={{ uri: image }}
                    style={StyleSheet.absoluteFill}
                    transition={reducedMotion ? 0 : 180}
                  />
                </Animated.View>
              ) : (
                <View style={styles.categoryFallback}>
                  <AppIcon
                    color={active ? BRAND_COLORS.primaryDark : BRAND_COLORS.primary}
                    name="clothing"
                    size={28}
                  />
                </View>
              )}
              {active ? <View style={styles.categorySelectedWash} /> : null}
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.categoryCardLabel,
                active && styles.categoryCardLabelActive,
              ]}>
              {item.name}
            </Text>
            {active ? <View style={styles.categoryActiveLine} /> : null}
          </MotionPressable>
        </Animated.View>
      );
    },
    [handleRootSelect, reducedMotion, selectedRoot],
  );

  const listHeader = (
    <View style={styles.listHeader}>
      <Animated.View
        entering={reducedMotion ? undefined : FadeInUp.duration(250)}
        style={styles.audienceSection}>
        <View style={styles.sectionHeading}>
          <Text style={styles.eyebrow}>CHỌN PHONG CÁCH</Text>
          <Text style={styles.sectionTitle}>Dành cho bạn</Text>
        </View>
        <AudienceTabs onSelect={handleAudienceSelect} selected={audience} />
      </Animated.View>

      <Animated.View
        entering={
          reducedMotion ? undefined : FadeInUp.duration(270).delay(45)
        }
        style={styles.editorialCard}>
        {heroImage ? (
          <Animated.View
            key={heroImage}
            entering={reducedMotion ? undefined : FadeIn.duration(260)}
            style={[StyleSheet.absoluteFill, heroParallaxStyle]}>
            <Image
              accessibilityLabel={`Ảnh ${heroTitle}`}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: heroImage }}
              style={StyleSheet.absoluteFill}
              transition={reducedMotion ? 0 : 220}
            />
          </Animated.View>
        ) : (
          <LinearGradient
            colors={[
              BRAND_COLORS.primaryDark,
              BRAND_COLORS.primary,
              BRAND_COLORS.ink,
            ]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={[
            'rgba(17,24,39,0.08)',
            'rgba(17,24,39,0.30)',
            'rgba(17,24,39,0.84)',
          ]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.editorialCopy}>
          <View style={styles.editorialEyebrowRow}>
            <View style={styles.editorialDot} />
            <Text style={styles.editorialEyebrow}>{audienceOption.label}</Text>
          </View>
          <Text numberOfLines={2} style={styles.editorialTitle}>
            {heroTitle}
          </Text>
          <Text numberOfLines={2} style={styles.editorialDescription}>
            {heroDescription}
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={
          reducedMotion ? undefined : FadeInUp.duration(270).delay(85)
        }
        style={styles.categorySection}>
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeading}>
            <Text style={styles.eyebrow}>DANH MỤC</Text>
            <Text style={styles.sectionTitle}>Chọn kiểu sản phẩm</Text>
          </View>
          {selectedRoot && audience !== 'all' ? (
            <Pressable
              accessibilityLabel="Bỏ lọc danh mục"
              accessibilityRole="button"
              onPress={clearCategory}
              style={({ pressed }) => [
                styles.clearCategory,
                pressed && styles.clearCategoryPressed,
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
          <Animated.View
            entering={
              reducedMotion ? undefined : FadeInDown.duration(220).delay(35)
            }
            style={styles.subcategorySection}>
            <Text style={styles.subcategoryLabel}>Danh mục con</Text>
            <ScrollView
              contentContainerStyle={styles.subcategoryList}
              horizontal
              showsHorizontalScrollIndicator={false}>
              <MotionPressable
                label={`Xem tất cả ${activeRoot?.name || ''}`}
                onPress={() => handleSubcategorySelect('')}
                selected={!selectedSubcategory}
                style={[
                  styles.subcategoryChip,
                  !selectedSubcategory && styles.subcategoryChipActive,
                ]}>
                <Text
                  style={[
                    styles.subcategoryChipText,
                    !selectedSubcategory && styles.subcategoryChipTextActive,
                  ]}>
                  Tất cả
                </Text>
              </MotionPressable>

              {childCategories.map((item) => {
                const active = item.name === selectedSubcategory;
                return (
                  <MotionPressable
                    key={item.id}
                    label={`Danh mục con ${item.name}`}
                    onPress={() => handleSubcategorySelect(item.name)}
                    selected={active}
                    style={[
                      styles.subcategoryChip,
                      active && styles.subcategoryChipActive,
                    ]}>
                    <Text
                      style={[
                        styles.subcategoryChipText,
                        active && styles.subcategoryChipTextActive,
                      ]}>
                      {item.name}
                    </Text>
                  </MotionPressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        ) : null}
      </Animated.View>

      <Animated.View
        entering={
          reducedMotion ? undefined : FadeInUp.duration(270).delay(120)
        }
        style={styles.productsHeading}>
        <View style={styles.productsHeadingCopy}>
          <Text style={styles.eyebrow}>SẢN PHẨM</Text>
          <Text style={styles.sectionTitle}>
            {productFilterLabel || 'Khám phá KaitoKid'}
          </Text>
        </View>
        <Text style={styles.productCount}>
          {loadingProducts ? 'Đang tải' : `${productTotal} sản phẩm`}
        </Text>
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.stickyHeader}>
        <View style={styles.stickyHeaderInner}>
          <View style={styles.headerCopy}>
            <Animated.Text style={[styles.headerTitle, headerTitleStyle]}>
              Danh mục
            </Animated.Text>
            <Animated.Text
              numberOfLines={1}
              style={[styles.headerSubtitle, headerSubtitleStyle]}>
              {BRAND.promise}
            </Animated.Text>
          </View>

          <MotionPressable
            label="Tìm kiếm sản phẩm"
            onPress={() => router.push('/search')}
            style={styles.searchButton}>
            <AppIcon color={BRAND_COLORS.ink} name="search" size={21} />
          </MotionPressable>
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
              description="Hiện chưa có sản phẩm phù hợp với lựa chọn này."
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
        onScroll={scrollHandler}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={
              reducedMotion
                ? undefined
                : FadeInUp.duration(220).delay(Math.min(index * 24, 160))
            }
            exiting={reducedMotion ? undefined : FadeOut.duration(110)}>
            <ProductCard
              product={item}
              width={cardWidth}
              wishlistPlacement="inline"
            />
          </Animated.View>
        )}
        scrollEventThrottle={16}
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
  stickyHeader: {
    zIndex: 20,
    backgroundColor: BRAND_COLORS.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_COLORS.line,
  },
  stickyHeaderInner: {
    width: '100%',
    maxWidth: 720,
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
    height: 52,
    justifyContent: 'center',
  },
  headerTitle: {
    alignSelf: 'flex-start',
    color: BRAND_COLORS.ink,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.65,
  },
  headerSubtitle: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  searchButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    overflow: 'hidden',
  },
  motionPressableInner: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productList: {
    paddingBottom: 34,
    flexGrow: 1,
  },
  listHeader: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: 18,
    paddingBottom: 20,
    gap: 22,
  },
  audienceSection: {
    paddingHorizontal: 16,
    gap: 11,
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
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  audienceTabs: {
    position: 'relative',
    height: 52,
    borderRadius: 18,
    padding: 4,
    flexDirection: 'row',
    backgroundColor: BRAND_COLORS.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    overflow: 'hidden',
  },
  audienceIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.primarySoft,
    boxShadow: '0 2px 8px rgba(17, 24, 39, 0.06)',
    elevation: 2,
  },
  audienceTab: {
    zIndex: 1,
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  audienceTabPressed: {
    opacity: 0.68,
  },
  audienceTabText: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  audienceTabTextActive: {
    color: BRAND_COLORS.primaryDark,
  },
  editorialCard: {
    marginHorizontal: 16,
    minHeight: 178,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: BRAND_COLORS.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'flex-end',
  },
  editorialCopy: {
    zIndex: 2,
    padding: 18,
    gap: 5,
    maxWidth: 520,
  },
  editorialEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  editorialDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_COLORS.accent,
  },
  editorialEyebrow: {
    color: BRAND_COLORS.accentSoft,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  editorialTitle: {
    color: BRAND_COLORS.surface,
    fontSize: 26,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  editorialDescription: {
    color: BRAND_COLORS.line,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    maxWidth: 460,
  },
  categorySection: {
    gap: 12,
  },
  clearCategory: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCategoryText: {
    color: BRAND_COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  clearCategoryPressed: {
    opacity: 0.72,
  },
  categoryList: {
    paddingHorizontal: 16,
    paddingRight: 22,
    gap: 10,
  },
  categoryCard: {
    width: 108,
    minHeight: 124,
    borderRadius: 20,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    overflow: 'hidden',
  },
  categoryCardActive: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.surface,
  },
  categoryMedia: {
    width: '100%',
    height: 76,
    backgroundColor: BRAND_COLORS.primarySoft,
    overflow: 'hidden',
  },
  categoryFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  categorySelectedWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(91,33,182,0.12)',
  },
  categoryCardLabel: {
    width: '100%',
    paddingHorizontal: 9,
    color: BRAND_COLORS.ink,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  categoryCardLabelActive: {
    color: BRAND_COLORS.primaryDark,
  },
  categoryActiveLine: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 6,
    height: 2,
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.primary,
  },
  categorySkeletonRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 10,
  },
  categorySkeletonCard: {
    width: 108,
    minHeight: 124,
    borderRadius: 20,
    paddingBottom: 12,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    overflow: 'hidden',
    gap: 12,
    alignItems: 'center',
  },
  categorySkeletonImage: {
    width: '100%',
    height: 76,
    backgroundColor: BRAND_COLORS.line,
  },
  categorySkeletonLine: {
    width: 62,
    height: 9,
    borderRadius: 5,
    backgroundColor: BRAND_COLORS.line,
  },
  subcategorySection: {
    gap: 8,
  },
  subcategoryLabel: {
    paddingHorizontal: 16,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  subcategoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  subcategoryChip: {
    minHeight: 44,
    minWidth: 64,
    borderRadius: 15,
    paddingHorizontal: 14,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    overflow: 'hidden',
  },
  subcategoryChipActive: {
    backgroundColor: BRAND_COLORS.primarySoft,
    borderColor: BRAND_COLORS.primary,
  },
  subcategoryChipText: {
    color: BRAND_COLORS.muted,
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
    fontSize: 10,
    fontWeight: '700',
    paddingBottom: 3,
  },
  productRow: {
    justifyContent: 'center',
    marginBottom: 20,
  },
  productSkeletonGrid: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  productSkeletonCard: {
    borderRadius: 22,
    padding: 8,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    gap: 10,
  },
  productSkeletonImage: {
    width: '100%',
    aspectRatio: 0.8,
    borderRadius: 17,
    backgroundColor: BRAND_COLORS.line,
  },
  productSkeletonCopy: {
    gap: 7,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  productSkeletonKicker: {
    width: '34%',
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_COLORS.line,
  },
  productSkeletonName: {
    width: '82%',
    height: 12,
    borderRadius: 6,
    backgroundColor: BRAND_COLORS.line,
  },
  productSkeletonPrice: {
    width: '52%',
    height: 13,
    borderRadius: 6,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  inlineState: {
    marginHorizontal: 16,
    padding: 22,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    gap: 7,
  },
  inlineStateIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inlineStateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  inlineStateDescription: {
    maxWidth: 380,
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  inlineStateAction: {
    minHeight: 46,
    minWidth: 112,
    marginTop: 5,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: BRAND_COLORS.primary,
  },
  inlineStateActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
  },
  inlineStateActionText: {
    color: BRAND_COLORS.surface,
    fontSize: 11,
    fontWeight: '900',
  },
});
