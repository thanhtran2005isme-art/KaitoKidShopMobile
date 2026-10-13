import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';

type QuantityNumberInputProps = {
  value: number;
  max: number;
  disabled?: boolean;
  variant?: 'light' | 'dark';
  onChange: (value: number) => void;
};

/**
 * Nhập số lượng trực tiếp bằng bàn phím số, chỉ commit khi rời ô / nhấn Done.
 * Không đẩy request theo từng phím trong giỏ hàng; server vẫn kiểm tra tồn kho.
 */
export function QuantityNumberInput({
  value,
  max,
  disabled = false,
  variant = 'light',
  onChange,
}: QuantityNumberInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const safeMax = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;
  const displayValue = safeMax === 0 ? 0 : value;
  const [draft, setDraft] = useState(String(displayValue));

  useEffect(() => {
    if (!focused) setDraft(String(displayValue));
  }, [displayValue, focused, disabled]);

  const commit = () => {
    setFocused(false);
    if (disabled || safeMax === 0) {
      setDraft(String(displayValue));
      return;
    }

    const parsed = draft ? Number(draft) : value;
    const valid = Number.isSafeInteger(parsed) ? parsed : value;
    const next = Math.max(1, Math.min(safeMax, valid));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <TextInput
      ref={inputRef}
      accessibilityLabel="Nhập số lượng sản phẩm"
      accessibilityHint={safeMax > 0 ? 'Từ 1 đến ' + safeMax + ' sản phẩm' : 'Sản phẩm hết hàng'}
      editable={!disabled && safeMax > 0}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={9}
      onBlur={commit}
      onChangeText={(text) => {
        if (/^\\d*$/.test(text)) setDraft(text);
      }}
      onFocus={() => setFocused(true)}
      onSubmitEditing={() => inputRef.current?.blur()}
      returnKeyType="done"
      selectTextOnFocus
      selectionColor={variant === 'dark' ? '#FFFFFF' : BRAND_COLORS.primary}
      style={[
        styles.input,
        variant === 'dark' ? styles.dark : styles.light,
        focused && (variant === 'dark' ? styles.focusedDark : styles.focusedLight),
        (disabled || safeMax === 0) && styles.disabled,
      ]}
      textAlign="center"
      value={draft}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: 48,
    minHeight: 44,
    paddingHorizontal: 2,
    paddingVertical: 0,
    fontSize: 15,
    fontWeight: '800',
    borderWidth: 1,
  },
  light: {
    color: BRAND_COLORS.ink,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
  },
  dark: {
    color: '#FFFFFF',
    borderColor: '#374151',
    backgroundColor: '#1C1E22',
  },
  focusedDark: { borderColor: '#FFFFFF' },
  focusedLight: { borderColor: BRAND_COLORS.primary },
  disabled: { opacity: 0.45 },
});
