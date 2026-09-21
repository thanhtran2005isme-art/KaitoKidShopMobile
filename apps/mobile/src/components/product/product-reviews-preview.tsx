import { StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import type { ProductReview } from '@/types/shop';

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

export function ProductReviewsPreview({
  reviews,
  rating,
}: {
  reviews: ProductReview[];
  rating: number;
}) {
  const visible = reviews.slice(0, 3);

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>ĐÁNH GIÁ</Text>
          <Text style={styles.title}>Khách hàng nói gì?</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingStar}>★</Text>
          <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
        </View>
      </View>

      {visible.length ? (
        <View style={styles.list}>
          {visible.map((review) => {
            const date = formatReviewDate(review.createdAt);
            const stars = '★'.repeat(Math.max(0, Math.min(5, review.rating)));

            return (
              <View key={review.id} style={styles.card}>
                <View style={styles.reviewHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(review.customerName || 'K').trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.reviewCopy}>
                    <Text style={styles.customer}>
                      {review.customerName || 'Khách hàng KaitoKid'}
                    </Text>
                    <Text style={styles.meta}>
                      {stars}{date ? ` · ${date}` : ''}
                    </Text>
                  </View>
                </View>

                <Text style={styles.comment}>
                  {review.comment || 'Khách hàng chưa để lại nội dung đánh giá.'}
                </Text>

                {review.size || review.color ? (
                  <Text style={styles.variant}>
                    {review.size ? `Size ${review.size}` : ''}
                    {review.size && review.color ? ' · ' : ''}
                    {review.color || ''}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Chưa có đánh giá chi tiết</Text>
          <Text style={styles.emptyText}>
            Điểm đánh giá tổng quan vẫn được hiển thị từ dữ liệu sản phẩm.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 13 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },
  ratingBadge: {
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingStar: {
    color: '#D97706',
    fontSize: 12,
  },
  ratingValue: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '900',
  },
  list: { gap: 10 },
  card: {
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    padding: 14,
    gap: 9,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  reviewCopy: { flex: 1, gap: 2 },
  customer: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  meta: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
  },
  comment: {
    color: '#4B5563',
    fontSize: 12,
    lineHeight: 18,
  },
  variant: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  empty: {
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    padding: 16,
    gap: 4,
  },
  emptyTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyText: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
  },
});
