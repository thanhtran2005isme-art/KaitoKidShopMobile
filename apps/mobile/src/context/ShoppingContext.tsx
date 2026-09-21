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
  cartCount: number | null;
  wishlistItems: WishlistItem[];
  wishlistLoading: boolean;
  isWishlisted: (productId: number) => boolean;
  refreshCartCount: () => Promise<void>;
  refreshWishlist: () => Promise<void>;
  toggleWishlist: (productId: number) => Promise<'added' | 'removed'>;
  addToCart: (input: AddToCartInput) => Promise<CartItem>;
};

const ShoppingContext = createContext<ShoppingContextValue | undefined>(undefined);

export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [cartCount, setCartCount] = useState<number | null>(0);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const refreshCartCount = useCallback(async () => {
    if (!token) {
      setCartCount(0);
      return;
    }

    try {
      const items = await shoppingApi.getCart(token);
      setCartCount(
        items.reduce(
          (total, item) => total + Math.max(0, item.quantity || 0),
          0,
        ),
      );
    } catch {
      setCartCount(null);
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
    void Promise.all([refreshCartCount(), refreshWishlist()]);
  }, [refreshCartCount, refreshWishlist]);

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
      await refreshCartCount();
      return item;
    },
    [refreshCartCount, token],
  );

  const value = useMemo(
    () => ({
      cartCount,
      wishlistItems,
      wishlistLoading,
      isWishlisted,
      refreshCartCount,
      refreshWishlist,
      toggleWishlist,
      addToCart,
    }),
    [
      addToCart,
      cartCount,
      isWishlisted,
      refreshCartCount,
      refreshWishlist,
      toggleWishlist,
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
