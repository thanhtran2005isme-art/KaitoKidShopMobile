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
import { AppIcon } from '@/components/ui/app-icon';
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
          <View accessibilityRole="alert" style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <AppIcon color={BRAND_COLORS.danger} name="warning" size={24} />
            </View>
            <Text style={styles.errorTitle}>Chưa tải được cửa hàng</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Text style={styles.hint}>
              Kiểm tra API KaitoKid cổng 5300 và kết nối mạng nếu đang dùng điện thoại thật.
            </Text>
            <Pressable
              accessibilityLabel="Thử tải lại cửa hàng"
              accessibilityRole="button"
              onPress={reload}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
              <AppIcon color={BRAND_COLORS.surface} name="refresh" size={18} />
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        {data ? (
          <>
            {error ? (
              <View accessibilityRole="alert" style={styles.inlineError}>
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
              subtitle="Thiết kế mới cho mọi phong cách"
              title="Hàng mới về"
            />

            <LookbookSection lookbooks={data.featuredLookbooks} />

            <ProductSection
              badge="HOT"
              badgeTone="hot"
              products={data.bestSellers}
              subtitle="Sản phẩm được khách hàng yêu thích"
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
              subtitle="Ưu đãi nổi bật hôm nay"
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
                          accessibilityLabel={item.title || `Hình ảnh ${BRAND.name}`}
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
                <Text style={styles.brandFooterTitle}>Phong cách mỗi ngày cùng {BRAND.name}</Text>
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
    borderRadius: 20,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    maxWidth: 420,
    color: BRAND_COLORS.muted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  errorTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  hint: {
    maxWidth: 420,
    color: BRAND_COLORS.primaryDark,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  retry: {
    minHeight: 46,
    marginTop: 4,
    backgroundColor: BRAND_COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  pressed: { opacity: 0.72 },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
    lineHeight: 19,
  },
  inlineError: {
    marginHorizontal: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  inlineErrorText: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  socialSection: { gap: 13 },
  sectionHeading: {
    paddingHorizontal: 16,
  },
  sectionEyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  sectionTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  socialList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  socialCard: {
    width: 140,
    height: 174,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  socialImage: {
    width: '100%',
    height: '100%',
  },
  brandFooter: {
    marginHorizontal: 16,
    borderRadius: 20,
    backgroundColor: BRAND_COLORS.primaryDark,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
    lineHeight: 20,
    fontWeight: '900',
  },
  brandFooterText: {
    color: '#DDD6FE',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});
