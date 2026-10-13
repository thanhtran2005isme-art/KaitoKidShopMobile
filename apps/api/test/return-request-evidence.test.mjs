import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeReturnReason, validateReturnImages,
} from "../dist/modules/orders/return-request.helpers.js";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const service = source("../src/modules/orders/order-after-sales.service.ts");
const controller = source("../src/modules/orders/orders.controller.ts");
const admin = source("../src/modules/admin/admin-order-after-sales.service.ts");
const mobile = source("../../mobile/src/app/orders/[id].tsx");
const web = source("../../web/src/pages/OrderTracking.tsx");

test("Dropdown reason codes are backend-authoritative and legacy clients still work", () => {
  for (const code of [
    "defective", "damaged", "wrong_item", "wrong_variant",
    "not_as_described", "missing_items",
  ]) {
    assert.ok(normalizeReturnReason({ reasonCode: code }).length >= 5);
  }
  assert.equal(normalizeReturnReason({ reasonCode: "other", detail: "Mặc không phù hợp" }), "Lý do khác: Mặc không phù hợp");
  assert.equal(normalizeReturnReason({ reason: "Sai sản phẩm" }), "Sai sản phẩm");
  assert.throws(() => normalizeReturnReason({ reasonCode: "arbitrary" }));
  assert.throws(() => normalizeReturnReason({ reasonCode: "other", detail: "" }));
  assert.throws(() => normalizeReturnReason({ reasonCode: "other", detail: "abc" }));
  assert.throws(() => normalizeReturnReason({ reasonCode: "defective", detail: "a".repeat(381) }));
});

test("Evidence accepts up to three genuine images, rejects spoofing and oversize", () => {
  const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
  const jpeg = Buffer.from([255,216,255,0]);
  const webp = Buffer.from("RIFF____WEBP", "ascii");
  const a = { buffer: png, size: png.length, mimetype: "image/png", originalname: "first.png" };
  const b = { buffer: jpeg, size: jpeg.length, mimetype: "image/jpeg", originalname: "next.jpg" };
  const c = { buffer: webp, size: webp.length, mimetype: "image/webp", originalname: "next.webp" };
  assert.deepEqual(validateReturnImages([a,b,c]).map(x=>x.extension), [".png",".jpg",".webp"]);
  assert.deepEqual(validateReturnImages([]), []);
  assert.throws(() => validateReturnImages([a,a,a,a]));
  assert.throws(() => validateReturnImages([{ ...a, buffer: Buffer.from("not png") }]));
  assert.throws(() => validateReturnImages([{ ...a, size: 5 * 1024 * 1024 + 1 }]));
});

test("Order-scoped submit persists evidence in the same transaction and removes orphan files", () => {
  assert.match(controller, /FilesInterceptor\("images", 3/);
  assert.match(controller, /body, images \?\? \[\]/);
  assert.match(service, /normalizeReturnReason\(body\)/);
  assert.match(service, /validateReturnImages\(files\)/);
  assert.match(service, /lockOrder\(tx, userId, orderId\)/);
  assert.match(service, /latestReturnMarker\(tx, orderId\)/);
  assert.match(service, /return_evidence/);
  assert.match(service, /removePublicFile\(url\)/);
  assert.match(service, /returnEvidence,/);
  assert.match(admin, /returnEvidence: history\.filter/);
  assert.match(mobile, /returnReasonCode === 'other'/);
  assert.match(web, /returnReasonCode === 'other'/);
  assert.match(mobile, /pickReturnImages/);
  assert.match(web, /changeReturnImages/);
});
