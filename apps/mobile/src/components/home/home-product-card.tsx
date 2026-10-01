import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { resolveMediaUrl } from '@/services/api-client';
import type { Product } from '@/types/shop';
import { productColorValue } from '@/utils/product-detail';

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

export function HomeProductCard({
  product,
  width,
}: {
  product: Product;
  width: number;
}) {
  const router = useRouter();
  const { token } = useAuth();
  const { addToCart, isWishlisted, toggleWishlist } = useShopping();
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const image = resolveMediaUrl(product.image);
  const availableStock = Math.max(0, product.availableStock ?? product.stock);
  const isOutOfStock = availableStock <= 0 || product.status === 'out-of-stock';
  const isLowStock = !isOutOfStock && availableStock <= 5;
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;
  const colors = Array.from(
    new Set((product.colors || []).map((item) => item?.trim()).filter(Boolean)),
  ) as string[];
  const sizes = Array.from(
    new Set((product.sizes || []).map((item) => item?.trim()).filter(Boolean)),
  ) as string[];
  const visibleColors = colors.slice(0, 3);
  const visibleSizes = sizes.slice(0, 4);
  const [selectedColor, setSelectedColor] = useState(colors[0] || '');
  const [selectedSize, setSelectedSize] = useState(
    sizes.length === 1 ? sizes[0] : '',
  );
  const wished = isWishlisted(product.id);

  useEffect(() => {
    setSelectedColor(colors[0] || '');
    setSelectedSize(sizes.length === 1 ? sizes[0] : '');
    setAddedToCart(false);
  }, [product.id]);

  useEffect(() => {
    if (!addedToCart) return;
    const timer = setTimeout(() => setAddedToCart(false), 1600);
    return () => clearTimeout(timer);
  }, [addedToCart]);

  const openProduct = () => {
    router.push({
      pathname: '/product/[slug]',
      params: { slug: product.slug || String(product.id) },
    });
  };

  const openLoginForProduct = () => {
    router.push({
      pathname: '/auth/login',
      params: { redirect: `/product/${product.slug || product.id}` },
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

    if (!token) {
      openLoginForProduct();
      return;
    }

    if (isOutOfStock) {
      Alert.alert('Giỏ hàng', 'Sản phẩm hiện đã hết hàng.');
      return;
    }

    if (sizes.length > 0 && !selectedSize) {
      Alert.alert('Chọn kích cỡ', 'Vui lòng chọn kích cỡ trước khi thêm vào giỏ.');
      return;
    }

    if (colors.length > 0 && !selectedColor) {
      Alert.alert('Chọn màu', 'Vui lòng chọn màu trước khi thêm vào giỏ.');
      return;
    }

    try {
      setCartBusy(true);
      await addToCart({
        productId: product.id,
        size: selectedSize,
        color: selectedColor,
        quantity: 1,
      });
      setAddedToCart(true);
    } catch (error) {
      Alert.alert(
        'Giỏ hàng',
        error instanceof Error
          ? error.message
          : 'Không thể thêm sản phẩm vào giỏ hàng.',
      );
    } finally {
      setCartBusy(false);
    }
  };

  const stockLabel = isOutOfStock
    ? 'Hết hàng'
    : isLowStock
      ? `Còn ${availableStock}`
      : 'Còn hàng';

  const cartLabel = cartBusy
    ? 'Đang thêm...'
    : addedToCart
      ? 'Đã thêm'
      : sizes.length > 0 && !selectedSize
        ? 'Chọn cỡ'
        : 'Thêm giỏ';

  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.imageWrap}>
        <Pressable
          accessibilityHint="Mở chi tiết sản phẩm"
          accessibilityLabel={`Xem ${product.name}`}
          accessibilityRole="button"
          onPress={openProduct}
          style={({ pressed }) => [styles.imagePressable, pressed && styles.pressed]}>
          {image ? (
            <Image
              accessibilityLabel={product.name}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri: image }}
              style={[styles.image, isOutOfStock && styles.imageOut]}
              transition={160}
            />
          ) : (
            <View style={styles.imageFallback}>
              <AppIcon color="#7C3AED" name="image" size={30} />
            </View>
          )}
        </Pressable>

        <View pointerEvents="none" style={styles.badges}>
          {product.isNew ? (
            <View style={[styles.badge, styles.newBadge]}>
              <Text style={styles.badgeDarkText}>Mới</Text>
            </View>
          ) : null}
          {product.isBestSeller ? (
            <View style={[styles.badge, styles.bestBadge]}>
              <Text style={styles.badgeDarkText}>Bán chạy</Text>
            </View>
          ) : null}
          {discount > 0 ? (
            <View style={[styles.badge, styles.saleBadge]}>
              <Text style={styles.badgeLightText}>-{discount}%</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          accessibilityLabel={wished ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
          accessibilityRole="button"
          accessibilityState={{ disabled: wishlistBusy, selected: wished }}
          disabled={wishlistBusy}
          hitSlop={5}
          onPress={() => void handleWishlist()}
          style={({ pressed }) => [
            styles.wishlist,
            wished && styles.wishlistActive,
            pressed && styles.pressed,
          ]}>
          {wishlistBusy ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <AppIcon
              color={wished ? '#FB7185' : '#FFFFFF'}
              name={wished ? 'heartFilled' : 'heart'}
              size={18}
            />
          )}
        </Pressable>
      </View>

      <View style={styles.content}>
        <Pressable
          accessibilityLabel={`Mở ${product.name}`}
          accessibilityRole="button"
          onPress={openProduct}
          style={({ pressed }) => pressed && styles.contentPressed}>
          <Text numberOfLines={2} style={styles.name}>
            {product.name}
          </Text>
        </Pressable>

        <View style={styles.metaRow}>
          <View style={styles.ratingRow}>
            <AppIcon color="#F59E0B" name="starFilled" size={12} />
            <Text style={styles.rating}>
              {product.rating > 0 ? product.rating.toFixed(1) : 'Mới'}
            </Text>
            {product.soldCount > 0 ? (
              <Text numberOfLines={1} style={styles.sold}>
                · {product.soldCount} đã bán
              </Text>
            ) : null}
          </View>
          <Text
            numberOfLines={1}
            style={[
              styles.stock,
              isLowStock && styles.stockLow,
              isOutOfStock && styles.stockOut,
            ]}>
            {stockLabel}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text numberOfLines={1} style={styles.price}>
            {formatPrice(product.price)}
          </Text>
          {product.oldPrice && product.oldPrice > product.price ? (
            <Text numberOfLines={1} style={styles.oldPrice}>
              {formatPrice(product.oldPrice)}
            </Text>
          ) : null}
        </View>

        {visibleColors.length > 0 ? (
          <View style={styles.colorRow}>
            {visibleColors.map((color) => {
              const selected = selectedColor === color;
              return (
                <Pressable
                  key={color}
                  accessibilityLabel={`Chọn màu ${color}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  hitSlop={4}
                  onPress={() => setSelectedColor(color)}
                  style={({ pressed }) => [
                    styles.colorButton,
                    selected && styles.colorButtonSelected,
                    pressed && styles.pressed,
                  ]}>
                  <View
                    style={[
                      styles.colorDot,
                      {
                        backgroundColor: productColorValue(color),
                        borderColor: color.toLowerCase().includes('trắng')
                          ? '#D1D5DB'
                          : 'rgba(255,255,255,0.28)',
                      },
                    ]}
                  />
                </Pressable>
              );
            })}
            {colors.length > visibleColors.length ? (
              <Text style={styles.moreColors}>+{colors.length - visibleColors.length}</Text>
            ) : null}
          </View>
        ) : null}

        {visibleSizes.length > 0 ? (
          <View style={styles.sizeRow}>
            {visibleSizes.map((size) => {
              const selected = selectedSize === size;
              return (
                <Pressable
                  key={size}
                  accessibilityLabel={`Chọn kích cỡ ${size}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  hitSlop={4}
                  onPress={() => setSelectedSize(size)}
                  style={({ pressed }) => [
                    styles.sizeButton,
                    selected && styles.sizeButtonSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.sizeText,
                      selected && styles.sizeTextSelected,
                    ]}>
                    {size}
                  </Text>
                </Pressable>
              );
            })}
            {sizes.length > visibleSizes.length ? (
              <Text style={styles.moreSizes}>+{sizes.length - visibleSizes.length}</Text>
            ) : null}
          </View>
        ) : null}

        <Pressable
          accessibilityLabel={cartLabel}
          accessibilityRole="button"
          accessibilityState={{
            disabled: cartBusy || addedToCart || isOutOfStock,
          }}
          disabled={cartBusy || addedToCart || isOutOfStock}
          hitSlop={{ top: 3, bottom: 3, left: 0, right: 0 }}
          onPress={() => void handleAddToCart()}
          style={({ pressed }) => [
            styles.cartButton,
            (cartBusy || addedToCart || isOutOfStock) && styles.cartButtonDisabled,
            pressed && styles.cartButtonPressed,
          ]}>
          {cartBusy ? (
            <ActivityIndicator color="#0B0B0D" size="small" />
          ) : (
            <AppIcon
              color="#0B0B0D"
              name={addedToCart ? 'check' : 'cart'}
              size={15}
            />
          )}
          <Text style={styles.cartButtonText}>{cartLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#08090A',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#26282D',
    overflow: 'hidden',
  },
  imageWrap: {
    aspectRatio: 0.92,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  imagePressable: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOut: {
    opacity: 0.58,
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE9FE',
  },
  badges: {
    position: 'absolute',
    left: 8,
    top: 8,
    alignItems: 'flex-start',
    gap: 4,
  },
  badge: {
    minHeight: 19,
    borderRadius: 999,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBadge: { backgroundColor: '#3B82F6' },
  bestBadge: { backgroundColor: '#F59E0B' },
  saleBadge: { backgroundColor: '#F43F5E' },
  badgeDarkText: {
    color: '#101114',
    fontSize: 8,
    fontWeight: '900',
  },
  badgeLightText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  wishlist: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,11,13,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  wishlistActive: {
    backgroundColor: 'rgba(76,5,25,0.88)',
    borderColor: '#FB7185',
  },
  content: {
    padding: 10,
    gap: 6,
  },
  contentPressed: {
    opacity: 0.82,
  },
  name: {
    minHeight: 32,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  metaRow: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  ratingRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rating: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  sold: {
    flexShrink: 1,
    color: '#8F949E',
    fontSize: 7,
  },
  stock: {
    maxWidth: 58,
    color: '#34D399',
    fontSize: 7,
    fontWeight: '800',
    textAlign: 'right',
  },
  stockLow: { color: '#FBBF24' },
  stockOut: { color: '#F87171' },
  priceRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  price: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  oldPrice: {
    flexShrink: 1,
    color: '#7C818A',
    fontSize: 8,
    textDecorationLine: 'line-through',
  },
  colorRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  colorButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorButtonSelected: {
    borderColor: '#FFFFFF',
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  moreColors: {
    color: '#9CA3AF',
    fontSize: 8,
    fontWeight: '700',
  },
  sizeRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sizeButton: {
    minWidth: 28,
    height: 30,
    borderRadius: 7,
    paddingHorizontal: 5,
    backgroundColor: '#1C1E22',
    borderWidth: 1,
    borderColor: '#2A2D33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeButtonSelected: {
    backgroundColor: '#F3F4F6',
    borderColor: '#F3F4F6',
  },
  sizeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  sizeTextSelected: {
    color: '#0B0B0D',
  },
  moreSizes: {
    color: '#9CA3AF',
    fontSize: 8,
    fontWeight: '800',
  },
  cartButton: {
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: '#F1F2F4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  cartButtonDisabled: {
    opacity: 0.58,
  },
  cartButtonPressed: {
    opacity: 0.8,
  },
  cartButtonText: {
    color: '#0B0B0D',
    fontSize: 9,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
  },
});
