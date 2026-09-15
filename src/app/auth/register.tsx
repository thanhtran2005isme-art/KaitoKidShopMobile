import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#FFF7ED', '#FFFFFF', '#FDF2F8']} style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.title}>Tạo tài khoản KaitoKid</Text>
          <Text style={styles.subtitle}>Gia nhập thế giới thời trang trẻ em dễ thương</Text>
        </View>

        <View style={styles.card}>
          <TextInput placeholder="Họ và tên" style={styles.input} />
          <TextInput placeholder="Email" style={styles.input} />
          <TextInput placeholder="Số điện thoại" style={styles.input} />
          <TextInput placeholder="Mật khẩu" secureTextEntry style={styles.input} />

          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Đăng ký</Text>
          </TouchableOpacity>

          <Link href="/auth/login" style={styles.link}>Đã có tài khoản? Đăng nhập</Link>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontWeight: '900', color: '#111827' },
  subtitle: { marginTop: 8, color: '#6B7280' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  input: { height: 52, borderRadius: 16, backgroundColor: '#F9FAFB', paddingHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  button: { height: 54, borderRadius: 18, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  link: { marginTop: 20, textAlign: 'center', color: '#EA580C', fontWeight: '700' },
});
