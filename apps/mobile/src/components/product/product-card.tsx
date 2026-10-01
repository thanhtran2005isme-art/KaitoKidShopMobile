import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { resolveMediaUrl } from '@/services/api-client';
import type { Product } from '@/types/shop';
import { productColorValue } from '@/utils/product-detail';

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

type ProductCardProps = {
  product: Product;
  width?: number;
  wishlistPlacement?: 'overlay' | 'inline';
};

export const ProductCard = memo(function ProductCard({
  product,
  width = 168,
  wishlistPlacement = 'overlay',
}: ProductCardProps) {
  const router = useRouter();
  const { token } = useAuth();
  const { addToCart, isWishlisted, toggleWishlist } = useShopping();
  const compact = width < 220;

  const colors = useMemo(
    () => uniqueValues(product.colors || []),
    [product.colors],
  );
  const sizes = useMemo(
    () => uniqueValues(product.sizes || []),
    [product.sizes],
  );
  const optionalImages = (product as Product & { images?: string[] }).images;
  const images = useMemo(
    () =>
      uniqueValues([product.image, ...(optionalImages || [])])
        .map((item) => resolveMediaUrl(item))
        .filter((item): item is string => Boolean(item)),
    [optionalImages, product.image],
  );

  const initialAvailableStock = Math.max(
    0,
    product.availableStock ?? product.stock,
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(
    colors[0] || null,
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(
    sizes.length === 1 ? sizes[0] : null,
  );
  const [availableStock, setAvailableStock] = useState(initialAvailableStock);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentImageIndex(0);
    setSelectedColor(colors[0] || null);
    setSelectedSize(sizes.length === 1 ? sizes[0] : null);
    setAvailableStock(initialAvailableStock);
    setActionError(null);
    setAddedToCart(false);
  }, [colors, initialAvailableStock, product.id, sizes]);

  useEffect(() => {
    if (!addedToCart) return;
    const timer = setTimeout(() => setAddedToCart(false), 1800);
    return () => clearTimeout(timer);
  }, [addedToCart]);

  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;
  const isOutOfStock =
    availableStock <= 0 || product.status === 'out-of-stock';
  const isLowStock = !isOutOfStock && availableStock <= 5;
  const wished = isWishlisted(product.id);
  const currentImage = images[currentImageIndex] || null;
  const hasMultipleImages = images.length > 1;

  const openProduct = () => {
    router.push({
      pathname: '/product/[slug]',
      params: { slug: product.slug || String(product.id) },
    });
  };

  const openLoginForProduct = () => {
    const productPath = `/product/${product.slug || product.id}`;
    router.push({
      pathname: '/auth/login',
      params: { redirect: productPath },
    });
  };

  const handleWishlist = async () => {
    if (wishlistBusy) return;

    if (!token) {
      openLoginForProduct();
      return;
    }

    try {
      setWishlistBusy(true);
      await toggleWishlist(product.id);
    } catch (error) {
      Alert.alert(
        'Danh sách yêu thích',
        error instanceof Error
          ? error.message
          : 'Không thể cập nhật danh sách yêu thích.',
      );
    } finally {
      setWishlistBusy(false);
    }
  };

  const handleAddToCart = async () => {
    if (cartBusy || addedToCart) return;
    setActionError(null);

    if (!token) {
      openLoginForProduct();
      return;
    }

    if (isOutOfStock) {
      setActionError('Sản phẩm hiện đã hết hàng.');
      return;
    }

    if (colors.length > 0 && !selectedColor) {
      setActionError('Vui lòng chọn màu sắc.');
      return;
    }

    if (sizes.length > 0 && !selectedSize) {
      setActionError('Vui lòng chọn kích cỡ.');
      return;
    }

    try {
      setCartBusy(true);
      const item = await addToCart({
        productId: product.id,
        size: selectedSize || '',
        color: selectedColor || '',
        quantity: 1,
      });
      setAvailableStock(Math.max(0, item.availableStock));
      setAddedToCart(true);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Không thể thêm sản phẩm vào giỏ hàng.',
      );
    } finally {
      setCartBusy(false);
    }
  };

  const cartLabel = (() => {
    if (cartBusy) return 'Đang thêm...';
    if (addedToCart) return 'Đã thêm vào giỏ';
    if (isOutOfStock) return 'Hết hàng';
    if (sizes.length > 0 && !selectedSize) return 'Chọn kích cỡ';
    if (colors.length > 0 && !selectedColor) return 'Chọn màu sắc';
    return 'Thêm vào giỏ';
  })();

  const stockLabel = isOutOfStock
    ? 'Hết hàng'
    : isLowStock
      ? `Còn ${availableStock}`
      : 'Còn hàng';

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        { width },
      ]}>
      <View
        style={[
          styles.imageWrap,
          compact && styles.imageWrapCompact,
        ]}>
        <Pressable
          accessibilityHint="Mở chi tiết sản phẩm"
          accessibilityLabel={`Xem ${product.name}`}
          accessibilityRole="button"
          onPress={openProduct}
          style={({ pressed }) => [
            styles.imagePressable,
            pressed && styles.mediaPressed,
          ]}>
          {currentImage ? (
            <Image
              accessibilityLabel={product.name}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: currentImage }}
              style={[
                styles.image,
                isOutOfStock && styles.imageOutOfStock,
              ]}
              transition={180}
            />
          ) : (
            <View style={styles.imageFallbackWrap}>
              <AppIcon color={BRAND_COLORS.primary} name="image" size={38} />
            </View>
          )}
        </Pressable>

        <View pointerEvents="none" style={styles.badges}>
          {product.isNew ? (
            <View style={[styles.badge, styles.newBadge]}>
              <Text style={styles.newBadgeText}>Mới</Text>
            </View>
          ) : null}
          {product.isBestSeller ? (
            <View style={[styles.badge, styles.bestBadge]}>
              <Text style={styles.darkBadgeText}>Bán chạy</Text>
            </View>
          ) : null}
          {discount > 0 ? (
            <View style={[styles.badge, styles.saleBadge]}>
              <Text style={styles.lightBadgeText}>-{discount}%</Text>
            </View>
          ) : null}
        </View>

        {hasMultipleImages ? (
          <View style={styles.imageIndicators}>
            {images.map((_, index) => {
              const active = index === currentImageIndex;
              return (
                <Pressable
                  key={`${product.id}-image-${index}`}
                  accessibilityLabel={`Xem ảnh ${index + 1}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  hitSlop={8}
                  onPress={() => setCurrentImageIndex(index)}
                  style={[
                    styles.imageIndicator,
                    active
                      ? styles.imageIndicatorActive
                      : styles.imageIndicatorIdle,
                  ]}
                />
              );
            })}
          </View>
        ) : null}

        {wishlistPlacement === 'overlay' ? (
          <Pressable
            accessibilityLabel={
              wished
                ? 'Bỏ khỏi danh sách yêu thích'
                : 'Thêm vào danh sách yêu thích'
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: wishlistBusy, selected: wished }}
            disabled={wishlistBusy}
            hitSlop={4}
            onPress={() => void handleWishlist()}
            style={({ pressed }) => [
              styles.wishlistButton,
              compact && styles.wishlistButtonCompact,
              wished && styles.wishlistButtonActive,
              pressed && styles.controlPressed,
              wishlistBusy && styles.controlBusy,
            ]}>
            {wishlistBusy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <AppIcon
                color={wished ? '#FB7185' : '#FFFFFF'}
                name={wished ? 'heartFilled' : 'heart'}
                size={compact ? 19 : 21}
              />
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.content, compact && styles.contentCompact]}>
        <Pressable
          accessibilityLabel={`Mở ${product.name}`}
          accessibilityRole="link"
          onPress={openProduct}
          style={({ pressed }) => pressed && styles.copyPressed}>
          <Text
            numberOfLines={compact ? 2 : 1}
            style={[styles.name, compact && styles.nameCompact]}>
            {product.name}
          </Text>
        </Pressable>

        <View style={styles.metaRow}>
          <View style={styles.ratingGroup}>
            <AppIcon color="#F59E0B" name="starFilled" size={compact ? 13 : 15} />
            <Text style={[styles.rating, compact && styles.metaCompact]}>
              {product.rating > 0 ? product.rating.toFixed(1) : 'Mới'}
            </Text>
            {product.soldCount > 0 ? (
              <Text style={[styles.sold, compact && styles.metaCompact]}>
                ({product.soldCount} đã bán)
              </Text>
            ) : null}
          </View>
          <Text
            style={[
              styles.stock,
              isOutOfStock && styles.stockOut,
              isLowStock && styles.stockLow,
              compact && styles.stockCompact,
            ]}>
            {stockLabel}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text style={[styles.price, compact && styles.priceCompact]}>
            {formatPrice(product.price)}
          </Text>
          {product.oldPrice && product.oldPrice > product.price ? (
            <Text style={[styles.oldPrice, compact && styles.oldPriceCompact]}>
              {formatPrice(product.oldPrice)}
            </Text>
          ) : null}
        </View>

        {colors.length > 0 ? (
          <View style={styles.optionBlock}>
            <Text style={[styles.optionLabel, compact && styles.optionLabelCompact]}>
              Màu sắc
            </Text>
            <View style={styles.colorsRow}>
              {colors.map((color) => {
                const selected = selectedColor === color;
                return (
                  <Pressable
                    key={color}
                    accessibilityLabel={`Chọn màu ${color}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    hitSlop={4}
                    onPress={() => {
                      setSelectedColor(color);
                      setActionError(null);
                    }}
                    style={({ pressed }) => [
                      styles.colorButton,
                      compact && styles.colorButtonCompact,
                      selected && styles.colorButtonSelected,
                      pressed && styles.controlPressed,
                    ]}>
                    <View
                      style={[
                        styles.colorDot,
                        compact && styles.colorDotCompact,
                        {
                          backgroundColor: productColorValue(color),
                          borderColor: color.toLowerCase().includes('trắng')
                            ? '#D1D5DB'
                            : 'rgba(255,255,255,0.22)',
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {sizes.length > 0 ? (
          <View style={styles.optionBlock}>
            <Text style={[styles.optionLabel, compact && styles.optionLabelCompact]}>
              Kích cỡ
            </Text>
            <View style={styles.sizesRow}>
              {sizes.map((size) => {
                const selected = selectedSize === size;
                return (
                  <Pressable
                    key={size}
                    accessibilityLabel={`Chọn kích cỡ ${size}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    hitSlop={3}
                    onPress={() => {
                      setSelectedSize(size);
                      setActionError(null);
                    }}
                    style={({ pressed }) => [
                      styles.sizeButton,
                      compact && styles.sizeButtonCompact,
                      selected && styles.sizeButtonSelected,
                      pressed && styles.controlPressed,
                    ]}>
                    <Text
                      style={[
                        styles.sizeText,
                        compact && styles.sizeTextCompact,
                        selected && styles.sizeTextSelected,
                      ]}>
                      {size}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {actionError ? (
          <Text accessibilityRole="alert" style={styles.actionError}>
            {actionError}
          </Text>
        ) : null}

        <Pressable
          accessibilityLabel={cartLabel}
          accessibilityRole="button"
          accessibilityState={{
            disabled: cartBusy || addedToCart || isOutOfStock,
          }}
          disabled={cartBusy || addedToCart || isOutOfStock}
          onPress={() => void handleAddToCart()}
          style={({ pressed }) => [
            styles.cartButton,
            compact && styles.cartButtonCompact,
            (cartBusy || addedToCart || isOutOfStock) &&
              styles.cartButtonDisabled,
            pressed && styles.cartButtonPressed,
          ]}>
          {cartBusy ? (
            <ActivityIndicator color="#0B0B0D" size="small" />
          ) : (
            <AppIcon
              color="#0B0B0D"
              name={addedToCart ? 'check' : 'cart'}
              size={compact ? 17 : 19}
            />
          )}
          <Text style={[styles.cartButtonText, compact && styles.cartButtonTextCompact]}>
            {cartLabel}
          </Text>
        </Pressable>

        {wishlistPlacement === 'inline' ? (
          <Pressable
            accessibilityLabel={
              wished
                ? 'Bỏ khỏi danh sách yêu thích'
                : 'Thêm vào danh sách yêu thích'
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: wishlistBusy, selected: wished }}
            disabled={wishlistBusy}
            onPress={() => void handleWishlist()}
            style={({ pressed }) => [
              styles.wishlistInlineButton,
              pressed && styles.controlPressed,
              wishlistBusy && styles.controlBusy,
            ]}>
            {wishlistBusy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <AppIcon
                  color={wished ? '#FB7185' : '#FFFFFF'}
                  name={wished ? 'heartFilled' : 'heart'}
                  size={18}
                />
                <Text
                  style={[
                    styles.wishlistInlineText,
                    wished && styles.wishlistInlineTextActive,
                  ]}>
                  {wished ? 'Đã lưu' : 'Yêu thích'}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#08090A',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#26282D',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  cardCompact: {
    borderRadius: 15,
  },
  imageWrap: {
    aspectRatio: 0.82,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
  },
  imageWrapCompact: {
    aspectRatio: 0.78,
  },
  imagePressable: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOutOfStock: {
    opacity: 0.58,
  },
  imageFallbackWrap: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPressed: {
    opacity: 0.88,
  },
  badges: {
    position: 'absolute',
    left: 10,
    top: 10,
    alignItems: 'flex-start',
    gap: 5,
  },
  badge: {
    minHeight: 22,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadge: {
    backgroundColor: '#3B82F6',
  },
  bestBadge: {
    backgroundColor: '#F59E0B',
  },
  saleBadge: {
    backgroundColor: '#F43F5E',
  },
  newBadgeText: {
    color: '#07111F',
    fontSize: 9,
    fontWeight: '900',
  },
  darkBadgeText: {
    color: '#17120A',
    fontSize: 9,
    fontWeight: '900',
  },
  lightBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  wishlistButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 3,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(11,11,13,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  wishlistButtonCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  wishlistButtonActive: {
    backgroundColor: 'rgba(76,5,25,0.88)',
    borderColor: '#FB7185',
  },
  imageIndicators: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  imageIndicator: {
    height: 4,
    borderRadius: 999,
  },
  imageIndicatorActive: {
    width: 15,
    backgroundColor: '#FFFFFF',
  },
  imageIndicatorIdle: {
    width: 4,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  content: {
    padding: 14,
    gap: 11,
  },
  contentCompact: {
    padding: 10,
    gap: 8,
  },
  copyPressed: {
    opacity: 0.72,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  nameCompact: {
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
  },
  metaRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  ratingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 3,
  },
  rating: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  sold: {
    color: '#9CA3AF',
    fontSize: 9,
    flexShrink: 1,
  },
  metaCompact: {
    fontSize: 8,
  },
  stock: {
    color: '#34D399',
    fontSize: 9,
    fontWeight: '800',
  },
  stockCompact: {
    fontSize: 8,
  },
  stockLow: {
    color: '#FBBF24',
  },
  stockOut: {
    color: '#F87171',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 7,
  },
  price: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  priceCompact: {
    fontSize: 14,
  },
  oldPrice: {
    color: '#7C818A',
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  oldPriceCompact: {
    fontSize: 9,
  },
  optionBlock: {
    gap: 6,
  },
  optionLabel: {
    color: '#A8ADB7',
    fontSize: 10,
    fontWeight: '700',
  },
  optionLabelCompact: {
    fontSize: 8,
  },
  colorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  colorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorButtonCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorButtonSelected: {
    borderColor: '#FFFFFF',
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  colorDotCompact: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  sizesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sizeButton: {
    minWidth: 42,
    minHeight: 40,
    borderRadius: 9,
    paddingHorizontal: 9,
    backgroundColor: '#1C1E22',
    borderWidth: 1,
    borderColor: '#25282D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeButtonCompact: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 6,
  },
  sizeButtonSelected: {
    backgroundColor: '#F3F4F6',
    borderColor: '#F3F4F6',
  },
  sizeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  sizeTextCompact: {
    fontSize: 8,
  },
  sizeTextSelected: {
    color: '#0B0B0D',
  },
  actionError: {
    color: '#FDA4AF',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
  },
  cartButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#F1F2F4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  cartButtonCompact: {
    minHeight: 44,
    borderRadius: 9,
    paddingHorizontal: 8,
  },
  cartButtonDisabled: {
    opacity: 0.58,
  },
  cartButtonPressed: {
    opacity: 0.78,
  },
  cartButtonText: {
    color: '#0B0B0D',
    fontSize: 11,
    fontWeight: '900',
  },
  cartButtonTextCompact: {
    fontSize: 9,
  },
  wishlistInlineButton: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#25282D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wishlistInlineText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  wishlistInlineTextActive: {
    color: '#FB7185',
  },
  controlPressed: {
    opacity: 0.72,
  },
  controlBusy: {
    opacity: 0.56,
  },
});
