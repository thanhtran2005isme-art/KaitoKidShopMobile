import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';

export function CartEmptyState({ onContinue }: { onContinue: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>🛍️</Text>
      </View>
      <Text style={styles.title}>Giỏ hàng đang trống</Text>
      <Text style={styles.description}>
        Chọn những món mềm mại, thoải mái và phù hợp với bé để bắt đầu đơn hàng.
      </Text>
      <Pressable
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
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  iconWrap: {
    width: 78,
    height: 78,
    borderRadius: 27,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 40 },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  description: {
    maxWidth: 330,
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
  },
  button: {
    minHeight: 46,
    marginTop: 6,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: { opacity: 0.82 },
});
