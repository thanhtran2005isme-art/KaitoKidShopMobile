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

const payOsEnvKeys = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'];

async function withPayOsEnv(configured, action) {
  const previous = Object.fromEntries(payOsEnvKeys.map((key) => [key, process.env[key]]));
  try {
    for (const key of payOsEnvKeys) {
      if (configured) process.env[key] = `test-${key.toLowerCase()}`;
      else delete process.env[key];
    }
    return await action();
  } finally {
    for (const key of payOsEnvKeys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('legacy bankEnabled không được bật online payment nếu payOS chưa cấu hình', { concurrency: false }, async () => {
  await withPayOsEnv(false, async () => {
    const settings = await loadPaymentSettings(
      fakeClient([
        { code: 'codEnabled', value: 'false' },
        { code: 'bankEnabled', value: 'true' },
        { code: 'bankAccounts', value: accountJson },
      ]),
    );

    assert.equal(settings.enableCod, false);
    assert.equal(settings.enableBank, false);
    assert.equal(settings.enablePayOs, false);
    assert.equal(settings.bankAccounts.length, 1);
    assert.equal(settings.bankAccounts[0].qrImage, 'data:image/png;base64,TEST');
  });
});

test('payOS đủ credentials tự bật ATM compatibility khi chưa có payosEnabled', { concurrency: false }, async () => {
  await withPayOsEnv(true, async () => {
    const settings = await loadPaymentSettings(fakeClient([]));
    assert.equal(settings.enableBank, true);
    assert.equal(settings.enablePayOs, true);
  });
});

test('payosEnabled=false tắt online payment dù backend có credentials', { concurrency: false }, async () => {
  await withPayOsEnv(true, async () => {
    const settings = await loadPaymentSettings(
      fakeClient([{ code: 'payosEnabled', value: 'false' }]),
    );
    assert.equal(settings.enableBank, false);
    assert.equal(settings.enablePayOs, false);
  });
});

test('COD vẫn tương thích key hiện tại và key legacy', { concurrency: false }, async () => {
  await withPayOsEnv(false, async () => {
    const current = await loadPaymentSettings(
      fakeClient([{ code: 'codEnabled', value: 'false' }]),
    );
    assert.equal(current.enableCod, false);

    const legacy = await loadPaymentSettings(
      fakeClient([{ code: 'enableCOD', value: 'true' }]),
    );
    assert.equal(legacy.enableCod, true);
  });
});
