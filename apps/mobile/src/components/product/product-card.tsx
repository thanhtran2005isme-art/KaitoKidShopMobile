import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { resolveMediaUrl } from '@/services/api-client';
import type { Product } from '@/types/shop';
import { productColorValue } from '@/utils/product-detail';

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

export function ProductCard({
  product,
  width = 168,
}: {
  product: Product;
  width?: number;
}) {
  const router = useRouter();
  const { token } = useAuth();
  const { isWishlisted, toggleWishlist } = useShopping();
  const [wishlistBusy, setWishlistBusy] = useState(false);

  const image = resolveMediaUrl(product.image);
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;

  const availableStock = product.availableStock ?? product.stock;
  const isOutOfStock =
    availableStock <= 0 || product.status === 'out-of-stock';
  const isLowStock = !isOutOfStock && availableStock <= 5;
  const colors = product.colors || [];
  const visibleColors = colors.slice(0, 3);
  const wished = isWishlisted(product.id);

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

  return (
    <View
      style={[
        styles.card,
        { width },
        isOutOfStock && styles.outOfStockCard,
      ]}>
      <Pressable
        accessibilityHint="Mở chi tiết sản phẩm"
        accessibilityLabel={product.name}
        accessibilityRole="button"
        onPress={openProduct}
        style={({ pressed }) => [
          styles.cardPressable,
          pressed && styles.pressed,
        ]}>
        <View style={styles.imageWrap}>
          {image ? (
            <Image
              contentFit="cover"
              source={{ uri: image }}
              style={styles.image}
              transition={180}
            />
          ) : (
            <Text style={styles.imageFallback}>👚</Text>
          )}

          <View style={styles.badges}>
            {discount > 0 ? (
              <View style={styles.saleBadge}>
                <Text style={styles.saleText}>-{discount}%</Text>
              </View>
            ) : null}

            {product.isNew ? (
              <View style={styles.newBadge}>
                <Text style={styles.newText}>MỚI</Text>
              </View>
            ) : null}

            {product.isBestSeller ? (
              <View style={styles.bestBadge}>
                <Text style={styles.bestText}>HOT</Text>
              </View>
            ) : null}
          </View>

          {isOutOfStock || isLowStock ? (
            <View
              style={[
                styles.stockBadge,
                isOutOfStock ? styles.stockOut : styles.stockLow,
              ]}>
              <Text style={styles.stockText}>
                {isOutOfStock ? 'HẾT HÀNG' : 'SẮP HẾT'}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.category}>
            {product.category}
          </Text>

          <Text numberOfLines={2} style={styles.name}>
            {product.name}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            {product.oldPrice && product.oldPrice > product.price ? (
              <Text style={styles.oldPrice}>
                {formatPrice(product.oldPrice)}
              </Text>
            ) : null}
          </View>

          <View style={styles.detailRow}>
            {visibleColors.length ? (
              <View style={styles.colors}>
                {visibleColors.map((color) => (
                  <View
                    key={color}
                    accessibilityLabel={color}
                    style={[
                      styles.colorDot,
                      {
                        backgroundColor: productColorValue(color),
                        borderColor: color.toLowerCase().includes('trắng')
                          ? '#D1D5DB'
                          : 'rgba(17,24,39,0.08)',
                      },
                    ]}
                  />
                ))}
                {colors.length > visibleColors.length ? (
                  <Text style={styles.moreColors}>
                    +{colors.length - visibleColors.length}
                  </Text>
                ) : null}
              </View>
            ) : (
              <View />
            )}

            {product.rating > 0 ? (
              <Text style={styles.rating}>★ {product.rating.toFixed(1)}</Text>
            ) : null}
          </View>

          {product.soldCount > 0 ? (
            <Text style={styles.sold}>Đã bán {product.soldCount}</Text>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        accessibilityLabel={
          wished ? 'Bỏ khỏi danh sách yêu thích' : 'Thêm vào danh sách yêu thích'
        }
        accessibilityRole="button"
        disabled={wishlistBusy}
        hitSlop={8}
        onPress={() => void handleWishlist()}
        style={({ pressed }) => [
          styles.wishlistButton,
          wished && styles.wishlistButtonActive,
          pressed && styles.wishlistPressed,
          wishlistBusy && styles.wishlistBusy,
        ]}>
        <Text
          style={[
            styles.wishlistIcon,
            wished && styles.wishlistIconActive,
          ]}>
          {wishlistBusy ? '…' : wished ? '♥' : '♡'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND_COLORS.surface,
    borderRadius: 22,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    position: 'relative',
  },
  cardPressable: {
    gap: 9,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  outOfStockCard: { opacity: 0.72 },
  imageWrap: {
    aspectRatio: 0.8,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { fontSize: 44 },
  wishlistButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 3,
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17,24,39,0.08)',
  },
  wishlistButtonActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  wishlistPressed: {
    transform: [{ scale: 0.94 }],
  },
  wishlistBusy: { opacity: 0.58 },
  wishlistIcon: {
    color: BRAND_COLORS.ink,
    fontSize: 21,
    lineHeight: 23,
    fontWeight: '900',
  },
  wishlistIconActive: {
    color: BRAND_COLORS.danger,
  },
  badges: {
    position: 'absolute',
    left: 8,
    top: 8,
    alignItems: 'flex-start',
    gap: 5,
  },
  saleBadge: {
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saleText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  newBadge: {
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.ink,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  newText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  bestBadge: {
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bestText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  stockBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stockLow: { backgroundColor: '#B45309' },
  stockOut: { backgroundColor: '#4B5563' },
  stockText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  copy: {
    paddingHorizontal: 2,
    paddingBottom: 3,
    gap: 4,
  },
  category: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    minHeight: 36,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  price: {
    color: BRAND_COLORS.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  oldPrice: {
    color: '#9CA3AF',
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  detailRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  colors: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  moreColors: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  rating: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
  },
  sold: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '600',
  },
});
