import assert from 'node:assert/strict';
import test from 'node:test';

import { loadPaymentSettings } from '../dist/modules/payment/payment-settings.js';

function fakeClient(rows) {
  return {
    async $queryRawUnsafe() {
      return rows;
    },
  };
}

const accountJson = JSON.stringify([
  {
    id: 1,
    bankName: 'MB Bank',
    accountNumber: '0123456789',
    accountHolder: 'KAITO KID SHOP',
    branch: 'Ha Noi',
    qrImage: 'data:image/png;base64,TEST',
  },
]);

test('payment settings đọc đúng key hiện tại do Admin Web lưu', async () => {
  const settings = await loadPaymentSettings(
    fakeClient([
      { code: 'codEnabled', value: 'false' },
      { code: 'bankEnabled', value: 'true' },
      { code: 'bankAccounts', value: accountJson },
    ]),
  );

  assert.equal(settings.enableCod, false);
  assert.equal(settings.enableBank, true);
  assert.equal(settings.bankAccounts.length, 1);
  assert.equal(settings.bankAccounts[0].qrImage, 'data:image/png;base64,TEST');
});

test('bankEnabled=false phải tắt chuyển khoản dù tài khoản ngân hàng hợp lệ', async () => {
  const settings = await loadPaymentSettings(
    fakeClient([
      { code: 'bankEnabled', value: 'false' },
      { code: 'bankAccounts', value: accountJson },
    ]),
  );

  assert.equal(settings.enableBank, false);
  assert.equal(settings.bankAccounts.length, 1);
});

test('payment settings vẫn tương thích key legacy', async () => {
  const settings = await loadPaymentSettings(
    fakeClient([
      { code: 'enableCOD', value: 'true' },
      { code: 'enableBankTransfer', value: 'true' },
      { code: 'bankAccounts', value: accountJson },
    ]),
  );

  assert.equal(settings.enableCod, true);
  assert.equal(settings.enableBank, true);
});
