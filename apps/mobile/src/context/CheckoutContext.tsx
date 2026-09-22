import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import type {
  CheckoutAddress,
  CouponResult,
  CreatedOrder,
  ShippingQuoteOption,
} from '@/types/checkout';
import type { CartItem, ComboDiscountResult } from '@/types/shopping';

type PaymentMethod = 'COD' | 'ATM';

type CheckoutContextValue = {
  selectedCartItemIds: number[];
  selectedItems: CartItem[];
  selectedQuantity: number;
  subtotal: number;
  selectedAddress: CheckoutAddress | null;
  selectedShipping: ShippingQuoteOption | null;
  couponCode: string | null;
  coupon: CouponResult | null;
  combo: ComboDiscountResult | null;
  paymentMethod: PaymentMethod;
  note: string;
  pendingOrder: CreatedOrder | null;
  setSelectedAddress: React.Dispatch<
    React.SetStateAction<CheckoutAddress | null>
  >;
  setSelectedShipping: React.Dispatch<
    React.SetStateAction<ShippingQuoteOption | null>
  >;
  setCoupon: (code: string | null, result: CouponResult | null) => void;
  setCombo: React.Dispatch<React.SetStateAction<ComboDiscountResult | null>>;
  setPaymentMethod: React.Dispatch<React.SetStateAction<PaymentMethod>>;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  setPendingOrder: React.Dispatch<React.SetStateAction<CreatedOrder | null>>;
  resetCheckout: () => void;
};

const CheckoutContext = createContext<CheckoutContextValue | undefined>(undefined);

export function CheckoutProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const {
    cartItems,
    preparedCheckoutItemIds,
    prepareCheckout,
  } = useShopping();

  const [selectedAddress, setSelectedAddress] = useState<CheckoutAddress | null>(null);
  const [selectedShipping, setSelectedShipping] =
    useState<ShippingQuoteOption | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [coupon, setCouponResult] = useState<CouponResult | null>(null);
  const [combo, setCombo] = useState<ComboDiscountResult | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [note, setNote] = useState('');
  const [pendingOrder, setPendingOrder] = useState<CreatedOrder | null>(null);

  const selectedCartItemIds = preparedCheckoutItemIds;

  const selectedItems = useMemo(() => {
    const ids = new Set(selectedCartItemIds);
    return cartItems.filter((item) => ids.has(item.id));
  }, [cartItems, selectedCartItemIds]);

  const selectedQuantity = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems],
  );

  const subtotal = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      ),
    [selectedItems],
  );

  const setCoupon = useCallback(
    (code: string | null, result: CouponResult | null) => {
      setCouponCode(code);
      setCouponResult(result);
    },
    [],
  );

  const resetCheckout = useCallback(() => {
    setSelectedAddress(null);
    setSelectedShipping(null);
    setCouponCode(null);
    setCouponResult(null);
    setCombo(null);
    setPaymentMethod('COD');
    setNote('');
    setPendingOrder(null);
    prepareCheckout([]);
  }, [prepareCheckout]);

  useEffect(() => {
    if (!token) resetCheckout();
  }, [resetCheckout, token]);

  const value = useMemo(
    () => ({
      selectedCartItemIds,
      selectedItems,
      selectedQuantity,
      subtotal,
      selectedAddress,
      selectedShipping,
      couponCode,
      coupon,
      combo,
      paymentMethod,
      note,
      pendingOrder,
      setSelectedAddress,
      setSelectedShipping,
      setCoupon,
      setCombo,
      setPaymentMethod,
      setNote,
      setPendingOrder,
      resetCheckout,
    }),
    [
      combo,
      coupon,
      couponCode,
      note,
      paymentMethod,
      pendingOrder,
      resetCheckout,
      selectedAddress,
      selectedCartItemIds,
      selectedItems,
      selectedQuantity,
      selectedShipping,
      setCoupon,
      subtotal,
    ],
  );

  return (
    <CheckoutContext.Provider value={value}>
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckout phải nằm trong CheckoutProvider');
  }
  return context;
}
