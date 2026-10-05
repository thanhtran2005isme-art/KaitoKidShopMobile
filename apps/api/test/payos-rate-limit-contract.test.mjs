import assert from 'node:assert/strict';
import test from 'node:test';

import { PayOsService } from '../dist/modules/payment/payos.service.js';

function withPayOsEnv() {
  const previous = {
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  };
  process.env.PAYOS_CLIENT_ID = 'test-client';
  process.env.PAYOS_API_KEY = 'test-api';
  process.env.PAYOS_CHECKSUM_KEY = 'test-checksum';
  return () => {
    if (previous.clientId === undefined) delete process.env.PAYOS_CLIENT_ID;
    else process.env.PAYOS_CLIENT_ID = previous.clientId;
    if (previous.apiKey === undefined) delete process.env.PAYOS_API_KEY;
    else process.env.PAYOS_API_KEY = previous.apiKey;
    if (previous.checksumKey === undefined) delete process.env.PAYOS_CHECKSUM_KEY;
    else process.env.PAYOS_CHECKSUM_KEY = previous.checksumKey;
  };
}

function sdkWithGet(get) {
  return {
    paymentRequests: {
      get,
      async create() { throw new Error('not used'); },
      async cancel() { throw new Error('not used'); },
    },
    webhooks: { verify(value) { return value; } },
  };
}

test('GET trạng thái cùng order trong 10 giây chỉ hit payOS một lần', async () => {
  const restoreEnv = withPayOsEnv();
  try {
    const service = new PayOsService();
    const code = service.providerOrderCode('KK-20261005-AC66FF');
    let getCalls = 0;
    service.sdk = sdkWithGet(async () => {
      getCalls += 1;
      return {
        id: 'rate-cache-link',
        orderCode: code,
        amount: 63600,
        status: 'PENDING',
        currency: 'VND',
      };
    });

    const first = await service.getPayment(code);
    const second = await service.getPayment(code);
    const third = await service.getPaymentForStatus(code);

    assert.equal(first.status, 'PENDING');
    assert.equal(second.status, 'PENDING');
    assert.equal(third.status, 'PENDING');
    assert.equal(getCalls, 1);
  } finally {
    restoreEnv();
  }
});

test('HTTP 429 dùng stale cache và cooldown không spam provider', async () => {
  const restoreEnv = withPayOsEnv();
  try {
    const service = new PayOsService();
    const code = service.providerOrderCode('KK-20261005-BF4492');
    let getCalls = 0;
    service.sdk = sdkWithGet(async () => {
      getCalls += 1;
      if (getCalls === 1) {
        return {
          id: 'stale-link',
          orderCode: code,
          amount: 63600,
          status: 'PENDING',
          currency: 'VND',
        };
      }
      const error = new Error('HTTP 429, {}');
      error.status = 429;
      throw error;
    });

    const first = await service.getPayment(code);
    assert.equal(first.status, 'PENDING');

    const entry = service.paymentCache.get(code);
    assert.ok(entry);
    entry.refreshedAtMs = 0;

    const second = await service.getPayment(code);
    const third = await service.getPayment(code);

    assert.equal(second.status, 'PENDING');
    assert.equal(third.status, 'PENDING');
    assert.equal(getCalls, 2);
    assert.ok(service.rateLimitUntilMs > Date.now());
  } finally {
    restoreEnv();
  }
});

test('429 khi chưa có cache trả 503 rõ nghĩa thay vì 502', async () => {
  const restoreEnv = withPayOsEnv();
  try {
    const service = new PayOsService();
    const code = service.providerOrderCode('KK-20261005-C0FFEE');
    service.sdk = sdkWithGet(async () => {
      const error = new Error('HTTP 429, {}');
      error.status = 429;
      throw error;
    });

    await assert.rejects(
      service.getPayment(code),
      (error) => {
        assert.equal(error?.getStatus?.(), 503);
        assert.match(String(error?.message ?? ''), /giới hạn tần suất/i);
        return true;
      },
    );
  } finally {
    restoreEnv();
  }
});