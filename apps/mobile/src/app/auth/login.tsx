import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';

import { AuthFashionHero } from '@/components/auth/auth-fashion-hero';
import { AuthField } from '@/components/auth/auth-field';
import { AuthPrimaryButton } from '@/components/auth/auth-primary-button';
import { AppIcon } from '@/components/ui/app-icon';
import { BRAND, BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';

type LoginErrors = {
  identifier?: string;
  password?: string;
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const params = useLocalSearchParams<{
    redirect?: string | string[];
    registered?: string | string[];
  }>();
  const reducedMotion = useReducedMotion();

  const redirect = Array.isArray(params.redirect)
    ? params.redirect[0]
    : params.redirect;
  const registered = Array.isArray(params.registered)
    ? params.registered[0] === '1'
    : params.registered === '1';

  const passwordRef = useRef<import('react-native').TextInput>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: LoginErrors = {};
    if (!identifier.trim()) {
      next.identifier = 'Nhập email hoặc số điện thoại của bạn.';
    }
    if (!password) {
      next.password = 'Nhập mật khẩu để tiếp tục.';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (loading || !validate()) return;

    setLoading(true);
    setServerError(null);

    try {
      await login(identifier.trim(), password);
      router.replace(
        redirect && redirect.startsWith('/')
          ? (redirect as any)
          : '/(tabs)',
      );
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Không thể đăng nhập. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field: keyof LoginErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    if (serverError) setServerError(null);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <AuthFashionHero
            eyebrow="MEMBER ACCESS"
            height={270}
            onBack={() => router.back()}
            subtitle={BRAND.promise}
            title="Chào mừng trở lại"
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
              <Text style={styles.kicker}>ĐĂNG NHẬP KAITOKID</Text>
              <Text style={styles.title}>Tiếp tục trải nghiệm của bạn</Text>
              <Text style={styles.subtitle}>
                Theo dõi đơn hàng, đồng bộ yêu thích, điểm thành viên và voucher trên một tài khoản.
              </Text>
            </View>

            {registered ? (
              <View accessibilityRole="alert" style={styles.successCard}>
                <View style={styles.successIcon}>
                  <AppIcon
                    color={BRAND_COLORS.success}
                    name="check"
                    size={18}
                  />
                </View>
                <Text style={styles.successText}>
                  Tài khoản đã sẵn sàng. Hãy đăng nhập để bắt đầu mua sắm.
                </Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <AuthField
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                error={fieldErrors.identifier}
                icon="mail"
                label="Email hoặc số điện thoại"
                onBlur={() => {
                  if (!identifier.trim()) {
                    setFieldErrors((current) => ({
                      ...current,
                      identifier: 'Nhập email hoặc số điện thoại của bạn.',
                    }));
                  }
                }}
                onChangeText={(value) => {
                  setIdentifier(value);
                  clearError('identifier');
                }}
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="email@domain.com hoặc 09xxxxxxxx"
                returnKeyType="next"
                textContentType="username"
                value={identifier}
              />

              <AuthField
                ref={passwordRef}
                autoComplete="current-password"
                error={fieldErrors.password}
                icon="lock"
                label="Mật khẩu"
                onBlur={() => {
                  if (!password) {
                    setFieldErrors((current) => ({
                      ...current,
                      password: 'Nhập mật khẩu để tiếp tục.',
                    }));
                  }
                }}
                onChangeText={(value) => {
                  setPassword(value);
                  clearError('password');
                }}
                onSubmitEditing={() => void handleLogin()}
                placeholder="Nhập mật khẩu"
                returnKeyType="done"
                secure
                textContentType="password"
                value={password}
              />

              <View style={styles.formMeta}>
                <View style={styles.secureHint}>
                  <AppIcon
                    color={BRAND_COLORS.success}
                    name="shield"
                    size={16}
                  />
                  <Text style={styles.secureHintText}>Phiên đăng nhập được bảo vệ</Text>
                </View>

                <Pressable
                  accessibilityLabel="Quên mật khẩu"
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/auth/forgot-password',
                      params: identifier.includes('@')
                        ? { email: identifier.trim() }
                        : {},
                    })
                  }
                  style={({ pressed }) => pressed && styles.pressed}>
                  <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                </Pressable>
              </View>
            </View>

            {serverError ? (
              <View accessibilityRole="alert" style={styles.errorCard}>
                <View style={styles.errorIcon}>
                  <AppIcon
                    color={BRAND_COLORS.danger}
                    name="warning"
                    size={18}
                  />
                </View>
                <View style={styles.errorCopy}>
                  <Text style={styles.errorTitle}>Chưa thể đăng nhập</Text>
                  <Text style={styles.errorText}>{serverError}</Text>
                </View>
              </View>
            ) : null}

            <AuthPrimaryButton
              label="Đăng nhập"
              loading={loading}
              loadingLabel="Đang xác thực..."
              onPress={() => void handleLogin()}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>MỚI TẠI KAITOKID</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              accessibilityLabel="Tạo tài khoản KaitoKid mới"
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/auth/register',
                  params: redirect ? { redirect } : {},
                })
              }
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryPressed,
              ]}>
              <View style={styles.secondaryIcon}>
                <AppIcon
                  color={BRAND_COLORS.primary}
                  name="user"
                  size={20}
                />
              </View>
              <View style={styles.secondaryCopy}>
                <Text style={styles.secondaryTitle}>Tạo tài khoản mới</Text>
                <Text style={styles.secondaryDescription}>
                  Bắt đầu tích điểm và quản lý trải nghiệm mua sắm.
                </Text>
              </View>
              <AppIcon
                color={BRAND_COLORS.ink}
                name="chevronRight"
                size={20}
              />
            </Pressable>

            <View style={styles.benefitStrip}>
              <View style={styles.benefitItem}>
                <AppIcon
                  color={BRAND_COLORS.primary}
                  name="bag"
                  size={18}
                />
                <Text style={styles.benefitText}>Đơn hàng</Text>
              </View>
              <View style={styles.benefitDivider} />
              <View style={styles.benefitItem}>
                <AppIcon
                  color="#BE185D"
                  name="heart"
                  size={18}
                />
                <Text style={styles.benefitText}>Yêu thích</Text>
              </View>
              <View style={styles.benefitDivider} />
              <View style={styles.benefitItem}>
                <AppIcon
                  color={BRAND_COLORS.accent}
                  name="gift"
                  size={18}
                />
                <Text style={styles.benefitText}>Điểm & voucher</Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingBottom: 26,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    marginTop: -24,
    borderRadius: 30,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 18,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
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
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: BRAND_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  form: { gap: 15 },
  formMeta: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  secureHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  secureHintText: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  forgotText: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  successCard: {
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    flex: 1,
    color: '#166534',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
  },
  errorCard: {
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  errorIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCopy: { flex: 1, gap: 2 },
  errorTitle: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '900',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 11,
    lineHeight: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: BRAND_COLORS.line },
  dividerText: {
    color: '#9CA3AF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  secondaryButton: {
    minHeight: 72,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#FAFAFB',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  secondaryPressed: { opacity: 0.78, backgroundColor: '#F3F4F6' },
  secondaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCopy: { flex: 1, gap: 2 },
  secondaryTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryDescription: {
    color: BRAND_COLORS.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  benefitStrip: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  benefitItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  benefitText: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  benefitDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: BRAND_COLORS.line,
  },
  pressed: { opacity: 0.7 },
});
