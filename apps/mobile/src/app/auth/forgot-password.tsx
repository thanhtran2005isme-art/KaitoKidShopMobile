import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { BRAND_COLORS } from '@/constants/brand';
import { requestPasswordReset } from '@/services/auth.service';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const reducedMotion = useReducedMotion();
  const initialEmail = Array.isArray(params.email)
    ? params.email[0] || ''
    : params.email || '';

  const [email, setEmail] = useState(initialEmail);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldError('Nhập địa chỉ email hợp lệ.');
      return false;
    }
    setFieldError(null);
    return true;
  };

  const submit = async () => {
    if (loading || !validate()) return;

    setLoading(true);
    setServerError(null);

    try {
      const result = await requestPasswordReset(email.trim());
      setSuccessMessage(
        result.message ||
          'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.',
      );
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Không thể gửi yêu cầu đặt lại mật khẩu.',
      );
    } finally {
      setLoading(false);
    }
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
            eyebrow="ACCOUNT RECOVERY"
            height={235}
            onBack={() => router.back()}
            subtitle="Khôi phục quyền truy cập theo luồng bảo mật hiện có của KaitoKid"
            title="Lấy lại tài khoản"
          />

          <Animated.View
            entering={
              reducedMotion
                ? undefined
                : FadeInUp.duration(300).delay(60)
            }
            style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {successMessage ? (
              <>
                <View style={styles.successHero}>
                  <View style={styles.successIcon}>
                    <AppIcon
                      color={BRAND_COLORS.success}
                      name="mail"
                      size={28}
                    />
                  </View>
                  <Text style={styles.successTitle}>Kiểm tra hộp thư của bạn</Text>
                  <Text style={styles.successText}>{successMessage}</Text>
                </View>

                <AuthPrimaryButton
                  label="Quay lại đăng nhập"
                  onPress={() => router.replace('/auth/login')}
                />

                <View style={styles.tipCard}>
                  <AppIcon
                    color={BRAND_COLORS.primary}
                    name="shield"
                    size={18}
                  />
                  <Text style={styles.tipText}>
                    Vì lý do riêng tư, hệ thống không xác nhận email có tồn tại hay không.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.headingBlock}>
                  <Text style={styles.kicker}>QUÊN MẬT KHẨU</Text>
                  <Text style={styles.title}>Nhận liên kết đặt lại mật khẩu</Text>
                  <Text style={styles.subtitle}>
                    Nhập email đã dùng cho KaitoKid. Hệ thống sẽ gửi hướng dẫn nếu email này tồn tại.
                  </Text>
                </View>

                <AuthField
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  error={fieldError}
                  icon="mail"
                  keyboardType="email-address"
                  label="Email tài khoản"
                  onBlur={validate}
                  onChangeText={(value) => {
                    setEmail(value);
                    setFieldError(null);
                    setServerError(null);
                  }}
                  onSubmitEditing={() => void submit()}
                  placeholder="email@domain.com"
                  returnKeyType="send"
                  textContentType="emailAddress"
                  value={email}
                />

                {serverError ? (
                  <View accessibilityRole="alert" style={styles.errorCard}>
                    <AppIcon
                      color={BRAND_COLORS.danger}
                      name="warning"
                      size={18}
                    />
                    <Text style={styles.errorText}>{serverError}</Text>
                  </View>
                ) : null}

                <AuthPrimaryButton
                  label="Gửi hướng dẫn"
                  loading={loading}
                  loadingLabel="Đang gửi..."
                  onPress={() => void submit()}
                />

                <Pressable
                  accessibilityLabel="Quay lại màn đăng nhập"
                  accessibilityRole="button"
                  onPress={() => router.replace('/auth/login')}
                  style={({ pressed }) => [
                    styles.backToLogin,
                    pressed && styles.pressed,
                  ]}>
                  <AppIcon
                    color={BRAND_COLORS.primary}
                    name="arrowLeft"
                    size={17}
                  />
                  <Text style={styles.backToLoginText}>Quay lại đăng nhập</Text>
                </Pressable>
              </>
            )}
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
    maxWidth: 540,
    alignSelf: 'center',
    marginTop: -22,
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
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: BRAND_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  errorCard: {
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  errorText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 11,
    lineHeight: 16,
  },
  backToLogin: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  backToLoginText: {
    color: BRAND_COLORS.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  successHero: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 23,
    fontWeight: '900',
    textAlign: 'center',
  },
  successText: {
    color: BRAND_COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 420,
  },
  tipCard: {
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  tipText: {
    flex: 1,
    color: BRAND_COLORS.primaryDark,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  pressed: { opacity: 0.7 },
});
