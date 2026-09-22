import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import type { ComboDiscountResult } from '@/types/shopping';

function formatPrice(value: number) {
  return Math.round(value).toLocaleString('vi-VN') + 'đ';
}

export function CartSummary({
  selectedLines,
  selectedQuantity,
  subtotal,
  comboDiscount,
  disabled,
  onCheckout,
}: {
  selectedLines: number;
  selectedQuantity: number;
  subtotal: number;
  comboDiscount: ComboDiscountResult | null;
  disabled: boolean;
  onCheckout: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.eyebrow}>TẠM TÍNH</Text>
          <Text style={styles.title}>Sản phẩm đã chọn</Text>
        </View>
        <Text style={styles.count}>
          {selectedLines + ' dòng · ' + selectedQuantity + ' sản phẩm'}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Tạm tính</Text>
        <Text style={styles.subtotal}>{formatPrice(subtotal)}</Text>
      </View>

      {comboDiscount?.eligible ? (
        <View style={styles.combo}>
          <Text style={styles.comboTitle}>
            {comboDiscount.message || 'Giỏ hàng đang đủ điều kiện ưu đãi combo'}
          </Text>
          <Text style={styles.comboText}>
            {'Backend đang ghi nhận mức giảm combo ' +
              formatPrice(comboDiscount.discount) +
              ' trên các nhóm đủ điều kiện trong toàn bộ giỏ.'}
          </Text>
        </View>
      ) : null}

      <Text style={styles.helper}>
        Phí giao hàng, coupon và thanh toán sẽ được tính ở bước checkout.
      </Text>

      <Pressable
        accessibilityLabel="Tiến hành thanh toán với các sản phẩm đã chọn"
        disabled={disabled}
        onPress={onCheckout}
        style={({ pressed }) => [
          styles.checkout,
          disabled && styles.checkoutDisabled,
          pressed && !disabled && styles.pressed,
        ]}>
        <Text style={styles.checkoutText}>Tiến hành thanh toán</Text>
        <Text style={styles.checkoutAmount}>{formatPrice(subtotal)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    padding: 16,
    gap: 13,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: 3,
    color: BRAND_COLORS.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  count: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'right',
  },
  row: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  subtotal: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  combo: {
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#A7F3D0',
    padding: 12,
    gap: 4,
  },
  comboTitle: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '900',
  },
  comboText: {
    color: '#065F46',
    fontSize: 9,
    lineHeight: 14,
  },
  helper: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
  },
  checkout: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  checkoutDisabled: {
    backgroundColor: '#9CA3AF',
  },
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  checkoutAmount: {
    color: '#EDE9FE',
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: { opacity: 0.84 },
});
