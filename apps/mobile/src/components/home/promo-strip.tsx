import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import type { HomepageBlock } from '@/types/shop';

const DEFAULT_ITEMS: HomepageBlock[] = [
  {
    id: -1,
    type: 'brandValue',
    title: 'Freeship đơn 499K',
    description: 'Miễn phí vận chuyển toàn quốc',
    icon: 'truck',
    sortOrder: 1,
  },
  {
    id: -2,
    type: 'brandValue',
    title: 'Đổi trả 7 ngày',
    description: 'Yên tâm chọn size cho bé',
    icon: 'refresh',
    sortOrder: 2,
  },
  {
    id: -3,
    type: 'brandValue',
    title: 'Ưu tiên thoải mái',
    description: 'Thiết kế phù hợp trẻ em 0–12 tuổi',
    icon: 'shield',
    sortOrder: 3,
  },
];

function iconFor(value?: string | null) {
  const key = value?.toLowerCase();
  if (key?.includes('truck')) return '🚚';
  if (key?.includes('refresh')) return '↻';
  if (key?.includes('shield')) return '✓';
  if (key?.includes('gift')) return '🎁';
  return '✦';
}

export function PromoStrip({ items }: { items?: HomepageBlock[] }) {
  const source = items?.length ? items.slice(0, 4) : DEFAULT_ITEMS;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}>
      {source.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{iconFor(item.icon)}</Text>
          </View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.title}>
              {item.title || 'KaitoKid'}
            </Text>
            <Text numberOfLines={2} style={styles.description}>
              {item.description || 'Mua sắm an tâm cho bé'}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    gap: 10,
  },
  card: {
    width: 222,
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 20,
    fontWeight: '900',
  },
  copy: { flex: 1, gap: 3 },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  description: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 14,
  },
});
