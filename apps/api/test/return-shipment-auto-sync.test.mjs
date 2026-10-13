import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ReturnShipmentService } from "../dist/modules/admin/return-shipment.service.js";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const panel = source("../../web/src/admin/AdminAfterSalesPanel.tsx");
const controller = source("../src/modules/shipping/shipping.controller.ts");
const returnSource = source("../src/modules/admin/return-shipment.service.ts");

function fakeReturnDB() {
  const shipment = {
    id: 9, orderId: 23, provider: "lalamove", externalId: "3605106573666075048",
    quotationId: "q1", status: "in_transit", senderName: "Customer",
    senderPhone: "+84000000000", pickupAddress: "Customer address",
    receiverName: "Shop", receiverPhone: "+84000000001", dropoffAddress: "Shop address",
    fee: 10000, trackingUrl: null, deliveredAt: null, errorMessage: null,
    lastCheckedAt: new Date(),
  };
  const events = [];
  const db = {
    async $queryRawUnsafe(query, ...args) {
      if (query.includes("FROM VanDonHoanHang WHERE DonHangId")) return [structuredClone(shipment)];
      if (query.includes("FROM VanDonHoanHang") && query.includes("MaVanDon = ?")) {
        return args[0] === shipment.externalId ? [{orderId: 23}] : [];
      }
      if (query.includes("FROM CauHinhCuaHang")) return [{value: JSON.stringify({LalamoveEnabled:true})}];
      throw Error("Unexpected DB query: " + query.slice(0, 100));
    },
    async $executeRawUnsafe(sql, ...args) {
      if (sql.includes("UPDATE VanDonHoanHang")) {
        shipment.status = args[0];
        shipment.deliveredAt = args[0] === "delivered" ? args[2] : null;
        shipment.lastCheckedAt = args[4];
        return 1;
      }
      if (sql.includes("INSERT INTO LichSuTrangThaiVanChuyen")) {
        events.push({state: "return_shipping_delivered", orderId: args[0]});
        return 1;
      }
      throw Error("Unexpected DB write: " + sql.slice(0, 100));
    },
    async $transaction(callback) { return callback(db); },
  };
  return {db, shipment, events};
}

test("Return shipment status is taken from authenticated provider GET, not a website screenshot", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.LALAMOVE_API_KEY;
  const originalSecret = process.env.LALAMOVE_API_SECRET;
  const {db, shipment, events} = fakeReturnDB();
  process.env.LALAMOVE_API_KEY = "test-api-key";
  process.env.LALAMOVE_API_SECRET = "test-api-secret";
  let responseStatus = "ON_GOING";
  let fetchCount = 0;
  globalThis.fetch = async (url, options) => {
    fetchCount += 1;
    assert.match(String(url), /\/v3\/orders\/3605106573666075048$/);
    assert.equal(options.method, "GET");
    assert.match(options.headers.Authorization, /^hmac /);
    return new Response(JSON.stringify({data:{orderId:shipment.externalId,status:responseStatus}}),{
      status:200,headers:{"Content-Type":"application/json"}
    });
  };
  try {
    const service = new ReturnShipmentService(db);
    assert.equal((await service.sync(23)).status,"in_transit");
    assert.equal(events.length,0);
    responseStatus = "COMPLETED";
    const returned = await service.sync(23);
    assert.equal(returned.status,"delivered");
    assert.equal(events.length,1);
    assert.ok(returned.deliveredAt);
    assert.equal((await service.sync(23)).status,"delivered");
    assert.equal(events.length,1,"repeat must not duplicate delivered history");
    assert.equal(fetchCount,2,"do not call provider twice after delivered");
  } finally {
    globalThis.fetch = originalFetch;
    if(originalKey === undefined) delete process.env.LALAMOVE_API_KEY;
    else process.env.LALAMOVE_API_KEY = originalKey;
    if(originalSecret === undefined) delete process.env.LALAMOVE_API_SECRET;
    else process.env.LALAMOVE_API_SECRET = originalSecret;
  }
});

test("Signed webhook routing correlates reverse shipments and rechecks with provider", async () => {
  assert.match(controller, /const result = await this\.lalamove\.handleWebhook\(body\)/);
  assert.match(controller, /if \(!\("ignored" in result\)/);
  assert.match(controller, /reconcileVerifiedWebhook\(externalOrderId\)/);
  assert.match(returnSource, /NhaVanChuyen = 'lalamove' AND MaVanDon = \?/);
  assert.match(returnSource, /await this\.sync\(orderId\)/);
  assert.match(returnSource, /carrierStatus\(data\.status\)/);
  assert.match(returnSource, /providerOrderId !== current\.externalId/);
});

test("Admin panel polls after load/on visibility/focus but never credits wallet", () => {
  assert.match(panel, /void reconcile\(\); \/\/ on open/);
  assert.match(panel, /setInterval\(\(\) => \{ void reconcile\(\); \}, 20_000\)/);
  assert.match(panel, /visibilitychange/);
  assert.match(panel, /window\.addEventListener\('focus'/);
  assert.match(panel, /document\.visibilityState === 'hidden'/);
  assert.match(panel, /orderApi\.syncReturnShipment\(orderId\)/);
  assert.match(panel, /currentShippingStatus.*currentShippingId/s);
  assert.match(panel, /Đồng bộ hãng gần nhất/);
  assert.doesNotMatch(returnSource, /refundOrderInTransaction|UPDATE SanPham/);
});
