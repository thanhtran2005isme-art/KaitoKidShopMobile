import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { shoppingApi } from '@/services/shopping.api';
import type {
  AddToCartInput,
  CartItem,
  WishlistItem,
} from '@/types/shopping';

const CHECKOUT_ITEM_IDS_KEY = 'kaitokid_checkout_item_ids';

type ShoppingContextValue = {
  cartItems: CartItem[];
  cartCount: number | null;
  cartLoading: boolean;
  cartLoaded: boolean;
  cartError: string | null;
  preparedCheckoutItemIds: number[];
  wishlistItems: WishlistItem[];
  wishlistLoading: boolean;
  isWishlisted: (productId: number) => boolean;
  refreshCart: () => Promise<void>;
  refreshCartCount: () => Promise<void>;
  refreshWishlist: () => Promise<void>;
  updateCartQuantity: (itemId: number, quantity: number) => Promise<CartItem>;
  removeCartItem: (itemId: number) => Promise<void>;
  removeCartItems: (itemIds: number[]) => Promise<number>;
  moveCartItemsToWishlist: (itemIds: number[]) => Promise<number>;
  prepareCheckout: (itemIds: number[]) => void;
  toggleWishlist: (productId: number) => Promise<'added' | 'removed'>;
  addToCart: (input: AddToCartInput) => Promise<CartItem>;
};

const ShoppingContext = createContext<ShoppingContextValue | undefined>(undefined);

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeCheckoutItemIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value.filter(
        (item): item is number =>
          typeof item === 'number' && Number.isInteger(item) && item > 0,
      ),
    ),
  );
}

async function readStoredCheckoutItemIds(): Promise<number[]> {
  try {
    const raw =
      Platform.OS === 'web'
        ? localStorage.getItem(CHECKOUT_ITEM_IDS_KEY)
        : await SecureStore.getItemAsync(CHECKOUT_ITEM_IDS_KEY);

    if (!raw) return [];
    return normalizeCheckoutItemIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeStoredCheckoutItemIds(itemIds: number[]): Promise<void> {
  const value = JSON.stringify(normalizeCheckoutItemIds(itemIds));

  if (Platform.OS === 'web') {
    localStorage.setItem(CHECKOUT_ITEM_IDS_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(CHECKOUT_ITEM_IDS_KEY, value);
}

async function clearStoredCheckoutItemIds(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(CHECKOUT_ITEM_IDS_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(CHECKOUT_ITEM_IDS_KEY);
}

export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const { token, loading: authLoading } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [preparedCheckoutItemIds, setPreparedCheckoutItemIds] = useState<number[]>([]);
  const [checkoutSelectionReady, setCheckoutSelectionReady] = useState(false);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (authLoading) return;

    if (!token) {
      setCartItems([]);
      setCartError(null);
      setCartLoading(false);
      setCartLoaded(true);
      return;
    }

    setCartLoading(true);
    setCartLoaded(false);
    setCartError(null);

    try {
      setCartItems(await shoppingApi.getCart(token));
    } catch (error) {
      setCartError(errorMessage(error, 'Không thể tải giỏ hàng.'));
    } finally {
      setCartLoading(false);
      setCartLoaded(true);
    }
  }, [authLoading, token]);

  const refreshWishlist = useCallback(async () => {
    if (authLoading) return;

    if (!token) {
      setWishlistItems([]);
      setWishlistLoading(false);
      return;
    }

    setWishlistLoading(true);
    try {
      setWishlistItems(await shoppingApi.getWishlist(token));
    } catch {
      setWishlistItems([]);
    } finally {
      setWishlistLoading(false);
    }
  }, [authLoading, token]);

  useEffect(() => {
    if (authLoading) {
      setCheckoutSelectionReady(false);
      return;
    }

    if (!token) {
      setPreparedCheckoutItemIds([]);
      setCheckoutSelectionReady(true);
      void clearStoredCheckoutItemIds();
      return;
    }

    let active = true;
    setCheckoutSelectionReady(false);

    void readStoredCheckoutItemIds().then((itemIds) => {
      if (!active) return;
      setPreparedCheckoutItemIds(itemIds);
      setCheckoutSelectionReady(true);
    });

    return () => {
      active = false;
    };
  }, [authLoading, token]);

  useEffect(() => {
    if (authLoading) return;
    void Promise.all([refreshCart(), refreshWishlist()]);
  }, [authLoading, refreshCart, refreshWishlist]);

  useEffect(() => {
    if (
      !token ||
      !checkoutSelectionReady ||
      !cartLoaded ||
      cartError
    ) {
      return;
    }

    const validIds = new Set(cartItems.map((item) => item.id));
    setPreparedCheckoutItemIds((itemIds) => {
      const nextItemIds = itemIds.filter((id) => validIds.has(id));
      const unchanged =
        nextItemIds.length === itemIds.length &&
        nextItemIds.every((id, index) => id === itemIds[index]);

      return unchanged ? itemIds : nextItemIds;
    });
  }, [
    cartError,
    cartItems,
    cartLoaded,
    checkoutSelectionReady,
    token,
  ]);

  useEffect(() => {
    if (authLoading || !token || !checkoutSelectionReady) return;
    void writeStoredCheckoutItemIds(preparedCheckoutItemIds);
  }, [
    authLoading,
    checkoutSelectionReady,
    preparedCheckoutItemIds,
    token,
  ]);

  const cartCount = useMemo(() => {
    if (authLoading) return null;
    if (!token) return 0;
    if (!cartLoaded && cartItems.length === 0) return null;
    if (cartError && cartItems.length === 0) return null;

    return cartItems.reduce(
      (total, item) => total + Math.max(0, item.quantity || 0),
      0,
    );
  }, [authLoading, cartError, cartItems, cartLoaded, token]);

  const refreshCartCount = refreshCart;

  const wishlistIds = useMemo(
    () => new Set(wishlistItems.map((item) => item.productId)),
    [wishlistItems],
  );

  const isWishlisted = useCallback(
    (productId: number) => wishlistIds.has(productId),
    [wishlistIds],
  );

  const toggleWishlist = useCallback(
    async (productId: number) => {
      if (!token) {
        throw new Error('Bạn cần đăng nhập để sử dụng danh sách yêu thích.');
      }

      const exists = wishlistIds.has(productId);

      if (exists) {
        await shoppingApi.removeWishlist(token, productId);
        setWishlistItems((items) =>
          items.filter((item) => item.productId !== productId),
        );
        return 'removed' as const;
      }

      try {
        const item = await shoppingApi.addWishlist(token, productId);
        setWishlistItems((items) => [
          item,
          ...items.filter((current) => current.productId !== productId),
        ]);
        return 'added' as const;
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';

        if (message.includes('đã có trong danh sách yêu thích')) {
          await refreshWishlist();
          return 'added' as const;
        }

        throw error;
      }
    },
    [refreshWishlist, token, wishlistIds],
  );

  const addToCart = useCallback(
    async (input: AddToCartInput) => {
      if (!token) {
        throw new Error('Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng.');
      }

      const item = await shoppingApi.addToCart(token, input);
      setCartItems((items) => [
        item,
        ...items.filter((current) => current.id !== item.id),
      ]);
      setCartError(null);
      setCartLoaded(true);
      return item;
    },
    [token],
  );

  const updateCartQuantity = useCallback(
    async (itemId: number, quantity: number) => {
      if (!token) {
        throw new Error('Bạn cần đăng nhập để cập nhật giỏ hàng.');
      }
      if (quantity < 1) {
        throw new Error('Số lượng phải lớn hơn 0.');
      }

      const item = await shoppingApi.updateCartItem(token, itemId, quantity);
      setCartItems((items) =>
        items.map((current) => (current.id === item.id ? item : current)),
      );
      setCartError(null);
      return item;
    },
    [token],
  );

  const removeCartItem = useCallback(
    async (itemId: number) => {
      if (!token) {
        throw new Error('Bạn cần đăng nhập để cập nhật giỏ hàng.');
      }

      await shoppingApi.removeCartItem(token, itemId);
      setCartItems((items) => items.filter((item) => item.id !== itemId));
      setPreparedCheckoutItemIds((ids) => ids.filter((id) => id !== itemId));
    },
    [token],
  );

  const removeCartItems = useCallback(
    async (itemIds: number[]) => {
      if (!token) {
        throw new Error('Bạn cần đăng nhập để cập nhật giỏ hàng.');
      }
      if (itemIds.length === 0) return 0;

      const result = await shoppingApi.removeCartItems(token, itemIds);
      const ids = new Set(itemIds);
      setCartItems((items) => items.filter((item) => !ids.has(item.id)));
      setPreparedCheckoutItemIds((current) =>
        current.filter((id) => !ids.has(id)),
      );
      return result.removed || 0;
    },
    [token],
  );

  const moveCartItemsToWishlist = useCallback(
    async (itemIds: number[]) => {
      if (!token) {
        throw new Error('Bạn cần đăng nhập để cập nhật giỏ hàng.');
      }
      if (itemIds.length === 0) return 0;

      const result = await shoppingApi.moveCartItemsToWishlist(token, itemIds);
      await Promise.all([refreshCart(), refreshWishlist()]);
      return result.moved || 0;
    },
    [refreshCart, refreshWishlist, token],
  );

  const prepareCheckout = useCallback(
    (itemIds: number[]) => {
      const validIds = new Set(cartItems.map((item) => item.id));
      setPreparedCheckoutItemIds(
        Array.from(new Set(itemIds.filter((id) => validIds.has(id)))),
      );
    },
    [cartItems],
  );

  const value = useMemo(
    () => ({
      cartItems,
      cartCount,
      cartLoading,
      cartLoaded,
      cartError,
      preparedCheckoutItemIds,
      wishlistItems,
      wishlistLoading,
      isWishlisted,
      refreshCart,
      refreshCartCount,
      refreshWishlist,
      updateCartQuantity,
      removeCartItem,
      removeCartItems,
      moveCartItemsToWishlist,
      prepareCheckout,
      toggleWishlist,
      addToCart,
    }),
    [
      addToCart,
      cartCount,
      cartError,
      cartItems,
      cartLoaded,
      cartLoading,
      isWishlisted,
      moveCartItemsToWishlist,
      prepareCheckout,
      preparedCheckoutItemIds,
      refreshCart,
      refreshCartCount,
      refreshWishlist,
      removeCartItem,
      removeCartItems,
      toggleWishlist,
      updateCartQuantity,
      wishlistItems,
      wishlistLoading,
    ],
  );

  return (
    <ShoppingContext.Provider value={value}>
      {children}
    </ShoppingContext.Provider>
  );
}

export function useShopping() {
  const context = useContext(ShoppingContext);
  if (!context) {
    throw new Error('useShopping phải nằm trong ShoppingProvider');
  }
  return context;
}
