import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import type { ProductReview } from '@/types/shop';

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
}

export function ProductReviewsPreview({
  reviews,
  rating,
  onHelpful,
  helpfulBusyId = null,
  helpfulMarkedIds = new Set<number>(),
}: {
  reviews: ProductReview[];
  rating: number;
  onHelpful?: (reviewId: number) => void;
  helpfulBusyId?: number | null;
  helpfulMarkedIds?: Set<number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, 3);

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>ĐÁNH GIÁ</Text>
          <Text style={styles.title}>Khách hàng nói gì?</Text>
          <Text style={styles.countText}>
            {reviews.length.toLocaleString('vi-VN')} đánh giá đã duyệt
          </Text>
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
            const images = (review.images || []).slice(0, 4);
            const helpfulBusy = helpfulBusyId === review.id;
            const helpfulMarked = helpfulMarkedIds.has(review.id);

            return (
              <View key={review.id} style={styles.card}>
                <View style={styles.reviewHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(review.customerName || 'K').trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.reviewCopy}>
                    <View style={styles.nameRow}>
                      <Text style={styles.customer}>
                        {review.customerName || 'Khách hàng KaitoKid'}
                      </Text>
                      {review.isVerifiedPurchase ? (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedText}>Đã mua hàng</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.meta}>
                      {stars}{date ? ' · ' + date : ''}
                    </Text>
                  </View>
                </View>

                <Text style={styles.comment}>
                  {review.comment || 'Khách hàng chưa để lại nội dung đánh giá.'}
                </Text>

                {review.size || review.color ? (
                  <Text style={styles.variant}>
                    {review.size ? 'Size ' + review.size : ''}
                    {review.size && review.color ? ' · ' : ''}
                    {review.color || ''}
                  </Text>
                ) : null}

                {images.length > 0 ? (
                  <View style={styles.mediaRow}>
                    {images.map((url, index) => {
                      const uri = resolveMediaUrl(url);
                      if (!uri) return null;
                      return (
                        <Image
                          accessibilityLabel={
                            'Ảnh đánh giá ' + (index + 1) + ' của ' + review.customerName
                          }
                          cachePolicy="memory-disk"
                          contentFit="cover"
                          key={url + ':' + index}
                          source={{ uri }}
                          style={styles.reviewImage}
                        />
                      );
                    })}
                  </View>
                ) : null}

                {review.adminReply ? (
                  <View style={styles.replyCard}>
                    <Text style={styles.replyLabel}>PHẢN HỒI TỪ KAITOKID</Text>
                    <Text style={styles.replyText}>{review.adminReply}</Text>
                    {review.repliedAt ? (
                      <Text style={styles.replyDate}>
                        {formatReviewDate(review.repliedAt)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.helpfulRow}>
                  <Text style={styles.helpfulCount}>
                    {(review.helpfulCount || 0).toLocaleString('vi-VN')} người thấy hữu ích
                  </Text>
                  {onHelpful ? (
                    <Pressable
                      accessibilityLabel={
                        helpfulMarked
                          ? 'Đã đánh dấu đánh giá hữu ích'
                          : 'Đánh dấu đánh giá này hữu ích'
                      }
                      accessibilityRole="button"
                      accessibilityState={{ disabled: helpfulMarked || helpfulBusy }}
                      disabled={helpfulMarked || helpfulBusy}
                      onPress={() => onHelpful(review.id)}
                      style={({ pressed }) => [
                        styles.helpfulButton,
                        helpfulMarked && styles.helpfulButtonMarked,
                        pressed && styles.pressed,
                      ]}>
                      {helpfulBusy ? (
                        <ActivityIndicator
                          color={BRAND_COLORS.primaryDark}
                          size="small"
                        />
                      ) : (
                        <Text
                          style={[
                            styles.helpfulButtonText,
                            helpfulMarked && styles.helpfulButtonTextMarked,
                          ]}>
                          {helpfulMarked ? 'Đã hữu ích' : 'Hữu ích'}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}

          {reviews.length > 3 ? (
            <Pressable
              accessibilityLabel={
                expanded
                  ? 'Thu gọn danh sách đánh giá'
                  : 'Xem tất cả đánh giá đã duyệt'
              }
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpanded((current) => !current)}
              style={({ pressed }) => [
                styles.expandButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.expandText}>
                {expanded
                  ? 'Thu gọn đánh giá'
                  : 'Xem tất cả ' + reviews.length + ' đánh giá'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Chưa có đánh giá đã duyệt</Text>
          <Text style={styles.emptyText}>
            Sau khi khách đã nhận hàng và đánh giá được duyệt, nội dung sẽ xuất hiện tại đây.
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
  headingCopy: { flex: 1 },
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
  countText: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 8,
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
  ratingStar: { color: '#D97706', fontSize: 12 },
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
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  customer: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  verifiedBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  verifiedText: {
    color: BRAND_COLORS.success,
    fontSize: 7,
    fontWeight: '900',
  },
  meta: { color: '#D97706', fontSize: 10, fontWeight: '800' },
  comment: { color: '#4B5563', fontSize: 12, lineHeight: 18 },
  variant: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reviewImage: {
    width: 70,
    height: 82,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  replyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#FDFBFF',
    padding: 11,
    gap: 4,
  },
  replyLabel: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  replyText: {
    color: '#4C1D95',
    fontSize: 9,
    lineHeight: 14,
  },
  replyDate: {
    color: BRAND_COLORS.muted,
    fontSize: 7,
  },
  helpfulRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    paddingTop: 7,
  },
  helpfulCount: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
  },
  helpfulButton: {
    minWidth: 76,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  helpfulButtonMarked: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  helpfulButtonText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 8,
    fontWeight: '900',
  },
  helpfulButtonTextMarked: { color: BRAND_COLORS.success },
  expandButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
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
  pressed: { opacity: 0.78 },
});
