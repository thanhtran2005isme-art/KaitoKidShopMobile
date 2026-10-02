import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

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
  const { isWishlisted, toggleWishlist } = useShopping();
  const [wishlistBusy, setWishlistBusy] = useState(false);

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
  const visibleColors = colors.slice(0, 3);
  const wished = isWishlisted(product.id);

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

  const stockLabel = isOutOfStock
    ? 'Hết hàng'
    : isLowStock
      ? `Còn ${availableStock}`
      : 'Còn hàng';

  const WishlistButton = ({ inline = false }: { inline?: boolean }) => (
    <Pressable
      accessibilityLabel={wished ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
      accessibilityRole="button"
      accessibilityState={{ disabled: wishlistBusy, selected: wished }}
      disabled={wishlistBusy}
      hitSlop={inline ? 2 : 4}
      onPress={() => void handleWishlist()}
      style={({ pressed }) => [
        inline ? styles.inlineWishlist : styles.overlayWishlist,
        wished && styles.wishlistActive,
        pressed && styles.pressed,
      ]}>
      {wishlistBusy ? (
        <ActivityIndicator color={BRAND_COLORS.primary} size="small" />
      ) : (
        <AppIcon
          color={wished ? '#E11D48' : BRAND_COLORS.ink}
          name={wished ? 'heartFilled' : 'heart'}
          size={19}
        />
      )}
    </Pressable>
  );

  const ProductSummary = () => (
    <>
      <Text numberOfLines={2} style={styles.name}>
        {product.name}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.ratingRow}>
          <AppIcon color="#D97706" name="starFilled" size={13} />
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
    </>
  );

  const PriceCopy = () => (
    <View style={styles.priceCopy}>
      <Text numberOfLines={1} style={styles.price}>
        {formatPrice(product.price)}
      </Text>
      {product.oldPrice && product.oldPrice > product.price ? (
        <Text numberOfLines={1} style={styles.oldPrice}>
          {formatPrice(product.oldPrice)}
        </Text>
      ) : null}
    </View>
  );

  const ColorRow = () =>
    visibleColors.length > 0 ? (
      <View style={styles.colorRow}>
        {visibleColors.map((color) => (
          <View
            key={color}
            accessibilityLabel={`Màu ${color}`}
            style={[
              styles.colorDot,
              {
                backgroundColor: productColorValue(color),
                borderColor: color.toLowerCase().includes('trắng')
                  ? '#CBD5E1'
                  : BRAND_COLORS.surface,
              },
            ]}
          />
        ))}
        {colors.length > visibleColors.length ? (
          <Text style={styles.moreColors}>+{colors.length - visibleColors.length}</Text>
        ) : null}
      </View>
    ) : null;

  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.imageWrap}>
        <Pressable
          accessibilityHint="Mở chi tiết sản phẩm"
          accessibilityLabel={`Xem ${product.name}`}
          accessibilityRole="button"
          onPress={openProduct}
          style={({ pressed }) => [styles.imagePressable, pressed && styles.imagePressed]}>
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
              <AppIcon color={BRAND_COLORS.primary} name="image" size={30} />
            </View>
          )}
        </Pressable>

        <View pointerEvents="none" style={styles.badges}>
          {product.isNew ? (
            <View style={[styles.badge, styles.newBadge]}>
              <Text style={[styles.badgeText, styles.newBadgeText]}>Mới</Text>
            </View>
          ) : null}
          {product.isBestSeller ? (
            <View style={[styles.badge, styles.bestBadge]}>
              <Text style={[styles.badgeText, styles.bestBadgeText]}>Bán chạy</Text>
            </View>
          ) : null}
          {discount > 0 ? (
            <View style={[styles.badge, styles.saleBadge]}>
              <Text style={[styles.badgeText, styles.saleBadgeText]}>-{discount}%</Text>
            </View>
          ) : null}
        </View>

        {wishlistPlacement === 'overlay' ? <WishlistButton /> : null}
      </View>

      {wishlistPlacement === 'inline' ? (
        <View style={styles.content}>
          <Pressable
            accessibilityLabel={`Mở ${product.name}`}
            accessibilityRole="button"
            onPress={openProduct}
            style={({ pressed }) => [styles.contentMain, pressed && styles.contentPressed]}>
            <ProductSummary />
          </Pressable>

          <View style={styles.priceRow}>
            <Pressable
              accessibilityLabel={`Mở ${product.name}`}
              accessibilityRole="button"
              onPress={openProduct}
              style={({ pressed }) => [styles.pricePressable, pressed && styles.contentPressed]}>
              <PriceCopy />
            </Pressable>
            <WishlistButton inline />
          </View>

          {visibleColors.length ? (
            <Pressable
              accessibilityLabel={`Mở ${product.name}`}
              accessibilityRole="button"
              onPress={openProduct}
              style={({ pressed }) => [styles.colorPressable, pressed && styles.contentPressed]}>
              <ColorRow />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Pressable
          accessibilityLabel={`Mở ${product.name}`}
          accessibilityRole="button"
          onPress={openProduct}
          style={({ pressed }) => [styles.content, pressed && styles.contentPressed]}>
          <ProductSummary />
          <View style={styles.priceRow}>
            <PriceCopy />
          </View>
          <ColorRow />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND_COLORS.surface,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    overflow: 'hidden',
  },
  imageWrap: {
    aspectRatio: 0.8,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  imagePressable: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  imagePressed: { opacity: 0.9 },
  imageOut: { opacity: 0.58 },
  imageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  badges: {
    position: 'absolute',
    left: 8,
    top: 8,
    alignItems: 'flex-start',
    gap: 4,
  },
  badge: {
    minHeight: 21,
    borderRadius: 9,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 8, lineHeight: 11, fontWeight: '900' },
  newBadge: { backgroundColor: BRAND_COLORS.primarySoft },
  newBadgeText: { color: BRAND_COLORS.primaryDark },
  bestBadge: { backgroundColor: BRAND_COLORS.accentSoft },
  bestBadgeText: { color: '#C2410C' },
  saleBadge: { backgroundColor: '#FEF2F2' },
  saleBadgeText: { color: BRAND_COLORS.danger },
  overlayWishlist: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(229,231,235,0.95)',
  },
  inlineWishlist: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  wishlistActive: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FDA4AF',
  },
  content: { padding: 10, gap: 7 },
  contentMain: { gap: 7 },
  contentPressed: { opacity: 0.72 },
  name: {
    minHeight: 36,
    color: BRAND_COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  metaRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  ratingRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rating: { color: BRAND_COLORS.ink, fontSize: 10, fontWeight: '800' },
  sold: { flexShrink: 1, color: BRAND_COLORS.muted, fontSize: 8 },
  stock: {
    maxWidth: 58,
    color: BRAND_COLORS.success,
    fontSize: 8,
    fontWeight: '800',
    textAlign: 'right',
  },
  stockLow: { color: '#B45309' },
  stockOut: { color: BRAND_COLORS.danger },
  priceRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  pricePressable: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  priceCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 5,
  },
  price: { color: BRAND_COLORS.ink, fontSize: 15, fontWeight: '900' },
  oldPrice: {
    flexShrink: 1,
    color: '#94A3B8',
    fontSize: 9,
    textDecorationLine: 'line-through',
  },
  colorPressable: { minHeight: 26, justifyContent: 'center' },
  colorRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 1,
  },
  moreColors: { color: BRAND_COLORS.muted, fontSize: 9, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
