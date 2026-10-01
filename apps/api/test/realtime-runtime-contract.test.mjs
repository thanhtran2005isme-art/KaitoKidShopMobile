import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const apiRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../../", import.meta.url);

function readApi(path) {
  return readFileSync(new URL(path, apiRoot), "utf8");
}

function readRepo(path) {
  return readFileSync(new URL(path, repoRoot), "utf8");
}

test("realtime runtime gate có Socket.IO client, backup và cleanup fixture", () => {
  const packageJson = readApi("package.json");
  const runtime = readApi("test/realtime-runtime-race.test.mjs");
  const fixtures = readApi("test/realtime-runtime-fixtures.mjs");
  const wrapper = readRepo("scripts/node-realtime-runtime-gate.bat");
  const launcher = readRepo("scripts/node-realtime-runtime-gate.ps1");

  assert.match(packageJson, /test:realtime-runtime/);
  assert.match(packageJson, /socket\.io-client/);
  assert.match(wrapper, /node-realtime-runtime-gate\.ps1/);
  assert.match(launcher, /mysqldump|mariadb-dump/);
  assert.match(launcher, /RUNTIME_REALTIME_CONFIRM/);
  assert.match(launcher, /kaitokid-phase11-realtime/);

  assert.match(runtime, /ClaimConversation/);
  assert.match(runtime, /ClaimFailed/);
  assert.match(runtime, /guest identity locked to handshake/);
  assert.match(runtime, /ReceiveMessage/);
  assert.match(runtime, /botBeforeClaim \+ 1/);
  assert.match(runtime, /LoaiNguoiGui = 'customer'/);
  assert.match(runtime, /LoaiNguoiGui = 'agent'/);
  assert.match(runtime, /intruderMessages/);

  assert.match(fixtures, /chat\.view/);
  assert.match(fixtures, /chat\.reply/);
  assert.match(fixtures, /DELETE FROM LichSuDangNhapNV/);
  assert.match(fixtures, /DELETE FROM NhanVien/);
  assert.match(fixtures, /DELETE FROM VaiTro_QuyenHan/);
  assert.match(fixtures, /DELETE FROM VaiTro/);
});
