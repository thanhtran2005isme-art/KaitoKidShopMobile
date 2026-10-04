import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import type { Category, Product } from '@/types/shop';
import { releaseWebFocus } from '@/utils/web-focus';

const NEUTRAL_BACKGROUNDS = ['#F4F4F5', '#E4E4E7', '#F5F5F5', '#E5E7EB'];

function normalizeCategoryText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function matchesCategory(category: Category, product: Product) {
  const categoryTerms = [category.name, category.slug]
    .map(normalizeCategoryText)
    .filter(Boolean);
  const productTerms = [product.category, product.subcategory, product.name]
    .map(normalizeCategoryText)
    .filter(Boolean);

  return categoryTerms.some((categoryTerm) =>
    productTerms.some(
      (productTerm) =>
        productTerm === categoryTerm ||
        productTerm.startsWith(`${categoryTerm} `) ||
        productTerm.includes(` ${categoryTerm} `),
    ),
  );
}

function resolveCategoryMedia(category: Category, products: Product[]) {
  const categoryImage = resolveMediaUrl(category.image);
  if (categoryImage) return categoryImage;

  const representative = products.find(
    (product) => matchesCategory(category, product) && Boolean(resolveMediaUrl(product.image)),
  );
  return resolveMediaUrl(representative?.image);
}

export function CategoryStrip({
  categories,
  products = [],
}: {
  categories: Category[];
  products?: Product[];
}) {
  const router = useRouter();

  const rootCategories = categories.filter((item) => !item.parentId);
  const visible = (rootCategories.length ? rootCategories : categories).slice(0, 8);

  if (!visible.length) return null;

  const openAllCategories = () => {
    releaseWebFocus();
    router.push('/categories');
  };

  const openCategory = (category: Category) => {
    releaseWebFocus();
    router.push({ pathname: '/categories', params: { category: category.slug || category.name } });
  };

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>DANH MỤC</Text>
          <Text style={styles.heading}>Khám phá danh mục</Text>
        </View>
        <Pressable
          accessibilityLabel="Xem tất cả danh mục"
          accessibilityRole="button"
          hitSlop={8}
          onPress={openAllCategories}>
          <Text style={styles.more}>Xem tất cả</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={visible}
        horizontal
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => {
          const image = resolveCategoryMedia(item, products);

          return (
            <Pressable
              accessibilityLabel={`Mở danh mục ${item.name}`}
              accessibilityRole="button"
              onPress={() => openCategory(item)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <View style={[styles.imageWrap, { backgroundColor: NEUTRAL_BACKGROUNDS[index % NEUTRAL_BACKGROUNDS.length] }]}>
                {image ? (
                  <Image
                    accessibilityLabel={`Ảnh đại diện danh mục ${item.name}`}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    source={{ uri: image }}
                    style={styles.image}
                    transition={180}
                  />
                ) : (
                  <View accessibilityLabel={`${item.name} chưa có ảnh đại diện`} style={styles.missingMedia}>
                    <AppIcon color={BRAND_COLORS.ink} name="image" size={26} />
                  </View>
                )}
              </View>
              <Text numberOfLines={2} style={styles.label}>
                {item.name}
              </Text>
            </Pressable>
          );
        }}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 13 },
  headingRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: { flex: 1, gap: 2 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heading: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  more: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  list: { paddingHorizontal: 16, gap: 14 },
  item: {
    width: 82,
    alignItems: 'center',
    gap: 8,
  },
  pressed: { opacity: 0.72 },
  imageWrap: {
    width: 74,
    height: 74,
    borderRadius: 23,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  image: { width: '100%', height: '100%' },
  missingMedia: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#374151',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    fontWeight: '700',
  },
});
