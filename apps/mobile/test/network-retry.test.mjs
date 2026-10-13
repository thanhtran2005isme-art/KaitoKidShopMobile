import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Run the actual TypeScript retry policy, not just text-pattern assertions.
const tsSource = readFileSync(new URL('../src/services/network-retry.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(tsSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { canRetryReadRequest, fetchWithTransportRetry, ApiTransportError } =
  await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));

const ok = { status: 200, ok: true };

test('GET catalog/wallet được phép retry, payment instructions GET thì không', () => {
  assert.equal(canRetryReadRequest('/api/wallet?x=1'), true);
  assert.equal(canRetryReadRequest('/api/products?Page=1'), true);
  assert.equal(canRetryReadRequest('/api/payment/instructions/ORDER-001'), false);
  assert.equal(canRetryReadRequest('/api/shipping/track/ORDER-001'), false);
  assert.equal(canRetryReadRequest('/api/orders', { method: 'POST' }), false);
  assert.equal(canRetryReadRequest('/api/wallet/withdrawals', { method: 'POST' }), false);
  assert.equal(canRetryReadRequest('/api/products', { method: 'GET', body: '{}' }), false);
});

test('GET bị lỗi mạng một lần được retry đúng một lần', async () => {
  let count = 0;
  const response = await fetchWithTransportRetry('/mock', '/api/wallet', undefined, 100, async () => {
    count++;
    if (count === 1) throw new TypeError('Failed to fetch');
    return ok;
  });
  assert.equal(response.status, 200);
  assert.equal(count, 2);
});

test('POST checkout lỗi mạng không retry để tránh tạo đơn trùng', async () => {
  let count = 0;
  await assert.rejects(
    fetchWithTransportRetry('/mock', '/api/orders', { method: 'POST', body: '{}' }, 100, async () => {
      count++;
      throw new TypeError('Failed to fetch');
    }),
    (error) => error instanceof ApiTransportError && error.kind === 'network' && error.attempts === 1,
  );
  assert.equal(count, 1);
});

test('GET payment instructions không retry vì có thể tạo provider payment', async () => {
  let count = 0;
  await assert.rejects(
    fetchWithTransportRetry('/mock', '/api/payment/instructions/ORD-123', undefined, 100, async () => {
      count++;
      throw new TypeError('Failed to fetch');
    }),
    (error) => error.kind === 'network',
  );
  assert.equal(count, 1);
});

test('GET HTTP 401/500 trả nguyên response, không thử lại', async () => {
  for (const status of [401, 500]) {
    let count = 0;
    const response = await fetchWithTransportRetry('/mock', '/api/wallet', undefined, 100, async () => {
      count++;
      return { status, ok: false };
    });
    assert.equal(response.status, status);
    assert.equal(count, 1);
  }
});

test('timeout có phân loại riêng và chỉ retry với GET whitelisted', async () => {
  let count = 0;
  const never = (_url, options) => {
    count++;
    return new Promise((_resolve, reject) => {
      const aborted = () => { const err = new Error('aborted'); err.name = 'AbortError'; reject(err); };
      if (options.signal.aborted) aborted();
      else options.signal.addEventListener('abort', aborted, { once: true });
    });
  };
  await assert.rejects(
    fetchWithTransportRetry('/mock', '/api/categories', undefined, 8, never),
    (error) => error.kind === 'timeout' && error.attempts === 2,
  );
  assert.equal(count, 2);
});

test('hủy từ màn hình không bị retry', async () => {
  const controller = new AbortController();
  controller.abort();
  let count = 0;
  await assert.rejects(
    fetchWithTransportRetry('/mock', '/api/wallet', { signal: controller.signal }, 100, async (_url, options) => {
      count++;
      if (options.signal.aborted) {
        const err = new Error('Aborted'); err.name = 'AbortError'; throw err;
      }
      return ok;
    }),
    (error) => error.kind === 'canceled' && error.attempts === 1,
  );
  assert.equal(count, 1);
});
