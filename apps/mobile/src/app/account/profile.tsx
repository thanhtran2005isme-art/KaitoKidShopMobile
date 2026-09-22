import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { accountApi } from '@/services/account.api';
import { resolveMediaUrl } from '@/services/api-client';
import type { AccountProfile } from '@/types/account';
import {
  appendImageToFormData,
  isSupportedUploadImage,
} from '@/utils/media-upload';

type FieldErrors = Partial<
  Record<'name' | 'phone' | 'birthday' | 'avatar', string>
>;

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function birthdayToText(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return day + '/' + month + '/' + date.getUTCFullYear();
}

function parseBirthday(value: string) {
  const text = value.trim();
  if (!text) return { iso: undefined as string | undefined, error: undefined as string | undefined };

  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return {
      iso: undefined,
      error: 'Ngày sinh cần đúng định dạng DD/MM/YYYY.',
    };
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { iso: undefined, error: 'Ngày sinh không hợp lệ.' };
  }

  if (date.getTime() > Date.now()) {
    return { iso: undefined, error: 'Ngày sinh không thể nằm trong tương lai.' };
  }

  return {
    iso: date.toISOString(),
    error: undefined,
  };
}

export default function AccountProfileScreen() {
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [avatarAsset, setAvatarAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

  const load = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await accountApi.getProfile(token);
      setProfile(next);
      setName(next.name);
      setPhone(next.phone || '');
      setBirthday(birthdayToText(next.birthday));
    } catch (loadError) {
      setError(messageFrom(loadError, 'Không thể tải hồ sơ.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, token]);

  const pickAvatar = async () => {
    if (saving) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!isSupportedUploadImage(asset)) {
      setFieldErrors((current) => ({
        ...current,
        avatar: 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.',
      }));
      return;
    }
    if (
      typeof asset.fileSize === 'number' &&
      asset.fileSize > 5 * 1024 * 1024
    ) {
      setFieldErrors((current) => ({
        ...current,
        avatar: 'Ảnh đại diện tối đa 5MB.',
      }));
      return;
    }

    setAvatarAsset(asset);
    setFieldErrors((current) => ({ ...current, avatar: undefined }));
  };

  const save = async () => {
    if (!token || !profile || saving || submitLock.current) return;

    const errors: FieldErrors = {};
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    const parsedBirthday = parseBirthday(birthday);

    if (trimmedName.length < 2) {
      errors.name = 'Họ tên phải có ít nhất 2 ký tự.';
    }
    if (
      trimmedPhone &&
      (phoneDigits.length < 9 || phoneDigits.length > 12)
    ) {
      errors.phone = 'Số điện thoại cần có từ 9 đến 12 chữ số.';
    }
    if (parsedBirthday.error) {
      errors.birthday = parsedBirthday.error;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Vui lòng kiểm tra các trường được đánh dấu.');
      return;
    }

    submitLock.current = true;
    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      let next = await accountApi.updateProfile(token, {
        name: trimmedName,
        phone: trimmedPhone,
        ...(parsedBirthday.iso ? { birthday: parsedBirthday.iso } : {}),
      });

      if (avatarAsset) {
        const formData = new FormData();
        appendImageToFormData(formData, 'file', avatarAsset, 'avatar');
        await accountApi.uploadAvatar(token, formData);
        next = await accountApi.getProfile(token);
      }

      setProfile(next);
      setName(next.name);
      setPhone(next.phone || '');
      setBirthday(birthdayToText(next.birthday));
      setAvatarAsset(null);
      router.back();
    } catch (saveError) {
      setError(messageFrom(saveError, 'Không thể cập nhật hồ sơ.'));
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang tải hồ sơ</Text>
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
            style={styles.primaryButtonCompact}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Không tải được hồ sơ</Text>
          <Text style={styles.stateText}>{error || 'Vui lòng thử lại.'}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={styles.primaryButtonCompact}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const avatarUri = avatarAsset?.uri || resolveMediaUrl(profile.avatar);
  const initial = profile.name.trim().charAt(0).toUpperCase() || 'K';

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
              accessibilityLabel="Quay lại tài khoản"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>HỒ SƠ CÁ NHÂN</Text>
              <Text style={styles.title}>Thông tin tài khoản</Text>
              <Text style={styles.subtitle}>
                Email là thông tin đăng nhập nên không chỉnh tại màn này.
              </Text>
            </View>
          </View>

          <View style={styles.avatarCard}>
            {avatarUri ? (
              <Image
                accessibilityLabel="Ảnh đại diện đang chọn"
                contentFit="cover"
                source={{ uri: avatarUri }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initial}</Text>
              </View>
            )}
            <View style={styles.avatarCopy}>
              <Text style={styles.avatarTitle}>Ảnh đại diện</Text>
              <Text style={styles.helper}>
                JPEG/PNG/WebP, tối đa 5MB. Ảnh sẽ được cắt vuông trước khi tải lên.
              </Text>
              {fieldErrors.avatar ? (
                <Text accessibilityRole="alert" style={styles.fieldError}>
                  {fieldErrors.avatar}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Chọn ảnh đại diện từ thư viện"
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void pickAvatar()}
              style={({ pressed }) => [
                styles.changeAvatarButton,
                pressed && styles.pressed,
                saving && styles.disabled,
              ]}>
              <Text style={styles.changeAvatarText}>Chọn ảnh</Text>
            </Pressable>
          </View>

          <View style={styles.formCard}>
            <Field
              error={fieldErrors.name}
              label="Họ và tên *"
              onChangeText={(value) => {
                setName(value);
                setFieldErrors((current) => ({ ...current, name: undefined }));
              }}
              value={name}
            />
            <Field
              error={fieldErrors.phone}
              keyboardType="phone-pad"
              label="Số điện thoại"
              onChangeText={(value) => {
                setPhone(value);
                setFieldErrors((current) => ({ ...current, phone: undefined }));
              }}
              value={phone}
            />
            <Field
              error={fieldErrors.birthday}
              keyboardType="numbers-and-punctuation"
              label="Ngày sinh"
              onChangeText={(value) => {
                setBirthday(value);
                setFieldErrors((current) => ({
                  ...current,
                  birthday: undefined,
                }));
              }}
              placeholder="DD/MM/YYYY"
              value={birthday}
            />

            <View style={styles.readonlyField}>
              <Text style={styles.label}>Email</Text>
              <Text selectable style={styles.readonlyValue}>
                {profile.email}
              </Text>
            </View>
          </View>

          {error ? (
            <View accessibilityRole="alert" style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="Lưu thay đổi hồ sơ"
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void save()}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.pressed,
              saving && styles.disabled,
            ]}>
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Lưu thay đổi</Text>
            )}
          </Pressable>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'numbers-and-punctuation';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label.replace(' *', '')}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={[styles.input, error && styles.inputError]}
        value={value}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
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
  title: { color: BRAND_COLORS.ink, fontSize: 22, fontWeight: '900' },
  subtitle: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
  },
  avatarCard: {
    minHeight: 108,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  avatarCopy: { flex: 1 },
  avatarTitle: { color: BRAND_COLORS.ink, fontSize: 11, fontWeight: '900' },
  helper: {
    marginTop: 3,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
  },
  changeAvatarButton: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: BRAND_COLORS.primarySoft,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeAvatarText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 8,
    fontWeight: '900',
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 14,
    gap: 13,
  },
  field: { gap: 5 },
  label: { color: BRAND_COLORS.ink, fontSize: 9, fontWeight: '900' },
  input: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#F9FAFB',
    color: BRAND_COLORS.ink,
    paddingHorizontal: 13,
    fontSize: 10,
  },
  inputError: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  fieldError: {
    color: BRAND_COLORS.danger,
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '700',
  },
  readonlyField: {
    minHeight: 62,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 13,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 4,
  },
  readonlyValue: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  errorCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 11,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '800',
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonCompact: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  centerState: {
    flex: 1,
    paddingHorizontal: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  bottomSpace: { height: 30 },
});
