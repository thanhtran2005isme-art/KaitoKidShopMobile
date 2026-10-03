import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';

export function CartEmptyState({ onContinue }: { onContinue: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <AppIcon color={BRAND_COLORS.primary} name="bag" size={34} />
      </View>
      <Text style={styles.title}>Giỏ hàng đang trống</Text>
      <Text style={styles.description}>
        Chọn món bạn thích, thêm đúng màu và size rồi quay lại đây để thanh toán.
      </Text>
      <Pressable
        accessibilityLabel="Khám phá sản phẩm"
        accessibilityRole="button"
        onPress={onContinue}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
        ]}>
        <Text style={styles.buttonText}>Khám phá sản phẩm</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 11,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  description: {
    maxWidth: 330,
    color: BRAND_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  button: {
    minHeight: 48,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  pressed: { opacity: 0.82 },
});
