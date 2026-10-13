import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const settingsSource = source('../src/modules/payment/payment-settings.ts');
const paymentSource = source('../src/modules/payment/payment.service.ts');
const envSource = source('../.env.example');
const handoffSource = source('../../../docs/AI_HANDOFF.md');
const decisionSource = source('../../../docs/decisions/D027-payos-payment-lifecycle.md');

test('runtime online payment không được kích hoạt bởi bankEnabled/VietQR legacy', () => {
  assert.match(settingsSource, /readBool\(map,\s*"payosEnabled",\s*configuredPayOs\)/);
  assert.doesNotMatch(settingsSource, /\["payosEnabled",\s*"bankEnabled",\s*"enableBankTransfer"\]/);
  assert.match(settingsSource, /enableBank:\s*onlineEnabled\s*&&\s*configuredPayOs/);
  assert.match(settingsSource, /enablePayOs:\s*onlineEnabled\s*&&\s*configuredPayOs/);
});

test('customer payment authority vẫn là payOS webhook, legacy bank chỉ dành cho compatibility', () => {
  assert.match(paymentSource, /provider:\s*"payos"/);
  assert.match(paymentSource, /handlePayOsWebhook/);
  assert.match(paymentSource, /this\.payos\.verifyWebhook\(payload\)/);
  assert.match(decisionSource, /legacy.*không còn quyền kích hoạt online payment/i);
});

test('durable docs và env template xác định payOS là provider hiện hành', () => {
  assert.match(envSource, /payOS là payment provider online hiện hành/);
  assert.match(handoffSource, /Online payment trên PR #75 dùng payOS SDK chính thức/);
});
