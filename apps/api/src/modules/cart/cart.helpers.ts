export const CART_RESERVATION_MINUTES = 30;

export interface ReservationReleaseItem {
  productId: number;
  size: string;
  color: string;
  quantity: number;
}

export interface ReservationUpdateInput {
  productStock: number;
  productReserved: number;
  oldQuantity: number;
  newQuantity: number;
  variantStock?: number;
  variantReserved?: number;
}

export function normalizeCartOption(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseCartOptionList(value: unknown): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function containsOrdinalIgnoreCase(values: string[], candidate: string): boolean {
  const normalized = candidate.toLowerCase();
  return values.some((value) => value.toLowerCase() === normalized);
}

export function availableStock(stock: number, reserved: number): number {
  return Math.max(0, stock - reserved);
}

export function reservationExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + CART_RESERVATION_MINUTES * 60_000);
}

export function calculateReservationUpdate(input: ReservationUpdateInput) {
  const productAvailableForItem =
    input.productStock - input.productReserved + input.oldQuantity;

  if (input.newQuantity > productAvailableForItem) {
    throw new Error(`Chỉ còn ${Math.max(0, productAvailableForItem)} sản phẩm khả dụng`);
  }

  const delta = input.newQuantity - input.oldQuantity;
  const nextProductReserved = Math.max(0, input.productReserved + delta);

  if (
    input.variantStock !== undefined &&
    input.variantReserved !== undefined
  ) {
    const variantAvailableForItem =
      input.variantStock - input.variantReserved + input.oldQuantity;

    if (input.newQuantity > variantAvailableForItem) {
      throw new Error(
        `Chỉ còn ${Math.max(0, variantAvailableForItem)} sản phẩm khả dụng cho biến thể này`,
      );
    }

    return {
      delta,
      nextProductReserved,
      nextVariantReserved: Math.max(0, input.variantReserved + delta),
    };
  }

  return { delta, nextProductReserved, nextVariantReserved: undefined };
}

export function groupReservationRelease(items: ReservationReleaseItem[]) {
  const products = new Map<number, number>();
  const variants = new Map<string, ReservationReleaseItem>();

  for (const item of items) {
    const quantity = Math.max(0, item.quantity);
    if (quantity === 0) continue;

    products.set(item.productId, (products.get(item.productId) ?? 0) + quantity);

    const key = JSON.stringify([item.productId, item.size, item.color]);
    const existing = variants.get(key);
    if (existing) {
      existing.quantity += quantity;
    } else {
      variants.set(key, { ...item, quantity });
    }
  }

  return {
    products: [...products.entries()]
      .map(([productId, quantity]) => ({ productId, quantity }))
      .sort((a, b) => a.productId - b.productId),
    variants: [...variants.values()].sort(
      (a, b) =>
        a.productId - b.productId ||
        a.size.localeCompare(b.size) ||
        a.color.localeCompare(b.color),
    ),
  };
}

export function distinctPositiveIds(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const ids = values
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0);
  return [...new Set(ids)];
}
