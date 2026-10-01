import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, dirname, normalize } from "node:path";
import test from "node:test";
import {
  backgroundWorkerOwner,
  nodeOwnsBackgroundWorkers,
  nodeWorkerEnabled,
} from "../dist/common/worker-owner.js";
import {
  LOOKBOOK_PLACEHOLDER_SVG,
  PRODUCT_PLACEHOLDER_SVG,
  resolveSharedWebPublicRoot,
} from "../dist/media/legacy-media.js";
import {
  nextShippingSimulationStep,
} from "../dist/modules/shipping/shipping-status-simulator.service.js";

const apiRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../../", import.meta.url);

function readApi(path) {
  return readFileSync(new URL(path, apiRoot), "utf8");
}

function readRepo(path) {
  return readFileSync(new URL(path, repoRoot), "utf8");
}

function withEnv(values, fn) {
  const old = {};
  for (const [key, value] of Object.entries(values)) {
    old[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("background worker mặc định vẫn thuộc C# và cần master owner=node", () => {
  withEnv(
    {
      BACKGROUND_WORKER_OWNER: undefined,
      CART_SWEEPER_ENABLED: "true",
    },
    () => {
      assert.equal(backgroundWorkerOwner(), "csharp");
      assert.equal(nodeOwnsBackgroundWorkers(), false);
      assert.equal(nodeWorkerEnabled("CART_SWEEPER_ENABLED"), false);
    },
  );

  withEnv(
    {
      BACKGROUND_WORKER_OWNER: "node",
      CART_SWEEPER_ENABLED: "true",
    },
    () => {
      assert.equal(backgroundWorkerOwner(), "node");
      assert.equal(nodeWorkerEnabled("CART_SWEEPER_ENABLED"), true);
    },
  );
});

test("shipping simulator giữ đúng flow C#", () => {
  assert.equal(nextShippingSimulationStep("ready_to_pick")?.next, "picking");
  assert.equal(nextShippingSimulationStep("picking")?.next, "picked");
  assert.equal(nextShippingSimulationStep("picked")?.next, "delivering");
  assert.equal(nextShippingSimulationStep("delivering")?.next, "delivered");
  assert.equal(nextShippingSimulationStep("delivered"), null);
});

test("shared media root và placeholder legacy tương thích API.Customer", () => {
  withEnv({ SHARED_WEB_PUBLIC_ROOT: undefined }, () => {
    const root = normalize(resolveSharedWebPublicRoot());
    assert.equal(basename(root), "public");
    assert.equal(basename(dirname(root)), "web");
  });
  assert.match(PRODUCT_PLACEHOLDER_SVG, /KaitoKid/);
  assert.match(PRODUCT_PLACEHOLDER_SVG, /Hình ảnh sản phẩm đang cập nhật/);
  assert.match(LOOKBOOK_PLACEHOLDER_SVG, /SHOP THE LOOK/);
});

test("bootstrap mount shared web public trước fallback /products và /lookbook", () => {
  const main = readApi("src/main.ts");
  const media = readApi("src/media/legacy-media.ts");
  assert.match(main, /useStaticAssets\(sharedWebPublicRoot\)/);
  assert.match(main, /registerLegacyMediaFallback\(app\)/);
  assert.match(media, /req\.path\.startsWith\("\/products\/"\)/);
  assert.match(media, /req\.path\.startsWith\("\/lookbook\/"\)/);
});

test("Socket.IO khóa guest identity theo handshake và authorize typing", () => {
  const gateway = readApi("src/modules/chat/chat.gateway.ts");
  assert.doesNotMatch(gateway, /who = \{ \.\.\.who, guestId: body\.guestId \}/);
  assert.match(gateway, /Guest identity không khớp handshake/);
  assert.match(gateway, /await this\.chat\.isOwner\(conversationId, who\)/);
  assert.match(gateway, /canChat\(who, "chat\.view"\)/);
  assert.match(gateway, /canChat\(who, "chat\.reply"\)/);
});

test("Web/Mobile có Node URL cutover nhưng giữ legacy C# fallback", () => {
  const web = readRepo("apps/web/src/services/apiClient.ts");
  const mobile = readRepo("apps/mobile/app.config.js");
  assert.match(web, /VITE_NODE_API_URL/);
  assert.match(web, /localhost:5053/);
  assert.match(web, /localhost:5265/);
  assert.match(web, /localhost:5089/);
  assert.match(mobile, /EXPO_PUBLIC_BACKEND_MODE/);
  assert.match(mobile, /EXPO_PUBLIC_NODE_API_URL/);
  assert.match(mobile, /:5300/);
  assert.match(mobile, /:5265/);
  assert.match(mobile, /:5053/);
});

test("launcher Phase 11 chặn dual C# và reverse port Node 5300", () => {
  const mobileLauncher = readRepo("scripts/run-mobile.bat");
  const cutover = readRepo("scripts/run-node-cutover.bat");
  assert.match(mobileLauncher, /adb reverse tcp:5300 tcp:5300/);
  assert.match(cutover, /5053,5265,5089,5155/);
  assert.match(cutover, /Get-NetTCPConnection -State Listen -LocalPort \$p/);
  assert.doesNotMatch(cutover, /\^\|/);
  assert.match(cutover, /BACKGROUND_WORKER_OWNER=node/);
  assert.match(cutover, /SHIPPING_SIMULATOR_ENABLED=true/);
  assert.match(cutover, /IMAGE_INDEXER_ENABLED=false/);
});

test("protected runtime parity có secure launcher và không hard-code credential", () => {
  const packageJson = readApi("package.json");
  const testFile = readApi("test/protected-runtime-parity.test.mjs");
  const wrapper = readRepo("scripts/node-protected-runtime-parity.bat");
  const launcher = readRepo("scripts/node-protected-runtime-parity.ps1");

  assert.match(packageJson, /test:protected-runtime/);
  assert.match(wrapper, /node-protected-runtime-parity\.ps1/);
  assert.match(launcher, /Read-Host 'Customer password' -AsSecureString|Read-PlainSecret 'Customer password'/);
  assert.match(launcher, /RUNTIME_CUSTOMER_PASSWORD/);
  assert.match(launcher, /RUNTIME_STAFF_PASSWORD/);
  assert.match(testFile, /refresh token cũ sau rotation/);
  assert.match(testFile, /customer JWT không được vào Admin/);
  assert.doesNotMatch(testFile, /Admin@123/);
});

test("commerce concurrency race gate bắt buộc backup + fixture cleanup", () => {
  const packageJson = readApi("package.json");
  const race = readApi("test/concurrency-runtime-race.test.mjs");
  const orchestrator = readApi("test/run-concurrency-runtime-race.mjs");
  const wrapper = readRepo("scripts/node-concurrency-race-gate.bat");
  const launcher = readRepo("scripts/node-concurrency-race-gate.ps1");
  const ignore = readRepo(".gitignore");

  assert.match(packageJson, /test:concurrency-runtime/);
  assert.match(packageJson, /run-concurrency-runtime-race\.mjs/);
  assert.match(wrapper, /node-concurrency-race-gate\.ps1/);
  assert.match(launcher, /mysqldump|mariadb-dump/);
  assert.match(launcher, /RUNTIME_RACE_CONFIRM/);
  assert.match(launcher, /\.runtime-backups/);
  assert.match(race, /hai AddToCart đồng thời/);
  assert.match(race, /hai checkout cùng reservation/);
  assert.match(race, /double cancel chỉ hoàn stock đúng một lần/);
  assert.match(race, /payment expiry và customer cancel race/);
  assert.match(race, /async function cleanup/);
  assert.match(race, /UPDATE SanPham/);
  assert.match(race, /UPDATE TonKhoBienThe/);
  assert.match(race, /DanhSachSize AS allowedSizes/);
  assert.match(race, /DanhSachMau AS allowedColors/);
  assert.match(race, /variantCount/);
  assert.match(race, /responseSummary/);
  assert.match(race, /let addReady = false/);
  assert.match(race, /let checkoutReady = false/);
  assert.match(orchestrator, /MockOnlyServeBranches/);
  assert.match(orchestrator, /Phase 11 Race Province/);
  assert.match(orchestrator, /INFORMATION_SCHEMA\.COLUMNS/);
  assert.match(orchestrator, /INSERT INTO CauHinhCuaHang/);
  assert.match(orchestrator, /DELETE FROM CauHinhCuaHang/);
  assert.match(orchestrator, /restoreShippingFixture/);
  assert.match(orchestrator, /original absence restored/);
  assert.match(ignore, /\.runtime-backups\//);
});
