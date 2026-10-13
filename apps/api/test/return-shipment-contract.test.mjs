import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const admin = source("../src/modules/admin/admin-order-after-sales.service.ts");
const controller = source("../src/modules/admin/admin-order-after-sales.controller.ts");
const shipping = source("../src/modules/admin/return-shipment.service.ts");
const frontend = source("../../web/src/admin/AdminAfterSalesPanel.tsx");
const migration = source("../../../database/migrations/20261013_return_shipment_lifecycle.sql");

test("Admin may not refund or restock before provider-verified reverse delivery", () => {
  assert.match(admin, /canReceiveReturn:[\s\S]*?returnShipment\?\.status === "delivered"/);
  const receive = admin.slice(admin.indexOf("async receiveReturn"), admin.indexOf("async markRefundCompleted"));
  assert.match(receive, /TrangThai = 'delivered' AND MaVanDon IS NOT NULL/);
  assert.match(receive, /Lalamove chưa xác nhận giao hàng hoàn/);
  assert.ok(receive.indexOf("TrangThai = 'delivered'") < receive.indexOf("UPDATE SanPham"));
  assert.ok(receive.indexOf("TrangThai = 'delivered'") < receive.indexOf("refundOrderInTransaction"));
  assert.match(receive, /refundOrderInTransaction/);
});

test("Reverse shipping uses original customer address for pickup and shop for dropoff", () => {
  assert.match(shipping, /DiaChiGiao AS pickupAddress/);
  assert.match(shipping, /stops: \[\{ address: claimed\.pickupAddress \}, \{ address: cfg\.shopAddress \}\]/);
  assert.match(shipping, /name: claimed\.senderName/);
  assert.match(shipping, /name: cfg\.shopName/);
  assert.match(shipping, /shipmentDirection: "return"/);
  assert.match(migration, /UNIQUE \(DonHangId\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS VanDonHoanHang/);
});

test("Only verified Lalamove completion unlocks return receipt", () => {
  assert.match(shipping, /carrierStatus\(data\.status\)/);
  assert.match(shipping, /if \(status === "COMPLETED"\) return "delivered"/);
  assert.match(shipping, /providerOrderId !== current\.externalId/);
  assert.match(shipping, /lalamoveRequest\(\s*cfg\.request, "GET", "\/v3\/orders\//);
  assert.match(shipping, /TrangThai <> 'delivered'/);
  assert.match(shipping, /if \(previous\[0\]\)/);
  assert.match(shipping, /placeWasAttempted \? "unknown" : "failed"/);
  assert.doesNotMatch(shipping, /MaVanDon\s*=\s*.*DonHang/);
});

test("Admin UI selects an enabled real return carrier and shows receipt only after backend permission", () => {
  assert.match(frontend, /getReturnCarriers/);
  assert.match(frontend, /disabled=\{!item\.enabled\}/);
  assert.match(frontend, /dispatchReturnShipment/);
  assert.match(frontend, /syncReturnShipment/);
  assert.match(frontend, /\{data\.canReceiveReturn && \(/);
  assert.match(controller, /orders\.update_status/);
});
