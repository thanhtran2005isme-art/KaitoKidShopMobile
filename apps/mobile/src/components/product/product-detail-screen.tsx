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
          <Pressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onAction}
            style={({ pressed }) => [styles.optionActionButton, pressed && styles.pressed]}>
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
  const aggregateAvailableStock = hasVariantInventory
    ? variantInventory.reduce(
        (total, item) => total + Math.max(0, item.available || 0),
        0,
      )
    : Math.max(0, product?.availableStock ?? product?.stock ?? 0);
  const availableStock = (() => {
    if (!product) return 0;
    if (hasVariantInventory && selectedColor && selectedSize) return selectedInventory?.available || 0;
    return aggregateAvailableStock;
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
        <Pressable
          accessibilityLabel="Quay lại"
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
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
        <Pressable
          accessibilityLabel="Thử tải lại sản phẩm"
          accessibilityRole="button"
          onPress={() => setRetryKey((value) => value + 1)}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
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
  const productAvailableStock = aggregateAvailableStock;
  const isOutOfStock = productAvailableStock <= 0 || product.status === 'out-of-stock';
  const isLowStock = !isOutOfStock && availableStock > 0 && availableStock <= 5;
  const selectionComplete = (!colors.length || Boolean(selectedColor)) && (!sizes.length || Boolean(selectedSize));
  const selectedOutOfStock = selectionComplete && availableStock <= 0;
  const stockDisplayText = isOutOfStock
    ? 'Hết hàng'
    : hasVariantInventory && !selectionComplete
      ? `Tổng còn ${productAvailableStock} sản phẩm`
      : `Còn ${availableStock} sản phẩm`;
  const quantityStockText = selectionComplete
    ? availableStock > 0
      ? `Tồn kho khả dụng: ${availableStock} sản phẩm ở lựa chọn này`
      : 'Lựa chọn này đang hết hàng'
    : hasVariantInventory
      ? `Tổng còn ${productAvailableStock} sản phẩm · chọn đủ màu và size để xem tồn kho biến thể`
      : `Tồn kho khả dụng: ${productAvailableStock} sản phẩm`;
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

            <Pressable
              accessibilityLabel="Quay lại"
              accessibilityRole="button"
              hitSlop={8}
              onPress={goBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <AppIcon color="#FFFFFF" name="arrowLeft" size={20} />
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

            <Pressable
              accessibilityLabel="Chia sẻ sản phẩm"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => void shareProduct()}
              style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
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
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.stockText, isLowStock && styles.stockLow, isOutOfStock && styles.stockOut]}>
                {stockDisplayText}
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
                <Text accessibilityLiveRegion="polite" style={styles.quantityHelper}>
                  {quantityStockText}
                </Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityLabel="Giảm số lượng"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: quantity <= 1 }}
                  disabled={quantity <= 1}
                  onPress={() => setQuantity((current) => Math.max(1, current - 1))}
                  style={[styles.stepButton, quantity <= 1 && styles.stepDisabled]}>
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <Text accessibilityLiveRegion="polite" style={styles.stepValue}>{availableStock > 0 ? quantity : 0}</Text>
                <Pressable
                  accessibilityLabel="Tăng số lượng"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: availableStock <= 0 || quantity >= availableStock }}
                  disabled={availableStock <= 0 || quantity >= availableStock}
                  onPress={() => setQuantity((current) => Math.min(availableStock, current + 1))}
                  style={[styles.stepButton, (availableStock <= 0 || quantity >= availableStock) && styles.stepDisabled]}>
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            </View>

            {feedback ? (
              <View
                accessibilityRole="alert"
                style={[styles.feedback, feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError]}>
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
                <Pressable
                  accessibilityLabel="Xem thêm sản phẩm"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push('/categories')}>
                  <Text style={styles.more}>Xem thêm</Text>
                </Pressable>
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
  errorTitle: { color: BRAND_COLORS.ink, fontSize: 20, lineHeight: 26, fontWeight: '900', textAlign: 'center' },
  errorText: { color: BRAND_COLORS.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retryButton: { minHeight: 44, borderRadius: 12, backgroundColor: BRAND_COLORS.ink, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  retryButtonText: { color: '#FFFFFF', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  purchaseShell: { width: '100%', maxWidth: 680, alignSelf: 'center', backgroundColor: '#08090A' },
  mediaSection: { position: 'relative', paddingTop: 8, backgroundColor: '#08090A' },
  backButton: { position: 'absolute', top: 16, left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,11,13,0.76)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  mediaBadges: { position: 'absolute', left: 16, top: 68, alignItems: 'flex-start', gap: 5 },
  heroBadge: { minHeight: 24, borderRadius: 999, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  newBadge: { backgroundColor: '#3B82F6' },
  bestBadge: { backgroundColor: '#F59E0B' },
  saleBadge: { backgroundColor: '#F43F5E' },
  heroBadgeDarkText: { color: '#101114', fontSize: 10, lineHeight: 14, fontWeight: '900' },
  heroBadgeLightText: { color: '#FFFFFF', fontSize: 10, lineHeight: 14, fontWeight: '900' },
  wishlistButton: { position: 'absolute', top: 16, right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,11,13,0.76)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.25)' },
  wishlistButtonActive: { backgroundColor: 'rgba(76,5,25,0.88)', borderColor: '#FB7185' },
  shareButton: { position: 'absolute', top: 68, right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,11,13,0.72)' },
  shareButtonText: { color: '#FFFFFF', fontSize: 18, lineHeight: 22, fontWeight: '900' },
  purchasePanel: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, gap: 13, backgroundColor: '#08090A' },
  title: { color: '#FFFFFF', fontSize: 20, lineHeight: 26, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ratingGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  rating: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '900' },
  reviewCount: { color: '#C5C8CE', fontSize: 12, lineHeight: 17 },
  sold: { color: '#A4A8B0', fontSize: 12, lineHeight: 17 },
  stockText: { maxWidth: 170, color: '#34D399', fontSize: 12, lineHeight: 17, fontWeight: '800', textAlign: 'right' },
  stockLow: { color: '#FBBF24' },
  stockOut: { color: '#F87171' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  price: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '900' },
  oldPrice: { color: '#9CA3AF', fontSize: 13, lineHeight: 18, textDecorationLine: 'line-through' },
  optionSection: { gap: 8 },
  optionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  optionHeadingCopy: { gap: 2 },
  optionLabel: { color: '#D1D5DB', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  optionSelected: { color: '#A4A8B0', fontSize: 11, lineHeight: 16 },
  optionActionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  optionAction: { color: '#C4B5FD', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorButtonActive: { borderColor: '#FFFFFF' },
  colorDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1 },
  sizeButton: { minWidth: 44, minHeight: 44, borderRadius: 10, paddingHorizontal: 11, backgroundColor: '#1C1E22', borderWidth: 1, borderColor: '#292C31', alignItems: 'center', justifyContent: 'center' },
  sizeButtonActive: { backgroundColor: '#F1F2F4', borderColor: '#F1F2F4' },
  sizeText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '900' },
  sizeTextActive: { color: '#0B0B0D' },
  optionDisabled: { opacity: 0.32 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  quantityCopy: { flex: 1, gap: 2 },
  quantityLabel: { color: '#D1D5DB', fontSize: 13, lineHeight: 18, fontWeight: '800' },
  quantityHelper: { color: '#A4A8B0', fontSize: 11, lineHeight: 16 },
  stepper: { height: 44, borderRadius: 10, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1E22' },
  stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepDisabled: { opacity: 0.32 },
  stepText: { color: '#FFFFFF', fontSize: 20, lineHeight: 24, fontWeight: '800' },
  stepValue: { minWidth: 34, textAlign: 'center', color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '900' },
  feedback: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth },
  feedbackSuccess: { backgroundColor: 'rgba(6,78,59,0.34)', borderColor: '#10B981' },
  feedbackError: { backgroundColor: 'rgba(127,29,29,0.34)', borderColor: '#F87171' },
  feedbackText: { fontSize: 12, lineHeight: 18, fontWeight: '800' },
  feedbackTextSuccess: { color: '#6EE7B7' },
  feedbackTextError: { color: '#FDA4AF' },
  cartButton: { minHeight: 52, borderRadius: 12, backgroundColor: '#F1F2F4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  cartButtonDisabled: { opacity: 0.5 },
  cartButtonPressed: { opacity: 0.76 },
  cartButtonText: { color: '#0B0B0D', fontSize: 14, lineHeight: 19, fontWeight: '900' },
  cartButtonPrice: { color: '#4B5563', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  microMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  microMeta: { color: '#A4A8B0', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  detailShell: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 18, gap: 14 },
  shortDescription: { color: '#4B5563', fontSize: 13, lineHeight: 20 },
  infoCard: { borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB', padding: 14, gap: 8 },
  sectionEyebrow: { color: BRAND_COLORS.primary, fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { color: BRAND_COLORS.ink, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  description: { color: '#4B5563', fontSize: 13, lineHeight: 21 },
  specRow: { minHeight: 44, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  specLabel: { width: 104, color: '#6B7280', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  specValue: { flex: 1, color: BRAND_COLORS.ink, fontSize: 12, lineHeight: 18, fontWeight: '800', textAlign: 'right' },
  relatedSection: { gap: 10, marginHorizontal: -16 },
  relatedHeading: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  relatedList: { paddingHorizontal: 16, paddingBottom: 4, gap: 10 },
  more: { color: BRAND_COLORS.primary, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});