import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryStrip } from '@/components/home/category-strip';
import { HeroCarousel } from '@/components/home/hero-carousel';
import { HomeHeader } from '@/components/home/home-header';
import { ProductSection } from '@/components/home/product-section';
import { useHomeData } from '@/hooks/use-home-data';
import { resolveMediaUrl } from '@/services/api-client';

export default function HomeScreen() {
  const { data, error, loading, refreshing, refresh, reload } = useHomeData();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={refresh} refreshing={refreshing} />}
        showsVerticalScrollIndicator={false}>
        <HomeHeader />

        {loading && !data ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.stateText}>Đang tải cửa hàng...</Text>
          </View>
        ) : null}

        {error && !data ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorTitle}>Chưa kết nối được backend</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Text style={styles.hint}>Máy thật: đặt EXPO_PUBLIC_API_URL bằng IP LAN của máy chạy API, ví dụ http://192.168.1.10:5265.</Text>
            <Pressable onPress={reload} style={styles.retry}><Text style={styles.retryText}>Thử lại</Text></Pressable>
          </View>
        ) : null}

        {data ? (
          <>
            {error ? <Text style={styles.inlineError}>Không làm mới được dữ liệu: {error}</Text> : null}
            <HeroCarousel banners={data.banners} />
            <CategoryStrip categories={data.categories} />
            <ProductSection title="Hàng mới về" subtitle="Mẫu mới dành cho bé" products={data.newArrivals} />
            <ProductSection title="Bán chạy" subtitle="Những sản phẩm được yêu thích" products={data.bestSellers} />
            <ProductSection title="Đang giảm giá" subtitle="Ưu đãi nổi bật hôm nay" products={data.saleProducts} />

            {data.blocks.brandValue?.length ? (
              <View style={styles.valuesSection}>
                <Text style={styles.sectionTitle}>Mua sắm an tâm</Text>
                <View style={styles.valuesGrid}>
                  {data.blocks.brandValue.slice(0, 4).map((item) => (
                    <View key={item.id} style={styles.valueCard}>
                      <Text style={styles.valueIcon}>{item.icon || '✓'}</Text>
                      <Text style={styles.valueTitle}>{item.title || 'KaitoKid'}</Text>
                      {item.description ? <Text style={styles.valueDescription}>{item.description}</Text> : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {data.blocks.socialImage?.length ? (
              <View style={styles.socialSection}>
                <Text style={styles.sectionTitle}>KaitoKid mỗi ngày</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.socialList}>
                  {data.blocks.socialImage.slice(0, 8).map((item) => {
                    const image = resolveMediaUrl(item.image);
                    return image ? <Image key={item.id} source={{ uri: image }} contentFit="cover" transition={180} style={styles.socialImage} /> : null;
                  })}
                </ScrollView>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingBottom: 36, gap: 26 },
  stateBox: { marginHorizontal: 16, padding: 24, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', gap: 10 },
  stateText: { color: '#6B7280', textAlign: 'center', fontSize: 13, lineHeight: 19 },
  errorTitle: { color: '#111827', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  hint: { color: '#7C3AED', textAlign: 'center', fontSize: 11, lineHeight: 16 },
  retry: { marginTop: 4, backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  inlineError: { marginHorizontal: 16, color: '#B45309', fontSize: 12, backgroundColor: '#FFFBEB', padding: 10, borderRadius: 12 },
  valuesSection: { paddingHorizontal: 16, gap: 12 },
  sectionTitle: { color: '#111827', fontSize: 20, fontWeight: '900' },
  valuesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  valueCard: { width: '48%', flexGrow: 1, minHeight: 116, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, gap: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E5E7EB' },
  valueIcon: { fontSize: 22 },
  valueTitle: { color: '#111827', fontWeight: '800', fontSize: 13 },
  valueDescription: { color: '#6B7280', fontSize: 11, lineHeight: 16 },
  socialSection: { gap: 12 },
  socialList: { paddingHorizontal: 16, gap: 10 },
  socialImage: { width: 140, height: 170, borderRadius: 18, backgroundColor: '#E5E7EB' },
});
