import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

const SYMBOLS = {
  user: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  heart: { ios: 'heart', android: 'favorite_border', web: 'favorite_border' },
  heartFilled: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  bag: { ios: 'bag', android: 'shopping_bag', web: 'shopping_bag' },
  cart: { ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  arrowRight: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  arrowLeft: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  home: { ios: 'house', android: 'home', web: 'home' },
  grid: { ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  truck: { ios: 'shippingbox', android: 'local_shipping', web: 'local_shipping' },
  return: {
    ios: 'arrow.triangle.2.circlepath',
    android: 'published_with_changes',
    web: 'published_with_changes',
  },
  shield: { ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  clothing: { ios: 'tshirt', android: 'checkroom', web: 'checkroom' },
  image: { ios: 'photo', android: 'image', web: 'image' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  mail: { ios: 'envelope', android: 'mail', web: 'mail' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  phone: { ios: 'phone', android: 'phone', web: 'phone' },
  gift: { ios: 'gift', android: 'redeem', web: 'redeem' },
  warning: {
    ios: 'exclamationmark.triangle',
    android: 'warning',
    web: 'warning',
  },
} as const;

export type AppIconName = keyof typeof SYMBOLS;

export function AppIcon({
  name,
  size = 22,
  color = '#111827',
}: {
  name: AppIconName;
  size?: number;
  color?: ColorValue;
}) {
  return (
    <SymbolView
      name={SYMBOLS[name] as SymbolViewProps['name']}
      size={size}
      tintColor={color}
    />
  );
}
