import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { walletApi } from '@/services/wallet.api';
import type {
  WalletSummary,
  WalletTransaction,
  WalletWithdrawal,
} from '@/types/wallet';
import { formatDateTime } from '@/utils/order-status';

function money(value: number) {
  return Math.round(Math.max(0, value || 0)).toLocaleString('vi-VN') + 'đ';
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function withdrawalLabel(status: string) {
  switch ((status || '').toLowerCase()) {
    case 'pending': return 'Chờ duyệt';
    case 'approved': return 'Đã duyệt · chờ chuyển khoản';
    case 'completed': return 'Đã chuyển khoản';
    case 'rejected': return 'Đã từ chối';
    default: return status || 'Không xác định';
  }
}

function transactionAmount(item: WalletTransaction) {
  const prefix = item.direction === 'credit' ? '+' : '−';
  return prefix + money(item.amount);
}

export default function WalletScreen() {
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WalletWithdrawal[]>([]);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const submitLock = useRef(false);

  const load = useCallback(async (refresh = false) => {
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [nextSummary, nextTransactions, nextWithdrawals] = await Promise.all([
        walletApi.getSummary(token),
        walletApi.getTransactions(token, 1, 50),
        walletApi.getWithdrawals(token),
      ]);
      setSummary(nextSummary);
      setTransactions(nextTransactions);
      setWithdrawals(nextWithdrawals);
    } catch (loadError) {
      setError(messageFrom(loadError, 'Không thể tải Ví KaitoKid.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading) void load(false);
  }, [authLoading, load]);

  const available = summary?.availableBalance ?? 0;
  const parsedAmount = useMemo(
    () => Number(amount.replace(/\D/g, '')),
    [amount],
  );

  const refresh = async () => {
    if (refreshing) return;
    setSuccess(null);
    await load(true);
  };

  const submitWithdrawal = async () => {
    if (!token || submitting || submitLock.current) return;
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
      setError('Vui lòng nhập số tiền rút hợp lệ.');
      return;
    }
    if (parsedAmount > available) {
      setError('Số tiền rút lớn hơn số dư khả dụng.');
      return;
    }
    if (bankName.trim().length < 2) {
      setError('Vui lòng nhập tên ngân hàng.');
      return;
    }
    if (accountNumber.replace(/\s+/g, '').length < 4) {
      setError('Vui lòng nhập số tài khoản hợp lệ.');
      return;
    }
    if (accountHolder.trim().length < 2) {
      setError('Vui lòng nhập tên chủ tài khoản.');
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await walletApi.createWithdrawal(token, {
        amount: parsedAmount,
        bankName: bankName.trim(),
        accountNumber: accountNumber.replace(/\s+/g, ''),
        accountHolder: accountHolder.trim(),
        note: note.trim() || undefined,
      });
      setAmount('');
      setBankName('');
      setAccountNumber('');
      setAccountHolder('');
      setNote('');
      setSuccess('Đã tạo yêu cầu rút tiền. Số tiền đang được tạm giữ trong lúc KaitoKid xử lý.');
      await load(false);
    } catch (submitError) {
      setError(messageFrom(submitError, 'Không thể tạo yêu cầu rút tiền.'));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (authLoading || (loading && !summary)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.stateTitle}>Đang tải Ví KaitoKid</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Bạn cần đăng nhập</Text>
          <Text style={styles.stateText}>Đăng nhập để xem số dư và yêu cầu rút tiền.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/auth/login')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={BRAND_COLORS.primary}
              onRefresh={() => void refresh()}
            />
          }
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Quay lại tài khoản"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <AppIcon color={BRAND_COLORS.ink} name="arrowLeft" size={22} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>KAITOKID WALLET</Text>
              <Text style={styles.title}>Ví KaitoKid</Text>
              <Text style={styles.subtitle}>
                Tiền hoàn hàng vào ví để mua tiếp hoặc rút về ngân hàng.
              </Text>
            </View>
          </View>

          {error ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {success ? (
            <View accessibilityRole="alert" style={styles.successBox}>
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          {summary ? (
            <View style={styles.balanceGrid}>
              <BalanceCard label="Khả dụng" value={money(summary.availableBalance)} />
              <BalanceCard label="Tạm giữ" value={money(summary.heldBalance)} />
              <BalanceCard label="Tổng số dư" value={money(summary.totalBalance)} wide />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionKicker}>RÚT TIỀN</Text>
            <Text style={styles.sectionTitle}>Tài khoản nhận tiền</Text>
            <Text style={styles.sectionHint}>
              Khi gửi yêu cầu, tiền được chuyển từ số dư khả dụng sang tạm giữ ngay để chống chi tiêu/rút trùng.
            </Text>

            <Field
              label="Số tiền rút"
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder={available > 0 ? 'Tối đa ' + money(available) : 'Ví chưa có số dư khả dụng'}
            />
            <Field
              label="Ngân hàng"
              value={bankName}
              onChangeText={setBankName}
              placeholder="Ví dụ Vietcombank"
            />
            <Field
              label="Số tài khoản"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
              placeholder="Số tài khoản nhận tiền"
            />
            <Field
              label="Tên chủ tài khoản"
              value={accountHolder}
              onChangeText={setAccountHolder}
              autoCapitalize="characters"
              placeholder="NGUYEN VAN A"
            />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Ghi chú (không bắt buộc)</Text>
              <TextInput
                accessibilityLabel="Ghi chú yêu cầu rút tiền"
                maxLength={300}
                multiline
                onChangeText={setNote}
                placeholder="Thông tin cần KaitoKid lưu ý"
                placeholderTextColor={BRAND_COLORS.muted}
                style={[styles.input, styles.textArea]}
                value={note}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={submitting || available <= 0}
              onPress={() => void submitWithdrawal()}
              style={({ pressed }) => [
                styles.primaryButton,
                (submitting || available <= 0) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Tạo yêu cầu rút tiền</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker}>YÊU CẦU RÚT TIỀN</Text>
            <Text style={styles.sectionTitle}>Trạng thái xử lý</Text>
            {withdrawals.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có yêu cầu rút tiền.</Text>
            ) : (
              withdrawals.map((item) => (
                <View key={item.id} style={styles.rowCard}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowAmount}>{money(item.amount)}</Text>
                    <Text style={styles.statusPill}>{withdrawalLabel(item.status)}</Text>
                  </View>
                  <Text style={styles.rowTitle}>
                    {item.bankName + ' · ' + item.accountNumber}
                  </Text>
                  <Text style={styles.rowMeta}>{item.accountHolder}</Text>
                  <Text style={styles.rowMeta}>{formatDateTime(item.createdAt)}</Text>
                  {item.bankReference ? (
                    <Text style={styles.rowMeta}>Mã giao dịch: {item.bankReference}</Text>
                  ) : null}
                  {item.adminNote ? (
                    <Text style={styles.rowNote}>{item.adminNote}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker}>LỊCH SỬ VÍ</Text>
            <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có giao dịch ví.</Text>
            ) : (
              transactions.map((item) => (
                <View key={item.id} style={styles.transactionRow}>
                  <View style={styles.transactionCopy}>
                    <Text style={styles.rowTitle}>{item.description || item.type}</Text>
                    <Text style={styles.rowMeta}>{formatDateTime(item.createdAt)}</Text>
                    <Text style={styles.rowMeta}>
                      Còn {money(item.availableAfter)} · giữ {money(item.heldAfter)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      item.direction === 'credit' ? styles.credit : styles.debit,
                    ]}>
                    {transactionAmount(item)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BalanceCard({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.balanceCard, wide && styles.balanceCardWide]}>
      <Text style={styles.balanceLabel}>{label}</Text>
      <Text style={styles.balanceValue}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={BRAND_COLORS.muted}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: BRAND_COLORS.canvas },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 28, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
  },
  headerCopy: { flex: 1, paddingTop: 1 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3, color: BRAND_COLORS.muted },
  title: { marginTop: 4, fontSize: 28, lineHeight: 34, fontWeight: '800', color: BRAND_COLORS.ink },
  subtitle: { marginTop: 5, fontSize: 14, lineHeight: 21, color: BRAND_COLORS.muted },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  stateTitle: { fontSize: 18, fontWeight: '800', color: BRAND_COLORS.ink, textAlign: 'center' },
  stateText: { fontSize: 14, lineHeight: 21, color: BRAND_COLORS.muted, textAlign: 'center' },
  errorBox: { padding: 12, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: BRAND_COLORS.danger, fontSize: 13, lineHeight: 19 },
  successBox: { padding: 12, borderRadius: 12, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  successText: { color: BRAND_COLORS.success, fontSize: 13, lineHeight: 19 },
  balanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  balanceCard: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 94,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    justifyContent: 'space-between',
  },
  balanceCardWide: { flexBasis: '100%' },
  balanceLabel: { fontSize: 12, color: BRAND_COLORS.muted, fontWeight: '700' },
  balanceValue: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: BRAND_COLORS.ink },
  section: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    gap: 12,
  },
  sectionKicker: { fontSize: 10, letterSpacing: 1.2, fontWeight: '800', color: BRAND_COLORS.muted },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: BRAND_COLORS.ink },
  sectionHint: { fontSize: 13, lineHeight: 20, color: BRAND_COLORS.muted },
  field: { gap: 7 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: BRAND_COLORS.ink },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    color: BRAND_COLORS.ink,
    fontSize: 15,
  },
  textArea: { minHeight: 92, textAlignVertical: 'top' },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: BRAND_COLORS.primary,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  emptyText: { fontSize: 14, lineHeight: 21, color: BRAND_COLORS.muted },
  rowCard: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: BRAND_COLORS.line, gap: 5 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  rowAmount: { fontSize: 17, fontWeight: '900', color: BRAND_COLORS.ink },
  statusPill: {
    flexShrink: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.canvas,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '800',
    color: BRAND_COLORS.ink,
  },
  rowTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: BRAND_COLORS.ink },
  rowMeta: { fontSize: 12, lineHeight: 18, color: BRAND_COLORS.muted },
  rowNote: { fontSize: 12, lineHeight: 18, color: BRAND_COLORS.ink },
  transactionRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: BRAND_COLORS.line },
  transactionCopy: { flex: 1, gap: 3 },
  transactionAmount: { fontSize: 14, fontWeight: '900', textAlign: 'right' },
  credit: { color: BRAND_COLORS.success },
  debit: { color: BRAND_COLORS.ink },
  bottomSpace: { height: 12 },
});
