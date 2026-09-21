import { apiRequest } from '@/services/api-client';
import type {
  AddToCartInput,
  CartItem,
  WishlistItem,
} from '@/types/shopping';

function authHeaders(token: string, json = false): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
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
    return apiRequest<WishlistItem>(`/api/wishlist/${productId}`, {
      method: 'POST',
      headers: authHeaders(token),
    });
  },

  removeWishlist(token: string, productId: number) {
    return apiRequest<void>(`/api/wishlist/${productId}`, {
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
};
