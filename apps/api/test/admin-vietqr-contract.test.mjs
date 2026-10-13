import assert from 'node:assert/strict';
import test from 'node:test';

import { AdminVietQrService } from '../dist/modules/admin/admin-vietqr.service.js';

const originalFetch = globalThis.fetch;
const originalClientId = process.env.VIETQR_CLIENT_ID;
const originalApiKey = process.env.VIETQR_API_KEY;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function restoreEnvironment() {
  globalThis.fetch = originalFetch;
  if (originalClientId === undefined) delete process.env.VIETQR_CLIENT_ID;
  else process.env.VIETQR_CLIENT_ID = originalClientId;
  if (originalApiKey === undefined) delete process.env.VIETQR_API_KEY;
  else process.env.VIETQR_API_KEY = originalApiKey;
}

test('VietQR bank catalog chuẩn hóa BIN/code và cờ hỗ trợ', async (t) => {
  t.after(restoreEnvironment);
  globalThis.fetch = async () => jsonResponse({
    code: '00',
    data: [
      {
        id: 1,
        name: 'Ngân hàng TMCP Quân đội',
        code: 'MB',
        bin: '970422',
        shortName: 'MBBank',
        logo: 'https://api.vietqr.io/img/MB.png',
        transferSupported: 1,
        lookupSupported: 1,
      },
    ],
  });

  const service = new AdminVietQrService();
  const banks = await service.getBanks();
  assert.equal(banks.length, 1);
  assert.equal(banks[0].bin, '970422');
  assert.equal(banks[0].code, 'MB');
  assert.equal(banks[0].shortName, 'MBBank');
  assert.equal(banks[0].transferSupported, true);
  assert.equal(banks[0].lookupSupported, true);
});

test('lookup tài khoản chỉ trả tên chủ tài khoản do VietQR xác minh', async (t) => {
  t.after(restoreEnvironment);
  process.env.VIETQR_CLIENT_ID = 'client-test';
  process.env.VIETQR_API_KEY = 'key-test';

  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/banks')) {
      return jsonResponse({
        code: '00',
        data: [
          {
            id: 1,
            name: 'Ngân hàng TMCP Quân đội',
            code: 'MB',
            bin: '970422',
            shortName: 'MBBank',
            logo: 'https://api.vietqr.io/img/MB.png',
            transferSupported: 1,
            lookupSupported: 1,
          },
        ],
      });
    }
    return jsonResponse({
      code: '00',
      desc: 'Success - Thành công',
      data: { accountName: 'TRAN NGOC THANH' },
    });
  };

  const service = new AdminVietQrService();
  const result = await service.lookupAccount('970422', '8334555555');

  assert.equal(result.bank.shortName, 'MBBank');
  assert.equal(result.accountNumber, '8334555555');
  assert.equal(result.accountName, 'TRAN NGOC THANH');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.headers['x-client-id'], 'client-test');
  assert.equal(calls[1].init.headers['x-api-key'], 'key-test');
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    bin: 970422,
    accountNumber: '8334555555',
  });
});

test('lookup từ chối STK sai định dạng trước khi gọi VietQR', async (t) => {
  t.after(restoreEnvironment);
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return jsonResponse({ code: '00', data: [] });
  };

  const service = new AdminVietQrService();
  await assert.rejects(
    () => service.lookupAccount('970422', '12AB'),
    /6–19 chữ số/,
  );
  assert.equal(called, false);
});
