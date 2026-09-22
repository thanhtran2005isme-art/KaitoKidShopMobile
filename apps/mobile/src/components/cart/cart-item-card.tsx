import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CartReservationTimer } from '@/components/cart/cart-reservation-timer';
import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import type { CartItem } from '@/types/shopping';

function formatPrice(value: number) {
  return Math.round(value).toLocaleString('vi-VN') + 'đ';
}

export function CartItemCard({
  item,
  selected,
  busy,
  onToggle,
  onChangeQuantity,
  onRemove,
  onExpired,
}: {
  item: CartItem;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
  onExpired: () => void;
}) {
  const image = resolveMediaUrl(item.image);
  const canDecrease = item.quantity > 1 && !busy;
  const canIncrease = item.availableStock > 0 && !busy;

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <Pressable
        accessibilityLabel={selected ? 'Bỏ chọn sản phẩm' : 'Chọn sản phẩm'}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled: busy }}
        disabled={busy}
        onPress={onToggle}
        style={[styles.checkbox, selected && styles.checkboxSelected]}>
        <Text style={styles.checkboxText}>{selected ? '✓' : ''}</Text>
      </Pressable>

      <View style={styles.media}>
        {image ? (
          <Image
            contentFit="cover"
            source={{ uri: image }}
            style={styles.image}
            transition={160}
          />
        ) : (
          <Text style={styles.fallback}>👚</Text>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.headingRow}>
          <View style={styles.titleWrap}>
            <Text numberOfLines={2} style={styles.name}>
              {item.name}
            </Text>
            <View style={styles.variantRow}>
              {item.size ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{'Size ' + item.size}</Text>
                </View>
              ) : null}
              {item.color ? (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{item.color}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Pressable
            accessibilityLabel={'Xóa ' + item.name + ' khỏi giỏ'}
            disabled={busy}
            onPress={onRemove}
            hitSlop={8}
            style={({ pressed }) => [
              styles.removeButton,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}>
            <Text style={styles.removeText}>×</Text>
          </Pressable>
        </View>

        <Text style={styles.price}>{formatPrice(item.price)}</Text>

        <View style={styles.statusRow}>
          {item.isLowStock ? (
            <View style={styles.lowStock}>
              <Text style={styles.lowStockText}>Sắp hết hàng</Text>
            </View>
          ) : null}
          <CartReservationTimer
            onExpired={onExpired}
            reservedUntil={item.reservedUntil}
          />
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.quantityLabel}>Số lượng</Text>
            <View style={styles.quantityControl}>
              <Pressable
                accessibilityLabel="Giảm số lượng"
                disabled={!canDecrease}
                onPress={() => onChangeQuantity(item.quantity - 1)}
                style={[
                  styles.quantityButton,
                  !canDecrease && styles.quantityButtonDisabled,
                ]}>
                <Text style={styles.quantityButtonText}>−</Text>
              </Pressable>
              <Text style={styles.quantity}>{item.quantity}</Text>
              <Pressable
                accessibilityLabel="Tăng số lượng"
                disabled={!canIncrease}
                onPress={() => onChangeQuantity(item.quantity + 1)}
                style={[
                  styles.quantityButton,
                  !canIncrease && styles.quantityButtonDisabled,
                ]}>
                <Text style={styles.quantityButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.totalWrap}>
            <Text style={styles.available}>
              {item.availableStock > 0
                ? 'Có thể thêm ' + item.availableStock
                : 'Đã giữ tối đa hiện tại'}
            </Text>
            <Text style={styles.lineTotal}>
              {formatPrice(item.price * item.quantity)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND_COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    padding: 11,
    flexDirection: 'row',
    gap: 10,
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#C4B5FD',
    backgroundColor: '#FDFBFF',
  },
  checkbox: {
    position: 'absolute',
    left: 17,
    top: 17,
    zIndex: 3,
    width: 23,
    height: 23,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  checkboxText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  media: {
    width: 92,
    height: 118,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  fallback: { fontSize: 36 },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 7,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleWrap: { flex: 1, gap: 6 },
  name: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    color: '#4B5563',
    fontSize: 9,
    fontWeight: '800',
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: BRAND_COLORS.danger,
    fontSize: 22,
    lineHeight: 23,
    fontWeight: '700',
  },
  price: {
    color: BRAND_COLORS.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  lowStock: {
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  lowStockText: {
    color: '#B45309',
    fontSize: 9,
    fontWeight: '900',
  },
  footer: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  quantityLabel: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    fontWeight: '700',
    marginBottom: 4,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 31,
    height: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  quantityButtonDisabled: { opacity: 0.35 },
  quantityButtonText: {
    color: BRAND_COLORS.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  quantity: {
    minWidth: 32,
    textAlign: 'center',
    color: BRAND_COLORS.ink,
    fontSize: 11,
    fontWeight: '900',
  },
  totalWrap: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 3,
  },
  available: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    textAlign: 'right',
  },
  lineTotal: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
