import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
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
      hitSlop={5}
      onPress={() => void handleWishlist()}
      style={({ pressed }) => [
        inline ? styles.inlineWishlist : styles.overlayWishlist,
        wished && styles.wishlistActive,
        pressed && styles.pressed,
      ]}>
      {wishlistBusy ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <AppIcon
          color={wished ? '#FB7185' : '#FFFFFF'}
          name={wished ? 'heartFilled' : 'heart'}
          size={inline ? 16 : 18}
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
                  ? '#D1D5DB'
                  : 'rgba(255,255,255,0.28)',
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

          <Pressable
            accessibilityLabel={`Mở ${product.name}`}
            accessibilityRole="button"
            onPress={openProduct}
            style={({ pressed }) => [styles.colorPressable, pressed && styles.contentPressed]}>
            <ColorRow />
          </Pressable>
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
    backgroundColor: '#08090A',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#26282D',
    overflow: 'hidden',
  },
  imageWrap: {
    aspectRatio: 0.88,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  imagePressable: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  imageOut: { opacity: 0.58 },
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
  badgeDarkText: { color: '#101114', fontSize: 8, fontWeight: '900' },
  badgeLightText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  overlayWishlist: {
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
  inlineWishlist: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1E22',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#303238',
  },
  wishlistActive: {
    backgroundColor: 'rgba(76,5,25,0.88)',
    borderColor: '#FB7185',
  },
  content: { padding: 10, gap: 6 },
  contentMain: { gap: 6 },
  contentPressed: { opacity: 0.82 },
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
  rating: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  sold: { flexShrink: 1, color: '#8F949E', fontSize: 7 },
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
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  pricePressable: { flex: 1, minWidth: 0, minHeight: 32, justifyContent: 'center' },
  priceCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  price: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  oldPrice: {
    flexShrink: 1,
    color: '#7C818A',
    fontSize: 8,
    textDecorationLine: 'line-through',
  },
  colorPressable: { minHeight: 20, justifyContent: 'center' },
  colorRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  colorDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  moreColors: { color: '#9CA3AF', fontSize: 8, fontWeight: '700' },
  pressed: { opacity: 0.76 },
});
