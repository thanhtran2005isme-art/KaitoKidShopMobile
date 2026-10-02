import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type AnimatedLogoutButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
  accessibilityLabel?: string;
};

const BUTTON_WIDTH = 150;
const IDLE_ROTATION = 5;
const PRESSED_TRANSLATE_Y = 5;
const IDLE_PADDING_BOTTOM = 3;
const DURATION = 300;
const SPRINGY_EASING = Easing.bezier(0.175, 0.885, 0.32, 1.275);

export function AnimatedLogoutButton({
  onPress,
  disabled = false,
  label = 'Logout',
  accessibilityLabel = 'Logout',
}: AnimatedLogoutButtonProps) {
  const pressed = useSharedValue(0);

  const buttonStyle = useAnimatedStyle(() => {
    const progress = pressed.value;

    return {
      paddingBottom: interpolate(
        progress,
        [0, 1],
        [IDLE_PADDING_BOTTOM, 0],
      ),
      transform: [
        {
          translateY: interpolate(
            progress,
            [0, 1],
            [0, PRESSED_TRANSLATE_Y],
          ),
        },
        {
          rotate: `${interpolate(progress, [0, 1], [IDLE_ROTATION, 0])}deg`,
        },
      ],
    };
  });

  const setPressed = (next: 0 | 1) => {
    pressed.value = withTiming(next, {
      duration: DURATION,
      easing: SPRINGY_EASING,
    });
  };

  return (
    <View style={styles.layoutBox}>
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
          onPress={onPress}
          onPressIn={() => setPressed(1)}
          onPressOut={() => setPressed(0)}
          style={styles.pressable}>
          <View style={styles.face}>
            <Text numberOfLines={1} style={styles.text}>
              {label}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layoutBox: {
    width: BUTTON_WIDTH + 16,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  button: {
    width: BUTTON_WIDTH,
    padding: 0,
    borderRadius: 5,
    backgroundColor: '#5CDB95',
    shadowColor: '#494A4B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  pressable: {
    width: '100%',
    borderRadius: 5,
  },
  face: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#494A4B',
    backgroundColor: '#F1F5F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#111827',
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'Marker Felt',
      android: 'cursive',
      default: 'cursive',
    }),
  },
  disabled: {
    opacity: 0.55,
  },
});
