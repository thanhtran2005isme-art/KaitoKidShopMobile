import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CartScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.icon}>🛍️</Text>
        <Text style={styles.title}>Giỏ hàng</Text>
        <Text style={styles.description}>Khung màn hình đã sẵn sàng. Bước tiếp theo sẽ nối CartController và trạng thái đăng nhập để đồng bộ giỏ hàng với backend.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 10 },
  icon: { fontSize: 48 },
  title: { color: '#111827', fontSize: 26, fontWeight: '900' },
  description: { color: '#6B7280', fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
