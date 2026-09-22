import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CheckoutOrderSummary } from '@/components/checkout/checkout-order-summary';
import { BRAND_COLORS } from '@/constants/brand';
import type { CartItem } from '@/types/shopping';

function money(value: number) {
  return Math.round(value).toLocaleString('vi-VN') + 'đ';
}

export function CheckoutReviewModal({
  visible,
  items,
  address,
  shippingLabel,
  paymentLabel,
  subtotal,
  shippingFee,
  couponDiscount,
  comboDiscount,
  total,
  submitting,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  items: CartItem[];
  address: string;
  shippingLabel: string;
  paymentLabel: string;
  subtotal: number;
  shippingFee: number;
  couponDiscount: number;
  comboDiscount: number;
  total: number;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>KIỂM TRA LẦN CUỐI</Text>
          <Text style={styles.title}>Xác nhận đơn hàng</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}>
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Sản phẩm</Text>
              {items.map((item) => (
                <View key={item.id} style={styles.item}>
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

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Giao hàng</Text>
              <Text style={styles.blockText}>{address}</Text>
              <Text style={styles.blockMeta}>{shippingLabel}</Text>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Thanh toán</Text>
              <Text style={styles.blockText}>{paymentLabel}</Text>
            </View>

            <CheckoutOrderSummary
              comboDiscount={comboDiscount}
              couponDiscount={couponDiscount}
              shippingFee={shippingFee}
              subtotal={subtotal}
              total={total}
            />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              disabled={submitting}
              onPress={onClose}
              style={({ pressed }) => [
                styles.secondary,
                pressed && styles.pressed,
                submitting && styles.disabled,
              ]}>
              <Text style={styles.secondaryText}>Quay lại sửa</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Xác nhận tạo đơn hàng"
              disabled={submitting}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.primary,
                pressed && styles.pressed,
                submitting && styles.disabled,
              ]}>
              <Text style={styles.primaryText}>
                {submitting ? 'Đang tạo đơn...' : 'Xác nhận đặt hàng'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.42)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: BRAND_COLORS.surface,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 99,
    alignSelf: 'center',
    backgroundColor: '#D1D5DB',
    marginBottom: 14,
  },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 23,
    fontWeight: '900',
    marginTop: 3,
  },
  scroll: {
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
  },
  block: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#FAFAFB',
    padding: 13,
    gap: 7,
  },
  blockTitle: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  blockText: {
    color: BRAND_COLORS.ink,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '800',
  },
  blockMeta: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
  },
  item: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 5,
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
  actions: {
    flexDirection: 'row',
    gap: 9,
  },
  secondary: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  primary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.48 },
});
