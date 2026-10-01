import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { PrismaService } from "../dist/database/prisma.service.js";
import { hashPassword } from "../dist/modules/identity/password.js";

const base = (process.env.NODE_BASE_URL ?? "http://127.0.0.1:5300").replace(/\/+$/, "");
const number = (value) => Number(value ?? 0);
function requiredConfirmation() {
  if ((process.env.RUNTIME_RACE_CONFIRM ?? "").trim().toUpperCase() !== "YES") {
    throw new Error("Payment terminal race có mutation. Hãy chạy scripts\\node-concurrency-race-gate.bat để backup DB trước.");
  }
}
async function call(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null; if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  return { response, data };
}
const ok = (result) => result.response.status >= 200 && result.response.status < 300;
function summary(result) { let body; try { body = JSON.stringify(result.data); } catch { body = String(result.data ?? ""); } return `HTTP ${result.response.status} body=${body}`; }
function parseProductOptions(value) { if (typeof value !== "string" || !value.trim()) return []; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string").map((x) => x.trim()) : []; } catch { return []; } }
function containsOption(values, candidate) { const normalized = String(candidate ?? "").trim().toLowerCase(); return values.some((value) => value.toLowerCase() === normalized); }

async function productState(prisma, productId) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT Id AS id, TonKho AS stock, COALESCE(SoLuongDaGiu,0) AS reserved,
            COALESCE(SoLuongDaBan,0) AS sold, TrangThai AS status, NgayCapNhat AS updatedAt
     FROM SanPham WHERE Id=? LIMIT 1`, productId,
  );
  return rows[0] ?? null;
}
async function variantState(prisma, variantId) {
  if (!variantId) return null;
  const rows = await prisma.$queryRawUnsafe(
    `SELECT Id AS id, SoLuong AS stock, COALESCE(SoLuongDaGiu,0) AS reserved,
            COALESCE(SoLuongDaBan,0) AS sold, NgayCapNhat AS updatedAt
     FROM TonKhoBienThe WHERE Id=? LIMIT 1`, variantId,
  );
  return rows[0] ?? null;
}
async function chooseFixture(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT p.Id AS productId, p.DanhSachSize AS allowedSizes, p.DanhSachMau AS allowedColors,
            (SELECT COUNT(*) FROM TonKhoBienThe vc WHERE vc.SanPhamId=p.Id) AS variantCount,
            v.Id AS variantId, v.KichCo AS size, v.MauSac AS color
     FROM SanPham p
     LEFT JOIN TonKhoBienThe v ON v.SanPhamId=p.Id AND COALESCE(v.SoLuongDaGiu,0)=0 AND v.SoLuong>=4
     WHERE p.TrangThai='active' AND COALESCE(p.SoLuongDaGiu,0)=0 AND p.TonKho>=4
       AND NOT EXISTS (SELECT 1 FROM GioHang g WHERE g.SanPhamId=p.Id)
     ORDER BY p.Id,v.Id LIMIT 300`,
  );
  for (const row of rows) {
    const allowedSizes = parseProductOptions(row.allowedSizes);
    const allowedColors = parseProductOptions(row.allowedColors);
    const variantCount = number(row.variantCount);
    if (variantCount > 0) {
      if (row.variantId == null) continue;
      const size = String(row.size ?? "").trim(); const color = String(row.color ?? "").trim();
      if (allowedSizes.length > 0 && !containsOption(allowedSizes, size)) continue;
      if (allowedColors.length > 0 && !containsOption(allowedColors, color)) continue;
      return { productId: number(row.productId), variantId: number(row.variantId), size, color };
    }
    return { productId: number(row.productId), variantId: null, size: allowedSizes[0] ?? "", color: allowedColors[0] ?? "" };
  }
  throw new Error("Không tìm thấy payment terminal race fixture phù hợp.");
}
function ciValue(source, name) { if (!source || typeof source !== "object" || Array.isArray(source)) return undefined; const target = name.toLowerCase(); return Object.entries(source).find(([key]) => key.toLowerCase() === target)?.[1]; }
function boolValue(value, fallback = true) { if (typeof value === "boolean") return value; if (typeof value === "number") return value !== 0; if (typeof value === "string") { if (/^(true|1|yes)$/i.test(value.trim())) return true; if (/^(false|0|no)$/i.test(value.trim())) return false; } return fallback; }
function textValue(source, name, fallback = "") { const value = ciValue(source, name); return typeof value === "string" && value.trim() ? value.trim() : fallback; }
async function resolveShippingFixture(prisma) {
  const rows = await prisma.$queryRawUnsafe(`SELECT GiaTri AS value FROM CauHinhCuaHang WHERE NhomCauHinh='shipping' AND MaCauHinh='config' LIMIT 1`);
  let raw = {}; try { raw = rows[0]?.value ? JSON.parse(String(rows[0].value)) : {}; } catch { raw = {}; }
  const rawBranches = ciValue(raw, "KaitoKidBranches");
  const branches = Array.isArray(rawBranches) ? rawBranches : [];
  const candidates = branches
    .filter((item) => item && typeof item === "object" && boolValue(ciValue(item, "Active"), true))
    .map((item) => ({ province: textValue(item, "Province"), district: textValue(item, "District", "Trung tâm"), ward: "Phường Phase 11", street: textValue(item, "Address", "Địa chỉ fixture payment race") }))
    .filter((item) => item.province && item.district);
  for (const address of candidates) {
    const quote = await call("/api/shipping/quote", {
      method: "POST", body: { provider: "mock", toProvince: address.province, toDistrict: address.district, toWard: address.ward, toAddress: address.street, weightGram: 500, orderValue: 100000 },
    });
    if (!ok(quote)) continue;
    const options = Array.isArray(quote.data?.options) ? quote.data.options : [];
    const option = options.find((item) => item.provider === "mock" && item.serviceCode === "standard") ?? options.find((item) => item.provider === "mock") ?? options[0];
    if (option?.provider && option?.serviceCode) return { address, option };
  }
  throw new Error("Không tìm thấy mock shipping option từ isolated Phase 11 shipping fixture.");
}
async function cleanup(prisma, context) {
  try {
    if (context.userId) {
      await prisma.$executeRawUnsafe(`DELETE FROM LichSuTrangThaiVanChuyen WHERE DonHangId IN (SELECT Id FROM DonHang WHERE NguoiDungId=?)`, context.userId);
      await prisma.$executeRawUnsafe(`DELETE FROM ChiTietDonHang WHERE DonHangId IN (SELECT Id FROM DonHang WHERE NguoiDungId=?)`, context.userId);
      await prisma.$executeRawUnsafe("DELETE FROM DonHang WHERE NguoiDungId=?", context.userId);
      await prisma.$executeRawUnsafe("DELETE FROM GioHang WHERE NguoiDungId=?", context.userId);
      await prisma.$executeRawUnsafe("DELETE FROM LoginActivity WHERE UserId=?", context.userId);
      await prisma.$executeRawUnsafe("DELETE FROM NguoiDung WHERE Id=?", context.userId);
    }
  } finally {
    if (context.fixture && context.productSnapshot) {
      await prisma.$executeRawUnsafe(
        `UPDATE SanPham SET TonKho=?,SoLuongDaGiu=?,SoLuongDaBan=?,TrangThai=?,NgayCapNhat=? WHERE Id=?`,
        number(context.productSnapshot.stock), number(context.productSnapshot.reserved), number(context.productSnapshot.sold), context.productSnapshot.status, context.productSnapshot.updatedAt, context.fixture.productId,
      );
    }
    if (context.fixture?.variantId && context.variantSnapshot) {
      await prisma.$executeRawUnsafe(
        `UPDATE TonKhoBienThe SET SoLuong=?,SoLuongDaGiu=?,SoLuongDaBan=?,NgayCapNhat=? WHERE Id=?`,
        number(context.variantSnapshot.stock), number(context.variantSnapshot.reserved), number(context.variantSnapshot.sold), context.variantSnapshot.updatedAt, context.fixture.variantId,
      );
    }
  }
}

test("Phase 11 payment paid/expiry/cancel terminal race không double-restock", async () => {
  requiredConfirmation();
  const prisma = new PrismaService(); await prisma.$connect();
  const context = { userId: 0, fixture: null, productSnapshot: null, variantSnapshot: null };
  try {
    const health = await call("/health");
    assert.ok(ok(health), `Node health fail: ${summary(health)}`);
    assert.equal(health.data?.database?.expectedTables, 52); assert.equal(health.data?.database?.actualTables, 52);
    context.fixture = await chooseFixture(prisma);
    context.productSnapshot = await productState(prisma, context.fixture.productId);
    context.variantSnapshot = await variantState(prisma, context.fixture.variantId);
    assert.ok(context.productSnapshot);

    const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
    const email = `phase11-payment-race-${suffix}@example.invalid`;
    const password = `Phase11-${randomBytes(8).toString("hex")}!`;
    const phone = `09${String(Date.now()).slice(-8)}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO NguoiDung (HoTen,Email,MatKhauHash,SoDienThoai,VaiTro,EmailDaXacThuc,NhaCungCap,NgayTao)
       VALUES (?,?,?,?, 'user',1,'local',?)`, "Phase 11 Payment Race", email, await hashPassword(password), phone, new Date(),
    );
    const users = await prisma.$queryRawUnsafe("SELECT Id AS id FROM NguoiDung WHERE Email=? LIMIT 1", email);
    context.userId = number(users[0]?.id); assert.ok(context.userId > 0);
    const login = await call("/api/Auth/login", { method: "POST", body: { identifier: email, password } });
    assert.ok(ok(login), `Customer login fail: ${summary(login)}`);
    const customerToken = String(login.data?.accessToken ?? ""); assert.ok(customerToken);

    const paymentConfig = await call("/api/payment/config");
    assert.ok(ok(paymentConfig), `Payment config fail: ${summary(paymentConfig)}`);
    const methods = Array.isArray(paymentConfig.data?.supportedMethods) ? paymentConfig.data.supportedMethods : [];
    const checkoutMethod = methods.includes("ATM") ? "ATM" : methods.includes("COD") ? "COD" : null;
    assert.ok(checkoutMethod, "Không có payment method cho fixture");
    const shipping = await resolveShippingFixture(prisma);
    const add = await call("/api/cart", { method: "POST", token: customerToken, body: { productId: context.fixture.productId, size: context.fixture.size, color: context.fixture.color, quantity: 1 } });
    assert.ok(ok(add), `Add cart payment fixture fail: ${summary(add)}`);
    const carts = await prisma.$queryRawUnsafe("SELECT Id AS id FROM GioHang WHERE NguoiDungId=? ORDER BY Id DESC LIMIT 1", context.userId);
    assert.ok(carts[0]);
    const checkout = await call("/api/orders", {
      method: "POST", token: customerToken,
      body: { cartItemIds: [number(carts[0].id)], customerName: "Phase 11 Payment Race", customerPhone: phone, customerEmail: email,
        shippingProvider: String(shipping.option.provider), shippingServiceCode: String(shipping.option.serviceCode),
        shippingProvince: shipping.address.province, shippingDistrict: shipping.address.district, shippingWard: shipping.address.ward, shippingStreet: shipping.address.street,
        paymentMethod: checkoutMethod, note: "phase11 paid-expiry-cancel race" },
    });
    assert.ok(ok(checkout), `Checkout payment fixture fail: ${summary(checkout)}`);
    const orderId = number(checkout.data?.id); const orderCode = String(checkout.data?.orderCode ?? "");
    assert.ok(orderId > 0 && orderCode);
    await prisma.$executeRawUnsafe(
      `UPDATE DonHang SET PhuongThucThanhToan='ATM',HetHanThanhToan=?,NgayThanhToan=NULL,TrangThai='pending',TrangThaiVanChuyen=NULL WHERE Id=?`,
      new Date(Date.now() - 60_000), orderId,
    );
    await prisma.$executeRawUnsafe("UPDATE NguoiDung SET VaiTro='admin' WHERE Id=?", context.userId);
    const adminLogin = await call("/api/Auth/login", { method: "POST", body: { identifier: email, password } });
    assert.ok(ok(adminLogin), `Admin-role fixture login fail: ${summary(adminLogin)}`);
    const adminToken = String(adminLogin.data?.accessToken ?? ""); assert.ok(adminToken);

    const [expiry, cancel, paid] = await Promise.all([
      call(`/api/payment/status/${encodeURIComponent(orderCode)}`, { token: adminToken }),
      call(`/api/payment/cancel/${encodeURIComponent(orderCode)}`, { method: "POST", token: adminToken }),
      call(`/api/payment/mark-paid/${encodeURIComponent(orderCode)}`, { method: "POST", token: adminToken }),
    ]);
    assert.ok(ok(expiry), `Payment status/expiry request phải trả 2xx: ${summary(expiry)}`);
    assert.ok([cancel, paid].filter(ok).length <= 1, `cancel và mark-paid không được cùng commit: ${summary(cancel)} | ${summary(paid)}`);
    for (const mutation of [cancel, paid]) assert.ok(ok(mutation) || mutation.response.status === 400, `Terminal mutation unexpected: ${summary(mutation)}`);

    const orders = await prisma.$queryRawUnsafe(`SELECT TrangThai AS status,NgayThanhToan AS paidAt FROM DonHang WHERE Id=? LIMIT 1`, orderId);
    const finalStatus = String(orders[0]?.status ?? "");
    assert.ok(["cancelled", "confirmed"].includes(finalStatus), `Unexpected final order status ${finalStatus}`);
    const product = await productState(prisma, context.fixture.productId);
    const variant = await variantState(prisma, context.fixture.variantId);
    if (finalStatus === "cancelled") {
      assert.equal(orders[0]?.paidAt, null);
      assert.equal(number(product.stock), number(context.productSnapshot.stock));
      assert.equal(number(product.reserved), number(context.productSnapshot.reserved));
      assert.equal(number(product.sold), number(context.productSnapshot.sold));
      if (context.fixture.variantId) {
        assert.equal(number(variant.stock), number(context.variantSnapshot.stock));
        assert.equal(number(variant.reserved), number(context.variantSnapshot.reserved));
        assert.equal(number(variant.sold), number(context.variantSnapshot.sold));
      }
    } else {
      assert.ok(orders[0]?.paidAt, "confirmed order phải có NgayThanhToan");
      assert.equal(number(product.stock), number(context.productSnapshot.stock) - 1);
      assert.equal(number(product.reserved), number(context.productSnapshot.reserved));
      assert.equal(number(product.sold), number(context.productSnapshot.sold) + 1);
      if (context.fixture.variantId) {
        assert.equal(number(variant.stock), number(context.variantSnapshot.stock) - 1);
        assert.equal(number(variant.reserved), number(context.variantSnapshot.reserved));
        assert.equal(number(variant.sold), number(context.variantSnapshot.sold) + 1);
      }
    }
    const terminalHistory = await prisma.$queryRawUnsafe(
      `SELECT TrangThai AS status FROM LichSuTrangThaiVanChuyen WHERE DonHangId=? AND TrangThai IN ('cancelled','payment_confirmed')`, orderId,
    );
    assert.equal(terminalHistory.length, 1, `Terminal race phải ghi đúng một terminal history, got ${JSON.stringify(terminalHistory)}`);
  } finally {
    await cleanup(prisma, context); await prisma.$disconnect();
  }
});
