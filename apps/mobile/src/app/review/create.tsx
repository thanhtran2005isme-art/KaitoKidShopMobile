import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { resolveMediaUrl } from '@/services/api-client';
import { ordersApi } from '@/services/orders.api';
import { reviewsApi } from '@/services/reviews.api';
import type { OrderItem } from '@/types/checkout';
import {
  appendImageToFormData,
  isSupportedUploadImage,
} from '@/utils/media-upload';

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function CreateReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId?: string | string[];
    productId?: string | string[];
    size?: string | string[];
    color?: string | string[];
  }>();
  const orderId = Number(firstParam(params.orderId));
  const productId = Number(firstParam(params.productId));
  const requestedSize = firstParam(params.size) || '';
  const requestedColor = firstParam(params.color) || '';

  const { token, loading: authLoading } = useAuth();
  const [item, setItem] = useState<OrderItem | null>(null);
  const [orderCode, setOrderCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!token || !Number.isInteger(orderId) || !Number.isInteger(productId)) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void ordersApi
      .getOrder(token, orderId)
      .then((order) => {
        if (!active) return;
        if (order.status !== 'completed') {
          throw new Error('Chỉ có thể đánh giá sau khi đơn hàng đã hoàn tất.');
        }

        const purchased = order.items.find(
          (candidate) =>
            candidate.productId === productId &&
            (!requestedSize || candidate.size === requestedSize) &&
            (!requestedColor || candidate.color === requestedColor),
        );

        if (!purchased) {
          throw new Error('Không tìm thấy đúng sản phẩm/biến thể trong đơn hàng này.');
        }
        if (purchased.hasReviewed) {
          throw new Error('Bạn đã đánh giá sản phẩm này trong đơn hàng rồi.');
        }

        setOrderCode(order.orderCode);
        setItem(purchased);
      })
      .catch((loadError) => {
        if (active) {
          setError(messageFrom(loadError, 'Không thể mở form đánh giá.'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    authLoading,
    orderId,
    productId,
    requestedColor,
    requestedSize,
    token,
  ]);

  const pickImages = async () => {
    if (submitting || assets.length >= 4) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 4 - assets.length,
      quality: 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });

    if (result.canceled) return;

    const tooLarge = result.assets.find(
      (asset) => typeof asset.fileSize === 'number' && asset.fileSize > 5 * 1024 * 1024,
    );
    if (tooLarge) {
      Alert.alert('Ảnh quá lớn', 'Mỗi ảnh đánh giá tối đa 5MB.');
      return;
    }

    const unsupported = result.assets.find(
      (asset) => !isSupportedUploadImage(asset),
    );
    if (unsupported) {
      Alert.alert(
        'Định dạng ảnh chưa hỗ trợ',
        'KaitoKid nhận JPEG, PNG hoặc WebP. Hãy chọn ảnh khác.',
      );
      return;
    }

    setAssets((current) => {
      const byUri = new Map(current.map((asset) => [asset.uri, asset]));
      result.assets.forEach((asset) => byUri.set(asset.uri, asset));
      return Array.from(byUri.values()).slice(0, 4);
    });
  };

  const submit = async () => {
    if (!token || !item || submitting || submitLock.current) return;

    const trimmed = comment.trim();
    if (rating < 1 || rating > 5) {
      setError('Vui lòng chọn số sao từ 1 đến 5.');
      return;
    }
    if (trimmed.length < 3) {
      setError('Vui lòng chia sẻ ít nhất 3 ký tự về trải nghiệm sản phẩm.');
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setError(null);

    try {
      let imageUrls: string[] = [];

      if (assets.length > 0) {
        const formData = new FormData();
        assets.forEach((asset) =>
          appendImageToFormData(formData, 'files', asset, 'review'),
        );
        const uploaded = await reviewsApi.uploadMedia(token, formData);
        imageUrls = uploaded.urls || [];
      }

      await reviewsApi.create(token, {
        productId: item.productId,
        orderId,
        rating,
        comment: trimmed,
        images: imageUrls,
        size: item.size,
        color: item.color,
      });

      Alert.alert(
        'Đã gửi đánh giá',
        'Cảm ơn bạn. Đánh giá đã được ghi nhận và sẽ hiển thị công khai sau khi được duyệt.',
        [
          {
            text: 'Về đơn hàng',
            onPress: () =>
              router.replace({
                pathname: '/orders/[id]',
                params: { id: String(orderId) },
              }),
          },
        ],
      );
    } catch (submitError) {
      setError(messageFrom(submitError, 'Không thể gửi đánh giá.'));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang kiểm tra đơn hàng</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Bạn cần đăng nhập</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/auth/login')}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Chưa thể viết đánh giá</Text>
          <Text style={styles.stateText}>
            {error || 'Sản phẩm hoặc đơn hàng không hợp lệ.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Number.isInteger(orderId)
                ? router.replace({
                    pathname: '/orders/[id]',
                    params: { id: String(orderId) },
                  })
                : router.replace('/orders')
            }
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Quay lại đơn hàng</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Quay lại đơn hàng"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>ĐÁNH GIÁ ĐƠN {orderCode}</Text>
              <Text style={styles.title}>Chia sẻ trải nghiệm</Text>
              <Text style={styles.subtitle}>
                Đánh giá đúng sản phẩm và biến thể bạn đã nhận.
              </Text>
            </View>
          </View>

          <View style={styles.productCard}>
            <Image
              accessibilityLabel={item.productName}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={resolveMediaUrl(item.productImage)}
              style={styles.productImage}
            />
            <View style={styles.productCopy}>
              <Text style={styles.productName}>{item.productName}</Text>
              <Text style={styles.productMeta}>
                {'Size ' + item.size + ' · ' + item.color}
              </Text>
              <Text style={styles.verified}>✓ Mua hàng đã xác minh</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Mức độ hài lòng *</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  accessibilityLabel={value + ' sao'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: rating === value }}
                  key={value}
                  onPress={() => setRating(value)}
                  style={({ pressed }) => [
                    styles.starButton,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.star,
                      value <= rating && styles.starActive,
                    ]}>
                    ★
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.ratingHint}>
              {rating === 5
                ? 'Rất hài lòng'
                : rating === 4
                  ? 'Hài lòng'
                  : rating === 3
                    ? 'Bình thường'
                    : rating === 2
                      ? 'Chưa hài lòng'
                      : 'Không hài lòng'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Nội dung đánh giá *</Text>
            <TextInput
              accessibilityLabel="Nội dung đánh giá"
              maxLength={2000}
              multiline
              onChangeText={(value) => {
                setComment(value);
                if (error) setError(null);
              }}
              placeholder="Ví dụ: chất vải mềm, bé mặc thoải mái, size vừa..."
              placeholderTextColor="#9CA3AF"
              style={styles.commentInput}
              textAlignVertical="top"
              value={comment}
            />
            <Text style={styles.counter}>{comment.length}/2000</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.mediaHeader}>
              <View style={styles.mediaCopy}>
                <Text style={styles.label}>Ảnh thực tế</Text>
                <Text style={styles.helper}>
                  Tối đa 4 ảnh · JPEG/PNG/WebP · mỗi ảnh tối đa 5MB
                </Text>
              </View>
              <Text style={styles.mediaCount}>{assets.length}/4</Text>
            </View>

            {assets.length > 0 ? (
              <View style={styles.previewGrid}>
                {assets.map((asset) => (
                  <View key={asset.uri} style={styles.previewCard}>
                    <Image
                      contentFit="cover"
                      source={{ uri: asset.uri }}
                      style={styles.previewImage}
                    />
                    <Pressable
                      accessibilityLabel="Xóa ảnh khỏi đánh giá"
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() =>
                        setAssets((current) =>
                          current.filter((item) => item.uri !== asset.uri),
                        )
                      }
                      style={styles.removeImageButton}>
                      <Text style={styles.removeImageText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              accessibilityLabel="Chọn ảnh đánh giá từ thư viện"
              accessibilityRole="button"
              disabled={assets.length >= 4 || submitting}
              onPress={() => void pickImages()}
              style={({ pressed }) => [
                styles.imageButton,
                pressed && styles.pressed,
                (assets.length >= 4 || submitting) && styles.disabled,
              ]}>
              <Text style={styles.imageButtonText}>
                {assets.length >= 4 ? 'Đã chọn đủ 4 ảnh' : 'Chọn ảnh từ thư viện'}
              </Text>
            </Pressable>
          </View>

          {error ? (
            <View accessibilityRole="alert" style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="Gửi đánh giá"
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.pressed,
              submitting && styles.disabled,
            ]}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Gửi đánh giá</Text>
            )}
          </Pressable>

          <Text style={styles.moderationNote}>
            Đánh giá mới được lưu ở trạng thái chờ duyệt. KaitoKid không tự công khai nội dung trước khi backend duyệt.
          </Text>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 13,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: BRAND_COLORS.ink, fontSize: 30, lineHeight: 32 },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: { color: BRAND_COLORS.ink, fontSize: 23, fontWeight: '900' },
  subtitle: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
  },
  productCard: {
    minHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productImage: {
    width: 66,
    height: 82,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
  },
  productCopy: { flex: 1 },
  productName: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  productMeta: {
    marginTop: 4,
    color: BRAND_COLORS.muted,
    fontSize: 9,
  },
  verified: {
    marginTop: 6,
    color: BRAND_COLORS.success,
    fontSize: 8,
    fontWeight: '900',
  },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 14,
    gap: 9,
  },
  label: { color: BRAND_COLORS.ink, fontSize: 11, fontWeight: '900' },
  helper: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
  },
  stars: { flexDirection: 'row', gap: 6 },
  starButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: { color: '#D1D5DB', fontSize: 25, lineHeight: 28 },
  starActive: { color: '#F59E0B' },
  ratingHint: { color: '#92400E', fontSize: 9, fontWeight: '800' },
  commentInput: {
    minHeight: 130,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#F9FAFB',
    color: BRAND_COLORS.ink,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 11,
    lineHeight: 17,
  },
  counter: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    textAlign: 'right',
  },
  mediaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  mediaCopy: { flex: 1 },
  mediaCount: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
  },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewCard: {
    width: 82,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  previewImage: { width: '100%', height: '100%' },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(17,24,39,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
  },
  imageButton: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  imageButtonText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
  },
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 12,
  },
  errorText: { color: '#B91C1C', fontSize: 9, lineHeight: 14, fontWeight: '800' },
  submitButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  moderationNote: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  centerState: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
  },
  stateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    maxWidth: 380,
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  bottomSpace: { height: 30 },
});
