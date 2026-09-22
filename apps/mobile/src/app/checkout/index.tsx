import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckoutOrderSummary } from '@/components/checkout/checkout-order-summary';
import { CheckoutReviewModal } from '@/components/checkout/checkout-review-modal';
import { CheckoutStepper } from '@/components/checkout/checkout-stepper';
import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useCheckout } from '@/context/CheckoutContext';
import { useShopping } from '@/context/ShoppingContext';
import { checkoutApi } from '@/services/checkout.api';
import type {
  CheckoutAddress,
  PaymentConfig,
  ShippingProvider,
  ShippingQuoteOption,
} from '@/types/checkout';

function money(value: number) {
  return Math.round(value).toLocaleString('vi-VN') + 'đ';
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function fullAddress(address: CheckoutAddress) {
  return [
    address.street,
    address.ward,
    address.district,
    address.province,
  ]
    .filter(Boolean)
    .join(', ');
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const { refreshCart } = useShopping();
  const {
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
    setSelectedAddress,
    setSelectedShipping,
    setCoupon,
    setCombo,
    setPaymentMethod,
    setNote,
    setPendingOrder,
  } = useCheckout();

  const [initialLoading, setInitialLoading] = useState(true);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [couponInput, setCouponInput] = useState(couponCode || '');
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [shippingOptions, setShippingOptions] = useState<ShippingQuoteOption[]>([]);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [initialRetryKey, setInitialRetryKey] = useState(0);
  const [shippingRetryKey, setShippingRetryKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const couponDiscount = coupon?.isValid ? coupon.discountAmount : 0;
  const comboDiscount = combo?.eligible ? combo.discount : 0;
  const shippingFee = selectedShipping?.fee || 0;
  const total = Math.max(
    0,
    subtotal - couponDiscount - comboDiscount + shippingFee,
  );

  useEffect(() => {
    if (!token) {
      setInitialLoading(false);
      return;
    }

    let active = true;

    async function loadInitial() {
      setInitialLoading(true);
      setError(null);

      const [addressesResult, configResult, providersResult, comboResult] =
        await Promise.allSettled([
          checkoutApi.getAddresses(token),
          checkoutApi.getPaymentConfig(),
          checkoutApi.getShippingProviders(),
          selectedCartItemIds.length
            ? checkoutApi.getSelectedCombo(token, selectedCartItemIds)
            : Promise.resolve(null),
        ]);

      if (!active) return;

      if (addressesResult.status === 'fulfilled') {
        const addresses = addressesResult.value;
        const fallbackAddress =
          addresses.find((address) => address.isDefault) || addresses[0];

        if (fallbackAddress) {
          setSelectedAddress(
            (current) => current || fallbackAddress,
          );
        }
      }

      if (configResult.status === 'fulfilled') {
        const config = configResult.value;
        setPaymentConfig(config);

        setPaymentMethod((current) => {
          if (config.supportedMethods.includes(current)) return current;

          if (config.supportedMethods.includes('COD')) return 'COD';
          if (config.supportedMethods.includes('ATM')) return 'ATM';
          return current;
        });
      } else {
        setError('Không tải được cấu hình thanh toán.');
      }

      if (providersResult.status === 'fulfilled') {
        setProviders(
          providersResult.value.filter((provider) => provider.enabled),
        );
      }

      if (comboResult.status === 'fulfilled') {
        setCombo(comboResult.value);
      } else if (selectedCartItemIds.length > 0) {
        setCombo(null);
      }

      setInitialLoading(false);
    }

    void loadInitial();

    return () => {
      active = false;
    };
  }, [
    initialRetryKey,
    selectedCartItemIds,
    setCombo,
    setPaymentMethod,
    setSelectedAddress,
    token,
  ]);

  useEffect(() => {
    if (!selectedAddress || subtotal <= 0) {
      setShippingOptions([]);
      setSelectedShipping(null);
      return;
    }

    let active = true;

    async function quote() {
      setShippingLoading(true);
      try {
        const response = await checkoutApi.quoteShipping({
          provider: 'all',
          toProvince: selectedAddress.province,
          toDistrict: selectedAddress.district,
          toWard: selectedAddress.ward || undefined,
          toAddress: selectedAddress.street || undefined,
          weightGram: Math.max(
            300,
            selectedItems.reduce(
              (sum, item) => sum + item.quantity * 300,
              0,
            ),
          ),
          orderValue: subtotal,
        });

        if (!active) return;

        if (!response.success || response.options.length === 0) {
          setShippingOptions([]);
          setSelectedShipping(null);
          setError(
            response.message ||
              'Không tìm được phương thức giao hàng cho địa chỉ này.',
          );
          return;
        }

        setShippingOptions(response.options);
        setSelectedShipping(response.options[0]);
        setError(null);
      } catch (quoteError) {
        if (!active) return;
        setShippingOptions([]);
        setSelectedShipping(null);
        setError(
          messageFrom(
            quoteError,
            'Không thể tính phí giao hàng. Vui lòng thử lại.',
          ),
        );
      } finally {
        if (active) setShippingLoading(false);
      }
    }

    void quote();

    return () => {
      active = false;
    };
  }, [
    selectedAddress,
    selectedItems,
    setSelectedShipping,
    shippingRetryKey,
    subtotal,
  ]);

  useEffect(() => {
    if (!token || !couponCode || subtotal <= 0) return;

    let active = true;

    async function revalidate() {
      try {
        const result = await checkoutApi.validateCoupon(
          token,
          couponCode,
          subtotal,
        );
        if (!active) return;

        if (result.isValid) {
          setCoupon(couponCode, result);
        } else {
          setCoupon(null, null);
          setCouponInput('');
        }
      } catch {
        if (active) {
          setCoupon(null, null);
          setCouponInput('');
        }
      }
    }

    void revalidate();

    return () => {
      active = false;
    };
  }, [couponCode, setCoupon, subtotal, token]);

  const providerNames = useMemo(
    () =>
      new Map(
        providers.map((provider) => [provider.code, provider.name] as const),
      ),
    [providers],
  );

  const paymentLabel =
    paymentMethod === 'ATM'
      ? paymentConfig?.vietQrConfigured
        ? 'Chuyển khoản ngân hàng / VietQR'
        : 'Chuyển khoản ngân hàng'
      : 'Thanh toán khi nhận hàng (COD)';

  const shippingLabel = selectedShipping
    ? [
        providerNames.get(selectedShipping.provider) ||
          selectedShipping.provider.toUpperCase(),
        selectedShipping.serviceName,
        selectedShipping.leadTimeHours > 0
          ? 'dự kiến ' + selectedShipping.leadTimeHours + ' giờ'
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Chưa chọn phương thức giao hàng';

  const applyCoupon = async () => {
    if (!token || couponBusy) return;

    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setError('Vui lòng nhập mã giảm giá.');
      return;
    }

    setCouponBusy(true);
    setError(null);
    try {
      const result = await checkoutApi.validateCoupon(token, code, subtotal);
      if (!result.isValid) {
        setCoupon(null, null);
        setError(result.message || 'Mã giảm giá không hợp lệ.');
        return;
      }

      setCoupon(code, result);
      setCouponInput(code);
    } catch (couponError) {
      setError(
        messageFrom(couponError, 'Không thể kiểm tra mã giảm giá.'),
      );
    } finally {
      setCouponBusy(false);
    }
  };

  const removeCoupon = () => {
    setCouponInput('');
    setCoupon(null, null);
    setError(null);
  };

  const validateBeforeReview = () => {
    if (selectedItems.length === 0 || selectedCartItemIds.length === 0) {
      return 'Không còn sản phẩm hợp lệ để thanh toán.';
    }
    if (!selectedAddress) return 'Vui lòng chọn địa chỉ nhận hàng.';
    if (!selectedShipping) return 'Vui lòng chọn phương thức giao hàng.';
    if (!paymentConfig?.supportedMethods.includes(paymentMethod)) {
      return 'Phương thức thanh toán hiện không khả dụng.';
    }
    return null;
  };

  const openReview = () => {
    const validationError = validateBeforeReview();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setReviewVisible(true);
  };

  const createOrder = async () => {
    if (
      !token ||
      !selectedAddress ||
      !selectedShipping ||
      submitLock.current
    ) {
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const order = await checkoutApi.createOrder(token, {
        cartItemIds: selectedCartItemIds,
        customerName: selectedAddress.fullName.trim(),
        customerPhone: selectedAddress.phone.trim(),
        customerEmail: String(user?.email || '').trim(),
        customerAddress: fullAddress(selectedAddress),
        paymentMethod,
        couponCode: couponCode || undefined,
        note: note.trim() || undefined,
        shippingProvider: selectedShipping.provider,
        shippingServiceCode: selectedShipping.serviceCode,
        shippingFee: selectedShipping.fee,
        leadTimeHours: selectedShipping.leadTimeHours,
        shippingProvince: selectedAddress.province,
        shippingDistrict: selectedAddress.district,
        shippingWard: selectedAddress.ward || undefined,
        shippingStreet: selectedAddress.street || undefined,
      });

      setPendingOrder(order);
      setReviewVisible(false);
      await refreshCart();

      if (paymentMethod === 'ATM') {
        router.replace({
          pathname: '/checkout/payment',
          params: { orderCode: order.orderCode },
        });
      } else {
        router.replace({
          pathname: '/order-success/[orderCode]',
          params: { orderCode: order.orderCode },
        });
      }
    } catch (createError) {
      setReviewVisible(false);
      setError(
        messageFrom(
          createError,
          'Không thể tạo đơn hàng. Vui lòng kiểm tra lại giỏ hàng.',
        ),
      );
      await refreshCart();
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Cần đăng nhập để thanh toán</Text>
          <Text style={styles.stateText}>
            Đăng nhập để xác nhận giỏ hàng, địa chỉ và tạo đơn KaitoKid.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: '/auth/login',
                params: { redirect: '/checkout' },
              })
            }
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedItems.length === 0 || selectedCartItemIds.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Chưa có sản phẩm để thanh toán</Text>
          <Text style={styles.stateText}>
            Quay lại giỏ hàng và chọn ít nhất một sản phẩm trước khi tiếp tục.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/cart')}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Quay lại giỏ hàng</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang chuẩn bị thanh toán</Text>
          <Text style={styles.stateText}>
            KaitoKid đang tải địa chỉ, ưu đãi và cấu hình thanh toán.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityLabel="Quay lại giỏ hàng"
              hitSlop={10}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>CHECKOUT KAITOKID</Text>
              <Text style={styles.title}>Thanh toán</Text>
              <Text style={styles.subtitle}>
                {selectedQuantity + ' sản phẩm đã chọn'}
              </Text>
            </View>
          </View>

          <CheckoutStepper active={2} />

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              {!paymentConfig ? (
                <Pressable
                  accessibilityLabel="Tải lại cấu hình checkout"
                  onPress={() => setInitialRetryKey((value) => value + 1)}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.retryButtonText}>Thử tải lại</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {!paymentConfig && !error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                Chưa tải được cấu hình thanh toán.
              </Text>
              <Pressable
                accessibilityLabel="Tải lại cấu hình checkout"
                onPress={() => setInitialRetryKey((value) => value + 1)}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.retryButtonText}>Thử tải lại</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>01</Text>
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Địa chỉ nhận hàng</Text>
                <Text style={styles.sectionHint}>
                  Chọn địa chỉ đã lưu hoặc thêm địa chỉ mới.
                </Text>
              </View>
            </View>

            {selectedAddress ? (
              <View style={styles.selectedCard}>
                <View style={styles.selectedHeader}>
                  <View style={styles.flex}>
                    <Text style={styles.addressName}>
                      {selectedAddress.fullName}
                    </Text>
                    <Text style={styles.addressPhone}>
                      {selectedAddress.phone}
                    </Text>
                  </View>
                  {selectedAddress.isDefault ? (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Mặc định</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.addressText}>
                  {fullAddress(selectedAddress)}
                </Text>
                <Pressable
                  accessibilityLabel="Đổi hoặc quản lý địa chỉ nhận hàng"
                  onPress={() => router.push('/checkout/address')}
                  style={({ pressed }) => [
                    styles.outlineAction,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.outlineActionText}>
                    Đổi / quản lý địa chỉ
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityLabel="Thêm địa chỉ nhận hàng"
                onPress={() => router.push('/checkout/address')}
                style={({ pressed }) => [
                  styles.emptyAction,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.emptyActionTitle}>
                  Chưa có địa chỉ nhận hàng
                </Text>
                <Text style={styles.emptyActionText}>
                  Thêm địa chỉ để tính phí giao hàng chính xác.
                </Text>
                <Text style={styles.emptyActionLink}>Thêm địa chỉ →</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>02</Text>
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Phương thức giao hàng</Text>
                <Text style={styles.sectionHint}>
                  Phí và ETA được tính lại theo địa chỉ.
                </Text>
              </View>
            </View>

            {!selectedAddress ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>
                  Hãy chọn địa chỉ trước để xem các gói giao hàng.
                </Text>
              </View>
            ) : shippingLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={BRAND_COLORS.primary} />
                <Text style={styles.infoText}>Đang tính phí giao hàng...</Text>
              </View>
            ) : shippingOptions.length === 0 ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>
                  Chưa có gói giao hàng khả dụng cho địa chỉ này.
                </Text>
                <Pressable
                  accessibilityLabel="Tính lại phí giao hàng"
                  onPress={() => setShippingRetryKey((value) => value + 1)}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.retryButtonText}>Tính lại phí</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.optionList}>
                {shippingOptions.map((option) => {
                  const selected =
                    selectedShipping?.provider === option.provider &&
                    selectedShipping?.serviceCode === option.serviceCode;

                  return (
                    <Pressable
                      key={option.provider + '-' + option.serviceCode}
                      accessibilityLabel={
                        'Chọn ' +
                        option.serviceName +
                        ', phí ' +
                        money(option.fee)
                      }
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setSelectedShipping(option)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selected && styles.optionCardSelected,
                        pressed && styles.pressed,
                      ]}>
                      <View
                        style={[
                          styles.radio,
                          selected && styles.radioSelected,
                        ]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionTitle}>
                          {providerNames.get(option.provider) ||
                            option.provider.toUpperCase()}
                          {' · '}
                          {option.serviceName}
                        </Text>
                        <Text style={styles.optionMeta}>
                          {option.leadTimeHours > 0
                            ? 'Dự kiến ' + option.leadTimeHours + ' giờ'
                            : 'Thời gian giao sẽ được cập nhật'}
                        </Text>
                      </View>
                      <Text style={styles.optionPrice}>
                        {money(option.fee)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>03</Text>
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Ưu đãi</Text>
                <Text style={styles.sectionHint}>
                  Coupon được backend kiểm tra theo đúng subtotal đã chọn.
                </Text>
              </View>
            </View>

            {combo?.eligible ? (
              <View style={styles.comboCard}>
                <Text style={styles.comboTitle}>
                  {combo.message || 'Đã áp dụng ưu đãi combo'}
                </Text>
                <Text style={styles.comboValue}>
                  {'Giảm ' + money(combo.discount)}
                </Text>
              </View>
            ) : null}

            <View style={styles.couponRow}>
              <View style={styles.couponField}>
                <Text style={styles.fieldLabel}>Mã giảm giá</Text>
                <TextInput
                  accessibilityLabel="Mã giảm giá"
                  autoCapitalize="characters"
                  editable={!couponBusy && !couponCode}
                  onChangeText={setCouponInput}
                  placeholder="VD: KAITOKID10"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                  value={couponInput}
                  onSubmitEditing={() => void applyCoupon()}
                  style={[
                    styles.input,
                    couponCode && styles.inputApplied,
                  ]}
                />
              </View>
              {couponCode ? (
                <Pressable
                  accessibilityLabel="Bỏ mã giảm giá"
                  onPress={removeCoupon}
                  style={({ pressed }) => [
                    styles.couponButtonSecondary,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.couponButtonSecondaryText}>Bỏ mã</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityLabel="Áp dụng mã giảm giá"
                  disabled={couponBusy}
                  onPress={() => void applyCoupon()}
                  style={({ pressed }) => [
                    styles.couponButton,
                    pressed && styles.pressed,
                    couponBusy && styles.disabled,
                  ]}>
                  <Text style={styles.couponButtonText}>
                    {couponBusy ? 'Đang kiểm tra' : 'Áp dụng'}
                  </Text>
                </Pressable>
              )}
            </View>

            {couponCode && coupon?.isValid ? (
              <Text style={styles.appliedText}>
                {'Đã áp dụng ' +
                  couponCode +
                  ' · giảm ' +
                  money(coupon.discountAmount)}
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>04</Text>
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Thanh toán</Text>
                <Text style={styles.sectionHint}>
                  Chỉ hiển thị phương thức backend đang cho phép.
                </Text>
              </View>
            </View>

            <View style={styles.optionList}>
              {paymentConfig?.supportedMethods.includes('COD') ? (
                <Pressable
                  accessibilityLabel="Thanh toán khi nhận hàng"
                  accessibilityRole="radio"
                  accessibilityState={{ checked: paymentMethod === 'COD' }}
                  onPress={() => setPaymentMethod('COD')}
                  style={({ pressed }) => [
                    styles.optionCard,
                    paymentMethod === 'COD' &&
                      styles.optionCardSelected,
                    pressed && styles.pressed,
                  ]}>
                  <View
                    style={[
                      styles.radio,
                      paymentMethod === 'COD' && styles.radioSelected,
                    ]}>
                    {paymentMethod === 'COD' ? (
                      <View style={styles.radioDot} />
                    ) : null}
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle}>
                      Thanh toán khi nhận hàng
                    </Text>
                    <Text style={styles.optionMeta}>
                      Thanh toán cho đơn sau khi nhận sản phẩm.
                    </Text>
                  </View>
                </Pressable>
              ) : null}

              {paymentConfig?.supportedMethods.includes('ATM') ? (
                <Pressable
                  accessibilityLabel="Thanh toán chuyển khoản ngân hàng hoặc VietQR"
                  accessibilityRole="radio"
                  accessibilityState={{ checked: paymentMethod === 'ATM' }}
                  onPress={() => setPaymentMethod('ATM')}
                  style={({ pressed }) => [
                    styles.optionCard,
                    paymentMethod === 'ATM' &&
                      styles.optionCardSelected,
                    pressed && styles.pressed,
                  ]}>
                  <View
                    style={[
                      styles.radio,
                      paymentMethod === 'ATM' && styles.radioSelected,
                    ]}>
                    {paymentMethod === 'ATM' ? (
                      <View style={styles.radioDot} />
                    ) : null}
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionTitle}>
                      {paymentConfig.vietQrConfigured
                        ? 'Chuyển khoản / VietQR'
                        : 'Chuyển khoản ngân hàng'}
                    </Text>
                    <Text style={styles.optionMeta}>
                      Tạo đơn trước, sau đó thanh toán trong thời hạn backend cấp.
                    </Text>
                  </View>
                </Pressable>
              ) : null}
            </View>

            {paymentConfig &&
            paymentConfig.supportedMethods.length === 0 ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>
                  Shop chưa bật phương thức thanh toán khả dụng.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Ghi chú đơn hàng</Text>
            <TextInput
              accessibilityLabel="Ghi chú đơn hàng"
              multiline
              onChangeText={setNote}
              placeholder="Ví dụ: gọi trước khi giao..."
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
              value={note}
              style={[styles.input, styles.noteInput]}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>05</Text>
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Sản phẩm đã chọn</Text>
                <Text style={styles.sectionHint}>
                  Chỉ các dòng này sẽ được đưa vào đơn.
                </Text>
              </View>
            </View>

            <View style={styles.itemList}>
              {selectedItems.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemCopy}>
                    <Text numberOfLines={2} style={styles.itemName}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {[item.color, item.size ? 'Size ' + item.size : '', 'SL ' + item.quantity]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>
                    {money(item.price * item.quantity)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <CheckoutOrderSummary
            comboDiscount={comboDiscount}
            couponDiscount={couponDiscount}
            shippingFee={shippingFee}
            subtotal={subtotal}
            total={total}
          />

          <Pressable
            accessibilityLabel="Xem lại đơn hàng trước khi đặt"
            disabled={
              submitting ||
              !selectedAddress ||
              !selectedShipping ||
              !paymentConfig?.supportedMethods.includes(paymentMethod)
            }
            onPress={openReview}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.pressed,
              (submitting ||
                !selectedAddress ||
                !selectedShipping ||
                !paymentConfig?.supportedMethods.includes(paymentMethod)) &&
                styles.submitButtonDisabled,
            ]}>
            <View style={styles.submitCopy}>
              <Text style={styles.submitText}>Xem lại đơn hàng</Text>
              <Text style={styles.submitHint}>
                Backend sẽ kiểm tra lại toàn bộ giá trị
              </Text>
            </View>
            <Text style={styles.submitTotal}>{money(total)}</Text>
          </Pressable>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>

      <CheckoutReviewModal
        address={selectedAddress ? fullAddress(selectedAddress) : ''}
        comboDiscount={comboDiscount}
        couponDiscount={couponDiscount}
        items={selectedItems}
        onClose={() => setReviewVisible(false)}
        onConfirm={() => void createOrder()}
        paymentLabel={paymentLabel}
        shippingFee={shippingFee}
        shippingLabel={shippingLabel}
        submitting={submitting}
        subtotal={subtotal}
        total={total}
        visible={reviewVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: BRAND_COLORS.ink,
    fontSize: 30,
    lineHeight: 32,
    marginTop: -2,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  section: {
    gap: 11,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
  },
  sectionCopy: { flex: 1, gap: 2 },
  sectionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  sectionHint: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 13,
  },
  selectedCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    backgroundColor: '#FDFBFF',
    padding: 14,
    gap: 8,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  addressName: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  addressPhone: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  addressText: {
    color: '#374151',
    fontSize: 10,
    lineHeight: 16,
  },
  defaultBadge: {
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  defaultBadgeText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 8,
    fontWeight: '900',
  },
  outlineAction: {
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  outlineActionText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
  },
  emptyAction: {
    minHeight: 124,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C4B5FD',
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 4,
  },
  emptyActionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  emptyActionText: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    textAlign: 'center',
  },
  emptyActionLink: {
    color: BRAND_COLORS.primary,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 5,
  },
  optionList: { gap: 8 },
  optionCard: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  optionCardSelected: {
    borderWidth: 1.5,
    borderColor: BRAND_COLORS.primary,
    backgroundColor: '#FDFBFF',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: BRAND_COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND_COLORS.primary,
  },
  optionCopy: { flex: 1, gap: 3 },
  optionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '900',
  },
  optionMeta: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
  },
  optionPrice: {
    color: BRAND_COLORS.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  infoCard: {
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    padding: 13,
  },
  loadingCard: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 10,
  },
  infoText: {
    color: '#4B5563',
    fontSize: 9,
    lineHeight: 14,
  },
  comboCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    padding: 12,
    gap: 3,
  },
  comboTitle: {
    color: '#047857',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '800',
  },
  comboValue: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '900',
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  couponField: { flex: 1, gap: 5 },
  fieldLabel: {
    color: BRAND_COLORS.ink,
    fontSize: 9,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: BRAND_COLORS.surface,
    paddingHorizontal: 12,
    color: BRAND_COLORS.ink,
    fontSize: 11,
  },
  inputApplied: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  noteInput: {
    minHeight: 92,
    paddingTop: 12,
    paddingBottom: 12,
  },
  couponButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.ink,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponButtonText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  couponButtonSecondary: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponButtonSecondaryText: {
    color: BRAND_COLORS.danger,
    fontSize: 9,
    fontWeight: '900',
  },
  appliedText: {
    color: BRAND_COLORS.success,
    fontSize: 9,
    fontWeight: '800',
  },
  itemList: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    paddingHorizontal: 13,
  },
  itemRow: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_COLORS.line,
  },
  itemCopy: { flex: 1, gap: 2 },
  itemName: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '800',
  },
  itemMeta: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
  },
  itemPrice: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  submitButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitCopy: { flex: 1, gap: 2 },
  submitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  submitHint: {
    color: '#EDE9FE',
    fontSize: 8,
  },
  submitTotal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  errorCard: {
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 11,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '700',
  },
  retryButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#B91C1C',
    fontSize: 8,
    fontWeight: '900',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 10,
  },
  stateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    maxWidth: 360,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  bottomSpace: { height: 28 },
});
