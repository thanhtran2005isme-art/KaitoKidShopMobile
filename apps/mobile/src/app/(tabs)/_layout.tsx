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
        tabBarInactiveTintColor: '#94A3B8',
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          minHeight: 52,
          paddingVertical: 3,
        },
        tabBarLabelStyle: {
          marginTop: 1,
          fontSize: 10,
          lineHeight: 13,
          fontWeight: '800',
        },
        tabBarStyle: {
          minHeight: 64,
          paddingTop: 5,
          paddingBottom: 6,
          borderTopWidth: 1,
          borderTopColor: BRAND_COLORS.line,
          backgroundColor: BRAND_COLORS.surface,
          elevation: 8,
          shadowColor: '#0F172A',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
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
