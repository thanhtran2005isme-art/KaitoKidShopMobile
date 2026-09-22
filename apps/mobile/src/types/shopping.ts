export type WishlistItem = {
  id: number;
  productId: number;
  productName: string;
  price: number;
  oldPrice?: number | null;
  image: string;
  createdAt: string;
};

export type CartItem = {
  id: number;
  productId: number;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
  availableStock: number;
  reservedUntil?: string | null;
  isLowStock: boolean;
};

export type AddToCartInput = {
  productId: number;
  size: string;
  color: string;
  quantity: number;
};

export type ComboDiscountResult = {
  eligible: boolean;
  percent: number;
  discount: number;
  eligibleSubtotal: number;
  categories: string[];
  message?: string | null;
};

export type BulkCartResult = {
  removed?: number;
  moved?: number;
};
