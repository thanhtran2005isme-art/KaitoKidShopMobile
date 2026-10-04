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
  appearance?: 'light' | 'dark';
  showLeadingIcon?: boolean;
  showSecureToggle?: boolean;
};

export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  {
    label,
    icon,
    error,
    helper,
    secure = false,
    appearance = 'light',
    showLeadingIcon = true,
    showSecureToggle = true,
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
  const dark = appearance === 'dark';

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
    const idleBorder = dark ? '#374151' : BRAND_COLORS.line;
    const focusBorder = dark ? '#FFFFFF' : BRAND_COLORS.primary;
    const idleBackground = dark ? '#111827' : '#F9FAFB';
    const focusBackground = dark ? '#151D2D' : '#FFFFFF';

    const borderColor =
      errorProgress.value > 0.05
        ? interpolateColor(
            errorProgress.value,
            [0, 1],
            [idleBorder, dark ? '#FCA5A5' : BRAND_COLORS.danger],
          )
        : interpolateColor(
            focusProgress.value,
            [0, 1],
            [idleBorder, focusBorder],
          );

    return {
      borderColor,
      backgroundColor: interpolateColor(
        focusProgress.value,
        [0, 1],
        [idleBackground, focusBackground],
      ),
    };
  });

  return (
    <View style={[styles.wrapper, dark && styles.wrapperDark]}>
      <Text style={[styles.label, dark && styles.labelDark]}>{label}</Text>
      <Animated.View style={[styles.frame, dark && styles.frameDark, frameStyle]}>
        {showLeadingIcon ? (
          <View style={[styles.leadingIcon, dark && styles.leadingIconDark]}>
            <AppIcon
              color={
                focused
                  ? dark
                    ? '#FFFFFF'
                    : BRAND_COLORS.primary
                  : dark
                    ? '#9CA3AF'
                    : BRAND_COLORS.muted
              }
              name={icon}
              size={dark ? 17 : 20}
            />
          </View>
        ) : null}

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
          placeholderTextColor={dark ? '#6B7280' : '#9CA3AF'}
          secureTextEntry={secure && !revealed}
          style={[
            styles.input,
            dark && styles.inputDark,
            !showLeadingIcon && styles.inputWithoutLeadingIcon,
            secure && !showSecureToggle && styles.inputWithoutTrailingButton,
          ]}
        />

        {secure && showSecureToggle ? (
          <Pressable
            accessibilityLabel={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            accessibilityRole="button"
            hitSlop={4}
            onPress={() => setRevealed((current) => !current)}
            style={({ pressed }) => [
              styles.trailingButton,
              dark && styles.trailingButtonDark,
              pressed && styles.pressed,
            ]}>
            <AppIcon
              color={dark ? '#9CA3AF' : BRAND_COLORS.muted}
              name={revealed ? 'eyeOff' : 'eye'}
              size={dark ? 17 : 20}
            />
          </Pressable>
        ) : null}
      </Animated.View>

      {error ? (
        <View accessibilityRole="alert" style={styles.messageRow}>
          <AppIcon
            color={dark ? '#FCA5A5' : BRAND_COLORS.danger}
            name="warning"
            size={14}
          />
          <Text style={[styles.error, dark && styles.errorDark]}>{error}</Text>
        </View>
      ) : helper ? (
        <Text style={[styles.helper, dark && styles.helperDark]}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 7 },
  wrapperDark: { gap: 4 },
  label: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  labelDark: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  frame: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  frameDark: {
    minHeight: 40,
    borderRadius: 6,
    borderWidth: 1,
  },
  leadingIcon: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingIconDark: { width: 34 },
  input: {
    flex: 1,
    minHeight: 54,
    color: BRAND_COLORS.ink,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
    paddingRight: 10,
  },
  inputDark: {
    minHeight: 38,
    color: '#F3F4F6',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    paddingVertical: 6,
    paddingRight: 8,
  },
  inputWithoutLeadingIcon: { paddingLeft: 12 },
  inputWithoutTrailingButton: { paddingRight: 12 },
  trailingButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingButtonDark: {
    width: 40,
    height: 40,
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
  errorDark: { color: '#FCA5A5' },
  helper: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  helperDark: { color: '#9CA3AF' },
  pressed: { opacity: 0.6 },
});
