import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const wallet = source("../src/modules/wallet/wallet.service.ts");
const walletController = source("../src/modules/wallet/wallet.controller.ts");
const adminWalletController = source("../src/modules/wallet/admin-wallet.controller.ts");
const orders = source("../src/modules/orders/orders.service.ts");
const payment = source("../src/modules/payment/payment.service.ts");
const afterSales = source("../src/modules/orders/order-after-sales.service.ts");
const adminAfterSales = source("../src/modules/admin/admin-order-after-sales.service.ts");
const account = source("../src/modules/account/account.service.ts");
const permissions = source("../src/migration/rbac-permission-manifest.ts");
const tables = source("../src/migration/legacy-table-manifest.ts");
const migration = source("../../../database/migrations/20261006_wallet_refund_withdrawal.sql");
const webCheckout = source("../../web/src/pages/Checkout.tsx");
const mobileCheckout = source("../../mobile/src/app/checkout/index.tsx");

test("wallet schema có balance, immutable ledger và withdrawal hold", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS ViDienTu/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS GiaoDichVi/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS YeuCauRutTien/);
  assert.match(
    migration,
    /UNIQUE \(NguoiDungId, Loai, ThamChieuLoai, ThamChieuId\)/,
  );
  assert.match(wallet, /withdrawal_hold/);
  assert.match(wallet, /withdrawal_released/);
  assert.match(wallet, /withdrawal_completed/);
  assert.match(wallet, /SoDuKhaDung/);
  assert.match(wallet, /SoDuTamGiu/);
});

test("contract database được nâng từ 52 lên đúng 55 bảng", () => {
  assert.match(tables, /"ViDienTu", "GiaoDichVi", "YeuCauRutTien"/);
  const quotedTables = tables.match(/"[A-Za-z_]+"/g) ?? [];
  assert.equal(quotedTables.length, 55);
});

test("migration ví đồng bộ nội dung chính sách hoàn hàng 15 ngày", () => {
  assert.match(migration, /Đổi trả 15 ngày/);
  assert.match(migration, /15 ngày kể từ lúc xác nhận đã nhận hàng/);
  assert.match(migration, /WHERE Slug = 'chinh-sach-doi-tra'/);
});

test("hoàn hàng dùng cửa sổ 15 ngày từ lúc khách xác nhận nhận hàng", () => {
  assert.match(afterSales, /const RETURN_WINDOW_DAYS = 15/);
  assert.match(afterSales, /received_by_customer/);
  assert.match(afterSales, /returnWindowDays: RETURN_WINDOW_DAYS/);
  assert.match(afterSales, /Đã quá thời hạn hoàn hàng \$\{RETURN_WINDOW_DAYS\} ngày/);
});

test("nhận hàng hoàn credit toàn bộ TongTien vào ví đúng một lần", () => {
  assert.match(adminAfterSales, /refundOrderInTransaction/);
  assert.match(adminAfterSales, /toNumber\(order\.total\)/);
  assert.match(adminAfterSales, /refund_wallet_credited/);
  assert.match(wallet, /"refund_credit"/);
  assert.match(wallet, /findLedger\(tx, userId, "refund_credit", "order"/);
  assert.doesNotMatch(
    adminAfterSales,
    /appendHistory\([\s\S]{0,300}"refund_pending"/,
  );
});

test("checkout giữ TongTien là tổng đơn và chỉ thu phần còn lại sau ví", () => {
  assert.match(orders, /debitOrderInTransaction/);
  assert.match(orders, /const amountDue = Math\.max\(0, total - walletUsed\)/);
  assert.match(orders, /paidInFullByWallet/);
  assert.match(payment, /amountDue: Math\.max\(0, orderTotal - walletUsed\)/);
  assert.match(payment, /amount: amounts\.amountDue/);
  assert.match(payment, /Số tiền webhook payOS không khớp số tiền còn phải thanh toán sau Ví KaitoKid/);
});

test("hủy và hết hạn đơn hoàn lại wallet debit idempotent", () => {
  assert.match(orders, /restoreOrderDebitInTransaction/);
  assert.match(payment, /restoreOrderDebitInTransaction/);
  assert.match(wallet, /order_payment_reversal/);
  assert.match(
    wallet,
    /findLedger\([\s\S]*?"order_payment_reversal"[\s\S]*?"order"/,
  );
});

test("walletUsed projection là net debit sau reversal", () => {
  const projection = wallet.match(/async walletUsedForOrder\([\s\S]*?async assertAccountCanCloseInTransaction/)?.[0] ?? "";
  assert.match(projection, /SUM\(/);
  assert.match(projection, /WHEN Loai = 'order_payment' THEN SoTien/);
  assert.match(projection, /WHEN Loai = 'order_payment_reversal' THEN -SoTien/);
  assert.match(projection, /Loai IN \('order_payment','order_payment_reversal'\)/);
  assert.match(projection, /Math\.max\(0, toNumber/);
});

test("account có tiền hoặc withdrawal đang xử lý không được hủy", () => {
  assert.match(account, /assertAccountCanCloseInTransaction/);
  assert.match(wallet, /TrangThai IN \('pending','approved'\)/);
  assert.match(wallet, /Không thể hủy tài khoản khi Ví KaitoKid còn số dư/);
});

test("RBAC ví tách khỏi quyền đơn hàng", () => {
  assert.match(permissions, /code: "wallet\.view"/);
  assert.match(permissions, /code: "wallet\.manage"/);
  assert.match(adminWalletController, /assertStaffPermission\(user, "wallet\.view"\)/);
  assert.match(adminWalletController, /assertStaffPermission\(user, "wallet\.manage"\)/);
  assert.match(adminAfterSales, /refund_wallet_credited/);
});

test("customer API có summary, ledger và withdrawal", () => {
  assert.match(walletController, /@Get\(\)/);
  assert.match(walletController, /@Get\("transactions"\)/);
  assert.match(walletController, /@Get\("withdrawals"\)/);
  assert.match(walletController, /@Post\("withdrawals"\)/);
});

test("Web và Mobile đều gửi useWallet và xử lý amountDue", () => {
  assert.match(webCheckout, /useWallet/);
  assert.match(webCheckout, /amountDue/);
  assert.match(mobileCheckout, /useWallet/);
  assert.match(mobileCheckout, /amountDue/);
  assert.match(mobileCheckout, /Ví KaitoKid/);
});
