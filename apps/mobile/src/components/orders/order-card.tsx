import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OrderStatusBadge } from '@/components/orders/order-status-badge';
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
          <Text style={styles.code}>{order.orderCode}</Text>
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
              <Text numberOfLines={1} style={styles.itemName}>
                {item.productName}
              </Text>
              <Text style={styles.itemMeta}>
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
          {'+' + hiddenCount + ' sản phẩm khác'}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View>
          <Text style={styles.quantityLabel}>
            {quantity + ' sản phẩm'}
          </Text>
          <Text style={styles.totalLabel}>Tổng thanh toán</Text>
        </View>
        <View style={styles.totalBlock}>
          <Text style={styles.total}>{formatMoney(order.total)}</Text>
          <Text style={styles.detailAction}>Xem chi tiết ›</Text>
        </View>
      </View>
    </Pressable>
  );
}

export const OrderCard = memo(OrderCardBase);

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 14,
    gap: 11,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  codeBlock: { flex: 1 },
  code: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  date: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 12,
  },
  items: { gap: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  image: {
    width: 46,
    height: 58,
    borderRadius: 11,
    backgroundColor: '#F3F4F6',
  },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '800',
  },
  itemMeta: {
    marginTop: 3,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 12,
  },
  moreText: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '800',
  },
  footer: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  quantityLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    fontWeight: '700',
  },
  totalLabel: {
    marginTop: 2,
    color: BRAND_COLORS.ink,
    fontSize: 9,
    fontWeight: '900',
  },
  totalBlock: { alignItems: 'flex-end', gap: 3 },
  total: {
    color: BRAND_COLORS.accent,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
  },
  detailAction: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
  },
  pressed: { opacity: 0.78 },
});
