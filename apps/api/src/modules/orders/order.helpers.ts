export function canCancelOrder(
  status: string,
  shippingStatus: string | null | undefined,
): boolean {
  return (
    (status === "pending" || status === "confirmed") &&
    (
      shippingStatus === null ||
      shippingStatus === undefined ||
      shippingStatus === "ready_to_pick" ||
      shippingStatus === "picking" ||
      // Carrier có thể xác nhận hủy qua webhook trước khi transaction hủy
      // commerce order chạy. Khi đó vẫn phải cho phép hoàn tồn/coupon nội bộ.
      shippingStatus === "cancelled"
    )
  );
}

export function paymentSecondsLeft(
  expiresAt: Date | string | null | undefined,
  now = new Date(),
): number {
  if (!expiresAt) return 0;
  const diff = new Date(expiresAt).getTime() - now.getTime();
  return Math.max(0, Math.trunc(diff / 1000));
}

export function isExpiredUnpaidOrder(
  status: string,
  paidAt: Date | string | null | undefined,
  expiresAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  return Boolean(
    expiresAt &&
    now > new Date(expiresAt) &&
    status === "pending" &&
    !paidAt
  );
}

export function reviewedKey(
  orderId: number,
  productId: number,
  size: string | null | undefined,
  color: string | null | undefined,
): string {
  return `${orderId}:${productId}:${size || "*"}:${color || "*"}`;
}

export function hasReviewedVariant(
  reviewed: Set<string>,
  orderId: number,
  productId: number,
  size: string,
  color: string,
): boolean {
  return (
    reviewed.has(reviewedKey(orderId, productId, size, color)) ||
    reviewed.has(reviewedKey(orderId, productId, size, "*")) ||
    reviewed.has(reviewedKey(orderId, productId, "*", color)) ||
    reviewed.has(reviewedKey(orderId, productId, "*", "*"))
  );
}

export function canonicalShippingAddress(
  street: string,
  ward: string,
  district: string,
  province: string,
): string {
  return [street, ward, district, province]
    .filter((value) => value.trim())
    .join(", ");
}
