import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AccountScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.avatar}><Text style={styles.avatarText}>K</Text></View>

        <Text style={styles.title}>Tài khoản KaitoKid</Text>
        <Text style={styles.description}>
          Đăng nhập để quản lý đơn hàng, địa chỉ nhận hàng, wishlist và nhận ưu đãi dành riêng cho bạn.
        </Text>

        <Pressable
          style={styles.loginButton}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.loginText}>Đăng nhập</Text>
        </Pressable>

        <Pressable
          style={styles.registerButton}
          onPress={() => router.push('/auth/register')}
        >
          <Text style={styles.registerText}>Tạo tài khoản mới</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF7ED' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    gap: 14,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
  },
  title: {
    color: '#111827',
    fontSize: 26,
    fontWeight: '900',
  },
  description: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 12,
  },
  loginButton: {
    width: '100%',
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  registerButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  registerText: {
    color: '#EA580C',
    fontSize: 16,
    fontWeight: '800',
  },
});
