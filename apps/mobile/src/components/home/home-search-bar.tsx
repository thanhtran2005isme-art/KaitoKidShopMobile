import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND, BRAND_COLORS } from '@/constants/brand';

// Trang chủ chỉ là điểm vào. Ô nhập và bộ lọc thật thuộc màn /search để tránh
// phải nhập lại từ khóa khi điều hướng và hỗ trợ cùng trải nghiệm Expo Web/native.
export function HomeSearchBar() {
  const router = useRouter();
  const openSearch = () => router.push('/search');

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel="Tìm kiếm sản phẩm"
        accessibilityHint="Mở màn hình tìm sản phẩm KaitoKid"
        accessibilityRole="button"
        onPress={openSearch}
        style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
        <AppIcon color={BRAND_COLORS.muted} name="search" size={22} />
        <Text numberOfLines={1} style={styles.placeholder}>{BRAND.searchPlaceholder}</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Tìm kiếm và lọc sản phẩm"
        accessibilityRole="button"
        onPress={openSearch}
        style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}>
        <AppIcon color={BRAND_COLORS.surface} name="filter" size={22} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 54,
  },
  searchButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  placeholder: {
    flex: 1,
    color: BRAND_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});
