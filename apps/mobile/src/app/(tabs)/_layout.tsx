import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useNotifications } from '@/context/NotificationsContext';
import { useShopping } from '@/context/ShoppingContext';

function TabIcon({ label, color }: { label: string; color: string }) {
  return <Text style={[styles.icon, { color }]}>{label}</Text>;
}

export default function TabsLayout() {
  const { cartCount } = useShopping();
  const { unreadCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Trang chủ', tabBarIcon: ({ color }) => <TabIcon color={color} label="⌂" /> }} />
      <Tabs.Screen name="categories" options={{ title: 'Danh mục', tabBarIcon: ({ color }) => <TabIcon color={color} label="▦" /> }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Giỏ hàng',
          tabBarIcon: ({ color }) => <TabIcon color={color} label="◫" />,
          tabBarBadge:
            typeof cartCount === 'number' && cartCount > 0
              ? cartCount > 99
                ? '99+'
                : cartCount
              : undefined,
          tabBarBadgeStyle: styles.badge,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ color }) => <TabIcon color={color} label="○" />,
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: styles.badge,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { height: 66, paddingTop: 6, paddingBottom: 7, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  label: { fontSize: 10, fontWeight: '700' },
  icon: { fontSize: 22, fontWeight: '900', lineHeight: 24 },
  badge: { backgroundColor: '#DC2626', color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
});
