import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { AppIcon } from '@/components/ui/app-icon';
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

    const activeToken = token;
    let active = true;

    async function loadExtras() {
      const [crossSellResult, comboResult] = await Promise.allSettled([
        shoppingApi.getCartCrossSell(activeToken, 4),
        shoppingApi.getComboDiscount(activeToken),
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

  const confirmRemoveOne = (itemId: number) => {
    Alert.alert(
      'Xóa sản phẩm?',
      'Sản phẩm sẽ được bỏ khỏi giỏ và phần giữ hàng tương ứng sẽ được cập nhật.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => void removeOne(itemId),
        },
      ],
    );
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

  const confirmRemoveSelected = () => {
    if (selectedArray.length === 0) return;

    Alert.alert(
      'Xóa sản phẩm đã chọn?',
      'Bạn đang chọn ' + selectedArray.length + ' dòng sản phẩm để xóa khỏi giỏ.',
      [
        { text: 'Giữ lại', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => void removeSelected(),
        },
      ],
    );
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
            <AppIcon color={BRAND_COLORS.primary} name="bag" size={40} />
          </View>
          <Text style={styles.guestTitle}>Giỏ hàng của bạn</Text>
          <Text style={styles.guestDescription}>
            Đăng nhập để giữ sản phẩm trong giỏ và đồng bộ với tài khoản KaitoKid.
          </Text>
          <Pressable
            accessibilityLabel="Đăng nhập để xem giỏ hàng"
            accessibilityRole="button"
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
          <View style={styles.errorMark}>
            <AppIcon color={BRAND_COLORS.danger} name="warning" size={24} />
          </View>
          <Text style={styles.loadingTitle}>Không tải được giỏ hàng</Text>
          <Text style={styles.loadingText}>{cartError}</Text>
          <Pressable
            accessibilityLabel="Thử tải lại giỏ hàng"
            accessibilityRole="button"
            onPress={() => void refreshCart()}
            style={styles.primaryButton}>
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
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Giỏ hàng</Text>
            <Text style={styles.subtitle}>
              {typeof cartCount === 'number'
                ? cartCount + ' sản phẩm đang được giữ cho bạn'
                : 'Đang đồng bộ số lượng và tồn kho'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Làm mới giỏ hàng"
            accessibilityRole="button"
            onPress={() => void refreshCart()}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
            ]}>
            <AppIcon color={BRAND_COLORS.ink} name="refresh" size={20} />
          </Pressable>
        </View>

        {feedback ? (
          <View
            accessibilityRole="alert"
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
          <View accessibilityRole="alert" style={styles.inlineError}>
            <Text style={styles.inlineErrorText}>{cartError}</Text>
          </View>
        ) : null}

        {cartItems.length === 0 ? (
          <CartEmptyState onContinue={() => router.push('/')} />
        ) : (
          <>
            <View style={styles.selectionPanel}>
              <View style={styles.selectionBar}>
                <Pressable
                  accessibilityLabel={allSelected ? 'Bỏ chọn tất cả sản phẩm' : 'Chọn tất cả sản phẩm'}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allSelected }}
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
                    {allSelected ? (
                      <AppIcon color="#FFFFFF" name="check" size={14} />
                    ) : null}
                  </View>
                  <View style={styles.selectionCopy}>
                    <Text style={styles.selectAllText}>
                      {allSelected ? 'Đã chọn tất cả' : 'Chọn tất cả'}
                    </Text>
                    <Text style={styles.selectionHint}>
                      {selectedIds.size + '/' + cartItems.length + ' dòng · ' + selectedQuantity + ' sản phẩm'}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {selectedIds.size > 0 ? (
                <View style={styles.bulkActions}>
                  <Pressable
                    accessibilityLabel="Chuyển sản phẩm đã chọn sang yêu thích"
                    accessibilityRole="button"
                    onPress={() => void moveSelectedToWishlist()}
                    style={({ pressed }) => [
                      styles.bulkButton,
                      pressed && styles.pressed,
                    ]}>
                    <AppIcon color={BRAND_COLORS.primaryDark} name="heart" size={17} />
                    <Text style={styles.bulkText}>Yêu thích</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Xóa các sản phẩm đã chọn"
                    accessibilityRole="button"
                    onPress={confirmRemoveSelected}
                    style={({ pressed }) => [
                      styles.bulkButtonDanger,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.bulkDangerText}>Xóa đã chọn</Text>
                  </Pressable>
                </View>
              ) : null}
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
                  onRemove={() => confirmRemoveOne(item.id)}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 3,
    color: BRAND_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedback: {
    borderRadius: 12,
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
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  feedbackTextSuccess: { color: BRAND_COLORS.success },
  feedbackTextError: { color: '#B91C1C' },
  inlineError: {
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    padding: 11,
  },
  inlineErrorText: {
    color: '#B91C1C',
    fontSize: 12,
    lineHeight: 18,
  },
  selectionPanel: {
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    padding: 12,
    gap: 10,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectAll: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  selectAllBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#B7BDC7',
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectAllBoxActive: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  selectAllText: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  selectionHint: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
  },
  bulkButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  bulkButtonDanger: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF7F7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  bulkText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  bulkDangerText: {
    color: BRAND_COLORS.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  items: { gap: 10 },
  guest: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  guestIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  guestDescription: {
    color: BRAND_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 340,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  loading: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 10,
  },
  loadingTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
    textAlign: 'center',
  },
  loadingText: {
    color: BRAND_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 340,
  },
  errorMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
  bottomSpace: { height: 24 },
});
