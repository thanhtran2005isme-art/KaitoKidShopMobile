import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const clientSource = source("../src/modules/shipping/lalamove.client.ts");
const shippingSource = source("../src/modules/shipping/shipping.service.ts");

test("Lalamove request signs the exact v3 HMAC contract server-side", () => {
  assert.match(clientSource, /createHmac\("sha256", config\.apiSecret\)/);
  assert.match(clientSource, /`\$\{timestamp\}\\r\\n\$\{method\}\\r\\n\$\{path\}\\r\\n\\r\\n\$\{serializedBody\}`/);
  assert.match(clientSource, /Authorization: `hmac \$\{config\.apiKey\}:\$\{timestamp\}:\$\{signature\}`/);
  assert.match(clientSource, /Market: config\.market/);
  assert.match(clientSource, /"Request-ID": randomUUID\(\)/);
});

test("shipping quote supports Lalamove quotation without client-side secret", () => {
  assert.match(shippingSource, /"lalamove"/);
  assert.match(shippingSource, /"\/v3\/quotations"/);
  assert.match(shippingSource, /provider: "lalamove"/);
  assert.match(shippingSource, /priceBreakdown\.total/);
  assert.match(shippingSource, /process\.env\.LALAMOVE_API_KEY/);
  assert.match(shippingSource, /process\.env\.LALAMOVE_API_SECRET/);
});

test("Lalamove quotation stage never fabricates a carrier tracking code", () => {
  assert.match(
    shippingSource,
    /selected\.code === "lalamove"[\s\S]*?không tạo mã vận đơn giả/,
  );
  assert.doesNotMatch(shippingSource, /LALAMOVE-FAKE/);
});
