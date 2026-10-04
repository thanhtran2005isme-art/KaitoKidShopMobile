import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const clientSource = source("../src/modules/shipping/lalamove.client.ts");
const lifecycleSource = source("../src/modules/shipping/lalamove-shipping.service.ts");
const hardenedSource = source("../src/modules/shipping/lalamove-shipping-hardened.service.ts");
const moduleSource = source("../src/modules/shipping/shipping.module.ts");
const controllerSource = source("../src/modules/shipping/shipping.controller.ts");
const simulatorSource = source("../src/modules/shipping/shipping-status-simulator.service.ts");
const orderHelpersSource = source("../src/modules/orders/order.helpers.ts");

test("Lalamove request signs the exact v3 HMAC contract server-side", () => {
  assert.match(clientSource, /createHmac\("sha256", apiSecret\)/);
  assert.match(
    clientSource,
    /`\$\{timestamp\}\\r\\n\$\{method\}\\r\\n\$\{path\}\\r\\n\\r\\n\$\{serializedBody\}`/,
  );
  assert.match(
    clientSource,
    /Authorization: `hmac \$\{config\.apiKey\}:\$\{timestamp\}:\$\{signature\}`/,
  );
  assert.match(clientSource, /Market: config\.market/);
  assert.match(clientSource, /"Request-ID": randomUUID\(\)/);
});

test("webhook signature uses apiKey, timestamp, path and JSON data only", () => {
  assert.match(clientSource, /verifyLalamoveWebhookSignature/);
  assert.match(clientSource, /JSON\.stringify\(input\.data \?\? \{\}\)/);
  assert.match(clientSource, /timingSafeEqual/);
  assert.match(lifecycleSource, /LALAMOVE_WEBHOOK_PATH/);
  assert.match(lifecycleSource, /\/api\/shipping\/lalamove\/webhook/);
  assert.match(controllerSource, /@Post\("lalamove\/webhook"\)/);
});

test("checkout quote exposes stable Lalamove service type, not client-authoritative quotationId", () => {
  assert.match(lifecycleSource, /"\/v3\/quotations"/);
  assert.match(lifecycleSource, /serviceCode: quotation\.serviceType/);
  assert.match(lifecycleSource, /provider: "lalamove"/);
  assert.doesNotMatch(lifecycleSource, /serviceCode: quotation\.quotationId/);
});

test("Place Order re-quotes server-side and persists real carrier identifiers", () => {
  assert.match(lifecycleSource, /createQuotation\(cfg, order\.customerAddress\)/);
  assert.match(lifecycleSource, /PhiVanChuyen AS shippingFee/);
  assert.match(lifecycleSource, /Math\.abs\(quotation\.fee - toNumber\(order\.shippingFee\)\) > 1/);
  assert.match(lifecycleSource, /`\/v3\/quotations\/\$\{encodeURIComponent\(quotation\.quotationId\)\}`/);
  assert.match(lifecycleSource, /"POST",\s*"\/v3\/orders"/s);
  assert.match(lifecycleSource, /isPODEnabled: true/);
  assert.match(lifecycleSource, /kaitoKidOrderCode: order\.orderCode/);
  assert.match(lifecycleSource, /MaVanDon = COALESCE/);
  assert.match(lifecycleSource, /LinkTracking = COALESCE/);
  assert.match(lifecycleSource, /MaDichVuVanChuyen = COALESCE/);
});

test("DI routes ShippingService and Lalamove token through the hardened lifecycle", () => {
  assert.match(moduleSource, /provide: LalamoveShippingService/);
  assert.match(moduleSource, /useClass: HardenedLalamoveShippingService/);
  assert.match(moduleSource, /provide: ShippingService/);
  assert.match(moduleSource, /useExisting: LalamoveShippingService/);
  assert.match(lifecycleSource, /override async createShippingOrder/);
  assert.match(hardenedSource, /override async createShippingOrder/);
});

test("Place Order is claimed atomically and ambiguous outcomes fail closed", () => {
  assert.match(hardenedSource, /TrangThaiVanChuyen = 'lalamove_placing'/);
  assert.match(hardenedSource, /MaVanDon IS NULL/);
  assert.match(hardenedSource, /if \(claimed === 0\)/);
  assert.match(hardenedSource, /lalamove_place_unknown/);
  assert.match(hardenedSource, /khóa auto-retry để tránh tạo trùng vận đơn/);
});

test("tracking syncs known Lalamove orders but never retries an ambiguous empty tracking code", () => {
  assert.match(
    lifecycleSource,
    /`\/v3\/orders\/\$\{encodeURIComponent\(externalOrderId\)\}`/,
  );
  assert.match(lifecycleSource, /syncLalamoveOrder/);
  assert.match(hardenedSource, /!current\.trackingCode/);
  assert.match(hardenedSource, /ShippingService\.prototype\.track\.call/);
  assert.match(hardenedSource, /must never trigger a second POST \/v3\/orders/);
});

test("customer cancel asks Lalamove first and propagates forbidden cancellation", () => {
  assert.match(lifecycleSource, /"DELETE"/);
  assert.match(
    lifecycleSource,
    /`\/v3\/orders\/\$\{encodeURIComponent\(order\.trackingCode\)\}`/,
  );
  assert.match(lifecycleSource, /response\.status === 204/);
  assert.match(lifecycleSource, /response\.status === 409/);
  assert.match(orderHelpersSource, /shippingStatus === "cancelled"/);
});

test("webhook events are idempotent, serialized per carrier order and stale-safe", () => {
  assert.match(lifecycleSource, /\[LALAMOVE_EVENT:\$\{eventId\}\]/);
  assert.match(lifecycleSource, /LOCATE\(\?, COALESCE\(MoTa,''\)\)/);
  assert.match(lifecycleSource, /ignored=stale/);
  assert.match(lifecycleSource, /if \(!stale\) await this\.applyState/);
  assert.match(hardenedSource, /webhookQueues/);
  assert.match(hardenedSource, /withWebhookQueue\(\s*externalOrderId/s);
  assert.match(lifecycleSource, /ASSIGNING_DRIVER/);
  assert.match(lifecycleSource, /ON_GOING/);
  assert.match(lifecycleSource, /PICKED_UP/);
  assert.match(lifecycleSource, /COMPLETED/);
  assert.match(lifecycleSource, /CANCELED/);
});

test("shipping simulator never advances a real Lalamove shipment", () => {
  assert.match(
    simulatorSource,
    /LOWER\(COALESCE\(NhaVanChuyen,'mock'\)\) <> 'lalamove'/,
  );
});

test("Lalamove never fabricates a carrier tracking code", () => {
  assert.doesNotMatch(lifecycleSource, /LALAMOVE-FAKE/);
  assert.doesNotMatch(hardenedSource, /LALAMOVE-FAKE/);
});
