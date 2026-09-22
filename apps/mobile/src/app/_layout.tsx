import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/AuthContext';
import { CheckoutProvider } from '@/context/CheckoutContext';
import { ShoppingProvider } from '@/context/ShoppingContext';
import { installWebWarningFilter } from '@/utils/web-warning-filter';

installWebWarningFilter();
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ShoppingProvider>
        <CheckoutProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="product/[slug]" />
              <Stack.Screen name="wishlist" />
              <Stack.Screen name="search" />
              <Stack.Screen name="checkout/index" />
              <Stack.Screen name="checkout/address" />
              <Stack.Screen name="checkout/payment" />
              <Stack.Screen name="order-success/[orderCode]" />
            </Stack>
            <AnimatedSplashOverlay />
          </ThemeProvider>
        </CheckoutProvider>
      </ShoppingProvider>
    </AuthProvider>
  );
}
