import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useAuth } from '@/context/AuthContext';

type LoginErrors = {
  identifier?: string;
  password?: string;
};

const GOOGLE_MARK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAIAAAD9b0jDAAACV0lEQVR42mMUlFBnoDZgYqABGDqGsuCRY2RkdHOxd3a0NdDTUVSU4+bifPjoydVrN3fuPrB52+4fP37g1IgrovR1tSb0tujramGV/fDxU9/EGdNmLvj37x+mLDMnjwimaHCg94rFs6QkxXG5hYOD3dHeWlhYcPfeg0SFqa+X6+xpvaysKCHz/MXLS1eu/f79By5y6/bd9q5JRHlfVUXpwK51nJwcEO6jx0+7+6bu3H3gzdt3DAwMbKys5mZGlWV5Avz8fsFxEEHChm7ftMzc1AjCPnf+UlBE8qdPn9F9x8TEz8f7/sNHopKUsZE+3MSvX7/FJuVimsjAwPDv3z88JqIb6u7qAGf3T575/MVLKqRTHS0NOHvj5p1oSuNjwiQkxLCacvPW3Q2btmM3VECAD85+9PgJms6EuAhcyfbo8dPIhjKhBRaczcrKSoJ/WZhxhumrV2/gbDUVJeINff3mLU5DL125Dmd7ebqg6XR0CxKS1ICjsOg0uNSDB49xGoqc57LSEqSlJPG4LjMtHs4+dOQETkOvXrsJl+bi4lw4ZyIfHy9WE5MTohztraF+f/32yLFT+PJ+cXnD9+/QMs3IUO/Qng0RoQHI5YCmhuqieZO72+vgIq2dE9GKQSxFn6+X68K5k9Ei8Pbd+xDnG+rrIEvt2nMgIjaDqPI0ONB72sROtIIKE5w7fyk4IuXjp09EVSdr12/18I24eu0mLuN+//4zd8Ey3+A4TBPxlfyQ6sTT3cnJwcZAT1teXpabi/Pxk2c3bt45ePj45m27Xr9+S3J1Mlrvkw0A6Brfw7qKhC0AAAAASUVORK5CYII=';
const TWITTER_MARK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAIAAAD9b0jDAAACHElEQVR42mMUlFBnoDZgYqABGOGGspCqgYODQ1tLnY2V9dz5Sz9//SLKpVxcnHhMzM9JfXL33O6tK7duWHLx9D49HU0uLs7Y6FAZaUmchrKwMB/cvV5NVRmriXnZKfXVxUxMUC1iYiLrVy+4e+2Epbnxx0+fcRoqLyarrKSwee0iUxMDNBO5ublqKwvRBAUF+H/9+i0oIBDk74XT0E+fPjMwMIiKCu/cvGJSb4uIsBBcSk1VmZmZGdP5vLw8585fWrhkFbIgMyePCJzz7dt3Z0dbKSkJBgYGPV2t9NQ4WWmpL1++MjExSUtJhAX7YRr66dPnsOg0NEFG5GwqKSEeGuybl50iJChAZGK4d/+hiZU7viT1n+F/Q00JSSns8eOnBJLUixevzl+8QpKh+w8dI5xOUzKKXrx4RbyhW7fvxhREiSgGBoYPHz7eunNPRVlRUkKMoIk7dx+YPW8pUXlfRVnRUF+HoIn////v6p2CVQrdpQwMDBcvXREVETYgZG5LR//6TduJNfTfv387dx9YuWbj379/TU0MsWrbuHlHZW0baaWUhrpKekpcVHgQVtndew+mZhX///+fKEPtbCxyMpMkJcS1tbBXXI8eP+3qnbJyzaa/f//iCRlGtIqPm5vLx9PVy8PZ2dEWuRg8cuzUvIXLN23Z+e/fP4JxyIirNmViYpKXkxEREXrz5t3zF69+/PhBfOJlHK2ih4ahAHMmrlBP9O56AAAAAElFTkSuQmCC';
const GITHUB_MARK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAIAAAD9b0jDAAACyklEQVR42mMUlFBnoDZgYqABGDqGsuCXlpAQc3a0lZGWhIs8fPhk7/7Dr9+8JcdQKUmJlobyAD9PTKn///+vWL2xrrHz7bv3WPUyYo19ezurRXMm8fLy4HHO23fvI2Izzp67SFSYenk4r10+B7+JDAwMwkKC2zYstbY0JWyohrrK7Gm9TExMJ0+fy8gpO33mAqaeI8dOJWcUXbx8jZWVZeHcydJSkvjClJGRcerEDk5ODgYGhv0Hjq5au2n1us1hwX4Hjxx/8eIVJKAtLYzXrt/KwMBgZKCrr6slJCjQ390YFp2G06U+Xq6G+jpocbJyzUaIiQwMDM+ev4CYyMDAwMgIVePiZGdqYoDTUG9PFzj71p17+MP0+o3bcLanmxNOQ81MDCGMu/cebti0Hb+hS1ese/nyNYRtaWGC01BhIUEI48rV68TknEtXrkEY8rIyOA1lY2eDxxgxhjIzM0MYAgJ8OA19+/YdhKGlqUbQREZGRl1tTQj75as3OA29dv0WhKGirGhooIvfUDcXe1FRYQj76rWbOA09cuwUnL1o7iRtLZzlt5WF6bRJnXDuoSPHceZ9QQH+y2cPvP/wYe6C5VnpCUKCAsdOnNm+c9+suYv//v3LwMDAwcGRnZ7g6e5kZKgH1/Xu/Qd9U6evX79hd+n7Dx8nT58rLSVpb2MRFZ/59es3Gysze1sLiIkMDAw/fvzw83VHNpGBgaG7byqyiVjy/pTp8y5evmZvZ8XNxWVk4eoXHJeZW46s4PiJs8jcQ0dOzF+4gkCB8vXrt4CQhBOnzi6aOzkhNlxERBgtZP/8+Q1nb962Ozwm/dfv34SLvo+fPgWEJKzftK26omDezH5rKzNkWVZWNgYGhg8fP1XWtiak5P38+RNL+uXkEcEU/fvv345d+0+dOc/IyLh33+F79x/Cpbi4OJ+/eJmQkoecVIgq+UfrfUoAAIwsARSbWLDPAAAAAElFTkSuQmCC';

function SocialMark({ source }: { source: string }) {
  return (
    <Image
      accessible={false}
      resizeMode="contain"
      source={{ uri: source }}
      style={styles.socialReferenceMark}
    />
  );
}

const LOGIN_COLORS = {
  canvas: '#E8E8E8',
  card: '#111827',
  border: '#1F2937',
  text: '#F3F4F6',
  muted: '#9CA3AF',
  accent: '#A78BFA',
  success: '#86EFAC',
  successBackground: '#13251D',
  successBorder: '#1F5135',
  danger: '#FCA5A5',
  dangerBackground: '#2B171B',
  dangerBorder: '#5B2730',
} as const;

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
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={reducedMotion ? undefined : FadeInUp.duration(280).delay(40)}
            style={styles.card}>
            <View style={styles.heading}>
              <Text style={styles.title}>Đăng nhập</Text>
            </View>

            {registered ? (
              <View accessibilityRole="alert" style={styles.successCard}>
                <AppIcon color={LOGIN_COLORS.success} name="check" size={18} />
                <Text style={styles.successText}>
                  Tài khoản đã sẵn sàng. Hãy đăng nhập để bắt đầu mua sắm.
                </Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <AuthField
                appearance="dark"
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
                returnKeyType="next"
                showLeadingIcon={false}
                textContentType="username"
                value={identifier}
              />

              <AuthField
                ref={passwordRef}
                appearance="dark"
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
                returnKeyType="done"
                secure
                showLeadingIcon={false}
                showSecureToggle={false}
                textContentType="password"
                value={password}
              />

              <Pressable
                accessibilityLabel="Quên mật khẩu"
                accessibilityRole="button"
                hitSlop={11}
                onPress={() =>
                  router.push({
                    pathname: '/auth/forgot-password',
                    params: identifier.includes('@')
                      ? { email: identifier.trim() }
                      : {},
                  })
                }
                style={({ pressed }) => [
                  styles.forgotButton,
                  pressed && styles.controlPressed,
                ]}>
                <Text style={styles.forgotText}>Quên mật khẩu?</Text>
              </Pressable>
            </View>

            {serverError ? (
              <View accessibilityRole="alert" style={styles.errorCard}>
                <AppIcon color={LOGIN_COLORS.danger} name="warning" size={18} />
                <View style={styles.errorCopy}>
                  <Text style={styles.errorTitle}>Chưa thể đăng nhập</Text>
                  <Text style={styles.errorText}>{serverError}</Text>
                </View>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel="Đăng nhập"
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
              disabled={loading}
              hitSlop={2}
              onPress={() => void handleLogin()}
              style={({ pressed }) => [
                styles.signButton,
                loading && styles.signButtonDisabled,
                pressed && !loading && styles.signButtonPressed,
              ]}>
              {loading ? (
                <>
                  <ActivityIndicator color={LOGIN_COLORS.canvas} size="small" />
                  <Text style={styles.signButtonText}>Đang xác thực...</Text>
                </>
              ) : (
                <Text style={styles.signButtonText}>Đăng nhập</Text>
              )}
            </Pressable>

            <View style={styles.socialDivider}>
              <View style={styles.socialDividerLine} />
              <Text style={styles.socialDividerText}>Đăng nhập bằng mạng xã hội</Text>
              <View style={styles.socialDividerLine} />
            </View>

            <View
              accessibilityLabel="Đăng nhập mạng xã hội: Google, Twitter, GitHub"
              accessibilityRole="text"
              style={styles.socialRow}>
              <View style={styles.socialIconSlot}>
                <SocialMark source={GOOGLE_MARK} />
              </View>
              <View style={styles.socialIconSlot}>
                <SocialMark source={TWITTER_MARK} />
              </View>
              <View style={styles.socialIconSlot}>
                <SocialMark source={GITHUB_MARK} />
              </View>
            </View>

            <View style={styles.signupRow}>
              <Text style={styles.signupPrompt}>Chưa có tài khoản?</Text>
              <Pressable
                accessibilityLabel="Đăng ký tài khoản KaitoKid"
                accessibilityRole="button"
                hitSlop={14}
                onPress={() =>
                  router.push({
                    pathname: '/auth/register',
                    params: redirect ? { redirect } : {},
                  })
                }
                style={({ pressed }) => pressed && styles.controlPressed}>
                <Text style={styles.signupLink}>Đăng ký</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: LOGIN_COLORS.canvas },
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
    borderWidth: 1,
    borderColor: LOGIN_COLORS.border,
    backgroundColor: LOGIN_COLORS.card,
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 25,
    gap: 16,
  },
  heading: { alignItems: 'center', marginBottom: 12 },
  title: {
    color: LOGIN_COLORS.text,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.25,
    textAlign: 'center',
  },
  form: { gap: 4 },
  forgotButton: {
    minHeight: 22,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    marginTop: -1,
  },
  forgotText: {
    color: LOGIN_COLORS.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  signButton: {
    minHeight: 40,
    borderRadius: 6,
    backgroundColor: LOGIN_COLORS.accent,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signButtonPressed: { opacity: 0.82 },
  signButtonDisabled: { opacity: 0.62 },
  signButtonText: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  socialDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  socialDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#374151',
  },
  socialDividerText: {
    color: LOGIN_COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    textAlign: 'center',
  },
  socialRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: -9,
  },
  socialIconSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialReferenceMark: {
    width: 28,
    height: 28,
  },
  successCard: {
    borderRadius: 12,
    backgroundColor: LOGIN_COLORS.successBackground,
    borderWidth: 1,
    borderColor: LOGIN_COLORS.successBorder,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  successText: {
    flex: 1,
    color: LOGIN_COLORS.success,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  errorCard: {
    borderRadius: 12,
    backgroundColor: LOGIN_COLORS.dangerBackground,
    borderWidth: 1,
    borderColor: LOGIN_COLORS.dangerBorder,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  errorCopy: { flex: 1, gap: 2 },
  errorTitle: {
    color: LOGIN_COLORS.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  errorText: {
    color: LOGIN_COLORS.danger,
    fontSize: 11,
    lineHeight: 16,
  },
  signupRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: -9,
  },
  signupPrompt: {
    color: LOGIN_COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  signupLink: {
    color: LOGIN_COLORS.text,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  controlPressed: { opacity: 0.68 },
});
