import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const providerSource = source('../src/modules/payment/payos.service.ts');
const paymentSource = source('../src/modules/payment/payment.service.ts');
const controllerSource = source('../src/modules/payment/payment.controller.ts');
const moduleSource = source('../src/modules/payment/payment.module.ts');
const envSource = source('../.env.example');

test('payOS credentials chỉ nằm ở backend env và provider dùng official SDK', () => {
  assert.match(providerSource, /from "@payos\/node"/);
  assert.match(providerSource, /PAYOS_CLIENT_ID/);
  assert.match(providerSource, /PAYOS_API_KEY/);
  assert.match(providerSource, /PAYOS_CHECKSUM_KEY/);
  assert.match(envSource, /PAYOS_CLIENT_ID/);
  assert.match(envSource, /PAYOS_CHECKSUM_KEY/);
  assert.match(moduleSource, /PayOsService/);
});

test('DonHang.Id là payOS orderCode và create chỉ chạy sau GET recovery', () => {
  assert.match(providerSource, /getPayment\(input\.orderId\)/);
  assert.match(providerSource, /orderCode: input\.orderId/);
  assert.match(providerSource, /paymentRequests\.create/);
  assert.match(providerSource, /maxRetries: 0/);
});

test('QR payOS được backend render thành data URL cho Web và Mobile', () => {
  assert.match(providerSource, /QRCode\.toDataURL/);
  assert.match(providerSource, /payment\.qrCode \|\| payment\.checkoutUrl/);
  assert.match(paymentSource, /qrMode: payment\.qrCode \? "payos_vietqr" : "payos_checkout"/);
  assert.match(paymentSource, /checkoutUrl: payment\.checkoutUrl/);
});

test('webhook payOS là public route nhưng bắt buộc verify signature', () => {
  assert.match(controllerSource, /@Post\("payos\/webhook"\)/);
  const webhookBlock = controllerSource.match(/@Post\("payos\/webhook"\)[\s\S]*?@Post\("mark-paid/)?.[0] ?? '';
  assert.doesNotMatch(webhookBlock, /UseGuards\(JwtAuthGuard\)/);
  assert.match(paymentSource, /this\.payos\.verifyWebhook\(payload\)/);
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
  assert.match(expiryBlock, /Fail closed/);
});
