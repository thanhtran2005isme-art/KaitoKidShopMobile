import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/AuthContext';
import { ShoppingProvider } from '@/context/ShoppingContext';
import { installWebWarningFilter } from '@/utils/web-warning-filter';

installWebWarningFilter();
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ShoppingProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="product/[slug]" />
            <Stack.Screen name="wishlist" />
            <Stack.Screen name="search" />
          </Stack>
          <AnimatedSplashOverlay />
        </ThemeProvider>
      </ShoppingProvider>
    </AuthProvider>
  );
}
