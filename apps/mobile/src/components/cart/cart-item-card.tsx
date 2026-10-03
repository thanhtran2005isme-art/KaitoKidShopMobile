import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CartReservationTimer } from '@/components/cart/cart-reservation-timer';
import { AppIcon } from '@/components/ui/app-icon';
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
        style={styles.checkboxHitbox}>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected ? <AppIcon color="#FFFFFF" name="check" size={15} /> : null}
        </View>
      </Pressable>

      <View style={styles.media}>
        {image ? (
          <Image
            accessibilityLabel={item.name}
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: image }}
            style={styles.image}
            transition={160}
          />
        ) : (
          <Text style={styles.fallback}>K</Text>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.headingRow}>
          <View style={styles.titleWrap}>
            <Text numberOfLines={2} style={styles.name}>
              {item.name}
            </Text>
            {item.size || item.color ? (
              <Text numberOfLines={1} style={styles.variantText}>
                {[item.size ? 'Size ' + item.size : '', item.color]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
          </View>

          <Pressable
            accessibilityLabel={'Xóa ' + item.name + ' khỏi giỏ'}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onRemove}
            hitSlop={8}
            style={({ pressed }) => [
              styles.removeButton,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}>
            <AppIcon color={BRAND_COLORS.danger} name="close" size={19} />
          </Pressable>
        </View>

        <Text style={styles.price}>{formatPrice(item.price)}</Text>

        <View style={styles.statusRow}>
          {item.isLowStock ? (
            <Text style={styles.lowStockText}>Tồn kho còn ít</Text>
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
                accessibilityRole="button"
                accessibilityState={{ disabled: !canDecrease }}
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
                accessibilityRole="button"
                accessibilityState={{ disabled: !canIncrease }}
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
            <Text style={styles.totalLabel}>Thành tiền</Text>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#C4B5FD',
    backgroundColor: '#FDFBFF',
  },
  checkboxHitbox: {
    position: 'absolute',
    left: 6,
    top: 6,
    zIndex: 3,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#B7BDC7',
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  media: {
    width: 92,
    height: 124,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  fallback: { color: BRAND_COLORS.primary, fontSize: 30, fontWeight: '900' },
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
  titleWrap: { flex: 1, gap: 4 },
  name: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
  },
  variantText: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
  },
  removeButton: {
    width: 44,
    height: 44,
    marginTop: -7,
    marginRight: -7,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  price: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  lowStockText: {
    color: '#92400E',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
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
    fontSize: 10,
    lineHeight: 14,
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
    backgroundColor: BRAND_COLORS.surface,
  },
  quantityButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_COLORS.surface,
  },
  quantityButtonDisabled: { opacity: 0.35 },
  quantityButtonText: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  quantity: {
    minWidth: 34,
    textAlign: 'center',
    color: BRAND_COLORS.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  totalWrap: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 3,
  },
  available: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'right',
  },
  totalLabel: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
  },
  lineTotal: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
