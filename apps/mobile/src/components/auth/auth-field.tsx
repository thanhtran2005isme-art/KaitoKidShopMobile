import { forwardRef, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';

type AuthFieldProps = Omit<TextInputProps, 'style' | 'secureTextEntry'> & {
  label: string;
  icon: AppIconName;
  error?: string | null;
  helper?: string;
  secure?: boolean;
};

export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  {
    label,
    icon,
    error,
    helper,
    secure = false,
    onBlur,
    onFocus,
    ...inputProps
  },
  ref,
) {
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const focusProgress = useSharedValue(0);
  const errorProgress = useSharedValue(error ? 1 : 0);

  useEffect(() => {
    focusProgress.value = withTiming(focused ? 1 : 0, {
      duration: reducedMotion ? 0 : 180,
    });
  }, [focusProgress, focused, reducedMotion]);

  useEffect(() => {
    errorProgress.value = withTiming(error ? 1 : 0, {
      duration: reducedMotion ? 0 : 180,
    });
  }, [error, errorProgress, reducedMotion]);

  const frameStyle = useAnimatedStyle(() => {
    const borderColor =
      errorProgress.value > 0.05
        ? interpolateColor(
            errorProgress.value,
            [0, 1],
            [BRAND_COLORS.line, BRAND_COLORS.danger],
          )
        : interpolateColor(
            focusProgress.value,
            [0, 1],
            [BRAND_COLORS.line, BRAND_COLORS.primary],
          );

    return {
      borderColor,
      backgroundColor: interpolateColor(
        focusProgress.value,
        [0, 1],
        ['#F9FAFB', '#FCFAFF'],
      ),
    };
  });

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={[styles.frame, frameStyle]}>
        <View style={styles.leadingIcon}>
          <AppIcon
            color={focused ? BRAND_COLORS.primary : BRAND_COLORS.muted}
            name={icon}
            size={20}
          />
        </View>

        <TextInput
          {...inputProps}
          ref={ref}
          accessibilityLabel={label}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secure && !revealed}
          style={styles.input}
        />

        {secure ? (
          <Pressable
            accessibilityLabel={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            accessibilityRole="button"
            hitSlop={4}
            onPress={() => setRevealed((current) => !current)}
            style={({ pressed }) => [
              styles.trailingButton,
              pressed && styles.pressed,
            ]}>
            <AppIcon
              color={BRAND_COLORS.muted}
              name={revealed ? 'eyeOff' : 'eye'}
              size={20}
            />
          </Pressable>
        ) : null}
      </Animated.View>

      {error ? (
        <View accessibilityRole="alert" style={styles.messageRow}>
          <AppIcon color={BRAND_COLORS.danger} name="warning" size={14} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 7 },
  label: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  frame: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  leadingIcon: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: BRAND_COLORS.ink,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
    paddingRight: 10,
  },
  trailingButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  error: {
    flex: 1,
    color: BRAND_COLORS.danger,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  helper: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: { opacity: 0.6 },
});
