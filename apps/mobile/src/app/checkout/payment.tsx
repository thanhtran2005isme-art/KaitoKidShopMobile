import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreditCardPaymentForm } from '@/components/checkout/credit-card-payment-form';
import { CheckoutStepper } from '@/components/checkout/checkout-stepper';
import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useCheckout } from '@/context/CheckoutContext';
import { resolveMediaUrl } from '@/services/api-client';
import { checkoutApi } from '@/services/checkout.api';
import type {
  PaymentConfig,
  PaymentInstructions,
  PaymentStatus,
} from '@/types/checkout';

function money(value: number) {
  return Math.round(value).toLocaleString('vi-VN') + 'đ';
}

function timeText(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remain = safe % 60;
  return String(minutes).padStart(2, '0') + ':' + String(remain).padStart(2, '0');
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function imageUri(value?: string | null) {
  const raw = value?.trim() ?? '';
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  return resolveMediaUrl(raw);
}

export default function CheckoutPaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderCode?: string | string[] }>();
  const routeOrderCode = Array.isArray(params.orderCode)
    ? params.orderCode[0]
    : params.orderCode;

  const { token } = useAuth();
  const { pendingOrder } = useCheckout();
  const orderCode = routeOrderCode || pendingOrder?.orderCode || '';

  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paid = Boolean(status?.paidAt);
  const cancelled = status?.status === 'cancelled';
  const terminal = useMemo(
    () => cancelled || paid || (status != null && secondsLeft <= 0),
    [cancelled, paid, secondsLeft, status],
  );
  const isPayOs =
    instructions?.provider === 'payos' ||
    status?.paymentProvider === 'payos' ||
    config?.paymentProvider === 'payos' ||
    config?.payOsConfigured === true;

  async function syncPaymentStatus(activeToken: string, activeOrderCode: string) {
    const next = await checkoutApi.getPaymentStatus(activeToken, activeOrderCode);
    setStatus(next);
    setSecondsLeft(Math.max(0, next.secondsLeft));
    if (next.paidAt) {
      router.replace({
        pathname: '/order-success/[orderCode]',
        params: { orderCode: activeOrderCode },
      });
    }
    return next;
  }

  useEffect(() => {
    if (!token || !orderCode) {
      setLoading(false);
      return;
    }

    const activeToken = token;
    const activeOrderCode = orderCode;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [configResult, instructionsResult, statusResult] =
          await Promise.all([
            checkoutApi.getPaymentConfig(),
            checkoutApi.getPaymentInstructions(activeToken, activeOrderCode),
            checkoutApi.getPaymentStatus(activeToken, activeOrderCode),
          ]);
        if (!active) return;

        setConfig(configResult);
        setInstructions(instructionsResult);
        setStatus(statusResult);
        setSecondsLeft(
          Math.max(
            0,
            statusResult.secondsLeft || instructionsResult.secondsLeft || 0,
          ),
        );

        if (statusResult.paidAt) {
          router.replace({
            pathname: '/order-success/[orderCode]',
            params: { orderCode: activeOrderCode },
          });
        }
      } catch (loadError) {
        if (!active) return;
        setError(
          messageFrom(
            loadError,
            'Không thể tải thông tin thanh toán.',
          ),
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [orderCode, retryKey, router, token]);

  // Webhook payOS là authority. Polling này chỉ đồng bộ UI Mobile với DB sau
  // khi backend đã verify webhook; Mobile không đọc SMS/số dư ngân hàng.
  useEffect(() => {
    if (!token || !orderCode || loading || terminal) return;

    const activeToken = token;
    const activeOrderCode = orderCode;
    let active = true;
    let inFlight = false;

    async function poll() {
      if (inFlight) return;
      inFlight = true;
      try {
        const next = await checkoutApi.getPaymentStatus(
          activeToken,
          activeOrderCode,
        );
        if (!active) return;
        setStatus(next);
        setSecondsLeft(Math.max(0, next.secondsLeft));
        if (next.paidAt) {
          router.replace({
            pathname: '/order-success/[orderCode]',
            params: { orderCode: activeOrderCode },
          });
        }
      } catch {
        // Webhook vẫn là source of truth; tick sau sẽ thử đồng bộ lại.
      } finally {
        inFlight = false;
      }
    }

    const interval = setInterval(() => void poll(), 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loading, orderCode, router, terminal, token]);

  useEffect(() => {
    if (loading || terminal || secondsLeft <= 0) return;
    const timer = setInterval(
      () => setSecondsLeft((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [loading, secondsLeft, terminal]);

  async function refreshStatus() {
    if (!token || !orderCode || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      await syncPaymentStatus(token, orderCode);
    } catch (refreshError) {
      setError(messageFrom(refreshError, 'Không thể kiểm tra trạng thái thanh toán.'));
    } finally {
      setActionBusy(false);
    }
  }

  async function cancelPayment() {
    if (!token || !orderCode || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      await checkoutApi.cancelPayment(token, orderCode);
      await syncPaymentStatus(token, orderCode);
    } catch (cancelError) {
      setError(
        messageFrom(
          cancelError,
          'Không thể hủy giao dịch. Hệ thống chưa thay đổi tồn kho/coupon.',
        ),
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function simulatePaid() {
    if (!token || !orderCode || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      await checkoutApi.simulatePaid(token, orderCode);
      await syncPaymentStatus(token, orderCode);
    } catch (simulateError) {
      setError(
        messageFrom(
          simulateError,
          'Không thể mô phỏng thanh toán trong môi trường này.',
        ),
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function openPayOs() {
    const url = instructions?.checkoutUrl?.trim();
    if (!url || !token || !orderCode || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(url);
      await syncPaymentStatus(token, orderCode);
    } catch (browserError) {
      setError(messageFrom(browserError, 'Không thể mở trang thanh toán payOS.'));
    } finally {
      setActionBusy(false);
    }
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Cần đăng nhập để xem thanh toán</Text>
          <Pressable
            accessibilityLabel="Đăng nhập để tiếp tục thanh toán"
            accessibilityRole="button"
            onPress={() =>
              router.replace({
                pathname: '/auth/login',
                params: {
                  redirect: orderCode
                    ? '/checkout/payment?orderCode=' + encodeURIComponent(orderCode)
                    : '/cart',
                },
              })
            }
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderCode) {
    return (
      <SafeAreaView edges={['top']} style={styles.cardPaymentSafeArea}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.cardPaymentContent}>
          <CreditCardPaymentForm />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang tạo thanh toán payOS</Text>
          <Text style={styles.stateText}>
            Backend đang tạo hoặc khôi phục payment link của đơn hàng.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !instructions && !status) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Không tải được thanh toán</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable
            accessibilityLabel="Thử tải lại thông tin thanh toán"
            accessibilityRole="button"
            onPress={() => setRetryKey((value) => value + 1)}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const qrUrl = imageUri(instructions?.qrUrl);
  const expired = status != null && secondsLeft <= 0;
  const bank = instructions?.bankAccount;
  const showBankAccount = Boolean(
    bank?.accountNumber &&
      bank.accountNumber !== 'Thanh toán trên payOS' &&
      bank.accountHolder,
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>THANH TOÁN ĐƠN {orderCode}</Text>
          <Text style={styles.title}>
            {isPayOs ? 'Thanh toán qua payOS' : 'Chuyển khoản ngân hàng'}
          </Text>
          <Text style={styles.subtitle}>
            {isPayOs
              ? 'Quét QR hoặc mở payOS. Khi ngân hàng ghi nhận tiền, webhook payOS sẽ xác nhận với KaitoKid và màn hình tự chuyển sang thành công.'
              : 'Hệ thống sẽ tự cập nhật khi backend xác nhận thanh toán.'}
          </Text>
        </View>

        <CheckoutStepper active={3} />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {cancelled || expired ? (
          <View style={styles.cancelledCard}>
            <Text style={styles.cancelledTitle}>Giao dịch không còn hiệu lực</Text>
            <Text style={styles.cancelledText}>
              Đơn đã hủy hoặc hết thời gian thanh toán. Backend chỉ hoàn tồn
              kho/coupon sau khi đã đối soát payOS chưa nhận tiền.
            </Text>
            <Pressable
              accessibilityLabel="Tiếp tục mua sắm"
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              style={styles.darkButton}>
              <Text style={styles.darkButtonText}>Tiếp tục mua sắm</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.countdownCard,
                secondsLeft <= 60 && styles.countdownUrgent,
              ]}>
              <View style={styles.countdownCopy}>
                <Text style={styles.countdownLabel}>Thời gian thanh toán còn lại</Text>
                <Text style={styles.countdownHint}>
                  payOS webhook là nguồn xác nhận thanh toán chính thức.
                </Text>
              </View>
              <Text style={styles.countdown}>{timeText(secondsLeft)}</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.sectionEyebrow}>THÔNG TIN THANH TOÁN</Text>
              <InfoRow label="Đơn hàng" value={orderCode} />
              <InfoRow
                label="Số tiền"
                value={money(instructions?.total ?? status?.total ?? 0)}
                emphasis
              />
              {instructions?.transferContent ? (
                <InfoRow
                  label="Nội dung"
                  value={instructions.transferContent}
                  selectable
                />
              ) : null}
              {showBankAccount && bank ? (
                <>
                  <InfoRow label="Kênh nhận" value={bank.bankName} />
                  <InfoRow
                    label="Số tài khoản"
                    value={bank.accountNumber}
                    selectable
                  />
                  <InfoRow label="Chủ tài khoản" value={bank.accountHolder} />
                </>
              ) : null}
            </View>

            {qrUrl ? (
              <View style={styles.qrCard}>
                <Text style={styles.sectionEyebrow}>PAYOS QR</Text>
                <Text style={styles.qrTitle}>Quét QR để thanh toán</Text>
                <View style={styles.qrFrame}>
                  <Image
                    accessibilityLabel={'Mã QR payOS cho đơn ' + orderCode}
                    contentFit="contain"
                    source={{ uri: qrUrl }}
                    style={styles.qrImage}
                  />
                </View>
                <Text style={styles.qrHint}>
                  {instructions?.qrMode === 'payos_checkout'
                    ? 'Payment link đã tồn tại; QR này mở payOS Hosted Checkout để tiếp tục thanh toán.'
                    : 'QR do payOS cấp cho đúng số tiền của đơn. Không cần bấm “đã thanh toán”; app sẽ tự nhận trạng thái sau webhook.'}
                </Text>
              </View>
            ) : null}

            {isPayOs && instructions?.checkoutUrl ? (
              <Pressable
                accessibilityLabel="Mở trang thanh toán payOS"
                accessibilityRole="button"
                disabled={actionBusy}
                onPress={() => void openPayOs()}
                style={({ pressed }) => [
                  styles.payOsButton,
                  pressed && styles.pressed,
                  actionBusy && styles.disabled,
                ]}>
                <Text style={styles.payOsButtonText}>Mở trang thanh toán payOS</Text>
              </Pressable>
            ) : null}

            <View style={styles.liveCard}>
              <View style={styles.liveDot} />
              <View style={styles.liveCopy}>
                <Text style={styles.liveTitle}>Đang chờ payOS xác nhận</Text>
                <Text style={styles.liveText}>
                  Mobile đồng bộ trạng thái với backend mỗi 3 giây. App không đọc
                  SMS hoặc số dư tài khoản ngân hàng.
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Kiểm tra lại trạng thái thanh toán"
                accessibilityRole="button"
                disabled={actionBusy}
                onPress={() => void refreshStatus()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  actionBusy && styles.disabled,
                ]}>
                <Text style={styles.primaryButtonText}>
                  {actionBusy ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái'}
                </Text>
              </Pressable>

              {config?.allowSimulatePaid ? (
                <Pressable
                  accessibilityLabel="Mô phỏng đã thanh toán trong môi trường phát triển"
                  accessibilityRole="button"
                  disabled={actionBusy}
                  onPress={() => void simulatePaid()}
                  style={({ pressed }) => [
                    styles.devButton,
                    pressed && styles.pressed,
                    actionBusy && styles.disabled,
                  ]}>
                  <Text style={styles.devButtonText}>Mô phỏng paid (DEV)</Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityLabel="Hủy giao dịch thanh toán"
                accessibilityRole="button"
                disabled={actionBusy}
                onPress={() => void cancelPayment()}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                  actionBusy && styles.disabled,
                ]}>
                <Text style={styles.cancelButtonText}>Hủy giao dịch</Text>
              </Pressable>
            </View>
          </>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  emphasis = false,
  selectable = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  selectable?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        selectable={selectable}
        style={[styles.infoValue, emphasis && styles.infoValueEmphasis]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  cardPaymentSafeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  cardPaymentContent: {
    flexGrow: 1,
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 15,
  },
  header: { gap: 5 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: { color: BRAND_COLORS.ink, fontSize: 25, fontWeight: '900' },
  subtitle: { color: '#666666', fontSize: 13, lineHeight: 20 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  stateTitle: { color: BRAND_COLORS.ink, fontSize: 19, fontWeight: '800' },
  stateText: { color: '#666666', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  countdownCard: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  countdownUrgent: { borderColor: '#111111' },
  countdownCopy: { flex: 1, gap: 3 },
  countdownLabel: { color: '#111111', fontWeight: '800', fontSize: 13 },
  countdownHint: { color: '#777777', fontSize: 11, lineHeight: 17 },
  countdown: { color: '#111111', fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  sectionEyebrow: {
    color: '#666666',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7E7E7',
  },
  infoLabel: { color: '#777777', fontSize: 12, flexShrink: 0 },
  infoValue: { color: '#111111', fontSize: 13, fontWeight: '700', textAlign: 'right', flex: 1 },
  infoValueEmphasis: { fontSize: 18, fontWeight: '900' },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  qrTitle: { color: '#111111', fontSize: 18, fontWeight: '900', marginBottom: 14 },
  qrFrame: {
    width: 276,
    height: 276,
    maxWidth: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  qrImage: { width: '100%', height: '100%' },
  qrHint: { color: '#666666', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
  liveCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    padding: 14,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#111111', marginTop: 4 },
  liveCopy: { flex: 1, gap: 3 },
  liveTitle: { color: '#111111', fontSize: 12, fontWeight: '800' },
  liveText: { color: '#666666', fontSize: 11, lineHeight: 17 },
  actions: { gap: 10 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  payOsButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  payOsButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  devButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#999999',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devButtonText: { color: '#333333', fontSize: 12, fontWeight: '800' },
  cancelButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D3D3D3',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { color: '#555555', fontSize: 12, fontWeight: '800' },
  errorCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#B8B8B8',
    backgroundColor: '#F8F8F8',
  },
  errorText: { color: '#222222', fontSize: 12, lineHeight: 18 },
  cancelledCard: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  cancelledTitle: { color: '#111111', fontSize: 18, fontWeight: '900' },
  cancelledText: { color: '#666666', fontSize: 12, lineHeight: 19 },
  darkButton: {
    minHeight: 46,
    borderRadius: 11,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkButtonText: { color: '#FFFFFF', fontWeight: '900' },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.5 },
  bottomSpace: { height: 28 },
});
