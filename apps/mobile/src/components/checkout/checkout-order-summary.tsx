import { StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';

function money(value: number) {
  return Math.round(value).toLocaleString('vi-VN') + 'đ';
}

export function CheckoutOrderSummary({
  subtotal,
  shippingFee,
  couponDiscount,
  comboDiscount,
  total,
}: {
  subtotal: number;
  shippingFee: number;
  couponDiscount: number;
  comboDiscount: number;
  total: number;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>TỔNG KẾT ĐƠN</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Tạm tính</Text>
        <Text style={styles.value}>{money(subtotal)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Vận chuyển</Text>
        <Text style={styles.value}>{money(shippingFee)}</Text>
      </View>
      {couponDiscount > 0 ? (
        <View style={styles.row}>
          <Text style={styles.discountLabel}>Coupon</Text>
          <Text style={styles.discount}>-{money(couponDiscount)}</Text>
        </View>
      ) : null}
      {comboDiscount > 0 ? (
        <View style={styles.row}>
          <Text style={styles.discountLabel}>Ưu đãi combo</Text>
          <Text style={styles.discount}>-{money(comboDiscount)}</Text>
        </View>
      ) : null}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Thành tiền</Text>
        <Text style={styles.total}>{money(total)}</Text>
      </View>
      <Text style={styles.helper}>
        Giá, coupon, combo và phí giao hàng sẽ được backend kiểm tra lại khi tạo đơn.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 16,
    gap: 10,
  },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  row: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  value: {
    color: BRAND_COLORS.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  discountLabel: {
    color: BRAND_COLORS.success,
    fontSize: 10,
    fontWeight: '800',
  },
  discount: {
    color: BRAND_COLORS.success,
    fontSize: 11,
    fontWeight: '900',
  },
  totalRow: {
    marginTop: 3,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalLabel: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  total: {
    color: BRAND_COLORS.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  helper: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
  },
});
