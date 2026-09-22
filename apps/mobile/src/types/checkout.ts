import type { ComboDiscountResult } from '@/types/shopping';

export type CheckoutAddress = {
  id: number;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  isDefault: boolean;
};

export type CheckoutAddressInput = Omit<CheckoutAddress, 'id'>;

export type ShippingProvider = {
  code: string;
  name: string;
  enabled: boolean;
  note?: string | null;
};

export type ShippingQuoteOption = {
  provider: string;
  serviceCode: string;
  serviceName: string;
  fee: number;
  insuranceFee: number;
  leadTimeHours: number;
  deliveryType?: string | null;
};

export type ShippingQuoteResponse = {
  success: boolean;
  message?: string | null;
  options: ShippingQuoteOption[];
};

export type CouponResult = {
  isValid: boolean;
  message?: string | null;
  type?: string | null;
  discountAmount: number;
};

export type PaymentConfig = {
  allowSimulatePaid: boolean;
  supportedMethods: string[];
  bankTransferConfigured: boolean;
  vietQrConfigured: boolean;
};

export type PaymentBankAccount = {
  id: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch?: string | null;
  qrImage?: string | null;
};

export type PaymentInstructions = {
  orderCode: string;
  total: number;
  paymentExpiresAt?: string | null;
  secondsLeft: number;
  transferContent: string;
  bankAccount?: PaymentBankAccount | null;
  qrUrl?: string | null;
};

export type PaymentStatus = {
  orderCode: string;
  status: string;
  paidAt?: string | null;
  paymentMethod: string;
  paymentExpiresAt?: string | null;
  secondsLeft: number;
  total: number;
};

export type CreateOrderInput = {
  cartItemIds: number[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  paymentMethod: 'COD' | 'ATM';
  couponCode?: string;
  note?: string;
  shippingProvider: string;
  shippingServiceCode: string;
  shippingFee: number;
  leadTimeHours?: number;
  shippingProvince: string;
  shippingDistrict: string;
  shippingWard?: string;
  shippingStreet?: string;
};

export type OrderItem = {
  productId: number;
  productName: string;
  productImage: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
  hasReviewed: boolean;
};

export type CreatedOrder = {
  id: number;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  couponCode?: string | null;
  paymentMethod: string;
  status: string;
  note?: string | null;
  createdAt: string;
  items: OrderItem[];
  shippingProvider?: string | null;
  shippingServiceCode?: string | null;
  leadTimeHours?: number | null;
  paymentExpiresAt?: string | null;
  paidAt?: string | null;
};

export type CheckoutDiscountState = {
  coupon: CouponResult | null;
  couponCode: string | null;
  combo: ComboDiscountResult | null;
};
