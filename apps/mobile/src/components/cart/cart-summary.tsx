import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
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
        <Text style={styles.title}>Tóm tắt thanh toán</Text>
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

      <View style={styles.helperRow}>
        <AppIcon color={BRAND_COLORS.muted} name="shield" size={16} />
        <Text style={styles.helper}>
          Giá, tồn kho, phí giao hàng và ưu đãi được kiểm tra lại ở bước checkout.
        </Text>
      </View>

      <Pressable
        accessibilityLabel="Tiến hành thanh toán với các sản phẩm đã chọn"
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onCheckout}
        style={({ pressed }) => [
          styles.checkout,
          disabled && styles.checkoutDisabled,
          pressed && !disabled && styles.pressed,
        ]}>
        <Text style={styles.checkoutText}>Thanh toán</Text>
        <Text style={styles.checkoutAmount}>{formatPrice(subtotal)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    padding: 16,
    gap: 14,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: BRAND_COLORS.ink,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  count: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
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
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  subtotal: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    textAlign: 'right',
  },
  combo: {
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#A7F3D0',
    padding: 12,
    gap: 4,
  },
  comboTitle: {
    color: BRAND_COLORS.success,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
  },
  comboText: {
    color: '#065F46',
    fontSize: 10,
    lineHeight: 15,
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  helper: {
    flex: 1,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '500',
  },
  checkout: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  checkoutDisabled: {
    backgroundColor: '#D1D5DB',
  },
  checkoutText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  checkoutAmount: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  pressed: { opacity: 0.84 },
});
