import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { PrismaService } from "../dist/database/prisma.service.js";
import { hashPassword } from "../dist/modules/identity/password.js";

const base = (process.env.NODE_BASE_URL ?? "http://127.0.0.1:5300").replace(/\/+$/, "");

function number(value) {
  return Number(value ?? 0);
}

function requiredConfirmation() {
  if ((process.env.RUNTIME_RACE_CONFIRM ?? "").trim().toUpperCase() !== "YES") {
    throw new Error(
      "Race gate có mutation. Hãy chạy scripts\\node-concurrency-race-gate.bat để backup DB và set RUNTIME_RACE_CONFIRM=YES.",
    );
  }
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

function ok(result) {
  return result.response.status >= 200 && result.response.status < 300;
}

function responseSummary(result) {
  let body;
  try {
    body = JSON.stringify(result.data);
  } catch {
    body = String(result.data ?? "");
  }
  return `HTTP ${result.response.status} body=${body}`;
}

function assertExactlyOneSuccess(results, label) {
  const successful = results.filter(ok);
  assert.equal(
    successful.length,
    1,
    `${label}: expected exactly one success; ${results.map(responseSummary).join(" | ")}`,
  );
}

function parseProductOptions(value) {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string").map((item) => item.trim())
      : [];
  } catch {
    return [];
  }
}

function containsOption(values, candidate) {
  const normalized = String(candidate ?? "").trim().toLowerCase();
  return values.some((value) => value.toLowerCase() === normalized);
}

async function productState(prisma, productId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT Id AS id, TonKho AS stock, COALESCE(SoLuongDaGiu,0) AS reserved,
            COALESCE(SoLuongDaBan,0) AS sold, TrangThai AS status,
            NgayCapNhat AS updatedAt
     FROM SanPham WHERE Id = ? LIMIT 1`,
    productId,
  );
  return rows[0] ?? null;
}

async function variantState(prisma, variantId) {
  if (!variantId) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT Id AS id, SoLuong AS stock, COALESCE(SoLuongDaGiu,0) AS reserved,
            COALESCE(SoLuongDaBan,0) AS sold, NgayCapNhat AS updatedAt
     FROM TonKhoBienThe WHERE Id = ? LIMIT 1`,
    variantId,
  );
  return rows[0] ?? null;
}

async function chooseFixture(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT p.Id AS productId,
            p.TonKho AS productStock,
            COALESCE(p.SoLuongDaGiu,0) AS productReserved,
            COALESCE(p.SoLuongDaBan,0) AS productSold,
            p.TrangThai AS productStatus,
            p.DanhSachSize AS allowedSizes,
            p.DanhSachMau AS allowedColors,
            (SELECT COUNT(*) FROM TonKhoBienThe vc WHERE vc.SanPhamId = p.Id) AS variantCount,
            v.Id AS variantId,
            v.KichCo AS size,
            v.MauSac AS color,
            v.SoLuong AS variantStock,
            COALESCE(v.SoLuongDaGiu,0) AS variantReserved,
            COALESCE(v.SoLuongDaBan,0) AS variantSold
     FROM SanPham p
     LEFT JOIN TonKhoBienThe v
       ON v.SanPhamId = p.Id
      AND COALESCE(v.SoLuongDaGiu,0) = 0
      AND v.SoLuong >= 8
     WHERE p.TrangThai = 'active'
       AND COALESCE(p.SoLuongDaGiu,0) = 0
       AND p.TonKho >= 8
       AND NOT EXISTS (SELECT 1 FROM GioHang g WHERE g.SanPhamId = p.Id)
     ORDER BY p.Id, v.Id
     LIMIT 300`,
  );

  for (const row of rows) {
    const allowedSizes = parseProductOptions(row.allowedSizes);
    const allowedColors = parseProductOptions(row.allowedColors);
    const variantCount = number(row.variantCount);

    if (variantCount > 0) {
      if (row.variantId == null) continue;
      const size = String(row.size ?? "").trim();
      const color = String(row.color ?? "").trim();
      if (allowedSizes.length > 0 && !containsOption(allowedSizes, size)) continue;
      if (allowedColors.length > 0 && !containsOption(allowedColors, color)) continue;
      return {
        productId: number(row.productId),
        variantId: number(row.variantId),
        size,
        color,
      };
    }

    return {
      productId: number(row.productId),
      variantId: null,
      size: allowedSizes[0] ?? "",
      color: allowedColors[0] ?? "",
    };
  }

  throw new Error(
    "Không tìm thấy cart fixture tương thích: cần product active, stock>=8, reserved=0, không có cart và size/màu khớp rule CartService.",
  );
}

function ciValue(source, name) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return undefined;
  const target = name.toLowerCase();
  return Object.entries(source).find(([key]) => key.toLowerCase() === target)?.[1];
}

function boolValue(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    if (/^(true|1|yes)$/i.test(value.trim())) return true;
    if (/^(false|0|no)$/i.test(value.trim())) return false;
  }
  return fallback;
}

function textValue(source, name, fallback = "") {
  const value = ciValue(source, name);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function shippingCandidates(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT GiaTri AS value
     FROM CauHinhCuaHang
     WHERE NhomCauHinh = 'shipping' AND MaCauHinh = 'config'
     LIMIT 1`,
  );
  let raw = {};
  try {
    raw = rows[0]?.value ? JSON.parse(String(rows[0].value)) : {};
  } catch {
    raw = {};
  }

  const branchesRaw = ciValue(raw, "KaitoKidBranches");
  const branches = Array.isArray(branchesRaw) ? branchesRaw : [];
  const candidates = branches
    .filter((item) => item && typeof item === "object" && boolValue(ciValue(item, "Active"), true))
    .map((item) => ({
      province: textValue(item, "Province"),
      district: textValue(item, "District", "Trung tâm"),
      ward: "Phường Phase 11",
      street: textValue(item, "Address", "Địa chỉ fixture concurrency Phase 11"),
    }))
    .filter((item) => item.province && item.district);

  candidates.push(
    {
      province: "Hưng Yên",
      district: "Mỹ Hào",
      ward: "Phường Phase 11",
      street: "Địa chỉ fixture concurrency Phase 11",
    },
    {
      province: "Hà Nội",
      district: "Cầu Giấy",
      ward: "Phường Phase 11",
      street: "Địa chỉ fixture concurrency Phase 11",
    },
    {
      province: "Hồ Chí Minh",
      district: "Quận 1",
      ward: "Phường Phase 11",
      street: "Địa chỉ fixture concurrency Phase 11",
    },
  );

  const seen = new Set();
  return candidates.filter((item) => {
    const key = `${item.province.toLowerCase()}|${item.district.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function resolveShippingFixture(prisma) {
  const candidates = await shippingCandidates(prisma);
  const failures = [];

  for (const address of candidates) {
    const quote = await call("/api/shipping/quote", {
      method: "POST",
      body: {
        provider: "mock",
        toProvince: address.province,
        toDistrict: address.district,
        toWard: address.ward,
        toAddress: address.street,
        weightGram: 500,
        orderValue: 100000,
      },
    });
    if (!ok(quote)) {
      failures.push(`${address.province}/${address.district}: ${responseSummary(quote)}`);
      continue;
    }

    const options = Array.isArray(quote.data?.options) ? quote.data.options : [];
    if (options.length === 0) {
      failures.push(`${address.province}/${address.district}: no options`);
      continue;
    }

    const option =
      options.find((item) => item.provider === "mock" && item.serviceCode === "standard") ??
      options.find((item) => item.provider === "mock") ??
      options[0];

    if (option?.provider && option?.serviceCode) {
      return { address, option };
    }
    failures.push(`${address.province}/${address.district}: malformed option`);
  }

  throw new Error(
    `Không tìm thấy shipping option khả dụng cho race fixture. Đã thử: ${failures.join(" | ")}`,
  );
}

async function cleanup(prisma, context) {
  const { userId, fixture, productSnapshot, variantSnapshot } = context;
  try {
    if (userId) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM LichSuTrangThaiVanChuyen
         WHERE DonHangId IN (SELECT Id FROM DonHang WHERE NguoiDungId = ?)`,
        userId,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM ChiTietDonHang
         WHERE DonHangId IN (SELECT Id FROM DonHang WHERE NguoiDungId = ?)`,
        userId,
      );
      await prisma.$executeRawUnsafe("DELETE FROM DonHang WHERE NguoiDungId = ?", userId);
      await prisma.$executeRawUnsafe("DELETE FROM GioHang WHERE NguoiDungId = ?", userId);
      await prisma.$executeRawUnsafe("DELETE FROM LoginActivity WHERE UserId = ?", userId);
      await prisma.$executeRawUnsafe("DELETE FROM NguoiDung WHERE Id = ?", userId);
    }
  } finally {
    if (fixture && productSnapshot) {
      await prisma.$executeRawUnsafe(
        `UPDATE SanPham
         SET TonKho = ?, SoLuongDaGiu = ?, SoLuongDaBan = ?, TrangThai = ?, NgayCapNhat = ?
         WHERE Id = ?`,
        number(productSnapshot.stock),
        number(productSnapshot.reserved),
        number(productSnapshot.sold),
        productSnapshot.status,
        productSnapshot.updatedAt,
        fixture.productId,
      );
    }
    if (fixture?.variantId && variantSnapshot) {
      await prisma.$executeRawUnsafe(
        `UPDATE TonKhoBienThe
         SET SoLuong = ?, SoLuongDaGiu = ?, SoLuongDaBan = ?, NgayCapNhat = ?
         WHERE Id = ?`,
        number(variantSnapshot.stock),
        number(variantSnapshot.reserved),
        number(variantSnapshot.sold),
        variantSnapshot.updatedAt,
        fixture.variantId,
      );
    }
  }
}

test("Phase 11 commerce concurrency/race trên MariaDB thật", async (t) => {
  requiredConfirmation();
  const prisma = new PrismaService();
  await prisma.$connect();

  const context = {
    userId: 0,
    fixture: null,
    productSnapshot: null,
    variantSnapshot: null,
  };

  try {
    const health = await call("/health");
    assert.ok(ok(health), `Node health fail: ${responseSummary(health)}`);
    assert.equal(health.data?.database?.expectedTables, 52);
    assert.equal(health.data?.database?.actualTables, 52);

    context.fixture = await chooseFixture(prisma);
    context.productSnapshot = await productState(prisma, context.fixture.productId);
    context.variantSnapshot = await variantState(prisma, context.fixture.variantId);
    assert.ok(context.productSnapshot, "Không đọc được product snapshot");

    console.log(
      `[FIXTURE] cart product=${context.fixture.productId} variant=${context.fixture.variantId ?? "none"} size=${JSON.stringify(context.fixture.size)} color=${JSON.stringify(context.fixture.color)}`,
    );

    const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
    const email = `phase11-race-${suffix}@example.invalid`;
    const password = `Phase11-${randomBytes(8).toString("hex")}!`;
    const passwordHash = await hashPassword(password);
    const phone = `09${String(Date.now()).slice(-8)}`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO NguoiDung
         (HoTen, Email, MatKhauHash, SoDienThoai, VaiTro,
          EmailDaXacThuc, NhaCungCap, NgayTao)
       VALUES (?, ?, ?, ?, 'user', 1, 'local', ?)`,
      "Phase 11 Race Fixture",
      email,
      passwordHash,
      phone,
      new Date(),
    );
    const createdUsers = await prisma.$queryRawUnsafe(
      "SELECT Id AS id FROM NguoiDung WHERE Email = ? LIMIT 1",
      email,
    );
    context.userId = number(createdUsers[0]?.id);
    assert.ok(context.userId > 0, "Không tạo được customer fixture");

    const login = await call("/api/Auth/login", {
      method: "POST",
      body: { identifier: email, password },
    });
    assert.ok(ok(login), `Fixture login fail: ${responseSummary(login)}`);
    const token = login.data?.accessToken;
    assert.ok(token, "Fixture login thiếu accessToken");

    const paymentConfig = await call("/api/payment/config");
    assert.ok(ok(paymentConfig), `Không đọc được payment config: ${responseSummary(paymentConfig)}`);
    const methods = Array.isArray(paymentConfig.data?.supportedMethods)
      ? paymentConfig.data.supportedMethods
      : [];
    const paymentMethod = methods.includes("COD") ? "COD" : methods.includes("ATM") ? "ATM" : null;
    assert.ok(paymentMethod, "Không có payment method khả dụng để chạy checkout race");

    const shipping = await resolveShippingFixture(prisma);
    const address = shipping.address;
    const shippingProvider = String(shipping.option.provider);
    const shippingServiceCode = String(shipping.option.serviceCode);

    let addReady = false;
    await t.test("hai AddToCart đồng thời không double-reserve sai", async () => {
      const body = {
        productId: context.fixture.productId,
        size: context.fixture.size,
        color: context.fixture.color,
        quantity: 1,
      };
      const results = await Promise.all([
        call("/api/cart", { method: "POST", token, body }),
        call("/api/cart", { method: "POST", token, body }),
      ]);
      assert.equal(
        results.filter(ok).length,
        2,
        `AddToCart phải thành công cả 2 request; ${results.map(responseSummary).join(" | ")}`,
      );

      const cartRows = await prisma.$queryRawUnsafe(
        `SELECT Id AS id, SoLuong AS quantity
         FROM GioHang
         WHERE NguoiDungId = ? AND SanPhamId = ? AND KichCo = ? AND MauSac = ?`,
        context.userId,
        context.fixture.productId,
        context.fixture.size,
        context.fixture.color,
      );
      assert.equal(cartRows.length, 1, "Race tạo duplicate cart row");
      assert.equal(number(cartRows[0].quantity), 2, "Cart quantity sau race phải = 2");

      const product = await productState(prisma, context.fixture.productId);
      assert.equal(number(product.reserved), number(context.productSnapshot.reserved) + 2);
      if (context.fixture.variantId) {
        const variant = await variantState(prisma, context.fixture.variantId);
        assert.equal(number(variant.reserved), number(context.variantSnapshot.reserved) + 2);
      }
      addReady = true;
    });
    if (!addReady) return;

    let firstOrderId = 0;
    let checkoutReady = false;
    await t.test("hai checkout cùng reservation chỉ tạo đúng một đơn", async () => {
      const cartRows = await prisma.$queryRawUnsafe(
        "SELECT Id AS id FROM GioHang WHERE NguoiDungId = ? ORDER BY Id",
        context.userId,
      );
      assert.equal(cartRows.length, 1, "Checkout race cần đúng một cart row từ AddToCart race");
      const cartId = number(cartRows[0].id);
      const body = {
        cartItemIds: [cartId],
        customerName: "Phase 11 Race Fixture",
        customerPhone: phone,
        customerEmail: email,
        shippingProvider,
        shippingServiceCode,
        shippingProvince: address.province,
        shippingDistrict: address.district,
        shippingWard: address.ward,
        shippingStreet: address.street,
        paymentMethod,
        note: "phase11 concurrency fixture",
      };
      const results = await Promise.all([
        call("/api/orders", { method: "POST", token, body }),
        call("/api/orders", { method: "POST", token, body }),
      ]);
      assertExactlyOneSuccess(results, "concurrent checkout");

      const orders = await prisma.$queryRawUnsafe(
        `SELECT Id AS id, TrangThai AS status
         FROM DonHang WHERE NguoiDungId = ? ORDER BY Id`,
        context.userId,
      );
      assert.equal(orders.length, 1, "Checkout race tạo nhiều hơn một DonHang");
      firstOrderId = number(orders[0].id);
      const carts = await prisma.$queryRawUnsafe(
        "SELECT Id FROM GioHang WHERE NguoiDungId = ?",
        context.userId,
      );
      assert.equal(carts.length, 0, "Checkout thành công phải xóa reservation cart");

      const product = await productState(prisma, context.fixture.productId);
      assert.equal(number(product.stock), number(context.productSnapshot.stock) - 2);
      assert.equal(number(product.reserved), number(context.productSnapshot.reserved));
      assert.equal(number(product.sold), number(context.productSnapshot.sold) + 2);
      if (context.fixture.variantId) {
        const variant = await variantState(prisma, context.fixture.variantId);
        assert.equal(number(variant.stock), number(context.variantSnapshot.stock) - 2);
        assert.equal(number(variant.reserved), number(context.variantSnapshot.reserved));
        assert.equal(number(variant.sold), number(context.variantSnapshot.sold) + 2);
      }
      checkoutReady = true;
    });
    if (!checkoutReady) return;

    let cancelReady = false;
    await t.test("double cancel chỉ hoàn stock đúng một lần", async () => {
      assert.ok(firstOrderId > 0, "Thiếu order fixture cho double cancel");
      const results = await Promise.all([
        call(`/api/orders/${firstOrderId}/cancel`, { method: "PUT", token }),
        call(`/api/orders/${firstOrderId}/cancel`, { method: "PUT", token }),
      ]);
      assertExactlyOneSuccess(results, "double cancel");
      const orderRows = await prisma.$queryRawUnsafe(
        "SELECT TrangThai AS status FROM DonHang WHERE Id = ?",
        firstOrderId,
      );
      assert.equal(orderRows[0]?.status, "cancelled");

      const product = await productState(prisma, context.fixture.productId);
      assert.equal(number(product.stock), number(context.productSnapshot.stock));
      assert.equal(number(product.reserved), number(context.productSnapshot.reserved));
      assert.equal(number(product.sold), number(context.productSnapshot.sold));
      if (context.fixture.variantId) {
        const variant = await variantState(prisma, context.fixture.variantId);
        assert.equal(number(variant.stock), number(context.variantSnapshot.stock));
        assert.equal(number(variant.reserved), number(context.variantSnapshot.reserved));
        assert.equal(number(variant.sold), number(context.variantSnapshot.sold));
      }
      cancelReady = true;
    });
    if (!cancelReady) return;

    await t.test("payment expiry và customer cancel race không double-restock", async () => {
      const add = await call("/api/cart", {
        method: "POST",
        token,
        body: {
          productId: context.fixture.productId,
          size: context.fixture.size,
          color: context.fixture.color,
          quantity: 1,
        },
      });
      assert.ok(ok(add), `Add fixture lần 2 fail: ${responseSummary(add)}`);
      const cartRows = await prisma.$queryRawUnsafe(
        "SELECT Id AS id FROM GioHang WHERE NguoiDungId = ? ORDER BY Id DESC LIMIT 1",
        context.userId,
      );
      assert.ok(cartRows[0], "Add fixture lần 2 thành công nhưng không tìm thấy GioHang row");
      const checkout = await call("/api/orders", {
        method: "POST",
        token,
        body: {
          cartItemIds: [number(cartRows[0].id)],
          customerName: "Phase 11 Race Fixture",
          customerPhone: phone,
          customerEmail: email,
          shippingProvider,
          shippingServiceCode,
          shippingProvince: address.province,
          shippingDistrict: address.district,
          shippingWard: address.ward,
          shippingStreet: address.street,
          paymentMethod,
          note: "phase11 payment race fixture",
        },
      });
      assert.ok(ok(checkout), `Checkout fixture lần 2 fail: ${responseSummary(checkout)}`);
      const orderId = number(checkout.data?.id);
      const orderCode = String(checkout.data?.orderCode ?? "");
      assert.ok(orderId > 0 && orderCode, "Không đọc được order fixture lần 2");

      await prisma.$executeRawUnsafe(
        `UPDATE DonHang
         SET PhuongThucThanhToan = 'ATM', HetHanThanhToan = ?,
             NgayThanhToan = NULL, TrangThai = 'pending', TrangThaiVanChuyen = NULL
         WHERE Id = ?`,
        new Date(Date.now() - 60_000),
        orderId,
      );

      const [statusResult, cancelResult] = await Promise.all([
        call(`/api/payment/status/${encodeURIComponent(orderCode)}`, { token }),
        call(`/api/payment/cancel/${encodeURIComponent(orderCode)}`, { method: "POST", token }),
      ]);
      assert.ok(ok(statusResult), `payment status race fail: ${responseSummary(statusResult)}`);
      assert.ok(
        ok(cancelResult) || cancelResult.response.status === 400,
        `payment cancel race unexpected: ${responseSummary(cancelResult)}`,
      );

      const orderRows = await prisma.$queryRawUnsafe(
        "SELECT TrangThai AS status, NgayThanhToan AS paidAt FROM DonHang WHERE Id = ?",
        orderId,
      );
      assert.equal(orderRows[0]?.status, "cancelled");
      assert.equal(orderRows[0]?.paidAt, null);

      const product = await productState(prisma, context.fixture.productId);
      assert.equal(number(product.stock), number(context.productSnapshot.stock));
      assert.equal(number(product.reserved), number(context.productSnapshot.reserved));
      assert.equal(number(product.sold), number(context.productSnapshot.sold));
      if (context.fixture.variantId) {
        const variant = await variantState(prisma, context.fixture.variantId);
        assert.equal(number(variant.stock), number(context.variantSnapshot.stock));
        assert.equal(number(variant.reserved), number(context.variantSnapshot.reserved));
        assert.equal(number(variant.sold), number(context.variantSnapshot.sold));
      }
    });
  } finally {
    await cleanup(prisma, context);
    await prisma.$disconnect();
  }
});
