import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { AuthField } from '@/components/auth/auth-field';
import { AppIcon } from '@/components/ui/app-icon';
import { register } from '@/services/auth.service';

type RegisterErrors = {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REGISTER_COLORS = {
  canvas: '#E8E8E8',
  card: '#111827',
  border: '#374151',
  text: '#F3F4F6',
  muted: '#9CA3AF',
  accent: '#A78BFA',
  danger: '#FCA5A5',
  dangerBackground: '#2B171B',
  dangerBorder: '#5B2730',
} as const;

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();
  const reducedMotion = useReducedMotion();
  const redirect = Array.isArray(params.redirect)
    ? params.redirect[0]
    : params.redirect;

  const phoneRef = useRef<import('react-native').TextInput>(null);
  const emailRef = useRef<import('react-native').TextInput>(null);
  const passwordRef = useRef<import('react-native').TextInput>(null);

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RegisterErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateName = (value = fullName) =>
    value.trim().length >= 2 ? undefined : 'Nhập họ và tên của bạn.';

  const validatePhone = (value = phoneNumber) => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 8
      ? undefined
      : 'Số điện thoại chưa đủ ký tự.';
  };

  const validateEmail = (value = email) =>
    EMAIL_PATTERN.test(value.trim())
      ? undefined
      : 'Nhập địa chỉ email hợp lệ.';

  const validatePassword = (value = password) =>
    value.length >= 6
      ? undefined
      : 'Mật khẩu cần tối thiểu 6 ký tự.';

  const validate = () => {
    const next: RegisterErrors = {
      fullName: validateName(),
      phone: validatePhone(),
      email: validateEmail(),
      password: validatePassword(),
    };

    setFieldErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const clearError = (field: keyof RegisterErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    if (serverError) setServerError(null);
  };

  const handleRegister = async () => {
    if (loading || !validate()) return;

    setLoading(true);
    setServerError(null);

    try {
      const result = await register({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        password,
      });

      setPendingEmail(result.email || email.trim().toLowerCase());
      setPendingMessage(
        result.message ||
          'Đã gửi email xác nhận. Tài khoản sẽ được tạo sau khi bạn xác nhận email.',
      );
      setPassword('');
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

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={
              reducedMotion
                ? undefined
                : FadeInUp.duration(280).delay(40)
            }
            style={styles.card}>
            <Text style={styles.title}>
              {pendingEmail ? 'Kiểm tra email' : 'Đăng ký'}
            </Text>

            {pendingEmail ? (
              <View style={styles.pendingState}>
                <View style={styles.pendingIcon}>
                  <AppIcon color={REGISTER_COLORS.accent} name="mail" size={28} />
                </View>
                <Text style={styles.pendingTitle}>Xác nhận để tạo tài khoản</Text>
                <Text style={styles.pendingText}>
                  {pendingMessage}
                </Text>
                <Text selectable style={styles.pendingEmail}>
                  {pendingEmail}
                </Text>
                <Text style={styles.pendingHint}>
                  Mở liên kết trong email. Trước khi xác nhận, hệ thống chưa tạo tài khoản và bạn chưa thể đăng nhập.
                </Text>

                <Pressable
                  accessibilityLabel="Quay lại màn đăng nhập"
                  accessibilityRole="button"
                  onPress={() =>
                    router.replace({
                      pathname: '/auth/login',
                      params: redirect ? { redirect } : {},
                    })
                  }
                  style={({ pressed }) => [
                    styles.submitButton,
                    styles.pendingLoginButton,
                    pressed && styles.submitButtonPressed,
                  ]}>
                  <Text style={styles.submitButtonText}>Về đăng nhập</Text>
                </Pressable>
              </View>
            ) : (
              <>
            <View style={styles.form}>
              <AuthField
                appearance="dark"
                autoCapitalize="words"
                autoComplete="name"
                error={fieldErrors.fullName}
                icon="user"
                label="Name"
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
                onSubmitEditing={() => phoneRef.current?.focus()}
                returnKeyType="next"
                showLeadingIcon={false}
                textContentType="name"
                value={fullName}
              />

              <AuthField
                ref={phoneRef}
                appearance="dark"
                autoComplete="tel"
                error={fieldErrors.phone}
                icon="phone"
                keyboardType="phone-pad"
                label="Phone"
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
                onSubmitEditing={() => emailRef.current?.focus()}
                returnKeyType="next"
                showLeadingIcon={false}
                textContentType="telephoneNumber"
                value={phoneNumber}
              />

              <AuthField
                ref={emailRef}
                appearance="dark"
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
                onSubmitEditing={() => passwordRef.current?.focus()}
                returnKeyType="next"
                showLeadingIcon={false}
                textContentType="emailAddress"
                value={email}
              />

              <AuthField
                ref={passwordRef}
                appearance="dark"
                autoComplete="new-password"
                error={fieldErrors.password}
                icon="lock"
                label="Password"
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
                returnKeyType="done"
                secure
                showLeadingIcon={false}
                showSecureToggle={false}
                textContentType="newPassword"
                value={password}
              />
            </View>

            {serverError ? (
              <View accessibilityRole="alert" style={styles.errorCard}>
                <AppIcon color={REGISTER_COLORS.danger} name="warning" size={18} />
                <View style={styles.errorCopy}>
                  <Text style={styles.errorTitle}>Chưa thể tạo tài khoản</Text>
                  <Text style={styles.errorText}>{serverError}</Text>
                </View>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel="Tạo tài khoản"
              accessibilityRole="button"
              accessibilityState={{ busy: loading, disabled: loading }}
              disabled={loading}
              onPress={() => void handleRegister()}
              style={({ pressed }) => [
                styles.submitButton,
                loading && styles.submitButtonDisabled,
                pressed && !loading && styles.submitButtonPressed,
              ]}>
              {loading ? (
                <>
                  <ActivityIndicator color={REGISTER_COLORS.card} size="small" />
                  <Text style={styles.submitButtonText}>Đang gửi email...</Text>
                </>
              ) : (
                <Text style={styles.submitButtonText}>Đăng ký</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityLabel="Đã có tài khoản, chuyển sang đăng nhập"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() =>
                router.replace({
                  pathname: '/auth/login',
                  params: redirect ? { redirect } : {},
                })
              }
              style={({ pressed }) => [
                styles.divider,
                pressed && styles.dividerPressed,
              ]}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Đã có tài khoản? Đăng nhập</Text>
              <View style={styles.dividerLine} />
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
  safeArea: {
    flex: 1,
    backgroundColor: REGISTER_COLORS.canvas,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    borderRadius: 12,
    backgroundColor: REGISTER_COLORS.card,
    padding: 32,
  },
  title: {
    color: REGISTER_COLORS.text,
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  form: {
    marginTop: 24,
    gap: 4,
  },
  pendingState: {
    marginTop: 24,
    alignItems: 'center',
    gap: 10,
  },
  pendingIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: '#4C3C70',
    backgroundColor: '#1B2233',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: {
    color: REGISTER_COLORS.text,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700',
  },
  pendingText: {
    color: REGISTER_COLORS.muted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  pendingEmail: {
    color: REGISTER_COLORS.text,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  pendingHint: {
    color: REGISTER_COLORS.muted,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
  },
  pendingLoginButton: {
    width: '100%',
    minHeight: 44,
    marginTop: 6,
  },
  errorCard: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: REGISTER_COLORS.dangerBorder,
    backgroundColor: REGISTER_COLORS.dangerBackground,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  errorCopy: {
    flex: 1,
    gap: 2,
  },
  errorTitle: {
    color: REGISTER_COLORS.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  errorText: {
    color: REGISTER_COLORS.danger,
    fontSize: 11,
    lineHeight: 16,
  },
  submitButton: {
    minHeight: 42,
    marginTop: 18,
    borderRadius: 6,
    backgroundColor: REGISTER_COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonPressed: {
    opacity: 0.82,
  },
  submitButtonDisabled: {
    opacity: 0.62,
  },
  submitButtonText: {
    color: REGISTER_COLORS.card,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  divider: {
    minHeight: 44,
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerPressed: {
    opacity: 0.68,
  },
  dividerLine: {
    height: StyleSheet.hairlineWidth,
    flex: 1,
    backgroundColor: REGISTER_COLORS.border,
  },
  dividerText: {
    paddingHorizontal: 12,
    color: REGISTER_COLORS.muted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
});
