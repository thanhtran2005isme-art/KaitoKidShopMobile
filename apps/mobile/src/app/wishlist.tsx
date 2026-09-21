import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { resolveMediaUrl } from '@/services/api-client';
import type { WishlistItem } from '@/types/shopping';

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

export default function WishlistScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const {
    wishlistItems,
    wishlistLoading,
    refreshWishlist,
    toggleWishlist,
  } = useShopping();
  const [busyId, setBusyId] = useState<number | null>(null);

  const remove = async (productId: number) => {
    if (busyId != null) return;

    try {
      setBusyId(productId);
      await toggleWishlist(productId);
    } catch (error) {
      Alert.alert(
        'Danh sách yêu thích',
        error instanceof Error
          ? error.message
          : 'Không thể cập nhật danh sách yêu thích.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const openProduct = (item: WishlistItem) => {
    router.push({
      pathname: '/product/[slug]',
      params: { slug: String(item.productId) },
    });
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Quay lại"
            onPress={() => router.back()}
            style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Yêu thích</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.authState}>
          <View style={styles.authIcon}>
            <Text style={styles.authIconText}>♡</Text>
          </View>
          <Text style={styles.stateTitle}>Lưu những món bé yêu thích</Text>
          <Text style={styles.stateText}>
            Đăng nhập để đồng bộ danh sách yêu thích trên tài khoản KaitoKid.
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/auth/login',
                params: { redirect: '/wishlist' },
              })
            }
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Quay lại"
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Yêu thích</Text>
          <Text style={styles.headerSubtitle}>
            {wishlistItems.length} sản phẩm đã lưu
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {wishlistLoading && !wishlistItems.length ? (
        <View style={styles.loading}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.loadingText}>Đang tải danh sách...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[
            styles.list,
            !wishlistItems.length && styles.emptyList,
          ]}
          data={wishlistItems}
          keyExtractor={(item) => String(item.productId)}
          refreshControl={
            <RefreshControl
              onRefresh={() => void refreshWishlist()}
              refreshing={wishlistLoading}
              tintColor={BRAND_COLORS.primary}
            />
          }
          renderItem={({ item }) => {
            const image = resolveMediaUrl(item.image);
            const removing = busyId === item.productId;

            return (
              <View style={styles.card}>
                <Pressable
                  onPress={() => openProduct(item)}
                  style={({ pressed }) => [
                    styles.productArea,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.imageWrap}>
                    {image ? (
                      <Image
                        contentFit="cover"
                        source={{ uri: image }}
                        style={styles.image}
                        transition={160}
                      />
                    ) : (
                      <Text style={styles.imageFallback}>👕</Text>
                    )}
                  </View>

                  <View style={styles.productCopy}>
                    <Text numberOfLines={2} style={styles.productName}>
                      {item.productName}
                    </Text>

                    <View style={styles.priceRow}>
                      <Text style={styles.price}>{formatPrice(item.price)}</Text>
                      {item.oldPrice && item.oldPrice > item.price ? (
                        <Text style={styles.oldPrice}>
                          {formatPrice(item.oldPrice)}
                        </Text>
                      ) : null}
                    </View>

                    <Text style={styles.openText}>Xem sản phẩm →</Text>
                  </View>
                </Pressable>

                <Pressable
                  accessibilityLabel="Bỏ khỏi danh sách yêu thích"
                  disabled={removing}
                  onPress={() => void remove(item.productId)}
                  style={({ pressed }) => [
                    styles.removeButton,
                    pressed && styles.pressed,
                    removing && styles.disabled,
                  ]}>
                  <Text style={styles.removeIcon}>
                    {removing ? '…' : '♥'}
                  </Text>
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>♡</Text>
              </View>
              <Text style={styles.stateTitle}>Chưa có sản phẩm yêu thích</Text>
              <Text style={styles.stateText}>
                Chạm biểu tượng tim trên sản phẩm để lưu lại và xem sau.
              </Text>
              <Pressable
                onPress={() => router.replace('/(tabs)')}
                style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Khám phá sản phẩm</Text>
              </Pressable>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  header: {
    minHeight: 70,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BRAND_COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_COLORS.line,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: BRAND_COLORS.ink,
    fontSize: 31,
    lineHeight: 33,
  },
  headerCopy: { flex: 1 },
  headerTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  headerSpacer: { width: 42 },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 36,
  },
  emptyList: { flexGrow: 1 },
  card: {
    borderRadius: 20,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
  },
  productArea: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  imageWrap: {
    width: 92,
    height: 112,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { fontSize: 34 },
  productCopy: {
    flex: 1,
    paddingVertical: 5,
    gap: 8,
  },
  productName: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  price: {
    color: BRAND_COLORS.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  oldPrice: {
    color: '#9CA3AF',
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  openText: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '800',
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    color: BRAND_COLORS.danger,
    fontSize: 20,
    fontWeight: '900',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
  },
  authState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    gap: 11,
  },
  authIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authIconText: {
    color: BRAND_COLORS.danger,
    fontSize: 42,
    fontWeight: '900',
  },
  stateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 320,
  },
  primaryButton: {
    marginTop: 5,
    minWidth: 170,
    height: 48,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    marginTop: 5,
    minWidth: 180,
    height: 46,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 25,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: {
    color: BRAND_COLORS.primary,
    fontSize: 40,
    fontWeight: '900',
  },
});
