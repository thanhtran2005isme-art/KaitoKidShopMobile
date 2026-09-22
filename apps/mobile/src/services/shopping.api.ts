import { apiRequest } from '@/services/api-client';
import type { Product } from '@/types/shop';
import type {
  AddToCartInput,
  BulkCartResult,
  CartItem,
  ComboDiscountResult,
  WishlistItem,
} from '@/types/shopping';

function authHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: 'Bearer ' + token,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export const shoppingApi = {
  getWishlist(token: string) {
    return apiRequest<WishlistItem[]>('/api/wishlist', {
      headers: authHeaders(token),
    });
  },

  addWishlist(token: string, productId: number) {
    return apiRequest<WishlistItem>('/api/wishlist/' + productId, {
      method: 'POST',
      headers: authHeaders(token),
    });
  },

  removeWishlist(token: string, productId: number) {
    return apiRequest<void>('/api/wishlist/' + productId, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  getCart(token: string) {
    return apiRequest<CartItem[]>('/api/cart', {
      headers: authHeaders(token),
    });
  },

  addToCart(token: string, input: AddToCartInput) {
    return apiRequest<CartItem>('/api/cart', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify(input),
    });
  },

  updateCartItem(token: string, itemId: number, quantity: number) {
    return apiRequest<CartItem>('/api/cart/' + itemId, {
      method: 'PUT',
      headers: authHeaders(token, true),
      body: JSON.stringify({ quantity }),
    });
  },

  removeCartItem(token: string, itemId: number) {
    return apiRequest<void>('/api/cart/' + itemId, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  removeCartItems(token: string, itemIds: number[]) {
    return apiRequest<BulkCartResult>('/api/cart/remove-many', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({ itemIds }),
    });
  },

  moveCartItemsToWishlist(token: string, itemIds: number[]) {
    return apiRequest<BulkCartResult>('/api/cart/move-to-wishlist', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({ itemIds }),
    });
  },

  getCartCrossSell(token: string, limit = 4) {
    return apiRequest<Product[]>('/api/cart/cross-sell-products?limit=' + limit, {
      headers: authHeaders(token),
    });
  },

  getComboDiscount(token: string) {
    return apiRequest<ComboDiscountResult>('/api/cart/combo-discount', {
      headers: authHeaders(token),
    });
  },
};
