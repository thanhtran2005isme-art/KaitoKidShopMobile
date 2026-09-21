import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await login({ email, password });
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Đăng nhập thất bại', error instanceof Error ? error.message : 'Vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={['#FFF7ED', '#FFFFFF', '#FDF2F8']} style={styles.container}>
        <View style={styles.brand}>
          <View style={styles.logo}><Text style={styles.logoText}>K</Text></View>
          <Text style={styles.title}>Chào mừng đến KaitoKid</Text>
          <Text style={styles.subtitle}>Thời trang trẻ em đáng yêu, chất lượng và an toàn</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Đăng nhập</Text>
          <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} />
          <TextInput placeholder="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Đang xử lý...' : 'Đăng nhập'}</Text>
          </TouchableOpacity>

          <Link href="/auth/register" style={styles.link}>Chưa có tài khoản? Đăng ký ngay</Link>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 30 },
  logo: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  logoText: { color: '#fff', fontSize: 42, fontWeight: '900' },
  title: { fontSize: 25, fontWeight: '900', color: '#111827', textAlign: 'center' },
  subtitle: { marginTop: 8, color: '#6B7280', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 },
  heading: { fontSize: 22, fontWeight: '800', marginBottom: 20, color: '#111827' },
  input: { height: 52, borderRadius: 16, backgroundColor: '#F9FAFB', paddingHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  button: { height: 54, borderRadius: 18, backgroundColor: '#F97316', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  link: { marginTop: 20, textAlign: 'center', color: '#EA580C', fontWeight: '700' },
});
