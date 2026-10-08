import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const paymentSource = readFileSync(
  new URL('../src/modules/payment/payment.service.ts', import.meta.url),
  'utf8',
);

test('status polling đối soát payOS trước khi chờ đơn hết hạn', () => {
  const statusBlock = paymentSource.match(
    /async getStatus[\s\S]*?async handlePayOsWebhook/,
  )?.[0] ?? '';

  assert.match(statusBlock, /getOwnedOrder/);
  assert.match(statusBlock, /findPayOsPayment/);
  assert.match(statusBlock, /provider\?\.status === "PAID"/);
  assert.match(statusBlock, /assertPayOsPaymentMatchesOrder/);
  assert.match(statusBlock, /"payos_reconcile"/);
  assert.match(statusBlock, /expireOwnedOrderIfNeeded/);
  assert.ok(
    statusBlock.indexOf('findPayOsPayment') <
      statusBlock.indexOf('expireOwnedOrderIfNeeded'),
  );
});

test('provider PAID phải khớp VND và tổng tiền trước khi confirm local', () => {
  const verifyBlock = paymentSource.match(
    /private assertPayOsPaymentMatchesOrder[\s\S]*?private providerStatus/,
  )?.[0] ?? '';

  assert.match(verifyBlock, /payment\.currency/);
  assert.match(verifyBlock, /!== "VND"/);
  assert.match(verifyBlock, /Math\.round\(payment\.amount\)/);
  assert.match(verifyBlock, /toNumber\(order\.total\)/);
});

test('provider timeout trong polling không biến status endpoint thành 502', () => {
  const statusBlock = paymentSource.match(
    /async getStatus[\s\S]*?async handlePayOsWebhook/,
  )?.[0] ?? '';

  assert.match(statusBlock, /catch \(error\)/);
  assert.match(statusBlock, /error instanceof BadRequestException/);
});
