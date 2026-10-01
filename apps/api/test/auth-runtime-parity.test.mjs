import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { PrismaService } from "../dist/database/prisma.service.js";
import { hashVerificationToken } from "../dist/modules/identity/user-auth.service.js";
import { totpAt } from "../dist/modules/identity/two-factor.service.js";
import { hashPassword } from "../dist/modules/identity/password.js";

const base = (process.env.NODE_BASE_URL ?? "http://127.0.0.1:5300").replace(/\/+$/, "");

function number(value) { return Number(value ?? 0); }
function requiredConfirmation() {
  if ((process.env.RUNTIME_AUTH_FIXTURE_CONFIRM ?? "").trim().toUpperCase() !== "YES") {
    throw new Error("Protected auth parity có temporary DB fixtures. Hãy chạy scripts\\node-protected-runtime-parity.bat.");
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
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  return { response, data };
}
function ok(result) { return result.response.status >= 200 && result.response.status < 300; }
function summary(result) {
  let body; try { body = JSON.stringify(result.data); } catch { body = String(result.data ?? ""); }
  return `HTTP ${result.response.status} body=${body}`;
}

async function cleanupCustomer(prisma, context) {
  const userRows = await prisma.$queryRawUnsafe("SELECT Id AS id FROM NguoiDung WHERE Email = ? LIMIT 1", context.email);
  const userId = number(userRows[0]?.id);
  if (userId > 0) {
    await prisma.$executeRawUnsafe("DELETE FROM LoginActivity WHERE UserId = ?", userId);
    await prisma.$executeRawUnsafe("DELETE FROM PasswordResetToken WHERE UserId = ?", userId);
    await prisma.$executeRawUnsafe("DELETE FROM EmailVerificationToken WHERE UserId = ?", userId);
  }
  await prisma.$executeRawUnsafe("DELETE FROM OtpCode WHERE Identifier = ?", context.email);
  await prisma.$executeRawUnsafe("DELETE FROM PendingRegistration WHERE Email = ?", context.email);
  if (userId > 0) await prisma.$executeRawUnsafe("DELETE FROM NguoiDung WHERE Id = ?", userId);
}

async function createRole(prisma, roleCode, roleName, permissions) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO VaiTro (MaVaiTro, TenVaiTro, MoTa, TrangThai, LaMacDinh, NgayTao)
     VALUES (?, ?, 'Temporary protected parity fixture', 1, 0, ?)`, roleCode, roleName, new Date(),
  );
  const rows = await prisma.$queryRawUnsafe("SELECT Id AS id FROM VaiTro WHERE MaVaiTro = ? LIMIT 1", roleCode);
  const roleId = number(rows[0]?.id);
  assert.ok(roleId > 0, `Không tạo được role ${roleCode}`);
  if (permissions.length > 0) {
    const placeholders = permissions.map(() => "?").join(",");
    const permissionRows = await prisma.$queryRawUnsafe(
      `SELECT Id AS id, MaQuyen AS code FROM QuyenHan WHERE MaQuyen IN (${placeholders})`, ...permissions,
    );
    assert.deepEqual(permissionRows.map((row) => String(row.code)).sort(), [...permissions].sort(), `DB thiếu permission cho role ${roleCode}`);
    for (const permission of permissionRows) {
      await prisma.$executeRawUnsafe("INSERT INTO VaiTro_QuyenHan (VaiTroId, QuyenHanId) VALUES (?, ?)", roleId, number(permission.id));
    }
  }
  return roleId;
}

async function createStaff(prisma, roleId, suffix) {
  const email = `phase11-rbac-${suffix}@example.invalid`;
  const password = `Phase11-${randomBytes(8).toString("hex")}!`;
  const passwordHash = await hashPassword(password);
  await prisma.$executeRawUnsafe(
    `INSERT INTO NhanVien
       (Email, MatKhauHash, HoTen, SoDienThoai, AnhDaiDien, VaiTroId,
        NgaySinh, GioiTinh, DiaChi, NgayVaoLam, TrangThai, GhiChu, NgayTao)
     VALUES (?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL, ?, 1, 'Temporary protected parity fixture', ?)`,
    email, passwordHash, `Phase 11 RBAC ${suffix}`, roleId, new Date(), new Date(),
  );
  const rows = await prisma.$queryRawUnsafe("SELECT Id AS id FROM NhanVien WHERE Email = ? LIMIT 1", email);
  const id = number(rows[0]?.id);
  assert.ok(id > 0, "Không tạo được staff RBAC fixture");
  return { id, email, password };
}

async function staffLogin(staff) {
  const result = await call("/api/auth/staff/login", { method: "POST", body: { email: staff.email, password: staff.password } });
  assert.ok(ok(result), `Staff fixture login fail: ${summary(result)}`);
  assert.ok(result.data?.accessToken, "Staff fixture thiếu accessToken");
  return result;
}

async function cleanupStaff(prisma, context) {
  if (context.staffId) {
    await prisma.$executeRawUnsafe("DELETE FROM LichSuDangNhapNV WHERE NhanVienId = ?", context.staffId);
    await prisma.$executeRawUnsafe("DELETE FROM NhanVien WHERE Id = ?", context.staffId);
  }
  if (context.roleId) {
    await prisma.$executeRawUnsafe("DELETE FROM VaiTro_QuyenHan WHERE VaiTroId = ?", context.roleId);
    await prisma.$executeRawUnsafe("DELETE FROM VaiTro WHERE Id = ?", context.roleId);
  }
}

test("Phase 11 Auth runtime: register/verify/OTP/2FA/lockout/reset/change-password", async (t) => {
  requiredConfirmation();
  const prisma = new PrismaService();
  await prisma.$connect();
  const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const context = { email: `phase11-auth-${suffix}@example.invalid` };
  const initialPassword = `Init-${randomBytes(8).toString("hex")}!`;
  const resetPassword = `Reset-${randomBytes(8).toString("hex")}!`;
  const changedPassword = `Changed-${randomBytes(8).toString("hex")}!`;
  const phone = `09${String(Date.now()).slice(-8)}`;

  try {
    const health = await call("/health");
    assert.ok(ok(health), `Node health fail: ${summary(health)}`);
    assert.equal(health.data?.database?.expectedTables, 52);
    assert.equal(health.data?.database?.actualTables, 52);
    if (/^(1|true|yes)$/i.test(process.env.AUTH_REQUIRE_RECAPTCHA ?? "false")) {
      throw new Error("Auth runtime fixture cần AUTH_REQUIRE_RECAPTCHA=false trên local cutover để không dùng CAPTCHA giả.");
    }

    let accessToken = "";
    await t.test("register chỉ tạo PendingRegistration, verify mới tạo NguoiDung", async () => {
      let otpCode = "";
      if (/^(1|true|yes)$/i.test(process.env.AUTH_REQUIRE_OTP_FOR_REGISTER ?? "false")) {
        const otpRequest = await call("/api/Auth/otp/request", {
          method: "POST", body: { identifier: context.email, channel: "email", purpose: "register" },
        });
        assert.ok(ok(otpRequest), `Register OTP request fail: ${summary(otpRequest)}`);
        const otpRows = await prisma.$queryRawUnsafe(
          `SELECT Code AS code FROM OtpCode WHERE Identifier=? AND Purpose='register' ORDER BY CreatedAt DESC LIMIT 1`, context.email,
        );
        otpCode = String(otpRows[0]?.code ?? "");
        assert.ok(otpCode, "Không đọc được register OTP fixture");
      }

      const register = await call("/api/Auth/register", {
        method: "POST",
        body: { name: "Phase 11 Auth Fixture", email: context.email, phone, password: initialPassword, ...(otpCode ? { otpCode } : {}) },
      });
      assert.equal(register.response.status, 202, `Register phải HTTP 202: ${summary(register)}`);
      assert.equal(register.data?.requiresEmailVerification, true);
      const pending = await prisma.$queryRawUnsafe("SELECT Id AS id, TokenHash AS tokenHash FROM PendingRegistration WHERE Email = ? LIMIT 1", context.email);
      assert.equal(pending.length, 1, "Register không tạo đúng một PendingRegistration");
      const beforeVerify = await prisma.$queryRawUnsafe("SELECT Id FROM NguoiDung WHERE Email = ?", context.email);
      assert.equal(beforeVerify.length, 0, "Register đã tạo NguoiDung trước verify");

      const rawToken = randomBytes(32).toString("hex");
      await prisma.$executeRawUnsafe("UPDATE PendingRegistration SET TokenHash = ? WHERE Email = ?", hashVerificationToken(rawToken), context.email);
      const verify = await call(`/api/Auth/verify-email?token=${encodeURIComponent(rawToken)}`);
      assert.ok(ok(verify), `Verify pending registration fail: ${summary(verify)}`);
      const users = await prisma.$queryRawUnsafe(
        `SELECT Id AS id, EmailDaXacThuc AS verified, NhaCungCap AS provider FROM NguoiDung WHERE Email = ? LIMIT 1`, context.email,
      );
      assert.equal(users.length, 1, "Verify không tạo NguoiDung");
      assert.equal(number(users[0].verified), 1, "Verify không set EmailDaXacThuc=1");
      assert.equal(String(users[0].provider ?? ""), "local");
      const pendingAfter = await prisma.$queryRawUnsafe("SELECT Id FROM PendingRegistration WHERE Email = ?", context.email);
      assert.equal(pendingAfter.length, 0, "Verify không xóa PendingRegistration");
    });

    await t.test("login user vừa verify hoạt động", async () => {
      const login = await call("/api/Auth/login", { method: "POST", body: { identifier: context.email, password: initialPassword } });
      assert.ok(ok(login), `Login sau verify fail: ${summary(login)}`);
      assert.equal(login.data?.twoFactorRequired, false);
      assert.ok(login.data?.accessToken);
      accessToken = String(login.data.accessToken);
    });

    await t.test("OTP request -> DB code -> verify một lần", async () => {
      const request = await call("/api/Auth/otp/request", {
        method: "POST", body: { identifier: context.email, channel: "email", purpose: "phase11_runtime" },
      });
      assert.ok(ok(request), `OTP request fail: ${summary(request)}`);
      const rows = await prisma.$queryRawUnsafe(
        `SELECT Id AS id, Code AS code FROM OtpCode WHERE Identifier = ? AND Purpose = 'phase11_runtime' ORDER BY CreatedAt DESC LIMIT 1`, context.email,
      );
      assert.ok(rows[0]?.code, "OTP request không ghi code vào DB");
      const verify = await call("/api/Auth/otp/verify", {
        method: "POST", body: { identifier: context.email, purpose: "phase11_runtime", code: String(rows[0].code) },
      });
      assert.ok(ok(verify), `OTP verify fail: ${summary(verify)}`);
      const replay = await call("/api/Auth/otp/verify", {
        method: "POST", body: { identifier: context.email, purpose: "phase11_runtime", code: String(rows[0].code) },
      });
      assert.equal(replay.response.status, 400, "OTP đã verify không được replay");
    });

    await t.test("TOTP 2FA setup/enable/login-2fa/disable chạy end-to-end", async () => {
      const setup = await call("/api/Auth/2fa/setup", { method: "POST", token: accessToken });
      assert.ok(ok(setup), `2FA setup fail: ${summary(setup)}`);
      const secret = String(setup.data?.secret ?? "");
      assert.ok(secret, "2FA setup thiếu secret");
      const enable = await call("/api/Auth/2fa/enable", { method: "POST", token: accessToken, body: { code: totpAt(secret, Date.now()) } });
      assert.ok(ok(enable), `2FA enable fail: ${summary(enable)}`);
      const normalLogin = await call("/api/Auth/login", { method: "POST", body: { identifier: context.email, password: initialPassword } });
      assert.ok(ok(normalLogin), `Login 2FA preflight fail: ${summary(normalLogin)}`);
      assert.equal(normalLogin.data?.twoFactorRequired, true);
      assert.equal(String(normalLogin.data?.accessToken ?? ""), "");
      const login2fa = await call("/api/Auth/login-2fa", {
        method: "POST", body: { identifier: context.email, password: initialPassword, code: totpAt(secret, Date.now()) },
      });
      assert.ok(ok(login2fa), `login-2fa fail: ${summary(login2fa)}`);
      assert.ok(login2fa.data?.accessToken, "login-2fa thiếu accessToken");
      accessToken = String(login2fa.data.accessToken);
      const disable = await call("/api/Auth/2fa/disable", { method: "POST", token: accessToken, body: { code: totpAt(secret, Date.now()) } });
      assert.ok(ok(disable), `2FA disable fail: ${summary(disable)}`);
      const rows = await prisma.$queryRawUnsafe("SELECT TwoFactorEnabled AS enabled, TwoFactorSecret AS secret FROM NguoiDung WHERE Email = ? LIMIT 1", context.email);
      assert.equal(number(rows[0]?.enabled), 0);
      assert.equal(rows[0]?.secret, null);
    });

    await t.test("lockout chặn mật khẩu đúng sau chuỗi đăng nhập sai", async () => {
      let locked = false;
      for (let attempt = 1; attempt <= 20; attempt += 1) {
        const wrong = await call("/api/Auth/login", { method: "POST", body: { identifier: context.email, password: `wrong-${attempt}` } });
        assert.equal(wrong.response.status, 401, `Wrong-password attempt ${attempt} phải 401`);
        const rows = await prisma.$queryRawUnsafe("SELECT BiKhoaDenLuc AS lockedUntil FROM NguoiDung WHERE Email = ? LIMIT 1", context.email);
        if (rows[0]?.lockedUntil) { locked = true; break; }
      }
      assert.equal(locked, true, "Không kích hoạt được auth lockout trong tối đa 20 lần");
      const correctWhileLocked = await call("/api/Auth/login", { method: "POST", body: { identifier: context.email, password: initialPassword } });
      assert.equal(correctWhileLocked.response.status, 401, "Tài khoản locked vẫn login bằng mật khẩu đúng");
    });

    await t.test("forgot/reset password consume token và clear lockout", async () => {
      const forgot = await call("/api/Auth/forgot-password", { method: "POST", body: { email: context.email } });
      assert.ok(ok(forgot), `forgot-password fail: ${summary(forgot)}`);
      const tokens = await prisma.$queryRawUnsafe(
        `SELECT Id AS id, Token AS token FROM PasswordResetToken WHERE Email = ? ORDER BY CreatedAt DESC LIMIT 1`, context.email,
      );
      assert.ok(tokens[0]?.token, "forgot-password không tạo PasswordResetToken");
      const reset = await call("/api/Auth/reset-password", { method: "POST", body: { token: String(tokens[0].token), newPassword: resetPassword } });
      assert.ok(ok(reset), `reset-password fail: ${summary(reset)}`);
      const resetRows = await prisma.$queryRawUnsafe("SELECT UsedAt AS usedAt FROM PasswordResetToken WHERE Id = ? LIMIT 1", number(tokens[0].id));
      assert.ok(resetRows[0]?.usedAt, "Reset token chưa được consume");
      const userRows = await prisma.$queryRawUnsafe("SELECT BiKhoaDenLuc AS lockedUntil, SoLanDangNhapSai AS failed FROM NguoiDung WHERE Email = ? LIMIT 1", context.email);
      assert.equal(userRows[0]?.lockedUntil, null, "reset-password không clear lockout");
      assert.equal(number(userRows[0]?.failed), 0, "reset-password không reset failed attempts");
      const login = await call("/api/Auth/login", { method: "POST", body: { identifier: context.email, password: resetPassword } });
      assert.ok(ok(login), `Login sau reset fail: ${summary(login)}`);
      accessToken = String(login.data?.accessToken ?? "");
      assert.ok(accessToken);
    });

    await t.test("change-password revoke refresh cũ và mật khẩu mới login được", async () => {
      const before = await call("/api/Auth/login", { method: "POST", body: { identifier: context.email, password: resetPassword } });
      assert.ok(ok(before), `Login trước change-password fail: ${summary(before)}`);
      const oldRefresh = String(before.data?.refreshToken ?? "");
      accessToken = String(before.data?.accessToken ?? "");
      assert.ok(oldRefresh && accessToken);
      const change = await call("/api/Auth/change-password", {
        method: "POST", token: accessToken, body: { currentPassword: resetPassword, newPassword: changedPassword },
      });
      assert.ok(ok(change), `change-password fail: ${summary(change)}`);
      const replayRefresh = await call("/api/Auth/refresh", { method: "POST", body: { refreshToken: oldRefresh } });
      assert.equal(replayRefresh.response.status, 401, "Refresh trước change-password chưa bị revoke");
      const oldLogin = await call("/api/Auth/login", { method: "POST", body: { identifier: context.email, password: resetPassword } });
      assert.equal(oldLogin.response.status, 401, "Mật khẩu cũ vẫn login sau change-password");
      const newLogin = await call("/api/Auth/login", { method: "POST", body: { identifier: context.email, password: changedPassword } });
      assert.ok(ok(newLogin), `Mật khẩu mới login fail: ${summary(newLogin)}`);
    });
  } finally {
    await cleanupCustomer(prisma, context);
    await prisma.$disconnect();
  }
});

test("Phase 11 staff granular RBAC: permission deny/allow đi qua JWT thật", async () => {
  requiredConfirmation();
  const prisma = new PrismaService();
  await prisma.$connect();
  const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const context = { roleId: 0, staffId: 0 };
  try {
    context.roleId = await createRole(prisma, `p11r-${suffix}`, "Phase 11 Runtime RBAC", ["inventory.view"]);
    const staff = await createStaff(prisma, context.roleId, suffix);
    context.staffId = staff.id;
    const viewLogin = await staffLogin(staff);
    const viewToken = String(viewLogin.data.accessToken);
    assert.deepEqual(viewLogin.data?.user?.permissions, ["inventory.view"]);
    const allowedRead = await call("/api/admin/inventory", { token: viewToken });
    assert.ok(ok(allowedRead), `inventory.view phải allow: ${summary(allowedRead)}`);
    const deniedWrite = await call("/api/admin/inventory/adjust", {
      method: "POST", token: viewToken, body: { SanPhamId: 2147483647, SoLuong: 1, LoaiThayDoi: "import" },
    });
    assert.equal(deniedWrite.response.status, 403, "Thiếu inventory.manage phải bị 403");
    const permissionRows = await prisma.$queryRawUnsafe("SELECT Id AS id FROM QuyenHan WHERE MaQuyen = 'inventory.manage' LIMIT 1");
    assert.ok(permissionRows[0], "DB thiếu inventory.manage");
    await prisma.$executeRawUnsafe("INSERT INTO VaiTro_QuyenHan (VaiTroId, QuyenHanId) VALUES (?, ?)", context.roleId, number(permissionRows[0].id));
    const manageLogin = await staffLogin(staff);
    const managePermissions = Array.isArray(manageLogin.data?.user?.permissions) ? manageLogin.data.user.permissions : [];
    assert.ok(managePermissions.includes("inventory.view"));
    assert.ok(managePermissions.includes("inventory.manage"));
    const passedPermission = await call("/api/admin/inventory/adjust", {
      method: "POST", token: String(manageLogin.data.accessToken), body: { SanPhamId: 2147483647, SoLuong: 1, LoaiThayDoi: "import" },
    });
    assert.equal(passedPermission.response.status, 404, `Có inventory.manage phải qua permission guard và dừng ở product-not-found: ${summary(passedPermission)}`);
  } finally {
    await cleanupStaff(prisma, context);
    await prisma.$disconnect();
  }
});
