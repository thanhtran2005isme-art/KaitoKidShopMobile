import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccountScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.avatar}><Text style={styles.avatarText}>K</Text></View>
        <Text style={styles.title}>Tài khoản KaitoKid</Text>
        <Text style={styles.description}>Màn tài khoản đã được tách khỏi Home. Phần đăng nhập JWT, địa chỉ, đơn hàng và wishlist sẽ nối trực tiếp các API backend hiện có.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 10 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  title: { color: '#111827', fontSize: 24, fontWeight: '900' },
  description: { color: '#6B7280', fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
