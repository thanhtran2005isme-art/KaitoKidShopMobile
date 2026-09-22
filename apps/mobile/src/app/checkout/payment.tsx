import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  const [instructions, setInstructions] =
    useState<PaymentInstructions | null>(null);
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terminal = useMemo(
    () =>
      status?.status === 'cancelled' ||
      Boolean(status?.paidAt) ||
      (status != null && secondsLeft <= 0),
    [secondsLeft, status?.paidAt, status?.status],
  );

  useEffect(() => {
    if (!token || !orderCode) {
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [configResult, instructionsResult, statusResult] =
          await Promise.all([
            checkoutApi.getPaymentConfig(),
            checkoutApi.getPaymentInstructions(token, orderCode),
            checkoutApi.getPaymentStatus(token, orderCode),
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
            params: { orderCode },
          });
        }
      } catch (loadError) {
        if (!active) return;
        setError(
          messageFrom(
            loadError,
            'Không thể tải thông tin chuyển khoản.',
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

  useEffect(() => {
    if (!token || !orderCode || loading) return;
    if (status?.status === 'cancelled' || status?.paidAt) return;

    let active = true;

    async function poll() {
      try {
        const next = await checkoutApi.getPaymentStatus(token, orderCode);
        if (!active) return;

        setStatus(next);
        setSecondsLeft(Math.max(0, next.secondsLeft));

        if (next.paidAt) {
          router.replace({
            pathname: '/order-success/[orderCode]',
            params: { orderCode },
          });
        }
      } catch {
        // Giữ UI hiện tại; request kế tiếp sẽ thử lại.
      }
    }

    const interval = setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    loading,
    orderCode,
    router,
    status?.paidAt,
    status?.status,
    token,
  ]);

  useEffect(() => {
    if (loading || terminal || secondsLeft <= 0) return;

    const timer = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, terminal]);

  const refreshStatus = async () => {
    if (!token || !orderCode || actionBusy) return;

    setActionBusy(true);
    setError(null);
    try {
      const next = await checkoutApi.getPaymentStatus(token, orderCode);
      setStatus(next);
      setSecondsLeft(Math.max(0, next.secondsLeft));
      if (next.paidAt) {
        router.replace({
          pathname: '/order-success/[orderCode]',
          params: { orderCode },
        });
      }
    } catch (refreshError) {
      setError(
        messageFrom(
          refreshError,
          'Không thể cập nhật trạng thái thanh toán.',
        ),
      );
    } finally {
      setActionBusy(false);
    }
  };

  const cancel = async () => {
    if (!token || !orderCode || actionBusy) return;

    setActionBusy(true);
    setError(null);
    try {
      await checkoutApi.cancelPayment(token, orderCode);
      const next = await checkoutApi.getPaymentStatus(token, orderCode);
      setStatus(next);
      setSecondsLeft(0);
    } catch (cancelError) {
      setError(
        messageFrom(cancelError, 'Không thể hủy giao dịch.'),
      );
    } finally {
      setActionBusy(false);
    }
  };

  const simulatePaid = async () => {
    if (!token || !orderCode || actionBusy || !config?.allowSimulatePaid) {
      return;
    }

    setActionBusy(true);
    setError(null);
    try {
      await checkoutApi.simulatePaid(token, orderCode);
      const next = await checkoutApi.getPaymentStatus(token, orderCode);
      setStatus(next);
      setSecondsLeft(Math.max(0, next.secondsLeft));

      if (next.paidAt) {
        router.replace({
          pathname: '/order-success/[orderCode]',
          params: { orderCode },
        });
      }
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
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Cần đăng nhập để xem thanh toán</Text>
          <Pressable
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Không có đơn chờ thanh toán</Text>
          <Text style={styles.stateText}>
            Mã đơn không tồn tại trong phiên checkout hiện tại.
          </Text>
          <Pressable
            onPress={() => router.replace('/cart')}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Về giỏ hàng</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang tải thanh toán</Text>
          <Text style={styles.stateText}>
            KaitoKid đang lấy hướng dẫn chuyển khoản từ backend.
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
            onPress={() => setRetryKey((value) => value + 1)}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const cancelled =
    status?.status === 'cancelled' ||
    (status != null && secondsLeft <= 0);
  const bank = instructions?.bankAccount;
  const qrUrl = resolveMediaUrl(instructions?.qrUrl);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>THANH TOÁN ĐƠN {orderCode}</Text>
          <Text style={styles.title}>
            {instructions?.qrUrl
              ? 'Chuyển khoản / VietQR'
              : 'Chuyển khoản ngân hàng'}
          </Text>
          <Text style={styles.subtitle}>
            Hệ thống sẽ tự cập nhật khi backend xác nhận thanh toán.
          </Text>
        </View>

        <CheckoutStepper active={3} />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {cancelled ? (
          <View style={styles.cancelledCard}>
            <Text style={styles.cancelledTitle}>
              Giao dịch không còn hiệu lực
            </Text>
            <Text style={styles.cancelledText}>
              Đơn đã bị hủy hoặc hết thời gian thanh toán. Tồn kho của đơn sẽ
              được backend xử lý theo trạng thái đơn.
            </Text>
            <Pressable
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
                <Text style={styles.countdownLabel}>
                  Thời gian thanh toán còn lại
                </Text>
                <Text style={styles.countdownHint}>
                  Đơn sẽ tự hủy nếu hết hạn mà chưa được xác nhận.
                </Text>
              </View>
              <Text style={styles.countdown}>
                {timeText(secondsLeft)}
              </Text>
            </View>

            {bank && instructions ? (
              <>
                <View style={styles.bankCard}>
                  <Text style={styles.sectionEyebrow}>
                    THÔNG TIN CHUYỂN KHOẢN
                  </Text>

                  <InfoRow
                    label="Số tiền"
                    value={money(instructions.total)}
                    emphasis
                  />
                  <InfoRow label="Ngân hàng" value={bank.bankName} />
                  <InfoRow
                    label="Số tài khoản"
                    value={bank.accountNumber}
                    selectable
                  />
                  <InfoRow
                    label="Chủ tài khoản"
                    value={bank.accountHolder}
                  />
                  {bank.branch ? (
                    <InfoRow label="Chi nhánh" value={bank.branch} />
                  ) : null}
                  <InfoRow
                    label="Nội dung chuyển khoản"
                    value={instructions.transferContent}
                    selectable
                    emphasis
                  />

                  <Text style={styles.bankNote}>
                    Chuyển đúng số tiền và nội dung để hệ thống đối soát đơn
                    chính xác.
                  </Text>
                </View>

                {qrUrl ? (
                  <View style={styles.qrCard}>
                    <Text style={styles.sectionEyebrow}>VIETQR</Text>
                    <Text style={styles.qrTitle}>
                      Quét mã bằng ứng dụng ngân hàng
                    </Text>
                    <View style={styles.qrFrame}>
                      <Image
                        accessibilityLabel={
                          'Mã VietQR cho đơn ' + orderCode
                        }
                        contentFit="contain"
                        source={{ uri: qrUrl }}
                        style={styles.qrImage}
                      />
                    </View>
                    <Text style={styles.qrHint}>
                      Nếu QR không tải được, bạn vẫn có thể chuyển khoản thủ
                      công bằng thông tin phía trên.
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>
                  Backend chưa trả về tài khoản nhận chuyển khoản.
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Kiểm tra lại trạng thái thanh toán"
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
                  disabled={actionBusy}
                  onPress={() => void simulatePaid()}
                  style={({ pressed }) => [
                    styles.devButton,
                    pressed && styles.pressed,
                    actionBusy && styles.disabled,
                  ]}>
                  <Text style={styles.devButtonText}>
                    Mô phỏng đã thanh toán (DEV)
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityLabel="Hủy giao dịch chuyển khoản"
                disabled={actionBusy}
                onPress={() => void cancel()}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                  actionBusy && styles.disabled,
                ]}>
                <Text style={styles.cancelButtonText}>
                  Hủy giao dịch
                </Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 15,
  },
  header: { gap: 3 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 25,
    fontWeight: '900',
  },
  subtitle: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
  },
  countdownCard: {
    minHeight: 82,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countdownUrgent: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  countdownCopy: { flex: 1, gap: 3 },
  countdownLabel: {
    color: BRAND_COLORS.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  countdownHint: {
    color: '#7C2D12',
    fontSize: 8,
    lineHeight: 13,
  },
  countdown: {
    color: BRAND_COLORS.accent,
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  bankCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 15,
    gap: 5,
  },
  sectionEyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoRow: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    width: 118,
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  infoValue: {
    flex: 1,
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
  },
  infoValueEmphasis: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
  },
  bankNote: {
    color: '#4B5563',
    fontSize: 8,
    lineHeight: 13,
    paddingTop: 8,
  },
  qrCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  qrTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  qrFrame: {
    width: 252,
    height: 252,
    maxWidth: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  qrHint: {
    maxWidth: 340,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
    textAlign: 'center',
  },
  actions: { gap: 8 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  devButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devButtonText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
  },
  cancelButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: BRAND_COLORS.danger,
    fontSize: 9,
    fontWeight: '900',
  },
  cancelledCard: {
    minHeight: 220,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cancelledTitle: {
    color: '#991B1B',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  cancelledText: {
    color: '#B91C1C',
    fontSize: 9,
    lineHeight: 15,
    textAlign: 'center',
    maxWidth: 360,
  },
  darkButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.ink,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
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
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    gap: 10,
  },
  stateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  bottomSpace: { height: 28 },
});
