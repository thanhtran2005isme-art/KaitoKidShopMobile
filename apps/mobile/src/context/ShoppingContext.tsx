import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import { shoppingApi } from '@/services/shopping.api';
import type {
  AddToCartInput,
  CartItem,
  WishlistItem,
} from '@/types/shopping';

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

export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [preparedCheckoutItemIds, setPreparedCheckoutItemIds] = useState<number[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!token) {
      setCartItems([]);
      setCartError(null);
      setCartLoading(false);
      setCartLoaded(true);
      setPreparedCheckoutItemIds([]);
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
  }, [token]);

  const refreshWishlist = useCallback(async () => {
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
  }, [token]);

  useEffect(() => {
    void Promise.all([refreshCart(), refreshWishlist()]);
  }, [refreshCart, refreshWishlist]);

  useEffect(() => {
    const validIds = new Set(cartItems.map((item) => item.id));
    setPreparedCheckoutItemIds((ids) => ids.filter((id) => validIds.has(id)));
  }, [cartItems]);

  const cartCount = useMemo(() => {
    if (!token) return 0;
    if (!cartLoaded && cartItems.length === 0) return null;
    if (cartError && cartItems.length === 0) return null;

    return cartItems.reduce(
      (total, item) => total + Math.max(0, item.quantity || 0),
      0,
    );
  }, [cartError, cartItems, cartLoaded, token]);

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
