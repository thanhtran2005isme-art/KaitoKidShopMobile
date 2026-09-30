import { Platform } from 'react-native';

type BlurTarget = {
  blur?: () => void;
};

export function releaseWebFocus() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const activeElement = document.activeElement as BlurTarget | null;
  activeElement?.blur?.();
}
