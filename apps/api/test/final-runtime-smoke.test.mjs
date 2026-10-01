import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = (process.env.NODE_BASE_URL ?? "http://127.0.0.1:5300").replace(/\/+$/, "");

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200, `${path} returned HTTP ${response.status}`);
  return response;
}

test("live Node health dùng đúng MariaDB 52 tables", async () => {
  const response = await request("/health");
  const json = await response.json();
  assert.equal(json.status, "ok");
  assert.equal(json.database?.expectedTables, 52);
  assert.equal(json.database?.actualTables, 52);
  assert.deepEqual(json.database?.missingTables, []);
});

test("live catalog public trả dữ liệu qua Node", async () => {
  const response = await request("/api/products?page=1&pageSize=1");
  const json = await response.json();
  assert.ok(json !== null && json !== undefined);
});

test("image search soft-status không làm API chết khi thiếu ONNX", async () => {
  const response = await request("/api/search/by-image/status");
  const json = await response.json();
  assert.equal(typeof json.ready, "boolean");
});

test("shared apps/web/public media được serve qua Node", async () => {
  const response = await request("/slide_1.jpg");
  assert.match(response.headers.get("content-type") ?? "", /image\/jpeg/i);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.ok(bytes.byteLength > 1000);
});

test("legacy product media fallback trả SVG thay vì 404", async () => {
  const response = await request("/products/phase11-missing-product.jpg");
  assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/i);
  assert.match(await response.text(), /KaitoKid/);
});

test("legacy lookbook media fallback trả SVG thay vì 404", async () => {
  const response = await request("/lookbook/phase11-missing-lookbook.jpg");
  assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/i);
  assert.match(await response.text(), /SHOP THE LOOK/);
});
