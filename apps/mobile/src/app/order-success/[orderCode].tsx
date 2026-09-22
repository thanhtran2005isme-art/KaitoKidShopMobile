import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckoutStepper } from '@/components/checkout/checkout-stepper';
import { BRAND_COLORS } from '@/constants/brand';
import { useCheckout } from '@/context/CheckoutContext';

function money(value: number) {
  return Math.round(value).toLocaleString('vi-VN') + 'đ';
}

export default function OrderSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderCode?: string | string[] }>();
  const routeOrderCode = Array.isArray(params.orderCode)
    ? params.orderCode[0]
    : params.orderCode;

  const { pendingOrder, resetCheckout } = useCheckout();
  const orderCode = routeOrderCode || pendingOrder?.orderCode || '';
  const order =
    pendingOrder?.orderCode === orderCode ? pendingOrder : null;

  const continueShopping = () => {
    resetCheckout();
    router.replace('/');
  };

  const openCart = () => {
    resetCheckout();
    router.replace('/cart');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <CheckoutStepper active={4} />

        <View style={styles.heroCard}>
          <View style={styles.successMark}>
            <Text style={styles.successMarkText}>✓</Text>
          </View>
          <Text style={styles.eyebrow}>ĐẶT HÀNG THÀNH CÔNG</Text>
          <Text style={styles.title}>Cảm ơn bạn đã chọn KaitoKid</Text>
          <Text style={styles.description}>
            Đơn hàng đã được ghi nhận. Bạn có thể tiếp tục mua sắm hoặc quay
            lại giỏ để kiểm tra các sản phẩm chưa checkout.
          </Text>

          {orderCode ? (
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>Mã đơn hàng</Text>
              <Text selectable style={styles.code}>
                {orderCode}
              </Text>
            </View>
          ) : null}
        </View>

        {order ? (
          <View style={styles.summaryCard}>
            <Text style={styles.sectionEyebrow}>TÓM TẮT</Text>
            <SummaryRow
              label="Thanh toán"
              value={
                order.paymentMethod === 'ATM'
                  ? 'Chuyển khoản / VietQR'
                  : 'Thanh toán khi nhận hàng'
              }
            />
            <SummaryRow
              label="Sản phẩm"
              value={
                order.items.reduce(
                  (sum, item) => sum + item.quantity,
                  0,
                ) + ' sản phẩm'
              }
            />
            <SummaryRow
              label="Tạm tính"
              value={money(order.subtotal)}
            />
            <SummaryRow
              label="Vận chuyển"
              value={money(order.shippingFee)}
            />
            {order.discount > 0 ? (
              <SummaryRow
                label="Tổng ưu đãi"
                value={'-' + money(order.discount)}
                success
              />
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tổng thanh toán</Text>
              <Text style={styles.total}>{money(order.total)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>
              Mã đơn đã được lưu trên hệ thống
            </Text>
            <Text style={styles.infoText}>
              Bạn có thể mở khu vực Đơn hàng để xem chi tiết, trạng thái và hành trình vận chuyển.
            </Text>
          </View>
        )}

        <View style={styles.nextCard}>
          <Text style={styles.nextTitle}>Điều gì xảy ra tiếp theo?</Text>
          <View style={styles.nextItem}>
            <Text style={styles.nextNumber}>1</Text>
            <Text style={styles.nextText}>
              KaitoKid tiếp nhận và chuẩn bị sản phẩm theo đơn.
            </Text>
          </View>
          <View style={styles.nextItem}>
            <Text style={styles.nextNumber}>2</Text>
            <Text style={styles.nextText}>
              Đơn COD được tạo vận đơn; đơn ATM đã thanh toán sẽ chuyển sang
              bước xử lý vận chuyển.
            </Text>
          </View>
          <View style={styles.nextItem}>
            <Text style={styles.nextNumber}>3</Text>
            <Text style={styles.nextText}>
              Theo dõi lịch sử xử lý và vận chuyển trong mục Đơn hàng của tôi.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityLabel="Xem đơn hàng vừa đặt"
            onPress={() => {
              const id = order?.id;
              resetCheckout();
              if (id) {
                router.replace({
                  pathname: '/orders/[id]',
                  params: { id: String(id) },
                });
              } else {
                router.replace('/orders');
              }
            }}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.primaryButtonText}>Xem đơn hàng</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Tiếp tục mua sắm"
            onPress={continueShopping}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.secondaryButtonText}>Tiếp tục mua sắm</Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Quay lại giỏ hàng"
            onPress={openCart}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.secondaryButtonText}>
              Xem sản phẩm còn trong giỏ
            </Text>
          </Pressable>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  success = false,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          success && styles.summaryValueSuccess,
        ]}>
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
    paddingTop: 18,
    gap: 15,
  },
  heroCard: {
    minHeight: 320,
    borderRadius: 28,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  successMark: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  successMarkText: {
    color: BRAND_COLORS.success,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '900',
  },
  eyebrow: {
    color: BRAND_COLORS.success,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    maxWidth: 420,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
  },
  codeCard: {
    minWidth: 210,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primarySoft,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: 'center',
    gap: 3,
  },
  codeLabel: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 8,
    fontWeight: '800',
  },
  code: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  summaryCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 16,
    gap: 8,
  },
  sectionEyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  summaryRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  summaryValue: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
  },
  summaryValueSuccess: {
    color: BRAND_COLORS.success,
  },
  totalRow: {
    paddingTop: 12,
    marginTop: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalLabel: {
    color: BRAND_COLORS.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  total: {
    color: BRAND_COLORS.primary,
    fontSize: 21,
    fontWeight: '900',
  },
  infoCard: {
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    padding: 16,
    gap: 4,
  },
  infoTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  infoText: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
  },
  nextCard: {
    borderRadius: 22,
    backgroundColor: '#FDFBFF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    padding: 16,
    gap: 11,
  },
  nextTitle: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },
  nextItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  nextNumber: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: BRAND_COLORS.primary,
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 9,
    lineHeight: 28,
    fontWeight: '900',
  },
  nextText: {
    flex: 1,
    color: '#4B5563',
    fontSize: 9,
    lineHeight: 15,
    paddingTop: 5,
  },
  actions: { gap: 8 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  pressed: { opacity: 0.8 },
  bottomSpace: { height: 28 },
});
