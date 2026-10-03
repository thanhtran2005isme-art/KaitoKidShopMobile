import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { releaseWebFocus } from '@/utils/web-focus';

import { PAYMENT_METHOD_LOGO_URIS } from './payment-method-logo-uris';

type FieldName = 'holder' | 'cardNumber' | 'expiry' | 'cvv' | null;

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function formatCardNumber(value: string) {
  return digitsOnly(value)
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

function formatExpiry(value: string) {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + '/' + digits.slice(2);
}

export function CreditCardPaymentForm() {
  const router = useRouter();
  const [holderName, setHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [focusedField, setFocusedField] = useState<FieldName>(null);

  const goBack = () => {
    releaseWebFocus();
    router.back();
  };

  const unavailableWallet = (name: string) => {
    Alert.alert(
      name,
      'Phương thức này chưa được cấu hình trong backend hiện tại.',
    );
  };

  const checkout = () => {
    const cardDigits = digitsOnly(cardNumber);
    const expiryDigits = digitsOnly(expiry);

    if (!holderName.trim()) {
      Alert.alert('Thông tin chưa hợp lệ', 'Vui lòng nhập tên chủ thẻ.');
      return;
    }

    if (cardDigits.length !== 16) {
      Alert.alert('Thông tin chưa hợp lệ', 'Số thẻ phải có 16 chữ số.');
      return;
    }

    if (expiryDigits.length !== 4) {
      Alert.alert('Thông tin chưa hợp lệ', 'Vui lòng nhập ngày hết hạn MM/YY.');
      return;
    }

    if (cvv.length < 3) {
      Alert.alert('Thông tin chưa hợp lệ', 'CVV phải có ít nhất 3 chữ số.');
      return;
    }

    Alert.alert(
      'Chưa hỗ trợ thanh toán thẻ',
      'Backend hiện chưa hỗ trợ giao dịch thẻ tín dụng. Thông tin vừa nhập chỉ tồn tại trong state của màn hình và không được gửi hoặc lưu lại.',
    );
  };

  return (
    <View style={styles.modal}>
      <View style={styles.form}>
        <Pressable
          accessibilityLabel="Quay lại trang thanh toán"
          accessibilityRole="button"
          hitSlop={8}
          onPress={goBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}>
          <AppIcon color="#1B1B1B" name="arrowLeft" size={20} />
          <Text style={styles.backButtonText}>Quay lại</Text>
        </Pressable>

        <View style={styles.paymentOptions}>
          <Pressable
            accessibilityLabel="PayPal"
            accessibilityRole="button"
            onPress={() => unavailableWallet('PayPal')}
            style={({ pressed }) => [
              styles.paymentOptionButton,
              styles.paymentOptionOuter,
              pressed && styles.pressed,
            ]}>
            <Image
              accessibilityLabel="PayPal"
              contentFit="contain"
              source={{ uri: PAYMENT_METHOD_LOGO_URIS.paypal }}
              style={styles.paypalLogo}
            />
          </Pressable>

          <Pressable
            accessibilityLabel="Apple Pay"
            accessibilityRole="button"
            onPress={() => unavailableWallet('Apple Pay')}
            style={({ pressed }) => [
              styles.paymentOptionButton,
              styles.paymentOptionMiddle,
              pressed && styles.pressed,
            ]}>
            <Image
              accessibilityLabel="Apple Pay"
              contentFit="contain"
              source={{ uri: PAYMENT_METHOD_LOGO_URIS.applePay }}
              style={styles.applePayLogo}
            />
          </Pressable>

          <Pressable
            accessibilityLabel="Google Pay"
            accessibilityRole="button"
            onPress={() => unavailableWallet('Google Pay')}
            style={({ pressed }) => [
              styles.paymentOptionButton,
              styles.paymentOptionOuter,
              pressed && styles.pressed,
            ]}>
            <Image
              accessibilityLabel="Google Pay"
              contentFit="contain"
              source={{ uri: PAYMENT_METHOD_LOGO_URIS.googlePay }}
              style={styles.googlePayLogo}
            />
          </Pressable>
        </View>

        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text numberOfLines={1} style={styles.separatorText}>
            or pay using credit card
          </Text>
          <View style={styles.separatorLine} />
        </View>

        <View style={styles.creditCardForm}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Card holder full name</Text>
            <TextInput
              accessibilityLabel="Card holder full name"
              autoCapitalize="words"
              autoCorrect={false}
              onBlur={() => setFocusedField(null)}
              onChangeText={setHolderName}
              onFocus={() => setFocusedField('holder')}
              placeholder="Enter your full name"
              placeholderTextColor="#8B8E98"
              style={[
                styles.inputField,
                focusedField === 'holder' && styles.inputFieldFocused,
              ]}
              value={holderName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Card Number</Text>
            <TextInput
              accessibilityLabel="Card Number"
              keyboardType="number-pad"
              maxLength={19}
              onBlur={() => setFocusedField(null)}
              onChangeText={(value) => setCardNumber(formatCardNumber(value))}
              onFocus={() => setFocusedField('cardNumber')}
              placeholder="0000 0000 0000 0000"
              placeholderTextColor="#8B8E98"
              style={[
                styles.inputField,
                focusedField === 'cardNumber' && styles.inputFieldFocused,
              ]}
              value={cardNumber}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Expiry Date / CVV</Text>
            <View style={styles.split}>
              <TextInput
                accessibilityLabel="Expiry Date"
                keyboardType="number-pad"
                maxLength={5}
                onBlur={() => setFocusedField(null)}
                onChangeText={(value) => setExpiry(formatExpiry(value))}
                onFocus={() => setFocusedField('expiry')}
                placeholder="01/23"
                placeholderTextColor="#8B8E98"
                style={[
                  styles.inputField,
                  styles.expiryInput,
                  focusedField === 'expiry' && styles.inputFieldFocused,
                ]}
                value={expiry}
              />
              <TextInput
                accessibilityLabel="CVV"
                keyboardType="number-pad"
                maxLength={4}
                onBlur={() => setFocusedField(null)}
                onChangeText={(value) => setCvv(digitsOnly(value).slice(0, 4))}
                onFocus={() => setFocusedField('cvv')}
                placeholder="CVV"
                placeholderTextColor="#8B8E98"
                secureTextEntry
                style={[
                  styles.inputField,
                  styles.cvvInput,
                  focusedField === 'cvv' && styles.inputFieldFocused,
                ]}
                value={cvv}
              />
            </View>
          </View>
        </View>

        <Pressable
          accessibilityLabel="Checkout"
          accessibilityRole="button"
          onPress={checkout}
          style={({ pressed }) => [
            styles.purchaseButton,
            pressed && styles.purchaseButtonPressed,
          ]}>
          <LinearGradient
            colors={['#363636', '#1B1B1B', '#000000']}
            end={{ x: 0.5, y: 1 }}
            start={{ x: 0.5, y: 0 }}
            style={styles.purchaseGradient}>
            <Text style={styles.purchaseButtonText}>Checkout</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modal: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 26,
    elevation: 10,
  },
  form: {
    gap: 20,
    padding: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#1B1B1B',
    fontSize: 13,
    fontWeight: '700',
  },
  paymentOptions: {
    flexDirection: 'row',
    gap: 20,
    padding: 10,
    marginHorizontal: 10,
  },
  paymentOptionButton: {
    minWidth: 0,
    height: 55,
    backgroundColor: '#F2F2F2',
    borderRadius: 11,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentOptionOuter: {
    flex: 33,
  },
  paymentOptionMiddle: {
    flex: 34,
  },
  paypalLogo: {
    width: 68,
    height: 18,
  },
  applePayLogo: {
    width: 44,
    height: 18,
  },
  googlePayLogo: {
    width: 45,
    height: 22,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 10,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  separatorText: {
    flex: 2,
    color: '#8B8E98',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  creditCardForm: {
    gap: 15,
  },
  inputContainer: {
    gap: 5,
  },
  inputLabel: {
    color: '#8B8E98',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  inputField: {
    height: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 16,
    paddingVertical: 0,
    color: '#1B1B1B',
    fontSize: 13,
    textAlignVertical: 'center',
  },
  inputFieldFocused: {
    borderWidth: 2,
    borderColor: '#242424',
    backgroundColor: 'transparent',
    paddingHorizontal: 15,
  },
  split: {
    flexDirection: 'row',
    gap: 15,
  },
  expiryInput: {
    flex: 2,
  },
  cvvInput: {
    flex: 1,
  },
  purchaseButton: {
    height: 55,
    borderRadius: 11,
    overflow: 'hidden',
  },
  purchaseButtonPressed: {
    opacity: 0.88,
  },
  purchaseGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
  },
});
