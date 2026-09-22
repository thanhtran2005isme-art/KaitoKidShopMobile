import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
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
import { accountApi } from '@/services/account.api';

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { token, loading: authLoading, logout } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteLock = useRef(false);

  const executeDelete = async () => {
    if (!token || deleting || deleteLock.current) return;

    deleteLock.current = true;
    setDeleting(true);
    setError(null);

    try {
      await accountApi.deleteAccount(token, 'DELETE');
      await logout();
      router.replace('/');
    } catch (deleteError) {
      setError(messageFrom(deleteError, 'Không thể hủy tài khoản.'));
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (confirmText.trim() !== 'DELETE') {
      setError('Vui lòng nhập đúng DELETE để xác nhận.');
      return;
    }

    Alert.alert(
      'Xác nhận hủy tài khoản',
      'Dữ liệu cá nhân sẽ được ẩn danh, wishlist/giỏ hàng/địa chỉ/thông báo sẽ bị xóa và các voucher cá nhân còn hiệu lực sẽ bị vô hiệu hóa. Các đơn hàng vẫn được giữ cho kế toán và lịch sử hệ thống.',
      [
        { text: 'Quay lại', style: 'cancel' },
        {
          text: 'Hủy tài khoản',
          style: 'destructive',
          onPress: () => void executeDelete(),
        },
      ],
    );
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.title}>Phiên đăng nhập đã kết thúc</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/')}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Về trang chủ</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const valid = confirmText.trim() === 'DELETE';

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
              <Text style={styles.eyebrow}>VÙNG NGUY HIỂM</Text>
              <Text style={styles.title}>Hủy tài khoản</Text>
            </View>
          </View>

          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Thao tác này không thể hoàn tác trong ứng dụng</Text>
            <Text style={styles.warningText}>
              KaitoKid sẽ ẩn danh tên, email, số điện thoại, avatar và ngày sinh; xóa wishlist, giỏ hàng, địa chỉ và thông báo; vô hiệu hóa voucher cá nhân còn hạn.
            </Text>
            <Text style={styles.warningText}>
              Lịch sử đơn hàng được giữ để phục vụ kế toán/báo cáo. Review được giữ nội dung nhưng đổi tên hiển thị thành người dùng ẩn danh.
            </Text>
            <Text style={styles.warningText}>
              Nếu giỏ còn giữ hàng, backend sẽ giải phóng reservation trước khi xóa Cart để tồn kho không bị kẹt.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Nhập DELETE để xác nhận *</Text>
            <TextInput
              accessibilityLabel="Nhập DELETE để xác nhận hủy tài khoản"
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={(value) => {
                setConfirmText(value);
                if (error) setError(null);
              }}
              placeholder="DELETE"
              placeholderTextColor="#9CA3AF"
              style={[styles.input, error && !valid && styles.inputError]}
              value={confirmText}
            />
            <Text style={styles.helper}>
              Backend chỉ chấp nhận đúng từ khóa DELETE, không dùng mật khẩu hoặc mã khác tại endpoint hiện tại.
            </Text>
          </View>

          {error ? (
            <View accessibilityRole="alert" style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="Hủy vĩnh viễn tài khoản KaitoKid"
            accessibilityRole="button"
            disabled={!valid || deleting}
            onPress={confirmDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
              (!valid || deleting) && styles.disabled,
            ]}>
            {deleting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.deleteButtonText}>Hủy tài khoản của tôi</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityLabel="Giữ tài khoản và quay lại"
            accessibilityRole="button"
            disabled={deleting}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
              deleting && styles.disabled,
            ]}>
            <Text style={styles.secondaryButtonText}>Giữ tài khoản</Text>
          </Pressable>

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
    maxWidth: 640,
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
    color: BRAND_COLORS.danger,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'left',
  },
  warningCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 15,
    gap: 9,
  },
  warningTitle: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  warningText: {
    color: '#7F1D1D',
    fontSize: 9,
    lineHeight: 15,
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 14,
    gap: 7,
  },
  label: { color: BRAND_COLORS.ink, fontSize: 10, fontWeight: '900' },
  input: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#F9FAFB',
    color: BRAND_COLORS.ink,
    paddingHorizontal: 13,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  inputError: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  helper: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    lineHeight: 13,
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
  deleteButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  centerState: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
  bottomSpace: { height: 30 },
});
