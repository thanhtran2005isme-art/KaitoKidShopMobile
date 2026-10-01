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
    throw new Error("Admin race gate có mutation. Hãy chạy scripts\\node-concurrency-race-gate.bat để backup DB trước.");
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
function assertExactlyOneSuccess(results, label) {
  assert.equal(results.filter(ok).length, 1, `${label}: expected exactly one success; ${results.map(summary).join(" | ")}`);
}
async function productState(prisma, productId) {
  const rows = await prisma.$queryRawUnsafe(`SELECT Id AS id,TonKho AS stock,TrangThai AS status,NgayCapNhat AS updatedAt FROM SanPham WHERE Id=? LIMIT 1`, productId);
  return rows[0] ?? null;
}
async function variantRows(prisma, productId) {
  return prisma.$queryRawUnsafe(
    `SELECT Id AS id,SanPhamId AS productId,KichCo AS size,MauSac AS color,SoLuong AS stock,
            COALESCE(SoLuongDaGiu,0) AS reserved,GiaVonTrungBinh AS averageCost,NgayCapNhat AS updatedAt
     FROM TonKhoBienThe WHERE SanPhamId=? ORDER BY Id`, productId,
  );
}
async function chooseFixture(prisma) {
  const products = await prisma.$queryRawUnsafe(
    `SELECT p.Id AS productId FROM SanPham p
     WHERE COALESCE(p.SoLuongDaGiu,0)=0
       AND NOT EXISTS (SELECT 1 FROM GioHang g WHERE g.SanPhamId=p.Id)
       AND NOT EXISTS (SELECT 1 FROM TonKhoBienThe v WHERE v.SanPhamId=p.Id AND COALESCE(v.SoLuongDaGiu,0)<>0)
       AND (SELECT COUNT(*) FROM TonKhoBienThe v WHERE v.SanPhamId=p.Id AND COALESCE(v.KichCo,'')<>'' AND COALESCE(v.MauSac,'')<>'')>=2
     ORDER BY p.Id LIMIT 100`,
  );
  for (const row of products) {
    const productId = number(row.productId);
    const variants = await variantRows(prisma, productId);
    const usable = variants.filter((variant) => String(variant.size ?? "").trim() && String(variant.color ?? "").trim() && number(variant.reserved) === 0 && number(variant.stock) >= 2);
    if (usable.length >= 2) return { productId, first: usable[0], second: usable[1] };
  }
  throw new Error("Không tìm thấy admin race fixture: cần product không có cart/reservation và ít nhất 2 variant có size/màu, stock>=2.");
}
async function createStaffFixture(prisma, context) {
  const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const roleCode = `p11a-${suffix}`;
  const email = `phase11-admin-race-${suffix}@example.invalid`;
  const password = `Phase11-${randomBytes(8).toString("hex")}!`;
  const name = `Phase 11 Admin Race ${suffix}`;
  const permissions = await prisma.$queryRawUnsafe(
    `SELECT Id AS id,MaQuyen AS code FROM QuyenHan WHERE MaQuyen IN ('inventory.view','inventory.manage') ORDER BY MaQuyen`,
  );
  assert.deepEqual(permissions.map((row) => String(row.code)).sort(), ["inventory.manage", "inventory.view"], "DB thiếu inventory.view/inventory.manage cho admin race gate");
  await prisma.$executeRawUnsafe(
    `INSERT INTO VaiTro (MaVaiTro,TenVaiTro,MoTa,TrangThai,LaMacDinh,NgayTao)
     VALUES (?,'Phase 11 Admin Race','Temporary admin race fixture',1,0,?)`, roleCode, new Date(),
  );
  const roles = await prisma.$queryRawUnsafe("SELECT Id AS id FROM VaiTro WHERE MaVaiTro=? LIMIT 1", roleCode);
  context.roleId = number(roles[0]?.id); assert.ok(context.roleId > 0, "Không tạo được role fixture admin race");
  for (const permission of permissions) {
    await prisma.$executeRawUnsafe("INSERT INTO VaiTro_QuyenHan (VaiTroId,QuyenHanId) VALUES (?,?)", context.roleId, number(permission.id));
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO NhanVien
       (Email,MatKhauHash,HoTen,SoDienThoai,AnhDaiDien,VaiTroId,NgaySinh,GioiTinh,DiaChi,NgayVaoLam,TrangThai,GhiChu,NgayTao)
     VALUES (?,?,?,NULL,NULL,?,NULL,NULL,NULL,?,1,'Temporary admin race fixture',?)`,
    email, await hashPassword(password), name, context.roleId, new Date(), new Date(),
  );
  const staffRows = await prisma.$queryRawUnsafe("SELECT Id AS id FROM NhanVien WHERE Email=? LIMIT 1", email);
  context.staffId = number(staffRows[0]?.id); context.staffEmail = email; context.staffPassword = password; context.staffName = name;
  assert.ok(context.staffId > 0, "Không tạo được staff fixture admin race");
}
async function loginStaff(context) {
  const result = await call("/api/auth/staff/login", { method: "POST", body: { email: context.staffEmail, password: context.staffPassword } });
  assert.ok(ok(result), `Admin race staff login fail: ${summary(result)}`);
  const permissions = Array.isArray(result.data?.user?.permissions) ? result.data.user.permissions : [];
  assert.ok(permissions.includes("inventory.view")); assert.ok(permissions.includes("inventory.manage"));
  assert.ok(result.data?.accessToken, "Admin race staff login thiếu accessToken");
  return String(result.data.accessToken);
}
async function installInventoryBaseline(prisma, context) {
  const variants = await variantRows(prisma, context.fixture.productId);
  const aggregate = variants.reduce((sum, row) => sum + number(row.stock), 0);
  assert.ok(aggregate >= 4, "Variant aggregate quá thấp cho admin race gate");
  await prisma.$executeRawUnsafe(`UPDATE SanPham SET TonKho=?,TrangThai=?,NgayCapNhat=? WHERE Id=?`, aggregate, aggregate === 0 ? "out-of-stock" : "active", new Date(), context.fixture.productId);
  return aggregate;
}
async function restoreFixture(prisma, context) {
  if (!context.fixture || !context.productSnapshot) return;
  for (const variant of context.variantSnapshots) {
    await prisma.$executeRawUnsafe(`UPDATE TonKhoBienThe SET SoLuong=?,GiaVonTrungBinh=?,NgayCapNhat=? WHERE Id=?`, number(variant.stock), variant.averageCost, variant.updatedAt, number(variant.id));
  }
  await prisma.$executeRawUnsafe(`UPDATE SanPham SET TonKho=?,TrangThai=?,NgayCapNhat=? WHERE Id=?`, number(context.productSnapshot.stock), context.productSnapshot.status, context.productSnapshot.updatedAt, context.fixture.productId);
}
async function resetToAggregateBaseline(prisma, context) {
  for (const variant of context.variantSnapshots) {
    await prisma.$executeRawUnsafe(`UPDATE TonKhoBienThe SET SoLuong=?,GiaVonTrungBinh=?,NgayCapNhat=? WHERE Id=?`, number(variant.stock), variant.averageCost, variant.updatedAt, number(variant.id));
  }
  context.aggregateBaseline = await installInventoryBaseline(prisma, context);
  await prisma.$executeRawUnsafe("DELETE FROM TonKho_LichSu WHERE NguoiThucHien=?", context.staffName);
}
async function assertAggregate(prisma, context, expectedProductStock) {
  const product = await productState(prisma, context.fixture.productId);
  const variants = await variantRows(prisma, context.fixture.productId);
  const aggregate = variants.reduce((sum, row) => sum + number(row.stock), 0);
  assert.equal(number(product.stock), expectedProductStock, "Product stock lệch expected");
  assert.equal(aggregate, expectedProductStock, "Product stock lệch aggregate variant");
  assert.ok(number(product.stock) >= 0, "Product stock bị âm");
  assert.ok(variants.every((row) => number(row.stock) >= 0), "Variant stock bị âm");
}
async function cleanup(prisma, context) {
  try {
    if (context.receiptIds.length > 0) {
      const placeholders = context.receiptIds.map(() => "?").join(",");
      await prisma.$executeRawUnsafe(`DELETE FROM ChiTietPhieuNhap WHERE PhieuNhapId IN (${placeholders})`, ...context.receiptIds);
      await prisma.$executeRawUnsafe(`DELETE FROM PhieuNhap WHERE Id IN (${placeholders})`, ...context.receiptIds);
    }
    if (context.staffName) await prisma.$executeRawUnsafe("DELETE FROM TonKho_LichSu WHERE NguoiThucHien=?", context.staffName);
  } finally {
    await restoreFixture(prisma, context);
    if (context.staffId) {
      await prisma.$executeRawUnsafe("DELETE FROM LichSuDangNhapNV WHERE NhanVienId=?", context.staffId);
      await prisma.$executeRawUnsafe("DELETE FROM NhanVien WHERE Id=?", context.staffId);
    }
    if (context.roleId) {
      await prisma.$executeRawUnsafe("DELETE FROM VaiTro_QuyenHan WHERE VaiTroId=?", context.roleId);
      await prisma.$executeRawUnsafe("DELETE FROM VaiTro WHERE Id=?", context.roleId);
    }
  }
}
function receiptBody(context, suffix, quantity = 2) {
  const variant = context.fixture.first;
  const incomingCost = Math.max(1000, number(variant.averageCost) + 1234);
  return {
    NhaCungCapId: null, TenNhaCungCap: "Phase 11 Race Supplier", NguoiNhap: context.staffName,
    GhiChu: `phase11-admin-race-${suffix}`,
    Items: [{ SanPhamId: context.fixture.productId, KichCo: String(variant.size), MauSac: String(variant.color), SoLuong: quantity, DonGiaNhap: incomingCost, GhiChu: `phase11-admin-race-${suffix}` }],
  };
}

test("Phase 11 Admin inventory/variant/stock-receipt race trên MariaDB thật", async (t) => {
  requiredConfirmation();
  const prisma = new PrismaService(); await prisma.$connect();
  const context = { roleId: 0, staffId: 0, staffEmail: "", staffPassword: "", staffName: "", receiptIds: [], fixture: null, productSnapshot: null, variantSnapshots: [], aggregateBaseline: 0 };
  try {
    const health = await call("/health");
    assert.ok(ok(health), `Node health fail: ${summary(health)}`);
    assert.equal(health.data?.database?.expectedTables, 52); assert.equal(health.data?.database?.actualTables, 52);
    await createStaffFixture(prisma, context); const token = await loginStaff(context);
    context.fixture = await chooseFixture(prisma);
    context.productSnapshot = await productState(prisma, context.fixture.productId);
    context.variantSnapshots = await variantRows(prisma, context.fixture.productId);
    assert.ok(context.productSnapshot); assert.ok(context.variantSnapshots.length >= 2);
    await resetToAggregateBaseline(prisma, context);

    await t.test("hai inventory export đồng thời không oversell hoặc tạo tồn âm", async () => {
      const exportQuantity = context.aggregateBaseline - 1;
      assert.ok(exportQuantity > 0, "Inventory race cần baseline > 1");
      const body = { SanPhamId: context.fixture.productId, SoLuong: exportQuantity, LoaiThayDoi: "export", GhiChu: "phase11 concurrent inventory export" };
      const results = await Promise.all([
        call("/api/admin/inventory/adjust", { method: "POST", token, body }),
        call("/api/admin/inventory/adjust", { method: "POST", token, body }),
      ]);
      assertExactlyOneSuccess(results, "concurrent inventory export");
      const rejected = results.find((result) => !ok(result));
      assert.equal(rejected?.response.status, 400, `Oversell inventory phải reject HTTP 400: ${summary(rejected)}`);
      const product = await productState(prisma, context.fixture.productId);
      assert.equal(number(product.stock), 1, "Concurrent export phải để lại đúng 1 đơn vị");
      assert.ok(number(product.stock) >= 0, "Product stock bị âm sau concurrent export");
    });

    await resetToAggregateBaseline(prisma, context);
    await t.test("hai variant cùng product cập nhật đồng thời vẫn giữ aggregate stock", async () => {
      const first = context.fixture.first; const second = context.fixture.second;
      const firstTarget = number(first.stock) + 2; const secondTarget = number(second.stock) + 3;
      const results = await Promise.all([
        call(`/api/admin/variant-stock/${number(first.id)}`, { method: "PUT", token, body: { SoLuong: firstTarget, LyDo: "phase11 two-variant race A" } }),
        call(`/api/admin/variant-stock/${number(second.id)}`, { method: "PUT", token, body: { SoLuong: secondTarget, LyDo: "phase11 two-variant race B" } }),
      ]);
      assert.equal(results.filter(ok).length, 2, `two-variant race phải thành công cả 2 request; ${results.map(summary).join(" | ")}`);
      await assertAggregate(prisma, context, context.aggregateBaseline + 5);
    });

    await resetToAggregateBaseline(prisma, context);
    await t.test("double cancel cùng phiếu nhập chỉ rollback stock đúng một lần", async () => {
      const create = await call("/api/admin/stock-receipts", { method: "POST", token, body: receiptBody(context, "double-cancel", 2) });
      assert.ok(ok(create), `Tạo phiếu nhập fixture fail: ${summary(create)}`);
      const receiptId = number(create.data?.id); assert.ok(receiptId > 0); context.receiptIds.push(receiptId);
      await assertAggregate(prisma, context, context.aggregateBaseline + 2);
      const results = await Promise.all([
        call(`/api/admin/stock-receipts/${receiptId}/cancel`, { method: "POST", token, body: { LyDo: "phase11 double cancel A" } }),
        call(`/api/admin/stock-receipts/${receiptId}/cancel`, { method: "POST", token, body: { LyDo: "phase11 double cancel B" } }),
      ]);
      assertExactlyOneSuccess(results, "stock receipt double cancel");
      const rejected = results.find((result) => !ok(result));
      assert.equal(rejected?.response.status, 400, `Double cancel phải reject HTTP 400: ${summary(rejected)}`);
      await assertAggregate(prisma, context, context.aggregateBaseline);
    });

    await resetToAggregateBaseline(prisma, context);
    await t.test("hai phiếu nhập cùng product/variant tạo rồi hủy đồng thời không lệch aggregate", async () => {
      const creates = await Promise.all([
        call("/api/admin/stock-receipts", { method: "POST", token, body: receiptBody(context, "parallel-create-a", 1) }),
        call("/api/admin/stock-receipts", { method: "POST", token, body: receiptBody(context, "parallel-create-b", 1) }),
      ]);
      assert.equal(creates.filter(ok).length, 2, `Concurrent stock receipt create phải thành công cả 2; ${creates.map(summary).join(" | ")}`);
      const ids = creates.map((result) => number(result.data?.id));
      const codes = creates.map((result) => String(result.data?.maPhieu ?? ""));
      assert.ok(ids.every((id) => id > 0), "Concurrent create thiếu receipt id");
      assert.ok(codes.every(Boolean), "Concurrent create thiếu mã phiếu nhập");
      assert.notEqual(ids[0], ids[1], "Concurrent create trùng receipt id");
      assert.notEqual(codes[0], codes[1], "Concurrent create trùng MaPhieu");
      context.receiptIds.push(...ids);
      await assertAggregate(prisma, context, context.aggregateBaseline + 2);
      const cancels = await Promise.all(ids.map((id, index) => call(`/api/admin/stock-receipts/${id}/cancel`, { method: "POST", token, body: { LyDo: `phase11 parallel cancel ${index + 1}` } })));
      assert.equal(cancels.filter(ok).length, 2, `Concurrent cancel 2 phiếu độc lập phải thành công; ${cancels.map(summary).join(" | ")}`);
      await assertAggregate(prisma, context, context.aggregateBaseline);
    });
  } finally {
    await cleanup(prisma, context); await prisma.$disconnect();
  }
});
