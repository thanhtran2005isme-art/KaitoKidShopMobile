import { Platform } from 'react-native';

const POINTER_EVENTS_WARNING = 'props.pointerEvents is deprecated. Use style.pointerEvents';

type KaitoKidGlobal = typeof globalThis & {
  __kaitoKidWebWarningFilterInstalled?: boolean;
};

/**
 * React Navigation used by Expo Router can still emit the React Native Web
 * pointerEvents deprecation warning in development. The application itself
 * does not pass pointerEvents as a prop.
 *
 * Keep every other warning visible and remove this shim once Expo Router's
 * navigation dependency ships the upstream style.pointerEvents fix.
 */
export function installWebWarningFilter() {
  if (!__DEV__ || Platform.OS !== 'web') return;

  const target = globalThis as KaitoKidGlobal;
  if (target.__kaitoKidWebWarningFilterInstalled) return;
  target.__kaitoKidWebWarningFilterInstalled = true;

  const originalWarn = console.warn.bind(console);

  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && first.includes(POINTER_EVENTS_WARNING)) {
      return;
    }

    originalWarn(...args);
  };
}
