import { StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';

const STEPS = ['Giỏ hàng', 'Thông tin', 'Thanh toán', 'Hoàn tất'];

export function CheckoutStepper({ active }: { active: 1 | 2 | 3 | 4 }) {
  return (
    <View style={styles.wrap}>
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < active;
        const current = step === active;

        return (
          <View key={label} style={styles.itemWrap}>
            <View style={styles.item}>
              <View
                style={[
                  styles.circle,
                  (done || current) && styles.circleActive,
                  current && styles.circleCurrent,
                ]}>
                <Text
                  style={[
                    styles.number,
                    done && styles.numberDone,
                    current && styles.numberCurrent,
                  ]}>
                  {done ? '✓' : String(step)}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  (done || current) && styles.labelActive,
                ]}>
                {label}
              </Text>
            </View>
            {index < STEPS.length - 1 ? (
              <View
                style={[
                  styles.line,
                  step < active && styles.lineActive,
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  item: {
    width: 58,
    alignItems: 'center',
    gap: 5,
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND_COLORS.line,
    backgroundColor: BRAND_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  circleCurrent: {
    backgroundColor: BRAND_COLORS.primary,
  },
  number: {
    color: BRAND_COLORS.muted,
    fontSize: 10,
    fontWeight: '900',
  },
  numberDone: {
    color: BRAND_COLORS.primaryDark,
  },
  numberCurrent: {
    color: '#FFFFFF',
  },
  label: {
    width: 64,
    color: BRAND_COLORS.muted,
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
  },
  labelActive: {
    color: BRAND_COLORS.ink,
    fontWeight: '900',
  },
  line: {
    flex: 1,
    height: 2,
    marginTop: 14,
    marginHorizontal: 3,
    backgroundColor: BRAND_COLORS.line,
  },
  lineActive: {
    backgroundColor: BRAND_COLORS.primary,
  },
});
