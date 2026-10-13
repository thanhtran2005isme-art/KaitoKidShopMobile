import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const context = source('../src/context/AuthContext.tsx');
const service = source('../src/services/auth.service.ts');
const backend = source('../../api/src/modules/identity/user-auth.service.ts');

test('refresh 401 giữ security boundary và dọn session bị thu hồi', () => {
  assert.match(service, /export class AuthHttpError extends Error/);
  assert.match(service, /response\.status === 401/);
  assert.match(service, /throw new AuthHttpError/);
  assert.match(context, /error instanceof AuthHttpError && error\.status === 401/);
  assert.match(context, /latestToken === savedRefreshToken/);
  assert.match(context, /await clearSession\(\)/);
  assert.match(backend, /WHERE RefreshToken = \?/);
});

test('network và 5xx không bị nhận nhầm là refresh token vô hiệu', () => {
  const catchStart = context.indexOf('} catch (error) {');
  const catchEnd = context.indexOf('} finally {', catchStart);
  const failure = context.slice(catchStart, catchEnd);
  assert.ok(catchStart >= 0 && catchEnd > catchStart);
  assert.match(failure, /error\.status === 401/);
  assert.doesNotMatch(failure, /else\s*\{\s*await clearSession\(\)/);
});

test('refresh promise được reset ngay cả khi không có refresh token', () => {
  const start = context.indexOf('const refreshPromise: Promise<string | null>');
  const end = context.indexOf('refreshPromiseRef.current = refreshPromise;', start);
  const block = context.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /if \(!savedRefreshToken\)/);
  assert.match(block, /finally \{\s*refreshPromiseRef\.current = null/);
});

test('login mới thắng refresh và restore cũ, writes được serialize', () => {
  assert.match(context, /const generation = \+\+sessionGenerationRef\.current;/);
  assert.match(context, /const restoreGeneration = sessionGenerationRef\.current/);
  assert.match(context, /restoreGeneration !== sessionGenerationRef\.current/);
  assert.match(context, /runSessionWrite\(async \(\) =>/);
  assert.match(context, /expectedGeneration !== sessionGenerationRef\.current/);
});

test('refresh 401 dự kiến không bị console.error thêm', () => {
  assert.match(service, /expectedExpiredRefresh = url === '\/api\/Auth\/refresh' && response\.status === 401/);
  assert.match(service, /__DEV__ && !expectedExpiredRefresh/);
});
