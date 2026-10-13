// Trang thanh toán - đã refactor thành các sub-component
//   <CheckoutForm />        — form địa chỉ + sổ địa chỉ
//   <ShippingSelector />    — chọn ĐVVC + service
//   <PaymentMethodSelector />
//   <OrderSummaryBox />     — tóm tắt + nhập coupon
//   <ReviewOrderModal />    — xem lại trước khi gửi backend
//   <PaymentStep />         — step 3 QR + countdown
//   <OrderCompleted />      — step 4

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  couponApi, settingsApi, shippingApi, paymentApi, cartApi, addressApi, walletApi,
  type SettingDTO, type ShippingQuoteOption, type ComboDiscountResult, type WalletSummaryDTO,
} from '../services/api';
import apiClient from '../services/apiClient';
import CheckoutForm from '../components/checkout/CheckoutForm';
import ShippingSelector from '../components/checkout/ShippingSelector';
import PaymentMethodSelector from '../components/checkout/PaymentMethodSelector';
import OrderSummaryBox from '../components/checkout/OrderSummaryBox';
import ReviewOrderModal from '../components/checkout/ReviewOrderModal';
import PaymentStep from '../components/checkout/PaymentStep';
import OrderCompleted from '../components/checkout/OrderCompleted';
import { EMPTY_ADDRESS_FORM, type BankAccount, type CheckoutAddressForm } from '../components/checkout/types';
import '../styles/wallet.css';

type PaymentMethod = 'atm' | 'cod';
type ShippingProviderCode = 'mock' | 'ghn' | 'ghtk' | 'lalamove' | 'all';

type PendingOrder = {
  orderCode: string;
  orderTotal: number;
  amountDue: number;
  walletUsed: number;
};

export default function Checkout() {
  const { cart, subtotal, refreshCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [addressForm, setAddressForm] = useState<CheckoutAddressForm>({
    ...EMPTY_ADDRESS_FORM,
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [promoInput, setPromoInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Bank accounts (for QR step)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  // Shipping
  const [shippingProvider, setShippingProvider] = useState<ShippingProviderCode>('all');
  const [shippingOptions, setShippingOptions] = useState<ShippingQuoteOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingQuoteOption | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  // Combo discount (server-evaluated)
  const [combo, setCombo] = useState<ComboDiscountResult | null>(null);

  // Ví KaitoKid
  const [walletSummary, setWalletSummary] = useState<WalletSummaryDTO | null>(null);
  const [useWallet, setUseWallet] = useState(false);

  // Step state
  const [paymentStep, setPaymentStep] = useState(false);
  const [completedStep, setCompletedStep] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(null);

  // Backend cho phép simulate paid hay không (chỉ dev)
  const [allowSimulatePaid, setAllowSimulatePaid] = useState(false);

  const shippingFee = selectedShipping?.fee ?? 0;
  const comboDiscount = combo?.eligible ? combo.discount : 0;
  const total = useMemo(
    () => Math.max(0, subtotal - couponDiscount - comboDiscount) + shippingFee,
    [subtotal, couponDiscount, comboDiscount, shippingFee],
  );
  const estimatedWalletUse = useMemo(
    () => useWallet ? Math.min(walletSummary?.availableBalance ?? 0, total) : 0,
    [useWallet, walletSummary?.availableBalance, total],
  );
  const estimatedAmountDue = Math.max(0, total - estimatedWalletUse);

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (!user) {
      setWalletSummary(null);
      setUseWallet(false);
      return;
    }
    void walletApi.getSummary().then((result) => {
      if (result.success && result.data) {
        setWalletSummary(result.data);
        if (result.data.availableBalance <= 0) setUseWallet(false);
      }
    });
  }, [user]);

  // Load bank accounts từ admin settings
  useEffect(() => {
    void settingsApi.getAll('payment').then((result) => {
      if (!result.success || !result.data) return;
      result.data.forEach((dto: SettingDTO) => {
        if (dto.maCauHinh === 'bankAccounts') {
          try {
            const parsed = JSON.parse(dto.giaTri);
            if (Array.isArray(parsed)) setBankAccounts(parsed);
          } catch { /* ignore */ }
        }
      });
    });
  }, []);

  // Lấy cấu hình payment để biết có hiển thị nút mô phỏng hay không
  useEffect(() => {
    void paymentApi.getConfig().then((r) => {
      if (r.success && r.data) setAllowSimulatePaid(r.data.allowSimulatePaid);
    });
  }, []);

  // Auto load coupon đã apply từ trang Cart
  useEffect(() => {
    const pending = sessionStorage.getItem('kk_pending_coupon');
    if (!pending || appliedCoupon) return;
    setPromoInput(pending);
    sessionStorage.removeItem('kk_pending_coupon');
    void couponApi.validate({ code: pending, orderAmount: subtotal }).then((r) => {
      if (r.success && r.data?.isValid) {
        setCouponDiscount(r.data.discountAmount);
        setAppliedCoupon(pending);
      }
    });
  }, [subtotal, appliedCoupon]);

  // Combo discount
  useEffect(() => {
    if (cart.length === 0) { setCombo(null); return; }
    void cartApi.getComboDiscount().then((r) => {
      if (r.success && r.data) setCombo(r.data); else setCombo(null);
    });
  }, [cart]);

  // Quote phí ship khi địa chỉ đổi
  useEffect(() => {
    if (!addressForm.city || !addressForm.district) {
      setShippingOptions([]);
      setSelectedShipping(null);
      return;
    }
    const totalWeight = cart.reduce((s, i) => s + 300 * i.quantity, 0);
    setShippingLoading(true);
    void shippingApi.quote({
      provider: shippingProvider,
      toProvince: addressForm.city,
      toDistrict: addressForm.district,
      toWard: addressForm.ward || undefined,
      toAddress: addressForm.street || undefined,
      weightGram: Math.max(300, totalWeight),
      orderValue: subtotal,
    }).then((r) => {
      if (r.success && r.data?.success && r.data.options.length > 0) {
        setShippingOptions(r.data.options);
        const found = selectedShipping
          ? r.data.options.find((o) => o.provider === selectedShipping.provider && o.serviceCode === selectedShipping.serviceCode)
          : null;
        setSelectedShipping(found || r.data.options[0]);
      } else {
        setShippingOptions([]);
        setSelectedShipping(null);
      }
    }).finally(() => setShippingLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressForm.city, addressForm.district, addressForm.ward, addressForm.street, subtotal, shippingProvider]);

  // ==================== ACTIONS ====================

  const applyCoupon = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    const result = await couponApi.validate({ code, orderAmount: subtotal });
    if (result.success && result.data) {
      if (result.data.isValid) {
        setCouponDiscount(result.data.discountAmount);
        setAppliedCoupon(code);
        setError('');
      } else {
        setError(result.data.message || 'Mã không hợp lệ');
      }
    } else {
      setError(result.error || 'Không thể kiểm tra mã giảm giá');
    }
  };

  const validateForm = (): string | null => {
    if (!addressForm.name.trim()) return 'Vui lòng nhập họ tên';
    if (!addressForm.phone.trim()) return 'Vui lòng nhập số điện thoại';
    if (!addressForm.street.trim()) return 'Vui lòng nhập địa chỉ';
    if (!addressForm.city || !addressForm.district) return 'Vui lòng chọn tỉnh/quận';
    if (!addressForm.ward.trim()) return 'Vui lòng chọn phường/xã';
    if (!selectedShipping) return 'Vui lòng chọn đơn vị vận chuyển';
    return null;
  };

  /** Bấm "Xem lại đơn" → mở review modal. */
  const handleOpenReview = () => {
    const err = validateForm();
    if (err) { setError(err); return; }
    setError('');
    setShowReview(true);
  };

  const fullAddress = useMemo(
    () => [addressForm.street, addressForm.ward, addressForm.district, addressForm.city]
      .filter(Boolean).join(', '),
    [addressForm],
  );

  /** Sau khi user bấm "Xác nhận đặt hàng" trong review modal. */
  const handleConfirmOrder = async () => {
    setError('');
    setSubmitting(true);
    try {
      const response = await apiClient.post('/api/orders', {
        customerName: addressForm.name.trim(),
        customerPhone: addressForm.phone.trim(),
        customerEmail: user?.email || '',
        customerAddress: fullAddress,
        paymentMethod: paymentMethod.toUpperCase(),
        couponCode: appliedCoupon || undefined,
        shippingProvider: selectedShipping?.provider,
        shippingServiceCode: selectedShipping?.serviceCode,
        shippingFee: selectedShipping?.fee ?? shippingFee,
        leadTimeHours: selectedShipping?.leadTimeHours,
        shippingProvince: addressForm.city,
        shippingDistrict: addressForm.district,
        shippingWard: addressForm.ward,
        shippingStreet: addressForm.street,
        useWallet,
      });
      const data = response.data as {
        id?: number;
        orderCode?: string;
        total?: number;
        walletUsed?: number;
        amountDue?: number;
        paidAt?: string | null;
      };

      const orderTotal = Number(data.total ?? total);
      const walletUsed = Number(data.walletUsed ?? 0);
      const amountDue = Number(data.amountDue ?? Math.max(0, orderTotal - walletUsed));
      const orderInfo: PendingOrder = {
        orderCode: data.orderCode || String(data.id || ''),
        orderTotal,
        walletUsed,
        amountDue,
      };

      // Lưu địa chỉ vào sổ nếu user check
      if (user && addressForm.saveToBook) {
        void addressApi.create({
          fullName: addressForm.name.trim(),
          phone: addressForm.phone.trim(),
          province: addressForm.city,
          district: addressForm.district,
          ward: addressForm.ward,
          street: addressForm.street,
          isDefault: false,
        });
      }

      // Backend là authority của giỏ và số dư ví.
      await refreshCart();
      setShowReview(false);
      setPendingOrder(orderInfo);
      void walletApi.getSummary().then((result) => result.success && result.data && setWalletSummary(result.data));

      if (paymentMethod === 'atm' && amountDue > 0 && !data.paidAt) {
        setPaymentStep(true);
      } else {
        setCompletedStep(true);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Không thể đặt hàng. Vui lòng thử lại.';
      setError(msg);
      setShowReview(false);
      void walletApi.getSummary().then((result) => result.success && result.data && setWalletSummary(result.data));
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== RENDER ====================

  // Empty cart guard (chỉ check khi chưa qua step 3/4)
  if (cart.length === 0 && !paymentStep && !completedStep) {
    return (
      <div className="ivy-checkout-page">
        <div className="ivy-cart-empty">
          <h3>Giỏ hàng trống</h3>
          <p>Vui lòng thêm sản phẩm trước khi thanh toán</p>
          <Link to="/products" className="ivy-btn-continue">← Tiếp tục mua hàng</Link>
        </div>
      </div>
    );
  }

  if (completedStep && pendingOrder) {
    return <OrderCompleted orderCode={pendingOrder.orderCode} total={pendingOrder.orderTotal} paymentMethod={paymentMethod} />;
  }

  if (paymentStep && pendingOrder) {
    return (
      <PaymentStep
        orderCode={pendingOrder.orderCode}
        total={pendingOrder.amountDue}
        bankAccounts={bankAccounts}
        allowSimulatePaid={allowSimulatePaid}
        onPaid={() => {
          setPaymentStep(false);
          setCompletedStep(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <div className="ivy-checkout-page">
      {/* Steps: step 2 active */}
      <div className="ivy-cart-steps">
        <div className="ivy-step done"><div className="ivy-step-num">✓</div><span>Giỏ hàng</span></div>
        <div className="ivy-step-line active"></div>
        <div className="ivy-step active"><div className="ivy-step-num">2</div><span>Đặt hàng</span></div>
        <div className="ivy-step-line"></div>
        <div className="ivy-step"><div className="ivy-step-num">3</div><span>Thanh toán</span></div>
        <div className="ivy-step-line"></div>
        <div className="ivy-step"><div className="ivy-step-num">4</div><span>Hoàn thành đơn</span></div>
      </div>

      <div className="ivy-checkout-layout">
        {/* LEFT */}
        <div className="ivy-checkout-left">
          <CheckoutForm
            isLoggedIn={!!user}
            value={addressForm}
            onChange={setAddressForm}
            error={error}
          />

          <ShippingSelector
            provider={shippingProvider}
            onProviderChange={setShippingProvider}
            options={shippingOptions}
            selected={selectedShipping}
            onSelect={(opt) => setSelectedShipping(opt)}
            hasAddress={!!(addressForm.city && addressForm.district)}
            loading={shippingLoading}
          />

          <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />

          {walletSummary && (
            <div className="kk-wallet-checkout">
              <label className="kk-wallet-checkout__toggle">
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(e) => setUseWallet(e.target.checked)}
                  disabled={walletSummary.availableBalance <= 0}
                />
                <span>
                  <strong>Dùng số dư Ví KaitoKid</strong><br />
                  <span className="kk-wallet-muted">
                    Khả dụng {walletSummary.availableBalance.toLocaleString('vi-VN')}đ · <Link to="/wallet">Quản lý ví</Link>
                  </span>
                </span>
              </label>
              {useWallet && (
                <div className="kk-wallet-checkout__numbers">
                  <span>Ví dự kiến dùng <strong>−{estimatedWalletUse.toLocaleString('vi-VN')}đ</strong></span>
                  <span>Còn thanh toán <strong>{estimatedAmountDue.toLocaleString('vi-VN')}đ</strong></span>
                </div>
              )}
              <p className="kk-wallet-muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                Số tiền cuối cùng do backend khóa số dư và tính lại khi tạo đơn.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <OrderSummaryBox
          subtotal={subtotal}
          shippingFee={shippingFee}
          couponCode={appliedCoupon}
          couponDiscount={couponDiscount}
          comboLabel={combo?.eligible ? `Mua kèm −${combo.percent}%` : undefined}
          comboDiscount={comboDiscount}
          total={total}
          promoInput={promoInput}
          onPromoInputChange={setPromoInput}
          onApplyCoupon={applyCoupon}
          submitting={submitting}
          onSubmit={handleOpenReview}
          submitLabel="XEM LẠI ĐƠN"
        />
      </div>

      <ReviewOrderModal
        open={showReview}
        cart={cart}
        customerName={addressForm.name}
        customerPhone={addressForm.phone}
        customerAddress={fullAddress}
        paymentMethod={paymentMethod}
        shippingName={selectedShipping?.serviceName || ''}
        subtotal={subtotal}
        shippingFee={shippingFee}
        couponCode={appliedCoupon}
        couponDiscount={couponDiscount}
        comboDiscount={comboDiscount}
        total={total}
        submitting={submitting}
        onCancel={() => setShowReview(false)}
        onConfirm={handleConfirmOrder}
      />
    </div>
  );
}
