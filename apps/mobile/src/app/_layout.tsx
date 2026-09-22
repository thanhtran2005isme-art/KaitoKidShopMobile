import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/AuthContext';
import { CheckoutProvider } from '@/context/CheckoutContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { ShoppingProvider } from '@/context/ShoppingContext';
import { installWebWarningFilter } from '@/utils/web-warning-filter';

installWebWarningFilter();
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <NotificationsProvider>
        <ShoppingProvider>
          <CheckoutProvider>
            <ThemeProvider
              value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="product/[slug]" />
              <Stack.Screen name="wishlist" />
              <Stack.Screen name="search" />
              <Stack.Screen name="checkout/index" />
              <Stack.Screen name="checkout/address" />
              <Stack.Screen name="checkout/payment" />
              <Stack.Screen name="order-success/[orderCode]" />
              <Stack.Screen name="orders/index" />
              <Stack.Screen name="orders/[id]" />
              <Stack.Screen name="orders/[id]/tracking" />
              <Stack.Screen name="review/create" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="account/profile" />
              <Stack.Screen name="account/points" />
              <Stack.Screen name="account/vouchers" />
              <Stack.Screen name="account/delete" />
              </Stack>
              <AnimatedSplashOverlay />
            </ThemeProvider>
          </CheckoutProvider>
        </ShoppingProvider>
      </NotificationsProvider>
    </AuthProvider>
  );
}
