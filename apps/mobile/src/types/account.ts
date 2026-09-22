export type AccountProfile = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  createdAt: string;
  loyaltyPoints: number;
  memberTier: string;
  totalSpent: number;
  birthday?: string | null;
  nextTierAt: number;
  amountToNextTier: number;
  nextTier: string;
  totalOrders: number;
};

export type UpdateAccountInput = {
  name?: string;
  phone?: string;
  birthday?: string;
};

export type PointsHistoryItem = {
  id: number;
  type: string;
  points: number;
  balanceAfter: number;
  orderId?: number | null;
  orderCode?: string | null;
  description?: string | null;
  createdAt: string;
};

export type RedeemResult = {
  couponCode: string;
  discountValue: number;
  remainingPoints: number;
  expiresAt: string;
};

export type AccountVoucher = {
  code: string;
  type: string;
  value: number;
  minOrderAmount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  description: string;
};

export type BirthdayVoucherResult = {
  code: string;
  percent: number;
  minOrderAmount: number;
  endDate: string;
  message: string;
};
