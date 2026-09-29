import { Tabs } from 'expo-router';

import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';
import { useNotifications } from '@/context/NotificationsContext';
import { useShopping } from '@/context/ShoppingContext';

function TabIcon({ name, color }: { name: AppIconName; color: string }) {
  return <AppIcon color={color} name={name} size={23} />;
}

export default function TabsLayout() {
  const { cartCount } = useShopping();
  const { unreadCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND_COLORS.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        tabBarStyle: {
          height: 66,
          paddingTop: 6,
          paddingBottom: 7,
          borderTopColor: BRAND_COLORS.line,
          backgroundColor: BRAND_COLORS.surface,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="home" />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: 'Danh mục',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="grid" />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Giỏ hàng',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="cart" />,
          tabBarBadge:
            typeof cartCount === 'number' && cartCount > 0
              ? cartCount > 99
                ? '99+'
                : cartCount
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: BRAND_COLORS.danger,
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: '900',
          },
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ color }) => <TabIcon color={color} name="user" />,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: BRAND_COLORS.danger,
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: '900',
          },
        }}
      />
    </Tabs>
  );
}
