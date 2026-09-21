import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductDetailSkeleton } from '@/components/product/product-detail-skeleton';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductOptionSelector } from '@/components/product/product-option-selector';
import { ProductReviewsPreview } from '@/components/product/product-reviews-preview';
import { ProductSizeGuide } from '@/components/product/product-size-guide';
import { ProductCard } from '@/components/product/product-card';
import { QuantitySelector } from '@/components/product/quantity-selector';
import { BRAND, BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { shopApi } from '@/services/home.api';
import type {
  Product,
  ProductDetail,
  ProductVariantInventory,
} from '@/types/shop';
import {
  buildProductFacts,
  htmlToPlainText,
  supportsKidSizeGuide,
} from '@/utils/product-detail';

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
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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

    async function load() {
      try {
        const detail = await shopApi.getProduct(slug);
        if (!active) return;

        setProduct(detail);

        const colors = uniqueValues([
          ...(detail.colors || []),
          ...(detail.variantInventory || []).map((item) => item.color),
          ...(detail.variants || []).map((item) => item.color),
        ]);
        const sizes = uniqueValues([
          ...(detail.sizes || []),
          ...(detail.variantInventory || []).map((item) => item.size),
          ...(detail.variants || []).map((item) => item.size),
        ]);

        if (colors.length === 1) setSelectedColor(colors[0]);
        if (sizes.length === 1) setSelectedSize(sizes[0]);

        try {
          const related = await shopApi.getRelatedProducts(detail.id, 6);
          if (active) setRelatedProducts(related);
        } catch {
          if (active) setRelatedProducts([]);
        }
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Không thể tải sản phẩm.',
        );
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [slug, retryKey]);

  const colors = useMemo(
    () =>
      uniqueValues([
        ...(product?.colors || []),
        ...(product?.variantInventory || []).map((item) => item.color),
        ...(product?.variants || []).map((item) => item.color),
      ]),
    [product?.colors, product?.variantInventory, product?.variants],
  );

  const sizes = useMemo(
    () =>
      uniqueValues([
        ...(product?.sizes || []),
        ...(product?.variantInventory || []).map((item) => item.size),
        ...(product?.variants || []).map((item) => item.size),
      ]),
    [product?.sizes, product?.variantInventory, product?.variants],
  );

  const variantInventory = useMemo(
    () => product?.variantInventory || [],
    [product?.variantInventory],
  );

  const variants = useMemo(
    () => product?.variants || [],
    [product?.variants],
  );

  const hasVariantInventory = variantInventory.length > 0;
  const hasVariantPairs = variants.length > 0;

  const combinationExists = (size: string, color: string) => {
    if (hasVariantInventory) {
      return variantInventory.some(
        (item) =>
          item.size === size &&
          item.color === color &&
          item.available > 0,
      );
    }

    if (hasVariantPairs) {
      return variants.some(
        (item) => item.size === size && item.color === color,
      );
    }

    return (product?.stock || 0) > 0;
  };

  const isColorDisabled = (color: string) => {
    if (!product || product.stock <= 0) return true;

    if (selectedSize) {
      return !combinationExists(selectedSize, color);
    }

    if (hasVariantInventory) {
      return !variantInventory.some(
        (item) => item.color === color && item.available > 0,
      );
    }

    return false;
  };

  const isSizeDisabled = (size: string) => {
    if (!product || product.stock <= 0) return true;

    if (selectedColor) {
      return !combinationExists(size, selectedColor);
    }

    if (hasVariantInventory) {
      return !variantInventory.some(
        (item) => item.size === size && item.available > 0,
      );
    }

    return false;
  };

  const selectedInventory: ProductVariantInventory | undefined =
    selectedColor && selectedSize
      ? variantInventory.find(
          (item) =>
            item.color === selectedColor && item.size === selectedSize,
        )
      : undefined;

  const selectedVariant =
    selectedColor && selectedSize
      ? variants.find(
          (item) =>
            item.color === selectedColor && item.size === selectedSize,
        )
      : undefined;

  const availableStock = (() => {
    if (!product) return 0;

    if (hasVariantInventory && selectedColor && selectedSize) {
      return selectedInventory?.available || 0;
    }

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
        <Pressable onPress={() => router.back()} style={styles.darkButton}>
          <Text style={styles.darkButtonText}>Quay lại</Text>
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
        <View style={styles.errorIcon}>
          <Text style={styles.errorIconText}>!</Text>
        </View>
        <Text style={styles.errorTitle}>Không tải được sản phẩm</Text>
        <Text style={styles.error}>{error || 'Không tìm thấy sản phẩm.'}</Text>
        <View style={styles.errorActions}>
          <Pressable
            onPress={() => setRetryKey((value) => value + 1)}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.darkButton}>
            <Text style={styles.darkButtonText}>Quay lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const galleryImages = uniqueValues([product.image, ...(product.images || [])]);
  const description =
    htmlToPlainText(product.description) ||
    product.shortDescription ||
    'Thông tin sản phẩm đang được cập nhật.';
  const facts = buildProductFacts(product);
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;
  const saving =
    product.oldPrice && product.oldPrice > product.price
      ? product.oldPrice - product.price
      : 0;
  const productAvailableStock = Math.max(
    0,
    product.availableStock ?? product.stock,
  );
  const isOutOfStock =
    productAvailableStock <= 0 || product.status === 'out-of-stock';
  const isLowStock = !isOutOfStock && availableStock > 0 && availableStock <= 5;
  const canShowSizeGuide = supportsKidSizeGuide(sizes);
  const selectionComplete =
    (!colors.length || Boolean(selectedColor)) &&
    (!sizes.length || Boolean(selectedSize));
  const currentSku = selectedVariant?.sku || product.sku;
  const wished = isWishlisted(product.id);

  const productPath = `/product/${product.slug || product.id}`;

  const requireLogin = () => {
    router.push({
      pathname: '/auth/login',
      params: { redirect: productPath },
    });
  };

  const chooseColor = (color: string) => {
    setFeedback(null);
    setSelectedColor(color);
    setQuantity(1);

    if (selectedSize && !combinationExists(selectedSize, color)) {
      setSelectedSize(null);
    }
  };

  const chooseSize = (size: string) => {
    setFeedback(null);
    setSelectedSize(size);
    setQuantity(1);

    if (selectedColor && !combinationExists(size, selectedColor)) {
      setSelectedColor(null);
    }
  };

  const handleWishlist = async () => {
    if (actionBusy) return;

    if (!token) {
      requireLogin();
      return;
    }

    try {
      setActionBusy('wishlist');
      const result = await toggleWishlist(product.id);
      setFeedback({
        type: 'success',
        text:
          result === 'added'
            ? 'Đã lưu sản phẩm vào danh sách yêu thích.'
            : 'Đã bỏ sản phẩm khỏi danh sách yêu thích.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Không thể cập nhật danh sách yêu thích.',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleAddToCart = async () => {
    if (actionBusy) return;

    if (!token) {
      requireLogin();
      return;
    }

    if (!selectionComplete) {
      setFeedback({
        type: 'error',
        text: 'Vui lòng chọn đầy đủ màu sắc và kích cỡ.',
      });
      return;
    }

    if (isOutOfStock || availableStock <= 0) {
      setFeedback({
        type: 'error',
        text: 'Sản phẩm hoặc biến thể này hiện đã hết hàng.',
      });
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

        if (
          current.variantInventory?.length &&
          selectedSize &&
          selectedColor
        ) {
          return {
            ...current,
            variantInventory: current.variantInventory.map((variant) =>
              variant.size === selectedSize &&
              variant.color === selectedColor
                ? { ...variant, available: item.availableStock }
                : variant,
            ),
          };
        }

        return {
          ...current,
          availableStock: item.availableStock,
        };
      });

      setFeedback({
        type: 'success',
        text: `Đã thêm ${quantity} sản phẩm vào giỏ hàng.`,
      });
      setQuantity(1);
    } catch (error) {
      setFeedback({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Không thể thêm sản phẩm vào giỏ hàng.',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const shareProduct = async () => {
    const message = [
      product.name,
      formatPrice(product.price),
      product.shortDescription || BRAND.promise,
      `KaitoKid · ${product.category}`,
    ].join('\n');

    try {
      await Share.share({ message });
    } catch {
      // Chia sẻ là hành động phụ, không làm gián đoạn màn chi tiết nếu nền tảng không hỗ trợ.
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.mediaSection}>
          <ProductGallery images={galleryImages} />

          <View style={styles.mediaActions}>
            <Pressable
              accessibilityLabel="Quay lại"
              onPress={() => router.back()}
              style={styles.floatingButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Chia sẻ sản phẩm"
              onPress={() => void shareProduct()}
              style={styles.floatingButton}>
              <Text style={styles.shareText}>↗</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.shell}>
          <View style={styles.content}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.category}>{product.category}</Text>
              </View>
              {product.isNew ? (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>MỚI</Text>
                </View>
              ) : null}
              {product.isBestSeller ? (
                <View style={styles.hotBadge}>
                  <Text style={styles.hotBadgeText}>BÁN CHẠY</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.title}>{product.name}</Text>

            <View style={styles.ratingRow}>
              <Text style={styles.rating}>★ {product.rating.toFixed(1)}</Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.meta}>Đã bán {product.soldCount}</Text>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.meta}>SKU {currentSku}</Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatPrice(product.price)}</Text>
              {product.oldPrice && product.oldPrice > product.price ? (
                <Text style={styles.oldPrice}>{formatPrice(product.oldPrice)}</Text>
              ) : null}
              {discount > 0 ? (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>-{discount}%</Text>
                </View>
              ) : null}
            </View>

            {saving > 0 ? (
              <Text style={styles.saving}>
                Tiết kiệm {formatPrice(saving)}
              </Text>
            ) : null}

            {product.shortDescription ? (
              <Text style={styles.shortDescription}>
                {product.shortDescription}
              </Text>
            ) : null}

            <View style={styles.divider} />

            <ProductOptionSelector
              isDisabled={isColorDisabled}
              label="Màu sắc"
              onSelect={chooseColor}
              selected={selectedColor}
              type="color"
              values={colors}
            />

            <ProductOptionSelector
              actionLabel={canShowSizeGuide ? 'Hướng dẫn chọn size' : undefined}
              helper={
                canShowSizeGuide
                  ? 'Size KaitoKid ưu tiên theo chiều cao của bé.'
                  : undefined
              }
              isDisabled={isSizeDisabled}
              label="Kích cỡ"
              onAction={
                canShowSizeGuide
                  ? () => setSizeGuideVisible(true)
                  : undefined
              }
              onSelect={chooseSize}
              selected={selectedSize}
              values={sizes}
            />

            <View
              style={[
                styles.stockCard,
                isOutOfStock
                  ? styles.stockCardOut
                  : isLowStock
                    ? styles.stockCardLow
                    : styles.stockCardOk,
              ]}>
              <View style={styles.stockCopy}>
                <Text style={styles.stockTitle}>
                  {isOutOfStock
                    ? 'Sản phẩm đang hết hàng'
                    : hasVariantInventory && selectedColor && selectedSize
                      ? availableStock > 0
                        ? `Còn ${availableStock} sản phẩm ở biến thể này`
                        : 'Biến thể này đang hết hàng'
                      : hasVariantInventory
                        ? 'Chọn màu và size để xem tồn kho chính xác'
                        : `Còn ${product.stock} sản phẩm`}
                </Text>
                <Text style={styles.stockHelper}>
                  {hasVariantInventory
                    ? 'Tồn kho đã trừ số lượng đang được giữ trong giỏ.'
                    : 'Đang hiển thị tồn kho tổng của sản phẩm.'}
                </Text>
              </View>
              <Text style={styles.stockIcon}>
                {isOutOfStock ? '×' : isLowStock ? '!' : '✓'}
              </Text>
            </View>

            <QuantitySelector
              max={isOutOfStock ? 0 : availableStock}
              onChange={setQuantity}
              value={quantity}
            />

            <View style={styles.selectionCard}>
              <Text style={styles.selectionEyebrow}>LỰA CHỌN CỦA BẠN</Text>
              <Text style={styles.selectionTitle}>
                {selectionComplete
                  ? [
                      selectedColor || null,
                      selectedSize ? `Size ${selectedSize}` : null,
                      `SL ${quantity}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Hãy chọn đủ màu và size trước khi mua'}
              </Text>
              <Text style={styles.selectionHelper}>
                Lựa chọn màu, size và số lượng sẽ được giữ trong lúc bạn xem sản phẩm.
              </Text>
            </View>

            <View style={styles.trustGrid}>
              <View style={styles.trustCard}>
                <Text style={styles.trustIcon}>↻</Text>
                <Text style={styles.trustTitle}>Đổi trả 7 ngày</Text>
                <Text style={styles.trustText}>An tâm chọn size cho bé</Text>
              </View>
              <View style={styles.trustCard}>
                <Text style={styles.trustIcon}>🚚</Text>
                <Text style={styles.trustTitle}>Freeship 499K</Text>
                <Text style={styles.trustText}>Giao hàng toàn quốc</Text>
              </View>
              <View style={styles.trustCard}>
                <Text style={styles.trustIcon}>✓</Text>
                <Text style={styles.trustTitle}>Ưu tiên thoải mái</Text>
                <Text style={styles.trustText}>{BRAND.promise}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <Text style={styles.sectionEyebrow}>CHI TIẾT</Text>
              <Text style={styles.sectionTitle}>Mô tả sản phẩm</Text>
              <Text style={styles.description}>{description}</Text>
            </View>

            <View style={styles.specCard}>
              <Text style={styles.specTitle}>Thông tin sản phẩm</Text>
              {facts.map((item, index) => (
                <View
                  key={`${item.label}-${item.value}-${index}`}
                  style={styles.specRow}>
                  <Text style={styles.specLabel}>{item.label}</Text>
                  <Text style={styles.specValue}>{item.value}</Text>
                </View>
              ))}
            </View>

            <ProductReviewsPreview
              rating={product.rating}
              reviews={product.reviews || []}
            />

            {relatedProducts.length ? (
              <View style={styles.relatedSection}>
                <View style={styles.relatedHeading}>
                  <View>
                    <Text style={styles.sectionEyebrow}>GỢI Ý THÊM</Text>
                    <Text style={styles.sectionTitle}>Có thể bé cũng thích</Text>
                  </View>
                  <Pressable onPress={() => router.push('/categories')}>
                    <Text style={styles.more}>Xem thêm</Text>
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.relatedList}>
                  {relatedProducts.map((item) => (
                    <ProductCard key={item.id} product={item} width={174} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.actionBarSafe}>
        {feedback ? (
          <View
            style={[
              styles.feedback,
              feedback.type === 'success'
                ? styles.feedbackSuccess
                : styles.feedbackError,
            ]}>
            <Text
              style={[
                styles.feedbackText,
                feedback.type === 'success'
                  ? styles.feedbackTextSuccess
                  : styles.feedbackTextError,
              ]}>
              {feedback.text}
            </Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            accessibilityLabel={
              wished
                ? 'Bỏ khỏi danh sách yêu thích'
                : 'Thêm vào danh sách yêu thích'
            }
            disabled={actionBusy != null}
            onPress={() => void handleWishlist()}
            style={({ pressed }) => [
              styles.wishlistAction,
              wished && styles.wishlistActionActive,
              pressed && styles.actionPressed,
              actionBusy === 'wishlist' && styles.actionDisabled,
            ]}>
            <Text
              style={[
                styles.wishlistActionIcon,
                wished && styles.wishlistActionIconActive,
              ]}>
              {actionBusy === 'wishlist' ? '…' : wished ? '♥' : '♡'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Thêm sản phẩm vào giỏ hàng"
            disabled={actionBusy != null || isOutOfStock}
            onPress={() => void handleAddToCart()}
            style={({ pressed }) => [
              styles.cartAction,
              (actionBusy != null || isOutOfStock) && styles.cartActionDisabled,
              pressed && !isOutOfStock && styles.actionPressed,
            ]}>
            <View style={styles.cartActionCopy}>
              <Text style={styles.cartActionTitle}>
                {isOutOfStock
                  ? 'Hết hàng'
                  : actionBusy === 'cart'
                    ? 'Đang thêm...'
                    : selectionComplete
                      ? 'Thêm vào giỏ'
                      : 'Chọn màu & size'}
              </Text>
              {!isOutOfStock ? (
                <Text style={styles.cartActionPrice}>
                  {formatPrice(product.price * quantity)}
                </Text>
              ) : null}
            </View>
            {!isOutOfStock && actionBusy !== 'cart' ? (
              <Text style={styles.cartActionArrow}>→</Text>
            ) : null}
          </Pressable>
        </View>
      </SafeAreaView>

      <ProductSizeGuide
        availableSizes={sizes}
        onClose={() => setSizeGuideVisible(false)}
        visible={sizeGuideVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 34,
  },
  center: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconText: {
    color: BRAND_COLORS.danger,
    fontSize: 24,
    fontWeight: '900',
  },
  errorTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  error: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: BRAND_COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  darkButton: {
    backgroundColor: BRAND_COLORS.ink,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  darkButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  mediaSection: {
    position: 'relative',
  },
  mediaActions: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  floatingButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  backText: {
    color: BRAND_COLORS.ink,
    fontSize: 32,
    lineHeight: 34,
    marginTop: -2,
  },
  shareText: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '900',
  },
  shell: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  content: {
    marginTop: 12,
    paddingHorizontal: 16,
    gap: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  categoryBadge: {
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  category: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  newBadge: {
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.ink,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  hotBadge: {
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.accentSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  hotBadgeText: {
    color: '#C2410C',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  rating: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '900',
  },
  dot: {
    color: '#D1D5DB',
    fontSize: 10,
  },
  meta: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 9,
  },
  price: {
    color: BRAND_COLORS.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  oldPrice: {
    color: '#9CA3AF',
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    borderRadius: 999,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  discountText: {
    color: BRAND_COLORS.danger,
    fontSize: 9,
    fontWeight: '900',
  },
  saving: {
    color: BRAND_COLORS.success,
    fontSize: 10,
    fontWeight: '800',
    marginTop: -9,
  },
  shortDescription: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 19,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BRAND_COLORS.line,
    marginVertical: 3,
  },
  stockCard: {
    borderRadius: 17,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stockCardOk: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  stockCardLow: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  stockCardOut: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  stockCopy: { flex: 1, gap: 3 },
  stockTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  stockHelper: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
  },
  stockIcon: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  selectionCard: {
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.primarySoft,
    padding: 14,
    gap: 4,
  },
  selectionEyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  selectionTitle: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 17,
  },
  selectionHelper: {
    color: '#6D28D9',
    fontSize: 9,
    lineHeight: 14,
  },
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trustCard: {
    flex: 1,
    minWidth: 104,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    padding: 11,
    gap: 4,
  },
  trustIcon: {
    fontSize: 18,
  },
  trustTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  trustText: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 12,
  },
  section: { gap: 8 },
  sectionEyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 19,
    fontWeight: '900',
  },
  description: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 20,
  },
  specCard: {
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    overflow: 'hidden',
  },
  specTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  specRow: {
    minHeight: 42,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
  },
  specLabel: {
    width: 100,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  specValue: {
    flex: 1,
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  actionBarSafe: {
    backgroundColor: BRAND_COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  feedback: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feedbackSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  feedbackError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  feedbackText: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  feedbackTextSuccess: {
    color: '#047857',
  },
  feedbackTextError: {
    color: '#B91C1C',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  wishlistAction: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishlistActionActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  wishlistActionIcon: {
    color: BRAND_COLORS.ink,
    fontSize: 27,
    lineHeight: 29,
    fontWeight: '900',
  },
  wishlistActionIconActive: {
    color: BRAND_COLORS.danger,
  },
  cartAction: {
    flex: 1,
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cartActionDisabled: {
    backgroundColor: '#9CA3AF',
  },
  cartActionCopy: {
    flex: 1,
    gap: 2,
  },
  cartActionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  cartActionPrice: {
    color: '#EDE9FE',
    fontSize: 10,
    fontWeight: '700',
  },
  cartActionArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  actionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  actionDisabled: {
    opacity: 0.55,
  },
  relatedSection: {
    gap: 12,
    marginHorizontal: -16,
  },
  relatedHeading: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  more: {
    color: BRAND_COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  relatedList: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
  },
});
