import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, normalize } from "node:path";
import test from "node:test";
import { isCorsOriginAllowed, parseCorsOrigins } from "../dist/common/cors.js";
import { backgroundWorkerOwner, nodeOwnsBackgroundWorkers, nodeWorkerEnabled } from "../dist/common/worker-owner.js";
import { LOOKBOOK_PLACEHOLDER_SVG, PRODUCT_PLACEHOLDER_SVG, resolveSharedWebPublicRoot } from "../dist/media/legacy-media.js";
import { nextShippingSimulationStep } from "../dist/modules/shipping/shipping-status-simulator.service.js";

const apiRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../../", import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), "utf8");
const readRepo = (path) => readFileSync(new URL(path, repoRoot), "utf8");

function withEnv(values, fn) {
  const old = {};
  for (const [key, value] of Object.entries(values)) {
    old[key] = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try { return fn(); } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("Node là backend owner duy nhất sau retirement", () => {
  withEnv({ BACKGROUND_WORKER_OWNER: undefined, CART_SWEEPER_ENABLED: "true" }, () => {
    assert.equal(backgroundWorkerOwner(), "node");
    assert.equal(nodeOwnsBackgroundWorkers(), true);
    assert.equal(nodeWorkerEnabled("CART_SWEEPER_ENABLED"), true);
  });
  withEnv({ BACKGROUND_WORKER_OWNER: "csharp", CART_SWEEPER_ENABLED: "true" }, () => {
    assert.equal(backgroundWorkerOwner(), "node");
    assert.equal(nodeWorkerEnabled("CART_SWEEPER_ENABLED"), true);
  });
});

test("C# source đã retire nhưng database assets được giữ", () => {
  assert.equal(existsSync(new URL("backend/", repoRoot)), false);
  assert.equal(existsSync(new URL("database/KaitoKid_MariaDB.sql", repoRoot)), true);
  assert.equal(existsSync(new URL("database/migrations/20260930_registration_email_verification.sql", repoRoot)), true);
});

test("Web/Mobile chỉ dùng Node :5300, không còn legacy C# ports", () => {
  const web = readRepo("apps/web/src/services/apiClient.ts");
  const mobileConfig = readRepo("apps/mobile/app.config.js");
  const mobileApi = readRepo("apps/mobile/src/services/api-client.ts");
  const mobileAuth = readRepo("apps/mobile/src/services/auth.service.ts");
  const joined = [web, mobileConfig, mobileApi, mobileAuth].join("\n");

  assert.match(joined, /5300/);
  for (const port of ["5053", "5265", "5089", "5155"]) assert.doesNotMatch(joined, new RegExp(port));
});

test("CORS local cho phép Expo Web đổi port nhưng không mở origin ngoài cấu hình", () => {
  const origins = parseCorsOrigins(
    "http://localhost:5173,http://127.0.0.1:8081,https://shop.example.com",
  );

  assert.equal(isCorsOriginAllowed(undefined, origins), true);
  assert.equal(isCorsOriginAllowed("http://localhost:8082", origins), true);
  assert.equal(isCorsOriginAllowed("http://127.0.0.1:8083", origins), true);
  assert.equal(isCorsOriginAllowed("https://localhost:8082", origins), false);
  assert.equal(isCorsOriginAllowed("https://shop.example.com", origins), true);
  assert.equal(isCorsOriginAllowed("https://evil.example.com", origins), false);
  assert.equal(isCorsOriginAllowed("http://192.168.2.8:8082", origins), false);
});

test("JSON body limit đủ cho cấu hình admin chứa QR base64", () => {
  const main = readApi("src/main.ts");
  assert.match(main, /app\.useBodyParser\("json", \{ limit: "16mb" \}\);/);
});

test("launchers không còn dotnet/C# runtime và Node owns critical workers", () => {
  const root = readRepo("run.bat");
  const all = readRepo("scripts/run-all.bat");
  const mobile = readRepo("scripts/run-mobile.bat");
  const api = readRepo("scripts/run-node-api.bat");
  const joined = [root, all, mobile, api].join("\n");

  assert.doesNotMatch(joined, /dotnet/i);
  assert.doesNotMatch(joined, /5053|5265|5089|5155/);
  assert.match(mobile, /adb reverse tcp:5300 tcp:5300/);
  assert.match(api, /BACKGROUND_WORKER_OWNER=node/);
  assert.match(api, /CART_SWEEPER_ENABLED=true/);
  assert.match(api, /PAYMENT_SWEEPER_ENABLED=true/);
  assert.match(api, /CHAT_IDLE_SWEEPER_ENABLED=true/);
  assert.match(api, /SHIPPING_SIMULATOR_ENABLED=true/);
});

test("root package scripts không còn dotnet backend test", () => {
  const rootPackage = readRepo("package.json");
  assert.doesNotMatch(rootPackage, /dotnet\s+test/i);
  assert.match(rootPackage, /apps\/api/);
});

test("shipping simulator giữ flow đã nghiệm thu", () => {
  assert.equal(nextShippingSimulationStep("ready_to_pick")?.next, "picking");
  assert.equal(nextShippingSimulationStep("picking")?.next, "picked");
  assert.equal(nextShippingSimulationStep("picked")?.next, "delivering");
  assert.equal(nextShippingSimulationStep("delivering")?.next, "delivered");
  assert.equal(nextShippingSimulationStep("delivered"), null);
});

test("shared media root và placeholder vẫn hoạt động", () => {
  const root = normalize(resolveSharedWebPublicRoot());
  assert.equal(basename(root), "public");
  assert.equal(basename(dirname(root)), "web");
  assert.match(PRODUCT_PLACEHOLDER_SVG, /KaitoKid/);
  assert.match(LOOKBOOK_PLACEHOLDER_SVG, /SHOP THE LOOK/);
});

test("Socket.IO giữ khóa guest identity và permission checks", () => {
  const gateway = readApi("src/modules/chat/chat.gateway.ts");
  assert.match(gateway, /Guest identity không khớp handshake/);
  assert.match(gateway, /await this\.chat\.isOwner\(conversationId, who\)/);
  assert.match(gateway, /chat\.view/);
  assert.match(gateway, /chat\.reply/);
});

test("protected/race/realtime runtime harness vẫn tồn tại sau retirement", () => {
  const packageJson = readApi("package.json");
  const protectedBat = readRepo("scripts/node-protected-runtime-parity.bat");
  const raceBat = readRepo("scripts/node-concurrency-race-gate.bat");
  const realtimeBat = readRepo("scripts/node-realtime-runtime-gate.bat");

  assert.match(packageJson, /test:protected-runtime/);
  assert.match(packageJson, /test:concurrency-runtime/);
  assert.match(packageJson, /test:realtime-runtime/);
  assert.match(protectedBat, /node-protected-runtime-parity/);
  assert.match(raceBat, /node-concurrency-race-gate/);
  assert.match(realtimeBat, /node-realtime-runtime-gate/);
});
