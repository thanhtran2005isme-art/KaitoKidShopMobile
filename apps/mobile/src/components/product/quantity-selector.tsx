import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';

type QuantitySelectorProps = {
  value: number;
  max: number;
  onChange: (value: number) => void;
};

export function QuantitySelector({ value, max, onChange }: QuantitySelectorProps) {
  const safeMax = Math.max(0, max);
  const canDecrease = value > 1;
  const canIncrease = value < safeMax;

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.label}>Số lượng</Text>
        <Text style={styles.helper}>
          {safeMax > 0 ? `Có thể chọn tối đa ${safeMax} sản phẩm` : 'Biến thể này hiện hết hàng'}
        </Text>
      </View>

      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel="Giảm số lượng"
          disabled={!canDecrease}
          onPress={() => onChange(Math.max(1, value - 1))}
          style={[styles.button, !canDecrease && styles.disabled]}>
          <Text style={styles.buttonText}>−</Text>
        </Pressable>

        <Text style={styles.value}>{safeMax > 0 ? value : 0}</Text>

        <Pressable
          accessibilityLabel="Tăng số lượng"
          disabled={!canIncrease}
          onPress={() => onChange(Math.min(safeMax, value + 1))}
          style={[styles.button, !canIncrease && styles.disabled]}>
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  label: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  helper: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    marginTop: 3,
  },
  stepper: {
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  button: {
    width: 38,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.28 },
  buttonText: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  value: {
    minWidth: 32,
    textAlign: 'center',
    color: BRAND_COLORS.ink,
    fontSize: 13,
    fontWeight: '900',
  },
});
