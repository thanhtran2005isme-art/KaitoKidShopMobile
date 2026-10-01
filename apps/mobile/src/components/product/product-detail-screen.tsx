import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product/product-card';
import { ProductDetailSkeleton } from '@/components/product/product-detail-skeleton';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductReviewsPreview } from '@/components/product/product-reviews-preview';
import { ProductSizeGuide } from '@/components/product/product-size-guide';
import { AppIcon } from '@/components/ui/app-icon';
import { BRAND, BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { shopApi } from '@/services/home.api';
import { reviewsApi } from '@/services/reviews.api';
import type { Product, ProductDetail, ProductVariantInventory } from '@/types/shop';
import {
  buildProductFacts,
  htmlToPlainText,
  productColorValue,
  supportsKidSizeGuide,
} from '@/utils/product-detail';
import { releaseWebFocus } from '@/utils/web-focus';

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

function uniqueValues(values?: string[]) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

type OptionGroupProps = {
  label: string;
  values: string[];
  selected: string | null;
  type?: 'color' | 'text';
  isDisabled: (value: string) => boolean;
  onSelect: (value: string) => void;
  actionLabel?: string;
  onAction?: () => void;
};

function OptionGroup({
  label,
  values,
  selected,
  type = 'text',
  isDisabled,
  onSelect,
  actionLabel,
  onAction,
}: OptionGroupProps) {
  if (!values.length) return null;

  return (
    <View style={styles.optionSection}>
      <View style={styles.optionHeading}>
        <View style={styles.optionHeadingCopy}>
          <Text style={styles.optionLabel}>{label}</Text>
          {selected ? <Text style={styles.optionSelected}>Đã chọn: {selected}</Text> : null}
        </View>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction}>
            <Text style={styles.optionAction}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.optionRow}>
        {values.map((value) => {
          const disabled = isDisabled(value);
          const active = selected === value;

          if (type === 'color') {
            return (
              <Pressable
                accessibilityLabel={`${label}: ${value}${disabled ? ', hết hàng' : ''}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
                disabled={disabled}
                key={value}
                onPress={() => onSelect(value)}
                style={({ pressed }) => [
                  styles.colorButton,
                  active && styles.colorButtonActive,
                  disabled && styles.optionDisabled,
                  pressed && !disabled && styles.pressed,
                ]}>
                <View
                  style={[
                    styles.colorDot,
                    {
                      backgroundColor: productColorValue(value),
                      borderColor: value.toLowerCase().includes('trắng')
                        ? '#D1D5DB'
                        : 'rgba(255,255,255,0.24)',
                    },
                  ]}
                />
              </Pressable>
            );
          }

          return (
            <Pressable
              accessibilityLabel={`${label}: ${value}${disabled ? ', hết hàng' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              disabled={disabled}
              key={value}
              onPress={() => onSelect(value)}
              style={({ pressed }) => [
                styles.sizeButton,
                active && styles.sizeButtonActive,
                disabled && styles.optionDisabled,
                pressed && !disabled && styles.pressed,
              ]}>
              <Text style={[styles.sizeText, active && styles.sizeTextActive]}>{value}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { addToCart, isWishlisted, toggleWishlist } = useShopping();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sizeGuideVisible, setSizeGuideVisible] = useState(false);
  const [actionBusy, setActionBusy] = useState<'cart' | 'wishlist' | null>(null);
  const [helpfulBusyId, setHelpfulBusyId] = useState<number | null>(null);
  const [helpfulMarkedIds, setHelpfulMarkedIds] = useState<Set<number>>(() => new Set());
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const goBack = () => {
    releaseWebFocus();
    router.back();
  };

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 3200);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!slug) return;
    let active = true;

    setProduct(null);
    setRelatedProducts([]);
    setError(null);
    setSelectedColor(null);
    setSelectedSize(null);
    setQuantity(1);

    void (async () => {
      try {
        const detail = await shopApi.getProduct(slug);
        if (!active) return;
        setProduct(detail);

        const nextColors = uniqueValues([
          ...(detail.colors || []),
          ...(detail.variantInventory || []).map((item) => item.color),
          ...(detail.variants || []).map((item) => item.color),
        ]);
        const nextSizes = uniqueValues([
          ...(detail.sizes || []),
          ...(detail.variantInventory || []).map((item) => item.size),
          ...(detail.variants || []).map((item) => item.size),
        ]);
        if (nextColors.length === 1) setSelectedColor(nextColors[0]);
        if (nextSizes.length === 1) setSelectedSize(nextSizes[0]);

        try {
          const related = await shopApi.getRelatedProducts(detail.id, 6);
          if (active) setRelatedProducts(related);
        } catch {
          if (active) setRelatedProducts([]);
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải sản phẩm.');
      }
    })();

    return () => {
      active = false;
    };
  }, [retryKey, slug]);

  const colors = useMemo(
    () => uniqueValues([
      ...(product?.colors || []),
      ...(product?.variantInventory || []).map((item) => item.color),
      ...(product?.variants || []).map((item) => item.color),
    ]),
    [product?.colors, product?.variantInventory, product?.variants],
  );
  const sizes = useMemo(
    () => uniqueValues([
      ...(product?.sizes || []),
      ...(product?.variantInventory || []).map((item) => item.size),
      ...(product?.variants || []).map((item) => item.size),
    ]),
    [product?.sizes, product?.variantInventory, product?.variants],
  );
  const variantInventory = useMemo(() => product?.variantInventory || [], [product?.variantInventory]);
  const variants = useMemo(() => product?.variants || [], [product?.variants]);
  const hasVariantInventory = variantInventory.length > 0;
  const hasVariantPairs = variants.length > 0;

  const combinationExists = (size: string, color: string) => {
    if (hasVariantInventory) {
      return variantInventory.some(
        (item) => item.size === size && item.color === color && item.available > 0,
      );
    }
    if (hasVariantPairs) return variants.some((item) => item.size === size && item.color === color);
    return (product?.stock || 0) > 0;
  };

  const isColorDisabled = (color: string) => {
    if (!product || product.stock <= 0) return true;
    if (selectedSize) return !combinationExists(selectedSize, color);
    if (hasVariantInventory) {
      return !variantInventory.some((item) => item.color === color && item.available > 0);
    }
    return false;
  };

  const isSizeDisabled = (size: string) => {
    if (!product || product.stock <= 0) return true;
    if (selectedColor) return !combinationExists(size, selectedColor);
    if (hasVariantInventory) {
      return !variantInventory.some((item) => item.size === size && item.available > 0);
    }
    return false;
  };

  const selectedInventory: ProductVariantInventory | undefined =
    selectedColor && selectedSize
      ? variantInventory.find((item) => item.color === selectedColor && item.size === selectedSize)
      : undefined;
  const selectedVariant =
    selectedColor && selectedSize
      ? variants.find((item) => item.color === selectedColor && item.size === selectedSize)
      : undefined;
  const availableStock = (() => {
    if (!product) return 0;
    if (hasVariantInventory && selectedColor && selectedSize) return selectedInventory?.available || 0;
    return Math.max(0, product.availableStock ?? product.stock);
  })();

  useEffect(() => {
    setQuantity((current) => {
      if (availableStock <= 0) return 1;
      return Math.max(1, Math.min(current, availableStock));
    });
  }, [availableStock]);

  if (!slug) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorTitle}>Thiếu mã sản phẩm</Text>
        <Pressable onPress={goBack} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!product && !error) {
    return (
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ProductDetailSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorTitle}>Không tải được sản phẩm</Text>
        <Text style={styles.errorText}>{error || 'Không tìm thấy sản phẩm.'}</Text>
        <Pressable onPress={() => setRetryKey((value) => value + 1)} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Thử lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const galleryImages = uniqueValues([product.image, ...(product.images || [])]);
  const description = htmlToPlainText(product.description) || product.shortDescription || 'Thông tin sản phẩm đang được cập nhật.';
  const facts = buildProductFacts(product);
  const discount = product.oldPrice && product.oldPrice > product.price
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;
  const productAvailableStock = Math.max(0, product.availableStock ?? product.stock);
  const isOutOfStock = productAvailableStock <= 0 || product.status === 'out-of-stock';
  const isLowStock = !isOutOfStock && availableStock > 0 && availableStock <= 5;
  const selectionComplete = (!colors.length || Boolean(selectedColor)) && (!sizes.length || Boolean(selectedSize));
  const selectedOutOfStock = selectionComplete && availableStock <= 0;
  const canShowSizeGuide = supportsKidSizeGuide(sizes);
  const currentSku = selectedVariant?.sku || product.sku;
  const wished = isWishlisted(product.id);
  const productPath = `/product/${product.slug || product.id}`;
  const reviewCount = product.reviews?.length || 0;

  const requireLogin = () => {
    releaseWebFocus();
    router.push({ pathname: '/auth/login', params: { redirect: productPath } });
  };

  const chooseColor = (color: string) => {
    setFeedback(null);
    setSelectedColor(color);
    setQuantity(1);
    if (selectedSize && !combinationExists(selectedSize, color)) setSelectedSize(null);
  };

  const chooseSize = (size: string) => {
    setFeedback(null);
    setSelectedSize(size);
    setQuantity(1);
    if (selectedColor && !combinationExists(size, selectedColor)) setSelectedColor(null);
  };

  const handleWishlist = async () => {
    if (actionBusy) return;
    if (!token) return requireLogin();
    try {
      setActionBusy('wishlist');
      const result = await toggleWishlist(product.id);
      setFeedback({
        type: 'success',
        text: result === 'added' ? 'Đã lưu sản phẩm vào danh sách yêu thích.' : 'Đã bỏ sản phẩm khỏi danh sách yêu thích.',
      });
    } catch (wishlistError) {
      setFeedback({ type: 'error', text: wishlistError instanceof Error ? wishlistError.message : 'Không thể cập nhật danh sách yêu thích.' });
    } finally {
      setActionBusy(null);
    }
  };

  const handleAddToCart = async () => {
    if (actionBusy) return;
    if (!token) return requireLogin();
    if (!selectionComplete) {
      setFeedback({ type: 'error', text: 'Vui lòng chọn đầy đủ màu sắc và kích cỡ.' });
      return;
    }
    if (isOutOfStock || availableStock <= 0) {
      setFeedback({ type: 'error', text: 'Sản phẩm hoặc biến thể này hiện đã hết hàng.' });
      return;
    }

    try {
      setActionBusy('cart');
      const item = await addToCart({
        productId: product.id,
        size: selectedSize || '',
        color: selectedColor || '',
        quantity,
      });
      setProduct((current) => {
        if (!current) return current;
        if (current.variantInventory?.length && selectedSize && selectedColor) {
          return {
            ...current,
            availableStock: Math.max(0, (current.availableStock ?? current.stock) - quantity),
            variantInventory: current.variantInventory.map((variant) =>
              variant.size === selectedSize && variant.color === selectedColor
                ? { ...variant, available: item.availableStock }
                : variant,
            ),
          };
        }
        return { ...current, availableStock: item.availableStock };
      });
      setFeedback({ type: 'success', text: `Đã thêm ${quantity} sản phẩm vào giỏ hàng.` });
      setQuantity(1);
    } catch (cartError) {
      setFeedback({ type: 'error', text: cartError instanceof Error ? cartError.message : 'Không thể thêm sản phẩm vào giỏ hàng.' });
    } finally {
      setActionBusy(null);
    }
  };

  const shareProduct = async () => {
    try {
      await Share.share({
        message: [product.name, formatPrice(product.price), product.shortDescription || BRAND.promise, `KaitoKid · ${product.category}`].join('\n'),
      });
    } catch {
      // Chia sẻ là hành động phụ.
    }
  };

  const handleHelpful = async (reviewId: number) => {
    if (helpfulBusyId != null || helpfulMarkedIds.has(reviewId)) return;
    setHelpfulBusyId(reviewId);
    setFeedback(null);
    try {
      await reviewsApi.markHelpful(reviewId);
      setProduct((current) => current ? {
        ...current,
        reviews: (current.reviews || []).map((review) => review.id === reviewId
          ? { ...review, helpfulCount: (review.helpfulCount || 0) + 1 }
          : review),
      } : current);
      setHelpfulMarkedIds((current) => new Set(current).add(reviewId));
    } catch (helpfulError) {
      setFeedback({ type: 'error', text: helpfulError instanceof Error ? helpfulError.message : 'Không thể đánh dấu đánh giá hữu ích.' });
    } finally {
      setHelpfulBusyId(null);
    }
  };

  const cartLabel = isOutOfStock
    ? 'Hết hàng'
    : selectedOutOfStock
      ? 'Biến thể hết hàng'
      : actionBusy === 'cart'
        ? 'Đang thêm...'
        : selectionComplete
          ? 'Thêm vào giỏ'
          : 'Chọn màu & size';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.purchaseShell}>
          <View style={styles.mediaSection}>
            <ProductGallery images={galleryImages} />

            <Pressable accessibilityLabel="Quay lại" onPress={goBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <AppIcon color="#FFFFFF" name="arrowLeft" size={19} />
            </Pressable>

            <View pointerEvents="none" style={styles.mediaBadges}>
              {product.isNew ? <View style={[styles.heroBadge, styles.newBadge]}><Text style={styles.heroBadgeDarkText}>Mới</Text></View> : null}
              {product.isBestSeller ? <View style={[styles.heroBadge, styles.bestBadge]}><Text style={styles.heroBadgeDarkText}>Bán chạy</Text></View> : null}
              {discount > 0 ? <View style={[styles.heroBadge, styles.saleBadge]}><Text style={styles.heroBadgeLightText}>-{discount}%</Text></View> : null}
            </View>

            <Pressable
              accessibilityLabel={wished ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
              accessibilityRole="button"
              accessibilityState={{ selected: wished, disabled: actionBusy != null }}
              disabled={actionBusy != null}
              onPress={() => void handleWishlist()}
              style={({ pressed }) => [styles.wishlistButton, wished && styles.wishlistButtonActive, pressed && styles.pressed]}>
              {actionBusy === 'wishlist' ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                <AppIcon color={wished ? '#FB7185' : '#FFFFFF'} name={wished ? 'heartFilled' : 'heart'} size={20} />
              )}
            </Pressable>

            <Pressable accessibilityLabel="Chia sẻ sản phẩm" onPress={() => void shareProduct()} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
              <Text style={styles.shareButtonText}>↗</Text>
            </Pressable>
          </View>

          <View style={styles.purchasePanel}>
            <Text style={styles.title}>{product.name}</Text>
            <View style={styles.metaRow}>
              <View style={styles.ratingGroup}>
                <AppIcon color="#F59E0B" name="starFilled" size={14} />
                <Text style={styles.rating}>{product.rating.toFixed(1)}</Text>
                <Text style={styles.reviewCount}>({reviewCount} đánh giá)</Text>
                <Text style={styles.sold}>· {product.soldCount} đã bán</Text>
              </View>
              <Text style={[styles.stockText, isLowStock && styles.stockLow, isOutOfStock && styles.stockOut]}>
                {isOutOfStock ? 'Hết hàng' : isLowStock ? `Còn ${availableStock}` : 'Còn hàng'}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatPrice(product.price)}</Text>
              {product.oldPrice && product.oldPrice > product.price ? <Text style={styles.oldPrice}>{formatPrice(product.oldPrice)}</Text> : null}
            </View>

            <OptionGroup isDisabled={isColorDisabled} label="Màu sắc" onSelect={chooseColor} selected={selectedColor} type="color" values={colors} />
            <OptionGroup
              actionLabel={canShowSizeGuide ? 'Hướng dẫn size' : undefined}
              isDisabled={isSizeDisabled}
              label="Kích cỡ"
              onAction={canShowSizeGuide ? () => { releaseWebFocus(); setSizeGuideVisible(true); } : undefined}
              onSelect={chooseSize}
              selected={selectedSize}
              values={sizes}
            />

            <View style={styles.quantityRow}>
              <View style={styles.quantityCopy}>
                <Text style={styles.quantityLabel}>Số lượng</Text>
                <Text style={styles.quantityHelper}>
                  {selectionComplete
                    ? availableStock > 0 ? `Còn ${availableStock} sản phẩm ở lựa chọn này` : 'Lựa chọn này đang hết hàng'
                    : 'Chọn đủ biến thể để xem tồn kho chính xác'}
                </Text>
              </View>
              <View style={styles.stepper}>
                <Pressable accessibilityLabel="Giảm số lượng" disabled={quantity <= 1} onPress={() => setQuantity((current) => Math.max(1, current - 1))} style={[styles.stepButton, quantity <= 1 && styles.stepDisabled]}>
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text style={styles.stepValue}>{availableStock > 0 ? quantity : 0}</Text>
                <Pressable accessibilityLabel="Tăng số lượng" disabled={availableStock <= 0 || quantity >= availableStock} onPress={() => setQuantity((current) => Math.min(availableStock, current + 1))} style={[styles.stepButton, (availableStock <= 0 || quantity >= availableStock) && styles.stepDisabled]}>
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            </View>

            {feedback ? (
              <View style={[styles.feedback, feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
                <Text style={[styles.feedbackText, feedback.type === 'success' ? styles.feedbackTextSuccess : styles.feedbackTextError]}>{feedback.text}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel={cartLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: actionBusy != null || isOutOfStock || selectedOutOfStock }}
              disabled={actionBusy != null || isOutOfStock || selectedOutOfStock}
              onPress={() => void handleAddToCart()}
              style={({ pressed }) => [styles.cartButton, (actionBusy != null || isOutOfStock || selectedOutOfStock) && styles.cartButtonDisabled, pressed && styles.cartButtonPressed]}>
              {actionBusy === 'cart' ? <ActivityIndicator color="#0B0B0D" size="small" /> : <AppIcon color="#0B0B0D" name="cart" size={19} />}
              <Text style={styles.cartButtonText}>{cartLabel}</Text>
              {!isOutOfStock && !selectedOutOfStock && selectionComplete ? <Text style={styles.cartButtonPrice}>{formatPrice(product.price * quantity)}</Text> : null}
            </Pressable>

            <View style={styles.microMetaRow}>
              <Text style={styles.microMeta}>SKU {currentSku}</Text>
              <Text style={styles.microMeta}>Đổi trả 7 ngày</Text>
              <Text style={styles.microMeta}>Freeship từ 499K</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailShell}>
          {product.shortDescription ? <Text style={styles.shortDescription}>{product.shortDescription}</Text> : null}
          <View style={styles.infoCard}>
            <Text style={styles.sectionEyebrow}>CHI TIẾT</Text>
            <Text style={styles.sectionTitle}>Mô tả sản phẩm</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Thông tin sản phẩm</Text>
            {facts.map((item, index) => (
              <View key={`${item.label}-${index}`} style={styles.specRow}>
                <Text style={styles.specLabel}>{item.label}</Text>
                <Text style={styles.specValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <ProductReviewsPreview helpfulBusyId={helpfulBusyId} helpfulMarkedIds={helpfulMarkedIds} onHelpful={(reviewId) => void handleHelpful(reviewId)} rating={product.rating} reviews={product.reviews || []} />

          {relatedProducts.length ? (
            <View style={styles.relatedSection}>
              <View style={styles.relatedHeading}>
                <View><Text style={styles.sectionEyebrow}>GỢI Ý THÊM</Text><Text style={styles.sectionTitle}>Có thể bạn cũng thích</Text></View>
                <Pressable onPress={() => router.push('/categories')}><Text style={styles.more}>Xem thêm</Text></Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.relatedList} horizontal showsHorizontalScrollIndicator={false}>
                {relatedProducts.map((item) => <ProductCard key={item.id} product={item} width={174} />)}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ProductSizeGuide availableSizes={sizes} onClose={() => { releaseWebFocus(); setSizeGuideVisible(false); }} visible={sizeGuideVisible} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F5F7' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: BRAND_COLORS.canvas },
  errorTitle: { color: BRAND_COLORS.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  errorText: { color: BRAND_COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { borderRadius: 999, backgroundColor: BRAND_COLORS.ink, paddingHorizontal: 18, paddingVertical: 11 },
  retryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  purchaseShell: { width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: '#08090A' },
  mediaSection: { position: 'relative', paddingTop: 8, backgroundColor: '#08090A' },
  backButton: { position: 'absolute', top: 18, left: 18, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,11,13,0.76)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  mediaBadges: { position: 'absolute', left: 18, top: 66, alignItems: 'flex-start', gap: 5 },
  heroBadge: { minHeight: 22, borderRadius: 999, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  newBadge: { backgroundColor: '#3B82F6' },
  bestBadge: { backgroundColor: '#F59E0B' },
  saleBadge: { backgroundColor: '#F43F5E' },
  heroBadgeDarkText: { color: '#101114', fontSize: 9, fontWeight: '900' },
  heroBadgeLightText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  wishlistButton: { position: 'absolute', top: 18, right: 18, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,11,13,0.76)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  wishlistButtonActive: { backgroundColor: 'rgba(76,5,25,0.88)', borderColor: '#FB7185' },
  shareButton: { position: 'absolute', top: 66, right: 18, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,11,13,0.72)' },
  shareButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  purchasePanel: { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 18, gap: 12, backgroundColor: '#08090A' },
  title: { color: '#FFFFFF', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ratingGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  rating: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  reviewCount: { color: '#A4A8B0', fontSize: 9 },
  sold: { color: '#7C818A', fontSize: 9 },
  stockText: { color: '#34D399', fontSize: 9, fontWeight: '800' },
  stockLow: { color: '#FBBF24' },
  stockOut: { color: '#F87171' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  price: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  oldPrice: { color: '#7C818A', fontSize: 11, textDecorationLine: 'line-through' },
  optionSection: { gap: 7 },
  optionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  optionHeadingCopy: { gap: 2 },
  optionLabel: { color: '#B7BBC3', fontSize: 10, fontWeight: '800' },
  optionSelected: { color: '#747982', fontSize: 8 },
  optionAction: { color: '#A78BFA', fontSize: 9, fontWeight: '800' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  colorButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorButtonActive: { borderColor: '#FFFFFF' },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  sizeButton: { minWidth: 42, minHeight: 36, borderRadius: 8, paddingHorizontal: 9, backgroundColor: '#1C1E22', borderWidth: 1, borderColor: '#292C31', alignItems: 'center', justifyContent: 'center' },
  sizeButtonActive: { backgroundColor: '#F1F2F4', borderColor: '#F1F2F4' },
  sizeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  sizeTextActive: { color: '#0B0B0D' },
  optionDisabled: { opacity: 0.28 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  quantityCopy: { flex: 1, gap: 2 },
  quantityLabel: { color: '#B7BBC3', fontSize: 10, fontWeight: '800' },
  quantityHelper: { color: '#747982', fontSize: 8, lineHeight: 12 },
  stepper: { height: 36, borderRadius: 9, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1E22' },
  stepButton: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepDisabled: { opacity: 0.28 },
  stepText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  stepValue: { minWidth: 28, textAlign: 'center', color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  feedback: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth },
  feedbackSuccess: { backgroundColor: 'rgba(6,78,59,0.34)', borderColor: '#10B981' },
  feedbackError: { backgroundColor: 'rgba(127,29,29,0.34)', borderColor: '#F87171' },
  feedbackText: { fontSize: 9, lineHeight: 14, fontWeight: '800' },
  feedbackTextSuccess: { color: '#6EE7B7' },
  feedbackTextError: { color: '#FDA4AF' },
  cartButton: { minHeight: 48, borderRadius: 9, backgroundColor: '#F1F2F4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  cartButtonDisabled: { opacity: 0.5 },
  cartButtonPressed: { opacity: 0.78 },
  cartButtonText: { color: '#0B0B0D', fontSize: 11, fontWeight: '900' },
  cartButtonPrice: { color: '#4B5563', fontSize: 9, fontWeight: '800' },
  microMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  microMeta: { color: '#6F747D', fontSize: 8, fontWeight: '700' },
  detailShell: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18, gap: 14 },
  shortDescription: { color: '#4B5563', fontSize: 12, lineHeight: 19 },
  infoCard: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', padding: 14, gap: 8 },
  sectionEyebrow: { color: BRAND_COLORS.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: BRAND_COLORS.ink, fontSize: 18, fontWeight: '900' },
  description: { color: '#4B5563', fontSize: 12, lineHeight: 20 },
  specRow: { minHeight: 38, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  specLabel: { width: 100, color: '#6B7280', fontSize: 10, fontWeight: '700' },
  specValue: { flex: 1, color: BRAND_COLORS.ink, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  relatedSection: { gap: 10, marginHorizontal: -16 },
  relatedHeading: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  relatedList: { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  more: { color: BRAND_COLORS.primary, fontSize: 11, fontWeight: '800' },
  pressed: { opacity: 0.74 },
});
