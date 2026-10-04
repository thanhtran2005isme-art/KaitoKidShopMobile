import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';

type AuthPrimaryButtonProps = {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function AuthPrimaryButton({
  label,
  loadingLabel = 'Đang xử lý...',
  loading = false,
  disabled = false,
  onPress,
}: AuthPrimaryButtonProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const blocked = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const setPressed = (pressed: boolean) => {
    scale.value = withTiming(pressed ? 0.985 : 1, {
      duration: reducedMotion ? 0 : pressed ? 110 : 160,
    });
  };

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled: blocked, busy: loading }}
        disabled={blocked}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={styles.pressable}>
        <LinearGradient
          colors={
            blocked
              ? ['#6B7280', '#4B5563']
              : [BRAND_COLORS.primaryDark, BRAND_COLORS.primary]
          }
          end={{ x: 1, y: 0.75 }}
          start={{ x: 0, y: 0 }}
          style={styles.gradient}>
          {loading ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.label}>{loadingLabel}</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>{label}</Text>
              <AppIcon color="#FFFFFF" name="arrowRight" size={19} />
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  pressable: {
    minHeight: 56,
    borderRadius: 19,
    overflow: 'hidden',
  },
  gradient: {
    minHeight: 56,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
});
