import { Image } from 'expo-image';
import { useCallback } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryStrip } from '@/components/home/category-strip';
import { CollectionSection } from '@/components/home/collection-section';
import { DiscoveryTiles } from '@/components/home/discovery-tiles';
import { HeroCarousel } from '@/components/home/hero-carousel';
import { HomeHeader } from '@/components/home/home-header';
import { HomeSkeleton } from '@/components/home/home-skeleton';
import { LookbookSection } from '@/components/home/lookbook-section';
import { ProductSection } from '@/components/home/product-section';
import { PromoStrip } from '@/components/home/promo-strip';
import { BRAND, BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { useHomeData } from '@/hooks/use-home-data';
import { resolveMediaUrl } from '@/services/api-client';

export default function HomeScreen() {
  const { user, token } = useAuth();
  const { cartCount, refreshCartCount, refreshWishlist } = useShopping();
  const { data, error, loading, refreshing, refresh, reload } = useHomeData(token);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshCartCount(), refreshWishlist()]);
  }, [refresh, refreshCartCount, refreshWishlist]);

  const userName =
    user?.name ||
    user?.fullName ||
    user?.hoTen ||
    user?.displayName ||
    null;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[BRAND_COLORS.primary]}
            onRefresh={() => void handleRefresh()}
            refreshing={refreshing}
            tintColor={BRAND_COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}>
        <HomeHeader cartCount={cartCount} userName={userName} />

        {loading && !data ? <HomeSkeleton /> : null}

        {error && !data ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <Text style={styles.errorIconText}>!</Text>
            </View>
            <Text style={styles.errorTitle}>Chưa tải được cửa hàng</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Text style={styles.hint}>
              Kiểm tra API.Customer cổng 5265 và kết nối LAN nếu đang dùng điện thoại thật.
            </Text>
            <Pressable onPress={reload} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        {data ? (
          <>
            {error ? (
              <View style={styles.inlineError}>
                <Text style={styles.inlineErrorText}>Không làm mới được một phần dữ liệu: {error}</Text>
              </View>
            ) : null}

            <HeroCarousel banners={data.banners} />

            <PromoStrip items={data.blocks.brandValue} />

            <CategoryStrip categories={data.categories} />

            <DiscoveryTiles items={data.blocks.categoryTile} />

            <CollectionSection collections={data.featuredCollections} />

            <ProductSection
              badge="MỚI"
              badgeTone="primary"
              products={data.newArrivals}
              subtitle="Mẫu mới cho bé 0–12 tuổi"
              title="Hàng mới về"
            />

            <LookbookSection lookbooks={data.featuredLookbooks} />

            <ProductSection
              badge="HOT"
              badgeTone="hot"
              products={data.bestSellers}
              subtitle="Những mẫu được phụ huynh yêu thích"
              title="Bán chạy"
            />

            <ProductSection
              badge={data.recommendationPersonalized ? 'CHO BẠN' : 'KHÁM PHÁ'}
              badgeTone="primary"
              products={data.recommendations}
              subtitle={
                data.recommendationPersonalized
                  ? 'Dựa trên sản phẩm bạn đã lưu và mua'
                  : 'Sản phẩm nổi bật và mẫu mới từ KaitoKid'
              }
              title={data.recommendationPersonalized ? 'Gợi ý cho bạn' : 'Khám phá thêm'}
            />

            <ProductSection
              badge="SALE"
              badgeTone="sale"
              products={data.saleProducts}
              subtitle="Ưu đãi nổi bật cho tủ đồ của bé"
              title="Đang giảm giá"
            />

            {data.blocks.socialImage?.length ? (
              <View style={styles.socialSection}>
                <View style={styles.sectionHeading}>
                  <View>
                    <Text style={styles.sectionEyebrow}>CẢM HỨNG MỖI NGÀY</Text>
                    <Text style={styles.sectionTitle}>{BRAND.name} mỗi ngày</Text>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.socialList}>
                  {data.blocks.socialImage.slice(0, 8).map((item) => {
                    const image = resolveMediaUrl(item.image);
                    return image ? (
                      <View key={item.id} style={styles.socialCard}>
                        <Image
                          source={{ uri: image }}
                          contentFit="cover"
                          transition={180}
                          style={styles.socialImage}
                        />
                      </View>
                    ) : null;
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.brandFooter}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>K</Text>
              </View>
              <View style={styles.brandFooterCopy}>
                <Text style={styles.brandFooterTitle}>Lớn lên thật vui cùng {BRAND.name}</Text>
                <Text style={styles.brandFooterText}>{BRAND.promise}</Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  content: {
    paddingBottom: 40,
    gap: 26,
  },
  errorCard: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  errorIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconText: {
    color: BRAND_COLORS.danger,
    fontSize: 23,
    fontWeight: '900',
  },
  stateText: {
    color: BRAND_COLORS.muted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  errorTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  hint: {
    color: BRAND_COLORS.primary,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 15,
  },
  retry: {
    marginTop: 4,
    backgroundColor: BRAND_COLORS.ink,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  pressed: { opacity: 0.75 },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  inlineError: {
    marginHorizontal: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FDE68A',
  },
  inlineErrorText: {
    color: '#92400E',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
  },
  socialSection: { gap: 13 },
  sectionHeading: {
    paddingHorizontal: 16,
  },
  sectionEyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  sectionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  socialList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  socialCard: {
    width: 140,
    height: 174,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  socialImage: {
    width: '100%',
    height: '100%',
  },
  brandFooter: {
    marginHorizontal: 16,
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.primaryDark,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: BRAND_COLORS.primary,
    fontSize: 27,
    fontWeight: '900',
  },
  brandFooterCopy: {
    flex: 1,
    gap: 3,
  },
  brandFooterTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  brandFooterText: {
    color: '#DDD6FE',
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
  },
});
