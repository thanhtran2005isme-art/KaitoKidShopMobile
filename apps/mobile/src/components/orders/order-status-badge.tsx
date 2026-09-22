import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { orderStatusMeta, shippingStatusMeta } from '@/utils/order-status';
import type { StatusTone } from '@/types/orders';

const TONE_STYLES: Record<StatusTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: '#F3F4F6', fg: '#4B5563', border: '#E5E7EB' },
  warning: { bg: '#FFF7ED', fg: '#9A3412', border: '#FED7AA' },
  info: { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
  success: { bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' },
  danger: { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' },
  primary: { bg: '#F5F3FF', fg: '#6D28D9', border: '#DDD6FE' },
};

function StatusBadgeBase({
  status,
  kind = 'order',
}: {
  status?: string | null;
  kind?: 'order' | 'shipping';
}) {
  const meta =
    kind === 'shipping'
      ? shippingStatusMeta(status)
      : orderStatusMeta(status);
  const tone = TONE_STYLES[meta.tone];

  return (
    <View
      accessibilityLabel={meta.label}
      style={[
        styles.badge,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
        },
      ]}>
      <Text style={[styles.text, { color: tone.fg }]}>{meta.label}</Text>
    </View>
  );
}

export const OrderStatusBadge = memo(StatusBadgeBase);

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  text: {
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '900',
  },
});
