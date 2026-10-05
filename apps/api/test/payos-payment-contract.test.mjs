import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PayOsService } from '../dist/modules/payment/payos.service.js';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const providerSource = source('../src/modules/payment/payos.service.ts');
const paymentSource = source('../src/modules/payment/payment.service.ts');
const inventorySource = source('../src/modules/orders/order-inventory.service.ts');
const controllerSource = source('../src/modules/payment/payment.controller.ts');
const moduleSource = source('../src/modules/payment/payment.module.ts');
const envSource = source('../.env.example');

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

test('payOS credentials chỉ nằm ở backend env và provider dùng official SDK', () => {
  assert.match(providerSource, /from "@payos\/node"/);
  assert.match(providerSource, /PAYOS_CLIENT_ID/);
  assert.match(providerSource, /PAYOS_API_KEY/);
  assert.match(providerSource, /PAYOS_CHECKSUM_KEY/);
  assert.match(envSource, /PAYOS_CLIENT_ID/);
  assert.match(envSource, /PAYOS_CHECKSUM_KEY/);
  assert.match(moduleSource, /PayOsService/);
});

test('payOS orderCode suy ra reversible từ MaDonHang, không dùng DonHang.Id', () => {
  const service = new PayOsService();
  const display = 'KK-20261005-DB6E9B';
  const providerOrderCode = service.providerOrderCode(display);
  assert.ok(Number.isSafeInteger(providerOrderCode));
  assert.ok(providerOrderCode > 0);
  assert.equal(service.kaitoKidOrderCode(providerOrderCode), display);
  assert.doesNotMatch(providerSource, /getPayment\(input\.orderId\)/);
  assert.doesNotMatch(providerSource, /orderCode:\s*input\.orderId/);
  assert.match(providerSource, /orderCode:\s*providerOrderCode/);
  assert.match(providerSource, /paymentRequests\.create/);
  assert.match(providerSource, /maxRetries: 0/);
});

test('payOS business code 101 được hiểu là chưa có payment và chuyển sang create', async () => {
  const restoreEnv = withPayOsEnv();
  try {
    const service = new PayOsService();
    const display = 'KK-20261005-ABC123';
    const providerOrderCode = service.providerOrderCode(display);
    let createCalls = 0;
    service.sdk = {
      paymentRequests: {
        async get() {
          const error = new Error('HTTP 200, Mã thanh toán không tồn tại (code: 101)');
          error.status = 200;
          error.code = '101';
          throw error;
        },
        async create(input) {
          createCalls += 1;
          return {
            orderCode: input.orderCode,
            amount: input.amount,
            description: input.description,
            status: 'PENDING',
            paymentLinkId: 'payos-test-link',
            checkoutUrl: 'https://pay.payos.vn/web/payos-test-link',
            qrCode: '000201TEST',
            currency: 'VND',
          };
        },
        async cancel() { throw new Error('not used'); },
      },
      webhooks: { verify(value) { return value; } },
    };

    const payment = await service.ensurePayment({
      orderCode: display,
      amount: 150000,
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    assert.equal(createCalls, 1);
    assert.equal(payment.orderCode, providerOrderCode);
    assert.equal(payment.amount, 150000);
    assert.equal(payment.status, 'PENDING');
  } finally {
    restoreEnv();
  }
});

test('hai ensurePayment đồng thời cho cùng đơn chỉ create payOS đúng một lần', async () => {
  const restoreEnv = withPayOsEnv();
  try {
    const service = new PayOsService();
    const display = 'KK-20261005-2E2370';
    const providerOrderCode = service.providerOrderCode(display);
    let getCalls = 0;
    let createCalls = 0;

    service.sdk = {
      paymentRequests: {
        async get() {
          getCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          const error = new Error('HTTP 200, Mã thanh toán không tồn tại (code: 101)');
          error.status = 200;
          error.code = '101';
          throw error;
        },
        async create(input) {
          createCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            orderCode: input.orderCode,
            amount: input.amount,
            description: input.description,
            status: 'PENDING',
            paymentLinkId: 'single-flight-link',
            checkoutUrl: 'https://pay.payos.vn/web/single-flight-link',
            qrCode: '000201SINGLEFLIGHT',
            currency: 'VND',
          };
        },
        async cancel() { throw new Error('not used'); },
      },
      webhooks: { verify(value) { return value; } },
    };

    const input = {
      orderCode: display,
      amount: 199000,
      customerName: 'Strict Mode Customer',
      customerEmail: 'strict@example.com',
      paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    const [first, second] = await Promise.all([
      service.ensurePayment(input),
      service.ensurePayment(input),
    ]);

    assert.equal(getCalls, 1);
    assert.equal(createCalls, 1);
    assert.equal(first.orderCode, providerOrderCode);
    assert.equal(second.orderCode, providerOrderCode);
    assert.equal(first.paymentLinkId, 'single-flight-link');
    assert.equal(second.paymentLinkId, 'single-flight-link');
  } finally {
    restoreEnv();
  }
});

test('QR CREATE được cache để GET kế tiếp không làm mất QR ngân hàng', async () => {
  const restoreEnv = withPayOsEnv();
  try {
    const service = new PayOsService();
    const display = 'KK-20261005-A53AAD';
    const providerOrderCode = service.providerOrderCode(display);
    let getCalls = 0;
    service.sdk = {
      paymentRequests: {
        async get() {
          getCalls += 1;
          if (getCalls === 1) {
            const error = new Error('HTTP 200, Mã thanh toán không tồn tại (code: 101)');
            error.status = 200;
            error.code = '101';
            throw error;
          }
          return {
            id: 'cached-link',
            orderCode: providerOrderCode,
            amount: 389600,
            status: 'PENDING',
          };
        },
        async create(input) {
          return {
            orderCode: input.orderCode,
            amount: input.amount,
            description: input.description,
            status: 'PENDING',
            paymentLinkId: 'cached-link',
            checkoutUrl: 'https://pay.payos.vn/web/cached-link',
            qrCode: '0002010102123857VALIDBANKQR6304ABCD',
            currency: 'VND',
          };
        },
        async cancel() { throw new Error('not used'); },
      },
      webhooks: { verify(value) { return value; } },
    };

    const input = {
      orderCode: display,
      amount: 389600,
      customerName: 'QR Cache Customer',
      customerEmail: 'qr@example.com',
      paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    const created = await service.ensurePayment(input);
    const reloaded = await service.ensurePayment(input);
    assert.ok(created.qrCode);
    assert.equal(reloaded.qrCode, created.qrCode);
    assert.equal(reloaded.checkoutUrl, 'https://pay.payos.vn/web/cached-link');
  } finally {
    restoreEnv();
  }
});

test('payOS create code 231 recover payment đã tồn tại thay vì trả 502', async () => {
  const restoreEnv = withPayOsEnv();
  try {
    const service = new PayOsService();
    const display = 'KK-20261005-DEF456';
    const providerOrderCode = service.providerOrderCode(display);
    let getCalls = 0;
    let createCalls = 0;
    service.sdk = {
      paymentRequests: {
        async get() {
          getCalls += 1;
          if (getCalls === 1) {
            const error = new Error('HTTP 200, Mã thanh toán không tồn tại (code: 101)');
            error.status = 200;
            error.code = '101';
            throw error;
          }
          return {
            orderCode: providerOrderCode,
            amount: 275000,
            status: 'PENDING',
            paymentLinkId: 'existing-link',
            checkoutUrl: 'https://pay.payos.vn/web/existing-link',
            currency: 'VND',
          };
        },
        async create() {
          createCalls += 1;
          const error = new Error('HTTP 200, Đơn thanh toán đã tồn tại (code: 231)');
          error.status = 200;
          error.code = '231';
          throw error;
        },
        async cancel() { throw new Error('not used'); },
      },
      webhooks: { verify(value) { return value; } },
    };

    const payment = await service.ensurePayment({
      orderCode: display,
      amount: 275000,
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    assert.equal(createCalls, 1);
    assert.ok(getCalls >= 2);
    assert.equal(payment.orderCode, providerOrderCode);
    assert.equal(payment.amount, 275000);
    assert.equal(payment.paymentLinkId, 'existing-link');
    assert.equal(payment.status, 'PENDING');
  } finally {
    restoreEnv();
  }
});

test('QR payOS chỉ render raw qrCode, không biến checkoutUrl thành QR ngân hàng', async () => {
  assert.match(providerSource, /if \(!payment\.qrCode\) return null/);
  assert.match(providerSource, /QRCode\.toDataURL\(payment\.qrCode/);
  assert.doesNotMatch(providerSource, /payment\.qrCode \|\| payment\.checkoutUrl/);
  assert.match(paymentSource, /qrMode: payment\.qrCode \? "payos_vietqr" : "payos_checkout"/);
  assert.match(paymentSource, /checkoutUrl: payment\.checkoutUrl/);

  const service = new PayOsService();
  const noFakeQr = await service.qrDataUrl({
    orderCode: 1,
    amount: 10000,
    status: 'PENDING',
    paymentLinkId: 'hosted-only',
    checkoutUrl: 'https://pay.payos.vn/web/hosted-only',
    qrCode: null,
    description: null,
    currency: 'VND',
    bin: null,
    accountNumber: null,
    accountName: null,
  });
  assert.equal(noFakeQr, null);
});

test('webhook payOS là public route nhưng bắt buộc verify signature', () => {
  assert.match(controllerSource, /@Post\("payos\/webhook"\)/);
  const webhookBlock = controllerSource.match(/@Post\("payos\/webhook"\)[\s\S]*?@Post\("mark-paid/)?.[0] ?? '';
  assert.doesNotMatch(webhookBlock, /UseGuards\(JwtAuthGuard\)/);
  assert.match(paymentSource, /this\.payos\.verifyWebhook\(payload\)/);
  assert.match(paymentSource, /kaitoKidOrderCode\(verified\.orderCode\)/);
  assert.match(paymentSource, /verified\.currency !== "VND"/);
  assert.match(paymentSource, /Số tiền webhook payOS không khớp/);
});

test('payOS paid dùng row lock/idempotency trước khi tạo shipment', () => {
  assert.match(paymentSource, /FOR UPDATE/);
  assert.match(paymentSource, /if \(order\.paidAt\)/);
  assert.match(paymentSource, /payment_confirmed/);
  assert.match(paymentSource, /createShippingOrder/);
});

test('cancel và expiry đối soát payOS trước khi hoàn tồn kho/coupon', () => {
  const cancelBlock = paymentSource.match(/async cancelByCustomer[\s\S]*?async markPaid/)?.[0] ?? '';
  assert.match(cancelBlock, /findPayOsPayment/);
  assert.match(cancelBlock, /cancelPayment/);
  assert.match(cancelBlock, /cancelLocalOrder/);
  assert.ok(cancelBlock.indexOf('cancelPayment') < cancelBlock.indexOf('cancelLocalOrder'));

  const expiryBlock = paymentSource.match(/private async expireOwnedOrderIfNeeded[\s\S]*?private async expireLocalOrder/)?.[0] ?? '';
  assert.match(expiryBlock, /findPayOsPayment/);
  assert.match(expiryBlock, /cancelPayment/);
});

test('đơn pending bị hủy hoặc hết hạn được restore stock và trả sản phẩm lại giỏ', () => {
  assert.match(inventorySource, /restoreStockAndCartInTransaction/);
  assert.match(inventorySource, /INSERT INTO GioHang/);
  assert.match(inventorySource, /SoLuongDaGiu = COALESCE\(SoLuongDaGiu, 0\) \+ \?/);
  assert.match(inventorySource, /reservationExpiresAt\(\)/);

  const expiryLocal = paymentSource.match(/private async expireLocalOrder[\s\S]*?private async cancelLocalOrder/)?.[0] ?? '';
  const cancelLocal = paymentSource.match(/private async cancelLocalOrder[\s\S]*?private async findPayOsPayment/)?.[0] ?? '';
  assert.match(expiryLocal, /restoreStockAndCartInTransaction/);
  assert.match(cancelLocal, /restoreStockAndCartInTransaction/);
});
