import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon } from '@/components/ui/app-icon';

type AnimatedLogoutButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
  accessibilityLabel?: string;
};

const COLLAPSED_WIDTH = 45;
const EXPANDED_WIDTH = 125;
const HEIGHT = 45;
const DURATION = 300;
const EXPANDED_SIGN_WIDTH = EXPANDED_WIDTH * 0.3 + 20;
const EXPANDED_TEXT_WIDTH = EXPANDED_WIDTH * 0.7 + 10;

export function AnimatedLogoutButton({
  onPress,
  disabled = false,
  label = 'Logout',
  accessibilityLabel = 'Logout',
}: AnimatedLogoutButtonProps) {
  const expanded = useSharedValue(0);
  const pressed = useSharedValue(0);
  const hovering = useRef(false);

  const expand = () => {
    if (disabled) return;
    expanded.value = withTiming(1, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    });
  };

  const collapse = (delay = 0) => {
    expanded.value = withDelay(
      delay,
      withTiming(0, {
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
      }),
    );
  };

  const buttonStyle = useAnimatedStyle(() => ({
    width: interpolate(expanded.value, [0, 1], [COLLAPSED_WIDTH, EXPANDED_WIDTH]),
    borderRadius: interpolate(expanded.value, [0, 1], [HEIGHT / 2, 40]),
    transform: [
      { translateX: interpolate(pressed.value, [0, 1], [0, 2]) },
      { translateY: interpolate(pressed.value, [0, 1], [0, 2]) },
    ],
  }));

  const signStyle = useAnimatedStyle(() => ({
    width: interpolate(expanded.value, [0, 1], [COLLAPSED_WIDTH, EXPANDED_SIGN_WIDTH]),
    paddingLeft: interpolate(expanded.value, [0, 1], [0, 20]),
  }));

  const textStyle = useAnimatedStyle(() => ({
    width: interpolate(expanded.value, [0, 1], [0, EXPANDED_TEXT_WIDTH]),
    opacity: expanded.value,
    paddingRight: interpolate(expanded.value, [0, 1], [0, 10]),
  }));

  return (
    <Animated.View
      style={[
        styles.button,
        buttonStyle,
        disabled && styles.disabled,
      ]}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onHoverIn={() => {
          hovering.current = true;
          expand();
        }}
        onHoverOut={() => {
          hovering.current = false;
          collapse();
        }}
        onPress={onPress}
        onPressIn={() => {
          expand();
          pressed.value = withTiming(1, { duration: 80 });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, { duration: 100 });
          if (!hovering.current) collapse(120);
        }}
        style={styles.pressable}>
        <Animated.View style={[styles.sign, signStyle]}>
          <View style={styles.iconBox}>
            <AppIcon color="#FFFFFF" name="logout" size={17} />
          </View>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.textWrap, textStyle]}>
          <Text numberOfLines={1} style={styles.text}>
            {label}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    height: HEIGHT,
    overflow: 'hidden',
    backgroundColor: 'rgb(255, 65, 65)',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.199,
    shadowRadius: 10,
    elevation: 5,
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    overflow: 'hidden',
  },
  sign: {
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.55,
  },
});
