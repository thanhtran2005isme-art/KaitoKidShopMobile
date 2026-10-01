export interface CouponSnapshot {
  type: string;
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number;
  usedCount: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

export interface CouponEvaluation {
  isValid: boolean;
  message: string;
  type: string | null;
  discountAmount: number;
}

export function evaluateCoupon(
  coupon: CouponSnapshot | null,
  orderAmount: number,
  now = new Date(),
): CouponEvaluation {
  if (!coupon || !coupon.isActive) {
    return {
      isValid: false,
      message: "Mã giảm giá không tồn tại",
      type: null,
      discountAmount: 0,
    };
  }
  if (now < coupon.startDate) {
    return {
      isValid: false,
      message: "Mã giảm giá chưa có hiệu lực",
      type: null,
      discountAmount: 0,
    };
  }
  if (now > coupon.endDate) {
    return {
      isValid: false,
      message: "Mã giảm giá đã hết hạn",
      type: null,
      discountAmount: 0,
    };
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return {
      isValid: false,
      message: "Mã giảm giá đã hết lượt sử dụng",
      type: null,
      discountAmount: 0,
    };
  }
  if (
    coupon.minOrderAmount !== null &&
    orderAmount < coupon.minOrderAmount
  ) {
    return {
      isValid: false,
      message: `Đơn hàng tối thiểu ${Math.trunc(coupon.minOrderAmount).toLocaleString("vi-VN")}đ`,
      type: null,
      discountAmount: 0,
    };
  }

  let discountAmount =
    coupon.type === "percent"
      ? orderAmount * coupon.value / 100
      : coupon.value;

  if (
    coupon.maxDiscount !== null &&
    discountAmount > coupon.maxDiscount
  ) {
    discountAmount = coupon.maxDiscount;
  }

  return {
    isValid: true,
    message: "Áp dụng thành công",
    type: coupon.type,
    discountAmount,
  };
}
