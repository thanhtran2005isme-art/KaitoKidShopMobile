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
import { register } from '@/services/auth.service';

type RegisterErrors = {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();
  const reducedMotion = useReducedMotion();
  const redirect = Array.isArray(params.redirect)
    ? params.redirect[0]
    : params.redirect;

  const emailRef = useRef<import('react-native').TextInput>(null);
  const phoneRef = useRef<import('react-native').TextInput>(null);
  const passwordRef = useRef<import('react-native').TextInput>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateName = (value = fullName) =>
    value.trim().length >= 2 ? undefined : 'Nhập họ và tên của bạn.';

  const validateEmail = (value = email) =>
    EMAIL_PATTERN.test(value.trim())
      ? undefined
      : 'Nhập địa chỉ email hợp lệ.';

  const validatePhone = (value = phoneNumber) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 8
      ? undefined
      : 'Số điện thoại chưa đủ ký tự.';
  };

  const validatePassword = (value = password) =>
    value.length >= 6
      ? undefined
      : 'Mật khẩu cần tối thiểu 6 ký tự.';

  const validate = () => {
    const next: RegisterErrors = {
      fullName: validateName(),
      email: validateEmail(),
      phone: validatePhone(),
      password: validatePassword(),
    };
    setFieldErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleRegister = async () => {
    if (loading || !validate()) return;

    setLoading(true);
    setServerError(null);

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
      });

      router.replace({
        pathname: '/auth/login',
        params: {
          registered: '1',
          ...(redirect ? { redirect } : {}),
        },
      });
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Không thể tạo tài khoản. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field: keyof RegisterErrors) => {
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
            eyebrow="JOIN KAITOKID"
            height={230}
            onBack={() => router.back()}
            subtitle={BRAND.promise}
            title="Tạo tài khoản của bạn"
          />

          <Animated.View
            entering={
              reducedMotion
                ? undefined
                : FadeInUp.duration(300).delay(60)
            }
            style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.headingBlock}>
              <Text style={styles.kicker}>THÀNH VIÊN KAITOKID</Text>
              <Text style={styles.title}>Một tài khoản, mọi quyền lợi</Text>
              <Text style={styles.subtitle}>
                Tạo tài khoản để quản lý đơn hàng, tích điểm, lưu yêu thích và nhận voucher thành viên.
              </Text>
            </View>

            <View style={styles.memberPreview}>
              <View style={styles.previewIcon}>
                <AppIcon
                  color={BRAND_COLORS.primary}
                  name="sparkles"
                  size={20}
                />
              </View>
              <View style={styles.previewCopy}>
                <Text style={styles.previewTitle}>KaitoKid Member</Text>
                <Text style={styles.previewText}>
                  Quyền lợi được đồng bộ sau khi bạn đăng nhập.
                </Text>
              </View>
            </View>

            <View style={styles.form}>
              <AuthField
                autoCapitalize="words"
                autoComplete="name"
                error={fieldErrors.fullName}
                icon="user"
                label="Họ và tên"
                onBlur={() =>
                  setFieldErrors((current) => ({
                    ...current,
                    fullName: validateName(),
                  }))
                }
                onChangeText={(value) => {
                  setFullName(value);
                  clearError('fullName');
                }}
                onSubmitEditing={() => emailRef.current?.focus()}
                placeholder="Nguyễn Văn A"
                returnKeyType="next"
                textContentType="name"
                value={fullName}
              />

              <AuthField
                ref={emailRef}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                error={fieldErrors.email}
                icon="mail"
                keyboardType="email-address"
                label="Email"
                onBlur={() =>
                  setFieldErrors((current) => ({
                    ...current,
                    email: validateEmail(),
                  }))
                }
                onChangeText={(value) => {
                  setEmail(value);
                  clearError('email');
                }}
                onSubmitEditing={() => phoneRef.current?.focus()}
                placeholder="email@domain.com"
                returnKeyType="next"
                textContentType="emailAddress"
                value={email}
              />

              <AuthField
                ref={phoneRef}
                autoComplete="tel"
                error={fieldErrors.phone}
                icon="phone"
                keyboardType="phone-pad"
                label="Số điện thoại (không bắt buộc)"
                onBlur={() =>
                  setFieldErrors((current) => ({
                    ...current,
                    phone: validatePhone(),
                  }))
                }
                onChangeText={(value) => {
                  setPhoneNumber(value);
                  clearError('phone');
                }}
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholder="09xxxxxxxx"
                returnKeyType="next"
                textContentType="telephoneNumber"
                value={phoneNumber}
              />

              <AuthField
                ref={passwordRef}
                autoComplete="new-password"
                error={fieldErrors.password}
                helper="Tối thiểu 6 ký tự theo quy tắc đăng ký hiện tại."
                icon="lock"
                label="Mật khẩu"
                onBlur={() =>
                  setFieldErrors((current) => ({
                    ...current,
                    password: validatePassword(),
                  }))
                }
                onChangeText={(value) => {
                  setPassword(value);
                  clearError('password');
                }}
                onSubmitEditing={() => void handleRegister()}
                placeholder="Tạo mật khẩu"
                returnKeyType="done"
                secure
                textContentType="newPassword"
                value={password}
              />
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
                  <Text style={styles.errorTitle}>Chưa thể tạo tài khoản</Text>
                  <Text style={styles.errorText}>{serverError}</Text>
                </View>
              </View>
            ) : null}

            <AuthPrimaryButton
              label="Tạo tài khoản"
              loading={loading}
              loadingLabel="Đang tạo tài khoản..."
              onPress={() => void handleRegister()}
            />

            <View style={styles.loginRow}>
              <Text style={styles.loginPrompt}>Đã có tài khoản?</Text>
              <Pressable
                accessibilityLabel="Đăng nhập tài khoản hiện có"
                accessibilityRole="button"
                onPress={() =>
                  router.replace({
                    pathname: '/auth/login',
                    params: redirect ? { redirect } : {},
                  })
                }
                style={({ pressed }) => pressed && styles.pressed}>
                <Text style={styles.loginLink}>Đăng nhập ngay</Text>
              </Pressable>
            </View>

            <View style={styles.trustRow}>
              <AppIcon
                color={BRAND_COLORS.success}
                name="shield"
                size={18}
              />
              <Text style={styles.trustText}>
                KaitoKid chỉ dùng thông tin tài khoản để phục vụ đăng nhập, đơn hàng và quyền lợi thành viên.
              </Text>
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
    marginTop: -22,
    borderRadius: 30,
    backgroundColor: BRAND_COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 18,
    boxShadow: '0 9px 20px rgba(17, 24, 39, 0.08)',
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
  memberPreview: {
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCopy: { flex: 1, gap: 2 },
  previewTitle: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '900',
  },
  previewText: {
    color: '#6D28D9',
    fontSize: 11,
    lineHeight: 16,
  },
  form: { gap: 15 },
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
  loginRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  loginPrompt: {
    color: BRAND_COLORS.muted,
    fontSize: 13,
  },
  loginLink: {
    color: BRAND_COLORS.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  trustRow: {
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  trustText: {
    flex: 1,
    color: '#166534',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  pressed: { opacity: 0.7 },
});
