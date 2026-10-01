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
  if ((process.env.RUNTIME_AUTH_FIXTURE_CONFIRM ?? "").trim().toUpperCase() !== "YES") {
    throw new Error(
      "Protected runtime parity có temporary DB fixtures. Hãy chạy scripts\\node-protected-runtime-parity.bat.",
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

async function createCustomerFixture(prisma, context) {
  const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  context.customerEmail = `phase11-protected-${suffix}@example.invalid`;
  context.customerPassword = `Phase11-${randomBytes(8).toString("hex")}!`;
  const passwordHash = await hashPassword(context.customerPassword);

  await prisma.$executeRawUnsafe(
    `INSERT INTO NguoiDung
       (HoTen, Email, MatKhauHash, SoDienThoai, VaiTro, TrangThai,
        NgayTao, EmailDaXacThuc, NhaCungCap, TwoFactorEnabled,
        SoLanDangNhapSai, BiKhoaDenLuc)
     VALUES (?, ?, ?, NULL, 'user', 1, ?, 1, 'local', 0, 0, NULL)`,
    "Phase 11 Protected Customer",
    context.customerEmail,
    passwordHash,
    new Date(),
  );

  const rows = await prisma.$queryRawUnsafe(
    "SELECT Id AS id FROM NguoiDung WHERE Email = ? LIMIT 1",
    context.customerEmail,
  );
  context.customerId = number(rows[0]?.id);
  assert.ok(context.customerId > 0, "Không tạo được customer fixture protected runtime");
}

async function createStaffFixture(prisma, context) {
  const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const roleCode = `p11p-${suffix}`;
  context.staffEmail = `phase11-protected-staff-${suffix}@example.invalid`;
  context.staffPassword = `Phase11-${randomBytes(8).toString("hex")}!`;
  const passwordHash = await hashPassword(context.staffPassword);

  const productPermission = await prisma.$queryRawUnsafe(
    "SELECT Id AS id FROM QuyenHan WHERE MaQuyen = 'products.view' LIMIT 1",
  );
  assert.ok(number(productPermission[0]?.id) > 0, "DB thiếu products.view cho protected runtime fixture");

  await prisma.$executeRawUnsafe(
    `INSERT INTO VaiTro (MaVaiTro, TenVaiTro, MoTa, TrangThai, LaMacDinh, NgayTao)
     VALUES (?, 'Phase 11 Protected', 'Temporary protected runtime fixture', 1, 0, ?)`,
    roleCode,
    new Date(),
  );
  const roles = await prisma.$queryRawUnsafe(
    "SELECT Id AS id FROM VaiTro WHERE MaVaiTro = ? LIMIT 1",
    roleCode,
  );
  context.roleId = number(roles[0]?.id);
  assert.ok(context.roleId > 0, "Không tạo được role fixture protected runtime");

  await prisma.$executeRawUnsafe(
    `INSERT INTO VaiTro_QuyenHan (VaiTroId, QuyenHanId)
     SELECT ?, Id FROM QuyenHan`,
    context.roleId,
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO NhanVien
       (Email, MatKhauHash, HoTen, SoDienThoai, AnhDaiDien, VaiTroId,
        LaSuperAdmin, NgaySinh, GioiTinh, DiaChi, NgayVaoLam, TrangThai,
        SoLanDangNhapSai, BiKhoa, GhiChu, NgayTao)
     VALUES (?, ?, 'Phase 11 Protected Staff', NULL, NULL, ?, 0,
             NULL, NULL, NULL, ?, 1, 0, 0,
             'Temporary protected runtime fixture', ?)`,
    context.staffEmail,
    passwordHash,
    context.roleId,
    new Date(),
    new Date(),
  );

  const staffRows = await prisma.$queryRawUnsafe(
    "SELECT Id AS id FROM NhanVien WHERE Email = ? LIMIT 1",
    context.staffEmail,
  );
  context.staffId = number(staffRows[0]?.id);
  assert.ok(context.staffId > 0, "Không tạo được staff fixture protected runtime");
}

async function cleanup(prisma, context) {
  if (context.staffId) {
    await prisma.$executeRawUnsafe(
      "DELETE FROM LichSuDangNhapNV WHERE NhanVienId = ?",
      context.staffId,
    );
    await prisma.$executeRawUnsafe("DELETE FROM NhanVien WHERE Id = ?", context.staffId);
  }
  if (context.roleId) {
    await prisma.$executeRawUnsafe(
      "DELETE FROM VaiTro_QuyenHan WHERE VaiTroId = ?",
      context.roleId,
    );
    await prisma.$executeRawUnsafe("DELETE FROM VaiTro WHERE Id = ?", context.roleId);
  }

  if (context.customerId) {
    await prisma.$executeRawUnsafe(
      "DELETE FROM LoginActivity WHERE UserId = ?",
      context.customerId,
    );
    await prisma.$executeRawUnsafe(
      "DELETE FROM PasswordResetToken WHERE UserId = ?",
      context.customerId,
    );
    await prisma.$executeRawUnsafe(
      "DELETE FROM EmailVerificationToken WHERE UserId = ?",
      context.customerId,
    );
  }
  if (context.customerEmail) {
    await prisma.$executeRawUnsafe(
      "DELETE FROM OtpCode WHERE Identifier = ?",
      context.customerEmail,
    );
    await prisma.$executeRawUnsafe(
      "DELETE FROM PendingRegistration WHERE Email = ?",
      context.customerEmail,
    );
  }
  if (context.customerId) {
    await prisma.$executeRawUnsafe("DELETE FROM NguoiDung WHERE Id = ?", context.customerId);
  }
}

test("protected runtime parity customer + staff trên Node với fixture tự chủ", async (t) => {
  requiredConfirmation();
  const prisma = new PrismaService();
  await prisma.$connect();

  const context = {
    customerId: 0,
    customerEmail: "",
    customerPassword: "",
    roleId: 0,
    staffId: 0,
    staffEmail: "",
    staffPassword: "",
  };

  let customerAccessToken = "";
  let customerRefreshToken = "";
  let staffAccessToken = "";

  try {
    await createCustomerFixture(prisma, context);
    await createStaffFixture(prisma, context);

    await t.test("protected endpoint reject anonymous", async () => {
      const result = await call("/api/Auth/me");
      expectStatus(result, 401, "anonymous /api/Auth/me");
    });

    await t.test("customer fixture login thật qua Node", async () => {
      const result = await call("/api/Auth/login", {
        method: "POST",
        body: {
          identifier: context.customerEmail,
          password: context.customerPassword,
        },
      });
      expectOk(result, "customer login");
      assert.equal(result.data?.twoFactorRequired, false);
      assert.ok(result.data?.accessToken, "customer login thiếu accessToken");
      assert.ok(result.data?.refreshToken, "customer login thiếu refreshToken");
      customerAccessToken = result.data.accessToken;
      customerRefreshToken = result.data.refreshToken;
    });

    await t.test("customer /me trả đúng session", async () => {
      const result = await call("/api/Auth/me", { token: customerAccessToken });
      expectOk(result, "customer /me");
      assert.equal(number(result.data?.id), context.customerId);
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

    await t.test("staff fixture login + /me thật qua Node", async () => {
      const login = await call("/api/auth/staff/login", {
        method: "POST",
        body: {
          email: context.staffEmail,
          password: context.staffPassword,
        },
      });
      expectOk(login, "staff login");
      assert.ok(login.data?.accessToken, "staff login thiếu accessToken");
      const permissions = Array.isArray(login.data?.user?.permissions)
        ? login.data.user.permissions
        : [];
      assert.ok(permissions.includes("products.view"), "staff fixture thiếu products.view");
      staffAccessToken = login.data.accessToken;

      const me = await call("/api/auth/staff/me", { token: staffAccessToken });
      expectOk(me, "staff /me");
      assert.equal(number(me.data?.id), context.staffId);
    });

    await t.test("staff JWT vào được Admin read surface", async () => {
      const result = await call("/api/admin/products?page=1&pageSize=1", {
        token: staffAccessToken,
      });
      expectOk(result, "staff -> admin products");
      assert.ok(Array.isArray(result.data?.items), "admin products thiếu items[]");
    });
  } finally {
    await cleanup(prisma, context);
    await prisma.$disconnect();
  }
});
