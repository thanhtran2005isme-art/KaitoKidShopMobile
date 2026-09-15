import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { register } from '../../services/auth.service';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    try {
      setLoading(true);
      await register({ fullName, email, phoneNumber, password });
      Alert.alert('Thành công', 'Đăng ký thành công');
      router.replace('/auth/login');
    } catch (error) {
      Alert.alert('Đăng ký thất bại', error instanceof Error ? error.message : 'Vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#FFF7ED', '#FFFFFF', '#FDF2F8']} style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.title}>Tạo tài khoản KaitoKid</Text>
          <Text style={styles.subtitle}>Gia nhập thế giới thời trang trẻ em dễ thương</Text>
        </View>

        <View style={styles.card}>
          <TextInput placeholder="Họ và tên" value={fullName} onChangeText={setFullName} style={styles.input} />
          <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
          <TextInput placeholder="Số điện thoại" value={phoneNumber} onChangeText={setPhoneNumber} style={styles.input} />
          <TextInput placeholder="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Đang xử lý...' : 'Đăng ký'}</Text>
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
