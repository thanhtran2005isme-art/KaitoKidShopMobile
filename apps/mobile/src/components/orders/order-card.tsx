import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { AppIcon } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import type { CustomerOrder } from '@/types/orders';
import {
  formatDateTime,
  formatMoney,
} from '@/utils/order-status';

function OrderCardBase({
  order,
  onPress,
}: {
  order: CustomerOrder;
  onPress: () => void;
}) {
  const quantity = useMemo(
    () => order.items.reduce((sum, item) => sum + item.quantity, 0),
    [order.items],
  );
  const preview = order.items.slice(0, 2);
  const hiddenCount = Math.max(0, order.items.length - preview.length);

  return (
    <Pressable
      accessibilityLabel={
        'Mở đơn ' +
        order.orderCode +
        ', ' +
        quantity +
        ' sản phẩm, tổng ' +
        formatMoney(order.total)
      }
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <View style={styles.codeBlock}>
          <Text numberOfLines={1} style={styles.code}>
            {order.orderCode}
          </Text>
          <Text style={styles.date}>{formatDateTime(order.createdAt)}</Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      <View style={styles.items}>
        {preview.map((item, index) => (
          <View key={item.productId + ':' + index} style={styles.itemRow}>
            <Image
              accessibilityLabel={item.productName}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={resolveMediaUrl(item.productImage)}
              style={styles.image}
            />
            <View style={styles.itemCopy}>
              <Text numberOfLines={2} style={styles.itemName}>
                {item.productName}
              </Text>
              <Text numberOfLines={2} style={styles.itemMeta}>
                {'Size ' +
                  item.size +
                  ' · ' +
                  item.color +
                  ' · SL ' +
                  item.quantity}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {hiddenCount > 0 ? (
        <Text style={styles.moreText}>
          {'+' + hiddenCount + ' sản phẩm khác trong đơn'}
        </Text>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={styles.quantityBlock}>
          <Text style={styles.quantityLabel}>{quantity + ' sản phẩm'}</Text>
          <Text style={styles.summaryHint}>Tổng thanh toán</Text>
        </View>
        <Text style={styles.total}>{formatMoney(order.total)}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailAction}>Xem chi tiết đơn hàng</Text>
        <AppIcon
          color={BRAND_COLORS.primary}
          name="chevronRight"
          size={18}
        />
      </View>
    </Pressable>
  );
}

export const OrderCard = memo(OrderCardBase);

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 16,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  codeBlock: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  code: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  date: {
    marginTop: 3,
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  items: {
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  image: {
    width: 64,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  itemMeta: {
    marginTop: 4,
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  moreText: {
    marginTop: -2,
    color: BRAND_COLORS.primary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  summaryRow: {
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
  },
  quantityBlock: {
    flex: 1,
    minWidth: 0,
  },
  quantityLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  summaryHint: {
    marginTop: 2,
    color: BRAND_COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  total: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    textAlign: 'right',
  },
  detailRow: {
    minHeight: 44,
    marginTop: -4,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primarySoft,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailAction: {
    flex: 1,
    color: BRAND_COLORS.primaryDark,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
    borderColor: '#D1D5DB',
  },
});
