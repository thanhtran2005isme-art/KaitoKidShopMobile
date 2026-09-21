import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';
import { productColorValue } from '@/utils/product-detail';

type ProductOptionSelectorProps = {
  label: string;
  values: string[];
  selected?: string | null;
  type?: 'text' | 'color';
  helper?: string;
  onSelect: (value: string) => void;
  isDisabled?: (value: string) => boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export function ProductOptionSelector({
  label,
  values,
  selected,
  type = 'text',
  helper,
  onSelect,
  isDisabled,
  actionLabel,
  onAction,
}: ProductOptionSelectorProps) {
  if (!values.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.label}>{label}</Text>
          {selected ? <Text style={styles.selected}>Đã chọn: {selected}</Text> : null}
        </View>

        {actionLabel && onAction ? (
          <Pressable onPress={onAction}>
            <Text style={styles.action}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      <View style={styles.options}>
        {values.map((value) => {
          const disabled = isDisabled?.(value) ?? false;
          const active = selected === value;

          return (
            <Pressable
              accessibilityLabel={`${label}: ${value}${disabled ? ', hết hàng' : ''}`}
              accessibilityRole="button"
              disabled={disabled}
              key={value}
              onPress={() => onSelect(value)}
              style={({ pressed }) => [
                styles.option,
                type === 'color' && styles.colorOption,
                active && styles.optionActive,
                disabled && styles.optionDisabled,
                pressed && !disabled && styles.optionPressed,
              ]}>
              {type === 'color' ? (
                <View
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: productColorValue(value),
                      borderColor: value.toLowerCase().includes('trắng')
                        ? '#D1D5DB'
                        : 'rgba(17,24,39,0.12)',
                    },
                  ]}
                />
              ) : null}

              <Text
                style={[
                  styles.optionText,
                  active && styles.optionTextActive,
                  disabled && styles.optionTextDisabled,
                ]}>
                {value}
              </Text>

              {disabled ? <View style={styles.strike} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 9 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  headingCopy: { gap: 2 },
  label: {
    color: BRAND_COLORS.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  selected: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  action: {
    color: BRAND_COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  helper: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  colorOption: {
    flexDirection: 'row',
    gap: 7,
  },
  optionActive: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  optionDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.56,
  },
  optionPressed: { opacity: 0.72 },
  optionText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '800',
  },
  optionTextActive: {
    color: BRAND_COLORS.primaryDark,
  },
  optionTextDisabled: {
    color: '#9CA3AF',
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  strike: {
    position: 'absolute',
    width: '130%',
    height: 1,
    backgroundColor: '#9CA3AF',
    transform: [{ rotate: '-16deg' }],
  },
});
