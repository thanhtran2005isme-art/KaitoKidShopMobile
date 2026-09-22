import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { useAuth } from '@/context/AuthContext';
import { useCheckout } from '@/context/CheckoutContext';
import { checkoutApi } from '@/services/checkout.api';
import type {
  CheckoutAddress,
  CheckoutAddressInput,
} from '@/types/checkout';

type AddressForm = CheckoutAddressInput;
type AddressField =
  | 'fullName'
  | 'phone'
  | 'province'
  | 'district'
  | 'ward'
  | 'street';
type AddressFieldErrors = Partial<Record<AddressField, string>>;

const EMPTY_FORM: AddressForm = {
  fullName: '',
  phone: '',
  province: '',
  district: '',
  ward: '',
  street: '',
  isDefault: false,
};

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizePhone(value: string) {
  return value.replace(/[^0-9+]/g, '');
}

function addressText(address: CheckoutAddress) {
  return [
    address.street,
    address.ward,
    address.district,
    address.province,
  ]
    .filter(Boolean)
    .join(', ');
}

function validate(form: AddressForm): AddressFieldErrors {
  const errors: AddressFieldErrors = {};

  if (form.fullName.trim().length < 2) {
    errors.fullName = 'Vui lòng nhập họ tên người nhận.';
  }

  const phoneDigits = form.phone.replace(/\D/g, '');
  if (phoneDigits.length < 9 || phoneDigits.length > 12) {
    errors.phone = 'Số điện thoại cần có từ 9 đến 12 chữ số.';
  }

  if (!form.province.trim()) {
    errors.province = 'Vui lòng nhập tỉnh/thành phố.';
  }
  if (!form.district.trim()) {
    errors.district = 'Vui lòng nhập quận/huyện.';
  }
  if (!form.ward.trim()) {
    errors.ward = 'Vui lòng nhập phường/xã.';
  }
  if (!form.street.trim()) {
    errors.street = 'Vui lòng nhập số nhà và tên đường.';
  }

  return errors;
}

export default function CheckoutAddressScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { selectedAddress, setSelectedAddress } = useCheckout();

  const [addresses, setAddresses] = useState<CheckoutAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AddressFieldErrors>({});

  const selectedId = selectedAddress?.id ?? null;

  const updateField = (field: AddressField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const sortedAddresses = useMemo(
    () =>
      [...addresses].sort(
        (a, b) => Number(b.isDefault) - Number(a.isDefault),
      ),
    [addresses],
  );

  const load = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const items = await checkoutApi.getAddresses(token);
      setAddresses(items);

      if (!selectedAddress && items.length > 0) {
        setSelectedAddress(
          items.find((address) => address.isDefault) || items[0],
        );
      }
    } catch (loadError) {
      setError(messageFrom(loadError, 'Không thể tải sổ địa chỉ.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // load phụ thuộc token; selectedAddress được xử lý sau response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      isDefault: addresses.length === 0,
    });
    setError(null);
    setFieldErrors({});
    setShowForm(true);
  };

  const openEdit = (address: CheckoutAddress) => {
    setEditingId(address.id);
    setForm({
      fullName: address.fullName,
      phone: address.phone,
      province: address.province,
      district: address.district,
      ward: address.ward,
      street: address.street,
      isDefault: address.isDefault,
    });
    setError(null);
    setFieldErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setError(null);
    setFieldErrors({});
  };

  const save = async () => {
    if (!token || saving) return;

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Vui lòng kiểm tra các trường được đánh dấu bên dưới.');
      return;
    }

    const payload: CheckoutAddressInput = {
      fullName: form.fullName.trim(),
      phone: normalizePhone(form.phone.trim()),
      province: form.province.trim(),
      district: form.district.trim(),
      ward: form.ward.trim(),
      street: form.street.trim(),
      isDefault: form.isDefault,
    };

    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      const saved = editingId
        ? await checkoutApi.updateAddress(token, editingId, payload)
        : await checkoutApi.createAddress(token, payload);

      setAddresses((current) => {
        const next = editingId
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];

        if (!saved.isDefault) return next;

        return next.map((item) => ({
          ...item,
          isDefault: item.id === saved.id,
        }));
      });

      if (selectedId === editingId || !selectedAddress || saved.isDefault) {
        setSelectedAddress(saved);
      }

      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (saveError) {
      setError(
        messageFrom(
          saveError,
          editingId
            ? 'Không thể cập nhật địa chỉ.'
            : 'Không thể tạo địa chỉ.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const choose = (address: CheckoutAddress) => {
    setSelectedAddress(address);
    router.back();
  };

  const setDefault = async (address: CheckoutAddress) => {
    if (!token || busyId !== null || address.isDefault) return;

    setBusyId(address.id);
    setError(null);

    try {
      await checkoutApi.setDefaultAddress(token, address.id);
      const updated = addresses.map((item) => ({
        ...item,
        isDefault: item.id === address.id,
      }));
      setAddresses(updated);

      const selected = updated.find((item) => item.id === selectedId);
      if (selected) {
        setSelectedAddress(selected);
      }
    } catch (defaultError) {
      setError(
        messageFrom(defaultError, 'Không thể đặt địa chỉ mặc định.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = (address: CheckoutAddress) => {
    if (!token || busyId !== null) return;

    Alert.alert(
      'Xóa địa chỉ?',
      'Địa chỉ này sẽ bị xóa khỏi sổ địa chỉ của bạn.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(address.id);
              setError(null);

              try {
                await checkoutApi.deleteAddress(token, address.id);
                setAddresses((current) =>
                  current.filter((item) => item.id !== address.id),
                );
                if (selectedId === address.id) {
                  setSelectedAddress(null);
                }
              } catch (deleteError) {
                setError(
                  messageFrom(deleteError, 'Không thể xóa địa chỉ.'),
                );
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Phiên đăng nhập đã hết</Text>
          <Pressable
            onPress={() =>
              router.replace({
                pathname: '/auth/login',
                params: { redirect: '/checkout/address' },
              })
            }
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Đăng nhập lại</Text>
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Quay lại checkout"
              hitSlop={10}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>SỔ ĐỊA CHỈ</Text>
              <Text style={styles.title}>Địa chỉ nhận hàng</Text>
              <Text style={styles.subtitle}>
                Chọn một địa chỉ hoặc quản lý các địa chỉ đã lưu.
              </Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              {addresses.length === 0 && !showForm && !loading ? (
                <Pressable
                  accessibilityLabel="Tải lại sổ địa chỉ"
                  onPress={() => void load()}
                  style={({ pressed }) => [
                    styles.retryButton,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.retryButtonText}>Thử tải lại</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={BRAND_COLORS.primary} />
              <Text style={styles.loadingText}>
                Đang tải sổ địa chỉ...
              </Text>
            </View>
          ) : (
            <>
              {sortedAddresses.length > 0 ? (
                <View style={styles.addressList}>
                  {sortedAddresses.map((address) => {
                    const selected = address.id === selectedId;
                    const busy = address.id === busyId;

                    return (
                      <View
                        key={address.id}
                        style={[
                          styles.addressCard,
                          selected && styles.addressCardSelected,
                        ]}>
                        <Pressable
                          accessibilityLabel={
                            'Chọn địa chỉ ' +
                            address.fullName +
                            ', ' +
                            addressText(address)
                          }
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          disabled={busy}
                          onPress={() => choose(address)}
                          style={({ pressed }) => [
                            styles.addressMain,
                            pressed && styles.pressed,
                          ]}>
                          <View
                            style={[
                              styles.radio,
                              selected && styles.radioSelected,
                            ]}>
                            {selected ? <View style={styles.radioDot} /> : null}
                          </View>
                          <View style={styles.addressCopy}>
                            <View style={styles.nameRow}>
                              <Text style={styles.addressName}>
                                {address.fullName}
                              </Text>
                              {address.isDefault ? (
                                <View style={styles.defaultBadge}>
                                  <Text style={styles.defaultBadgeText}>
                                    Mặc định
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.phone}>{address.phone}</Text>
                            <Text style={styles.addressText}>
                              {addressText(address)}
                            </Text>
                          </View>
                        </Pressable>

                        <View style={styles.addressActions}>
                          <Pressable
                            accessibilityLabel={
                              'Sửa địa chỉ của ' + address.fullName
                            }
                            disabled={busy}
                            onPress={() => openEdit(address)}
                            style={({ pressed }) => [
                              styles.smallAction,
                              pressed && styles.pressed,
                              busy && styles.disabled,
                            ]}>
                            <Text style={styles.smallActionText}>Sửa</Text>
                          </Pressable>

                          {!address.isDefault ? (
                            <Pressable
                              accessibilityLabel="Đặt làm địa chỉ mặc định"
                              disabled={busy}
                              onPress={() => void setDefault(address)}
                              style={({ pressed }) => [
                                styles.smallAction,
                                pressed && styles.pressed,
                                busy && styles.disabled,
                              ]}>
                              <Text style={styles.smallActionText}>
                                Đặt mặc định
                              </Text>
                            </Pressable>
                          ) : null}

                          <Pressable
                            accessibilityLabel={
                              'Xóa địa chỉ của ' + address.fullName
                            }
                            disabled={busy}
                            onPress={() => remove(address)}
                            style={({ pressed }) => [
                              styles.smallActionDanger,
                              pressed && styles.pressed,
                              busy && styles.disabled,
                            ]}>
                            <Text style={styles.smallActionDangerText}>
                              Xóa
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>
                    Chưa có địa chỉ nào được lưu
                  </Text>
                  <Text style={styles.emptyText}>
                    Thêm địa chỉ đầu tiên để KaitoKid tính phí giao hàng.
                  </Text>
                </View>
              )}

              {!showForm ? (
                <Pressable
                  accessibilityLabel="Thêm địa chỉ mới"
                  onPress={openCreate}
                  style={({ pressed }) => [
                    styles.addButton,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.addButtonText}>+ Thêm địa chỉ mới</Text>
                </Pressable>
              ) : null}
            </>
          )}

          {showForm ? (
            <View style={styles.formCard}>
              <View style={styles.formHeading}>
                <View>
                  <Text style={styles.formEyebrow}>
                    {editingId ? 'CẬP NHẬT' : 'ĐỊA CHỈ MỚI'}
                  </Text>
                  <Text style={styles.formTitle}>
                    {editingId
                      ? 'Sửa thông tin nhận hàng'
                      : 'Thêm địa chỉ nhận hàng'}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Đóng form địa chỉ"
                  disabled={saving}
                  hitSlop={8}
                  onPress={closeForm}
                  style={styles.closeButton}>
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>

              <Field
                label="Họ tên người nhận"
                value={form.fullName}
                onChangeText={(value) => updateField('fullName', value)}
                error={fieldErrors.fullName}
                placeholder="Nguyễn Văn A"
                autoCapitalize="words"
              />

              <Field
                label="Số điện thoại"
                value={form.phone}
                onChangeText={(value) =>
                  updateField('phone', normalizePhone(value))
                }
                error={fieldErrors.phone}
                placeholder="0901234567"
                keyboardType="phone-pad"
              />

              <Field
                label="Tỉnh / Thành phố"
                value={form.province}
                onChangeText={(value) => updateField('province', value)}
                error={fieldErrors.province}
                placeholder="Hà Nội"
                autoCapitalize="words"
              />

              <Field
                label="Quận / Huyện"
                value={form.district}
                onChangeText={(value) => updateField('district', value)}
                error={fieldErrors.district}
                placeholder="Hoàn Kiếm"
                autoCapitalize="words"
              />

              <Field
                label="Phường / Xã"
                value={form.ward}
                onChangeText={(value) => updateField('ward', value)}
                error={fieldErrors.ward}
                placeholder="Hàng Bạc"
                autoCapitalize="words"
              />

              <Field
                label="Số nhà, tên đường"
                value={form.street}
                onChangeText={(value) => updateField('street', value)}
                error={fieldErrors.street}
                placeholder="12 Trần Hưng Đạo"
                autoCapitalize="sentences"
              />

              <View style={styles.switchRow}>
                <View style={styles.switchCopy}>
                  <Text style={styles.switchTitle}>
                    Đặt làm địa chỉ mặc định
                  </Text>
                  <Text style={styles.switchHint}>
                    Checkout sau sẽ ưu tiên địa chỉ này.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Đặt làm địa chỉ mặc định"
                  disabled={saving}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      isDefault: value,
                    }))
                  }
                  value={form.isDefault}
                  trackColor={{
                    false: '#D1D5DB',
                    true: '#C4B5FD',
                  }}
                  thumbColor={
                    form.isDefault
                      ? BRAND_COLORS.primary
                      : '#FFFFFF'
                  }
                />
              </View>

              <View style={styles.formActions}>
                <Pressable
                  disabled={saving}
                  onPress={closeForm}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.pressed,
                    saving && styles.disabled,
                  ]}>
                  <Text style={styles.cancelButtonText}>Hủy</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={
                    editingId ? 'Lưu thay đổi địa chỉ' : 'Lưu địa chỉ mới'
                  }
                  disabled={saving}
                  onPress={() => void save()}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.pressed,
                    saving && styles.disabled,
                  ]}>
                  <Text style={styles.saveButtonText}>
                    {saving
                      ? 'Đang lưu...'
                      : editingId
                        ? 'Lưu thay đổi'
                        : 'Lưu địa chỉ'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

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
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  error,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        returnKeyType="next"
        value={value}
        style={[styles.input, error && styles.inputError]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  backText: {
    color: BRAND_COLORS.ink,
    fontSize: 30,
    lineHeight: 32,
    marginTop: -2,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 2,
  },
  loadingCard: {
    minHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
  },
  addressList: { gap: 9 },
  addressCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    overflow: 'hidden',
  },
  addressCardSelected: {
    borderWidth: 1.5,
    borderColor: BRAND_COLORS.primary,
    backgroundColor: '#FDFBFF',
  },
  addressMain: {
    minHeight: 100,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioSelected: {
    borderColor: BRAND_COLORS.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BRAND_COLORS.primary,
  },
  addressCopy: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  addressName: {
    color: BRAND_COLORS.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  phone: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    fontWeight: '800',
  },
  addressText: {
    color: '#374151',
    fontSize: 9,
    lineHeight: 15,
  },
  defaultBadge: {
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  defaultBadgeText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 7,
    fontWeight: '900',
  },
  addressActions: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
  },
  smallAction: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionText: {
    color: BRAND_COLORS.ink,
    fontSize: 8,
    fontWeight: '900',
  },
  smallActionDanger: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionDangerText: {
    color: BRAND_COLORS.danger,
    fontSize: 8,
    fontWeight: '900',
  },
  addButton: {
    minHeight: 52,
    borderRadius: 17,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C4B5FD',
    backgroundColor: '#FDFBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: BRAND_COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
  },
  emptyCard: {
    minHeight: 160,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 5,
  },
  emptyTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    color: BRAND_COLORS.muted,
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    padding: 15,
    gap: 12,
  },
  formHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  formEyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  formTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: BRAND_COLORS.ink,
    fontSize: 23,
    lineHeight: 24,
  },
  field: { gap: 5 },
  fieldLabel: {
    color: BRAND_COLORS.ink,
    fontSize: 9,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FAFAFB',
    paddingHorizontal: 12,
    color: BRAND_COLORS.ink,
    fontSize: 11,
  },
  inputError: {
    borderColor: '#F87171',
    backgroundColor: '#FFF7F7',
  },
  fieldError: {
    color: BRAND_COLORS.danger,
    fontSize: 8,
    lineHeight: 13,
    fontWeight: '700',
  },
  switchRow: {
    minHeight: 58,
    borderRadius: 15,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchCopy: { flex: 1, gap: 2 },
  switchTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  switchHint: {
    color: BRAND_COLORS.muted,
    fontSize: 8,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    minHeight: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: BRAND_COLORS.ink,
    fontSize: 10,
    fontWeight: '900',
  },
  saveButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  errorCard: {
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 11,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '700',
  },
  retryButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#B91C1C',
    fontSize: 8,
    fontWeight: '900',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  stateTitle: {
    color: BRAND_COLORS.ink,
    fontSize: 19,
    fontWeight: '900',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.48 },
  bottomSpace: { height: 28 },
});
