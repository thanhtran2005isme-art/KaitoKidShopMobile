import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartCrossSell } from '@/components/cart/cart-cross-sell';
import { CartEmptyState } from '@/components/cart/cart-empty-state';
import { CartItemCard } from '@/components/cart/cart-item-card';
import { CartSummary } from '@/components/cart/cart-summary';
import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { shoppingApi } from '@/services/shopping.api';
import type { Product } from '@/types/shop';
import type { ComboDiscountResult } from '@/types/shopping';

type Feedback = {
  type: 'success' | 'error';
  text: string;
};

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function CartScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const {
    cartItems,
    cartCount,
    cartLoading,
    cartLoaded,
    cartError,
    refreshCart,
    updateCartQuantity,
    removeCartItem,
    removeCartItems,
    moveCartItemsToWishlist,
    prepareCheckout,
  } = useShopping();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionInitialized, setSelectionInitialized] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [crossSell, setCrossSell] = useState<Product[]>([]);
  const [comboDiscount, setComboDiscount] =
    useState<ComboDiscountResult | null>(null);

  const cartSignature = useMemo(
    () =>
      cartItems
        .map((item) => item.id + ':' + item.quantity + ':' + item.availableStock)
        .join('|'),
    [cartItems],
  );

  useEffect(() => {
    if (!token) {
      setSelectedIds(new Set());
      setSelectionInitialized(false);
      setBusyIds(new Set());
      setCrossSell([]);
      setComboDiscount(null);
      setFeedback(null);
    }
  }, [token]);

  useEffect(() => {
    const validIds = new Set(cartItems.map((item) => item.id));

    if (cartLoaded && cartItems.length === 0) {
      setSelectedIds(new Set());
      setSelectionInitialized(false);
      return;
    }

    if (cartLoaded && !selectionInitialized && cartItems.length > 0) {
      setSelectedIds(new Set(validIds));
      setSelectionInitialized(true);
      return;
    }

    setSelectedIds(
      (current) =>
        new Set(Array.from(current).filter((id) => validIds.has(id))),
    );
  }, [cartItems, cartLoaded, selectionInitialized]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 3600);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!token || !cartLoaded || cartItems.length === 0) {
      setCrossSell([]);
      setComboDiscount(null);
      return;
    }

    let active = true;

    async function loadExtras() {
      const [crossSellResult, comboResult] = await Promise.allSettled([
        shoppingApi.getCartCrossSell(token, 4),
        shoppingApi.getComboDiscount(token),
      ]);

      if (!active) return;

      setCrossSell(
        crossSellResult.status === 'fulfilled' ? crossSellResult.value : [],
      );
      setComboDiscount(
        comboResult.status === 'fulfilled' ? comboResult.value : null,
      );
    }

    void loadExtras();

    return () => {
      active = false;
    };
  }, [cartItems.length, cartLoaded, cartSignature, token]);

  const selectedItems = useMemo(
    () => cartItems.filter((item) => selectedIds.has(item.id)),
    [cartItems, selectedIds],
  );

  const selectedQuantity = useMemo(
    () =>
      selectedItems.reduce(
        (total, item) => total + Math.max(0, item.quantity),
        0,
      ),
    [selectedItems],
  );

  const subtotal = useMemo(
    () =>
      selectedItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      ),
    [selectedItems],
  );

  const allSelected =
    cartItems.length > 0 &&
    cartItems.every((item) => selectedIds.has(item.id));

  const setBusy = (ids: number[], busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (busy) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const toggleItem = (itemId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(cartItems.map((item) => item.id)));
  };

  const updateQuantity = async (itemId: number, quantity: number) => {
    if (busyIds.has(itemId)) return;

    try {
      setBusy([itemId], true);
      await updateCartQuantity(itemId, quantity);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: messageFrom(error, 'Không thể cập nhật số lượng.'),
      });
      await refreshCart();
    } finally {
      setBusy([itemId], false);
    }
  };

  const removeOne = async (itemId: number) => {
    if (busyIds.has(itemId)) return;

    try {
      setBusy([itemId], true);
      await removeCartItem(itemId);
      setFeedback({ type: 'success', text: 'Đã xóa sản phẩm khỏi giỏ.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: messageFrom(error, 'Không thể xóa sản phẩm.'),
      });
    } finally {
      setBusy([itemId], false);
    }
  };

  const selectedArray = Array.from(selectedIds);

  const removeSelected = async () => {
    if (selectedArray.length === 0) return;

    try {
      setBusy(selectedArray, true);
      const removed = await removeCartItems(selectedArray);
      setSelectedIds(new Set());
      setFeedback({
        type: 'success',
        text: 'Đã xóa ' + removed + ' dòng sản phẩm khỏi giỏ.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: messageFrom(error, 'Không thể xóa các sản phẩm đã chọn.'),
      });
    } finally {
      setBusy(selectedArray, false);
    }
  };

  const moveSelectedToWishlist = async () => {
    if (selectedArray.length === 0) return;

    try {
      setBusy(selectedArray, true);
      const moved = await moveCartItemsToWishlist(selectedArray);
      setSelectedIds(new Set());
      setFeedback({
        type: 'success',
        text:
          moved > 0
            ? 'Đã chuyển ' + moved + ' sản phẩm mới vào danh sách yêu thích.'
            : 'Các sản phẩm đã có trong yêu thích và đã được bỏ khỏi giỏ.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: messageFrom(error, 'Không thể chuyển sang danh sách yêu thích.'),
      });
    } finally {
      setBusy(selectedArray, false);
    }
  };

  const handleReservationExpired = () => {
    setFeedback({
      type: 'error',
      text: 'Thời gian giữ hàng vừa hết. Giỏ đang đồng bộ lại tồn kho.',
    });
    void refreshCart();
  };

  const handleCheckout = () => {
    if (selectedArray.length === 0) return;
    prepareCheckout(selectedArray);
    router.push('/checkout');
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.guest}>
          <View style={styles.guestIconWrap}>
            <Text style={styles.guestIcon}>🛍️</Text>
          </View>
          <Text style={styles.guestTitle}>Giỏ hàng của bạn</Text>
          <Text style={styles.guestDescription}>
            Đăng nhập để giữ sản phẩm trong giỏ và đồng bộ với tài khoản KaitoKid.
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/auth/login',
                params: { redirect: '/cart' },
              })
            }
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!cartLoaded && cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.loadingTitle}>Đang tải giỏ hàng</Text>
          <Text style={styles.loadingText}>
            KaitoKid đang kiểm tra sản phẩm và tồn kho đã giữ cho bạn.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (cartError && cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <Text style={styles.errorMark}>!</Text>
          <Text style={styles.loadingTitle}>Không tải được giỏ hàng</Text>
          <Text style={styles.loadingText}>{cartError}</Text>
          <Pressable onPress={() => void refreshCart()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={cartLoading}
            onRefresh={() => void refreshCart()}
          />
        }>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>KAITOKID CART</Text>
            <Text style={styles.title}>Giỏ hàng</Text>
            <Text style={styles.subtitle}>
              {typeof cartCount === 'number'
                ? cartCount + ' sản phẩm đang được giữ'
                : 'Đang đồng bộ số lượng'}
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Làm mới giỏ hàng"
            onPress={() => void refreshCart()}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.refreshText}>↻</Text>
          </Pressable>
        </View>

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

        {cartError && cartItems.length > 0 ? (
          <View style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{cartError}</Text>
          </View>
        ) : null}

        {cartItems.length === 0 ? (
          <CartEmptyState onContinue={() => router.push('/')} />
        ) : (
          <>
            <View style={styles.selectionBar}>
              <Pressable
                onPress={toggleAll}
                style={({ pressed }) => [
                  styles.selectAll,
                  pressed && styles.pressed,
                ]}>
                <View
                  style={[
                    styles.selectAllBox,
                    allSelected && styles.selectAllBoxActive,
                  ]}>
                  <Text style={styles.selectAllCheck}>
                    {allSelected ? '✓' : ''}
                  </Text>
                </View>
                <Text style={styles.selectAllText}>
                  {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </Text>
              </Pressable>

              <Text style={styles.selectedCount}>
                {selectedIds.size + '/' + cartItems.length + ' dòng'}
              </Text>
            </View>

            <View style={styles.bulkActions}>
              <Pressable
                disabled={selectedIds.size === 0}
                onPress={() => void moveSelectedToWishlist()}
                style={[
                  styles.bulkButton,
                  selectedIds.size === 0 && styles.bulkDisabled,
                ]}>
                <Text style={styles.bulkText}>♡ Chuyển sang yêu thích</Text>
              </Pressable>
              <Pressable
                disabled={selectedIds.size === 0}
                onPress={() => void removeSelected()}
                style={[
                  styles.bulkButtonDanger,
                  selectedIds.size === 0 && styles.bulkDisabled,
                ]}>
                <Text style={styles.bulkDangerText}>Xóa đã chọn</Text>
              </Pressable>
            </View>

            <View style={styles.items}>
              {cartItems.map((item) => (
                <CartItemCard
                  key={item.id}
                  busy={busyIds.has(item.id)}
                  item={item}
                  onChangeQuantity={(quantity) =>
                    void updateQuantity(item.id, quantity)
                  }
                  onExpired={handleReservationExpired}
                  onRemove={() => void removeOne(item.id)}
                  onToggle={() => toggleItem(item.id)}
                  selected={selectedIds.has(item.id)}
                />
              ))}
            </View>

            <CartSummary
              comboDiscount={comboDiscount}
              disabled={selectedIds.size === 0 || subtotal <= 0}
              onCheckout={handleCheckout}
              selectedLines={selectedItems.length}
              selectedQuantity={selectedQuantity}
              subtotal={subtotal}
            />

            <CartCrossSell products={crossSell} />
          </>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: BRAND_COLORS.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  feedback: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  },
  feedbackTextSuccess: { color: '#047857' },
  feedbackTextError: { color: '#B91C1C' },
  inlineError: {
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    padding: 10,
  },
  inlineErrorText: {
    color: '#B91C1C',
    fontSize: 9,
    lineHeight: 14,
  },
  selectionBar: {
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  selectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllBox: {
    width: 23,
    height: 23,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectAllBoxActive: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  selectAllCheck: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  selectAllText: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  selectedCount: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  bulkButtonDanger: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  bulkText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
  bulkDangerText: {
    color: BRAND_COLORS.danger,
    fontSize: 9,
    fontWeight: '900',
  },
  bulkDisabled: { opacity: 0.42 },
  items: { gap: 10 },
  guest: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    gap: 11,
  },
  guestIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestIcon: { fontSize: 42 },
  guestTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 26,
    fontWeight: '900',
  },
  guestDescription: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 360,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 10,
  },
  loadingTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  loadingText: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 360,
  },
  errorMark: {
    width: 48,
    height: 48,
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    color: BRAND_COLORS.danger,
    fontSize: 24,
    fontWeight: '900',
  },
  pressed: { opacity: 0.78 },
  bottomSpace: { height: 26 },
});
