import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export function HomeHeader() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const submitSearch = () => {
    const q = search.trim();
    if (!q) return;
    router.push({ pathname: '/search', params: { q } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>THỜI TRANG TRẺ EM</Text>
          <Text style={styles.brand}>KaitoKid</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/cart')} style={styles.iconButton}>
          <Text style={styles.icon}>🛍️</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          enterKeyHint="search"
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
          placeholder="Tìm áo, quần, váy..."
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          style={styles.input}
          value={search}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Text style={styles.clear}>×</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
  brand: { color: '#111827', fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  icon: { fontSize: 20 },
  searchBox: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  searchIcon: { fontSize: 26, lineHeight: 28, color: '#6B7280', marginRight: 8 },
  input: { flex: 1, color: '#111827', fontSize: 15, paddingVertical: 10 },
  clear: { color: '#6B7280', fontSize: 24, lineHeight: 24 },
});
