import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { accountApi } from '@/services/account.api';
import type { AccountProfile, AccountVoucher } from '@/types/account';
import { formatDate } from '@/utils/order-status';

function money(value: number) {
  return Math.round(Math.max(0, value || 0)).toLocaleString('vi-VN') + 'đ';
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function voucherValue(voucher: AccountVoucher) {
  return voucher.type.toLowerCase() === 'percent'
    ? 'Giảm ' + voucher.value.toLocaleString('vi-VN') + '%'
    : 'Giảm ' + money(voucher.value);
}

export default function AccountVouchersScreen() {
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [vouchers, setVouchers] = useState<AccountVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const claimLock = useRef(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!token) {
        setLoading(false);
        return;
      }

      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [nextProfile, nextVouchers] = await Promise.all([
          accountApi.getProfile(token),
          accountApi.getVouchers(token),
        ]);
        setProfile(nextProfile);
        setVouchers(nextVouchers);
      } catch (loadError) {
        setError(messageFrom(loadError, 'Không thể tải voucher.'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const claimBirthday = async () => {
    if (!token || claiming || claimLock.current) return;

    claimLock.current = true;
    setClaiming(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await accountApi.claimBirthdayVoucher(token);
      setSuccess(result.message + ' Mã: ' + result.code);
      await load(false);
    } catch (claimError) {
      setError(
        messageFrom(
          claimError,
          'Chưa thể nhận voucher sinh nhật ở thời điểm này.',
        ),
      );
    } finally {
      claimLock.current = false;
      setClaiming(false);
    }
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang tải voucher</Text>
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
            style={styles.primaryCompact}>
            <Text style={styles.primaryText}>Đăng nhập</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.shell}>
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
            <Text style={styles.eyebrow}>ƯU ĐÃI CÁ NHÂN</Text>
            <Text style={styles.title}>Voucher của tôi</Text>
            <Text style={styles.subtitle}>
              Voucher đổi điểm và voucher sinh nhật còn hiệu lực.
            </Text>
          </View>
        </View>

        <View style={styles.birthdayCard}>
          <View style={styles.birthdayCopy}>
            <Text style={styles.birthdayTitle}>Quà sinh nhật KaitoKid</Text>
            <Text style={styles.birthdayText}>
              {profile?.birthday
                ? 'Ngày sinh đã lưu: ' + formatDate(profile.birthday) + '. Backend sẽ kiểm tra đúng tháng sinh và giới hạn 1 lần/năm.'
                : 'Hãy cập nhật ngày sinh trong Hồ sơ trước khi nhận quà sinh nhật.'}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Nhận voucher sinh nhật"
            accessibilityRole="button"
            disabled={claiming || !profile?.birthday}
            onPress={() => void claimBirthday()}
            style={({ pressed }) => [
              styles.claimButton,
              pressed && styles.pressed,
              (claiming || !profile?.birthday) && styles.disabled,
            ]}>
            {claiming ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.claimButtonText}>Nhận quà</Text>
            )}
          </Pressable>
        </View>

        {success ? (
          <View accessibilityRole="alert" style={styles.successCard}>
            <Text selectable style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        {error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>Voucher đang dùng được</Text>
          <Text style={styles.listCount}>{vouchers.length}</Text>
        </View>

        <FlatList
          contentContainerStyle={[
            styles.listContent,
            vouchers.length === 0 && styles.listEmpty,
          ]}
          data={vouchers}
          keyExtractor={(item) => item.code}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Chưa có voucher cá nhân</Text>
              <Text style={styles.emptyText}>
                Bạn có thể đổi điểm thành voucher hoặc nhận quà sinh nhật khi đủ điều kiện.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/account/points')}
                style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Đi tới Điểm thành viên</Text>
              </Pressable>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={BRAND_COLORS.primary}
              onRefresh={() => void load(true)}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.voucherCard}>
              <View style={styles.voucherTop}>
                <View style={styles.valueBlock}>
                  <Text style={styles.voucherValue}>{voucherValue(item)}</Text>
                  <Text style={styles.voucherMin}>
                    {'Đơn từ ' + money(item.minOrderAmount)}
                  </Text>
                </View>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Còn hiệu lực</Text>
                </View>
              </View>

              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Mã voucher</Text>
                <Text selectable style={styles.code}>{item.code}</Text>
              </View>

              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.expiry}>
                {'Hết hạn: ' + formatDate(item.endDate)}
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          windowSize={7}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
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
  birthdayCard: {
    minHeight: 104,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 10,
  },
  birthdayCopy: { flex: 1 },
  birthdayTitle: {
    color: '#9A3412',
    fontSize: 11,
    fontWeight: '900',
  },
  birthdayText: {
    marginTop: 4,
    color: '#7C2D12',
    fontSize: 8,
    lineHeight: 13,
  },
  claimButton: {
    minWidth: 78,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  claimButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  successCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    padding: 11,
    marginBottom: 9,
  },
  successText: {
    color: '#047857',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '700',
  },
  errorCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 11,
    marginBottom: 9,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '800',
  },
  listHeading: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  listTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  listCount: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BRAND_COLORS.primarySoft,
    color: BRAND_COLORS.primaryDark,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 26,
    fontSize: 8,
    fontWeight: '900',
  },
  listContent: { paddingTop: 7, paddingBottom: 30 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  separator: { height: 9 },
  voucherCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 14,
    gap: 10,
  },
  voucherTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  valueBlock: { flex: 1 },
  voucherValue: {
    color: BRAND_COLORS.accent,
    fontSize: 19,
    fontWeight: '900',
  },
  voucherMin: {
    marginTop: 2,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    fontWeight: '700',
  },
  activeBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  activeBadgeText: {
    color: BRAND_COLORS.success,
    fontSize: 7,
    fontWeight: '900',
  },
  codeBox: {
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primarySoft,
    padding: 11,
    gap: 3,
  },
  codeLabel: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 7,
    fontWeight: '800',
  },
  code: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  description: {
    color: '#4B5563',
    fontSize: 9,
    lineHeight: 14,
  },
  expiry: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  emptyTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 5,
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 15,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 13,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
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
  primaryCompact: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.45 },
});
