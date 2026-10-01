import assert from "node:assert/strict";
import test from "node:test";

const base = (process.env.NODE_BASE_URL ?? "http://127.0.0.1:5300").replace(/\/+$/, "");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Thiếu ${name}. Chạy scripts\\node-protected-runtime-parity.bat để nhập credential an toàn.`);
  }
  return value;
}

async function call(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { response, data };
}

function expectStatus(result, expected, label) {
  assert.equal(
    result.response.status,
    expected,
    `${label}: expected HTTP ${expected}, got ${result.response.status}: ${JSON.stringify(result.data)}`,
  );
}

function expectOk(result, label) {
  assert.ok(
    result.response.ok,
    `${label}: HTTP ${result.response.status}: ${JSON.stringify(result.data)}`,
  );
}

test("protected runtime parity customer + staff trên Node", async (t) => {
  const customerIdentifier = required("RUNTIME_CUSTOMER_IDENTIFIER");
  const customerPassword = required("RUNTIME_CUSTOMER_PASSWORD");
  const staffEmail = required("RUNTIME_STAFF_EMAIL");
  const staffPassword = required("RUNTIME_STAFF_PASSWORD");

  let customerAccessToken = "";
  let customerRefreshToken = "";
  let staffAccessToken = "";

  await t.test("protected endpoint reject anonymous", async () => {
    const result = await call("/api/Auth/me");
    expectStatus(result, 401, "anonymous /api/Auth/me");
  });

  await t.test("customer login thật qua Node", async () => {
    const result = await call("/api/Auth/login", {
      method: "POST",
      body: {
        identifier: customerIdentifier,
        password: customerPassword,
      },
    });
    expectOk(result, "customer login");
    assert.equal(result.data?.twoFactorRequired, false, "Hãy dùng tài khoản test không bật 2FA cho gate tự động này.");
    assert.ok(result.data?.accessToken, "customer login thiếu accessToken");
    assert.ok(result.data?.refreshToken, "customer login thiếu refreshToken");
    customerAccessToken = result.data.accessToken;
    customerRefreshToken = result.data.refreshToken;
  });

  await t.test("customer /me trả đúng session", async () => {
    const result = await call("/api/Auth/me", { token: customerAccessToken });
    expectOk(result, "customer /me");
    assert.ok(result.data?.id, "customer /me thiếu id");
  });

  await t.test("refresh token rotate và token cũ bị revoke", async () => {
    const firstRefresh = customerRefreshToken;
    const rotated = await call("/api/Auth/refresh", {
      method: "POST",
      body: { refreshToken: firstRefresh },
    });
    expectOk(rotated, "refresh rotation");
    assert.ok(rotated.data?.accessToken, "refresh thiếu accessToken mới");
    assert.ok(rotated.data?.refreshToken, "refresh thiếu refreshToken mới");
    assert.notEqual(rotated.data.refreshToken, firstRefresh, "refresh token không rotate");

    customerAccessToken = rotated.data.accessToken;
    customerRefreshToken = rotated.data.refreshToken;

    const replay = await call("/api/Auth/refresh", {
      method: "POST",
      body: { refreshToken: firstRefresh },
    });
    expectStatus(replay, 401, "refresh token cũ sau rotation");
  });

  await t.test("customer protected read surfaces sống trên Node", async () => {
    for (const [path, label] of [
      ["/api/account", "account"],
      ["/api/cart", "cart"],
      ["/api/wishlist", "wishlist"],
      ["/api/addresses", "addresses"],
      ["/api/orders", "orders"],
    ]) {
      const result = await call(path, { token: customerAccessToken });
      expectOk(result, label);
    }
  });

  await t.test("customer JWT không được vào Admin", async () => {
    const result = await call("/api/admin/products?page=1&pageSize=1", {
      token: customerAccessToken,
    });
    expectStatus(result, 403, "customer -> admin products");
  });

  await t.test("staff login + /me thật qua Node", async () => {
    const login = await call("/api/auth/staff/login", {
      method: "POST",
      body: { email: staffEmail, password: staffPassword },
    });
    expectOk(login, "staff login");
    assert.ok(login.data?.accessToken, "staff login thiếu accessToken");
    staffAccessToken = login.data.accessToken;

    const me = await call("/api/auth/staff/me", { token: staffAccessToken });
    expectOk(me, "staff /me");
    assert.ok(me.data?.id, "staff /me thiếu id");
  });

  await t.test("staff JWT vào được Admin read surface", async () => {
    const result = await call("/api/admin/products?page=1&pageSize=1", {
      token: staffAccessToken,
    });
    expectOk(result, "staff -> admin products");
    assert.ok(Array.isArray(result.data?.items), "admin products thiếu items[]");
  });
});
