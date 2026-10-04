import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';

import { AuthFashionHero } from '@/components/auth/auth-fashion-hero';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { AppIcon, type AppIconName } from '@/components/ui/app-icon';
import { BRAND, BRAND_COLORS } from '@/constants/brand';

type GuestAccountExperienceProps = {
  onLogin: () => void;
  onRegister: () => void;
};

const BENEFITS: {
  icon: AppIconName;
  title: string;
  description: string;
  background: string;
  color: string;
}[] = [
  {
    icon: 'bag',
    title: 'Theo dõi đơn hàng',
    description: 'Xem trạng thái xử lý, vận chuyển và lịch sử mua sắm.',
    background: '#F3F4F6',
    color: '#111111',
  },
  {
    icon: 'heart',
    title: 'Đồng bộ yêu thích',
    description: 'Lưu lại sản phẩm bạn quan tâm và quay lại bất cứ lúc nào.',
    background: '#F3F4F6',
    color: '#111111',
  },
  {
    icon: 'gift',
    title: 'Điểm & voucher',
    description: 'Theo dõi quyền lợi thành viên và voucher đang sử dụng.',
    background: '#F3F4F6',
    color: '#111111',
  },
];

export function GuestAccountExperience({
  onLogin,
  onRegister,
}: GuestAccountExperienceProps) {
  const reducedMotion = useReducedMotion();

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <AuthFashionHero
          eyebrow="KAITOKID MEMBER"
          height={318}
          subtitle={BRAND.promise}
          title={'Phong cách của bạn,\nquyền lợi của bạn'}
        />

        <Animated.View
          entering={
            reducedMotion
              ? undefined
              : FadeInUp.duration(300).delay(70)
          }
          style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.headingBlock}>
            <Text style={styles.kicker}>MEMBER EXPERIENCE</Text>
            <Text style={styles.title}>Tài khoản KaitoKid</Text>
            <Text style={styles.description}>
              Mọi quyền lợi mua sắm, đơn hàng và sản phẩm yêu thích của bạn ở cùng một nơi.
            </Text>
          </View>

          <View style={styles.benefits}>
            {BENEFITS.map((benefit) => (
              <View key={benefit.title} style={styles.benefitCard}>
                <View
                  style={[
                    styles.benefitIcon,
                    { backgroundColor: benefit.background },
                  ]}>
                  <AppIcon
                    color={benefit.color}
                    name={benefit.icon}
                    size={22}
                  />
                </View>
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDescription}>
                    {benefit.description}
                  </Text>
                </View>
                <AppIcon
                  color={BRAND_COLORS.muted}
                  name="chevronRight"
                  size={20}
                />
              </View>
            ))}
          </View>

          <View style={styles.actions}>
            <AuthPrimaryButton label="Đăng nhập" onPress={onLogin} />

            <Pressable
              accessibilityLabel="Tạo tài khoản KaitoKid mới"
              accessibilityRole="button"
              onPress={onRegister}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryPressed,
              ]}>
              <Text style={styles.secondaryText}>Tạo tài khoản mới</Text>
              <AppIcon
                color={BRAND_COLORS.ink}
                name="arrowRight"
                size={18}
              />
            </Pressable>
          </View>

          <View style={styles.trustRow}>
            <View style={styles.trustIcon}>
              <AppIcon
                color={BRAND_COLORS.ink}
                name="shield"
                size={18}
              />
            </View>
            <Text style={styles.trustText}>
              Đăng nhập để đồng bộ trải nghiệm mua sắm và dữ liệu thành viên trên thiết bị của bạn.
            </Text>
          </View>
        </Animated.View>
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
    flexGrow: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingBottom: 24,
  },
  sheet: {
    marginTop: -28,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 17,
    boxShadow: '0 8px 18px rgba(17, 24, 39, 0.08)',
    elevation: 4,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 2,
  },
  headingBlock: { gap: 5 },
  kicker: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  description: {
    color: BRAND_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 520,
  },
  benefits: { gap: 9 },
  benefitCard: {
    minHeight: 76,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#FAFAFB',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  benefitIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitCopy: { flex: 1, gap: 2 },
  benefitTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  benefitDescription: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  actions: { gap: 10 },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryPressed: {
    backgroundColor: '#F9FAFB',
    opacity: 0.84,
  },
  secondaryText: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  trustRow: {
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trustIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: {
    flex: 1,
    color: '#374151',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
});
