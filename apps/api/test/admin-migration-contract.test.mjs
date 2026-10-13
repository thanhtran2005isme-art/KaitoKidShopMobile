import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateAdjustedStock,
  floorAtZero,
  jsonValue,
  weightedAverageCost,
} from "../dist/modules/admin/admin-utils.js";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const moduleSource = source("../src/modules/admin/admin.module.ts");
const baseSource = source("../src/modules/admin/admin-content-base.controller.ts");
const salesSource = source("../src/modules/admin/admin-content-sales.controller.ts");
const homeSource = source("../src/modules/admin/admin-content-home.controller.ts");
const moreSource = source("../src/modules/admin/admin-content-more.controller.ts");
const catalogSource = source("../src/modules/admin/admin-catalog.controller.ts");
const operationsSource = source("../src/modules/admin/admin-operations.controller.ts");
const allSource = [baseSource, salesSource, homeSource, moreSource, catalogSource, operationsSource].join("\n");

const expectedControllers = [
  "AdminAttributesController",
  "AdminBannersController",
  "AdminCategoriesController",
  "AdminCollectionsController",
  "AdminCouponsController",
  "AdminCustomersController",
  "AdminFlashSalesController",
  "AdminHomepageBlocksController",
  "AdminHomepageController",
  "AdminInventoryController",
  "AdminLookbookController",
  "AdminMenusController",
  "AdminOrdersController",
  "AdminPagesController",
  "AdminProductsController",
  "AdminPromotionsController",
  "AdminReportsController",
  "AdminReviewsController",
  "AdminSettingsController",
  "AdminStockReceiptsController",
  "AdminSuppliersController",
  "AdminVariantStockController",
  "FlashSalesController",
];

const expectedRoutes = [
  "api/admin/attributes",
  "api/admin/banners",
  "api/admin/categories",
  "api/admin/collections",
  "api/admin/coupons",
  "api/admin/customers",
  "api/admin/flash-sales",
  "api/admin/homepage-blocks",
  "api/admin/homepage",
  "api/admin/inventory",
  "api/admin/lookbook",
  "api/admin/menus",
  "api/admin/orders",
  "api/admin/pages",
  "api/admin/products",
  "api/admin/promotions",
  "api/admin/reports",
  "api/admin/reviews",
  "api/admin/settings",
  "api/admin/stock-receipts",
  "api/admin/suppliers",
  "api/admin/variant-stock",
  "api/flash-sales",
];

test("Phase 10 registers all 23 legacy API.Admin controller surfaces", () => {
  assert.equal(expectedControllers.length, 23);
  assert.equal(expectedRoutes.length, 23);
  for (const name of expectedControllers) assert.match(moduleSource, new RegExp(`\\b${name}\\b`));
  for (const route of expectedRoutes) assert.ok(allSource.includes(`@Controller(\"${route}\")`), `missing ${route}`);
});

test("legacy test-bypass admin areas are hardened to staff-only", () => {
  assert.match(baseSource, /@Controller\("api\/admin\/categories"\)[\s\S]*?@UseGuards\(JwtAuthGuard, AdminStaffGuard\)/);
  assert.match(homeSource, /@Controller\("api\/admin\/homepage"\)[\s\S]*?@UseGuards\(JwtAuthGuard, AdminStaffGuard\)/);
  assert.match(catalogSource, /@Controller\("api\/admin\/products"\)[\s\S]*?@UseGuards\(JwtAuthGuard, AdminStaffGuard\)/);
  assert.match(operationsSource, /@Controller\("api\/admin\/stock-receipts"\)[\s\S]*?@UseGuards\(JwtAuthGuard, AdminStaffGuard\)/);
});

test("granular permissions used by API.Admin are preserved", () => {
  for (const permission of [
    "attributes.manage", "banners.manage", "collections.manage", "coupons.manage",
    "customers.view", "customers.manage", "flash_sales.manage", "homepage.manage",
    "inventory.view", "inventory.manage", "inventory.history", "lookbook.manage",
    "menus.manage", "orders.view", "orders.update_status", "pages.manage",
    "promotions.manage", "dashboard.view", "reports.view", "reviews.view", "reviews.moderate",
    "settings.view", "settings.manage", "suppliers.view", "suppliers.manage",
  ]) assert.ok(allSource.includes(`\"${permission}\"`), `missing permission ${permission}`);
});

test("admin order cancellation locks order and restores product, variant and coupon state once", () => {
  assert.match(operationsSource, /SELECT \* FROM DonHang WHERE Id=\? LIMIT 1 FOR UPDATE/);
  assert.match(operationsSource, /TonKho=TonKho\+\?/);
  assert.match(operationsSource, /SoLuong=SoLuong\+\?/);
  assert.match(operationsSource, /DaSuDung=GREATEST\(0, DaSuDung-1\)/);
  assert.match(operationsSource, /nextStatus === \"cancelled\" && previous !== \"cancelled\"/);
});

test("stock receipt is atomic and updates aggregate stock, variants, average cost and history", () => {
  assert.match(operationsSource, /this\.prisma\.\$transaction/);
  assert.match(operationsSource, /insertRow\(tx, \"PhieuNhap\"/);
  assert.match(operationsSource, /insertRow\(tx, \"ChiTietPhieuNhap\"/);
  assert.match(operationsSource, /TonKhoBienThe/);
  assert.match(operationsSource, /weightedAverageCost/);
  assert.match(operationsSource, /TonKho_LichSu/);
  assert.match(operationsSource, /TrangThai='cancelled'/);
  assert.match(operationsSource, /FOR UPDATE/);
});

test("inventory math rejects oversell and computes weighted average correctly", () => {
  assert.equal(calculateAdjustedStock(10, 4, "import"), 14);
  assert.equal(calculateAdjustedStock(10, 4, "export"), 6);
  assert.equal(calculateAdjustedStock(10, 4, "set"), 4);
  assert.throws(() => calculateAdjustedStock(3, 4, "export"), /insufficient stock/);
  assert.equal(weightedAverageCost(10, 100, 10, 200), 150);
  assert.equal(floorAtZero(-4), 0);
});

test("raw MariaDB rows are converted to ASP.NET-compatible camelCase JSON", () => {
  assert.deepEqual(jsonValue({ Id: 7n, TenSanPham: "Áo khoác", TongTien: 120000n }), {
    id: 7,
    tenSanPham: "Áo khoác",
    tongTien: 120000,
  });
});

test("customer summary aggregates MariaDB orders by user, with completed-only revenue", () => {
  const start = catalogSource.indexOf('@Get("summary")');
  const end = catalogSource.indexOf('  @Get()', start);
  assert.ok(start >= 0 && end > start);
  const summarySource = catalogSource.slice(start, end);
  assert.match(summarySource, /assertStaffPermission\(user, "customers.view"\)/);
  assert.match(summarySource, /GROUP BY d\.NguoiDungId/);
  assert.match(summarySource, /o\.UserId=n\.Id/);
  assert.match(summarySource, /WHERE n\.VaiTro='user'/);
  assert.match(summarySource, /d\.TrangThai='completed' THEN d\.TongTien ELSE 0/);
  assert.match(summarySource, /d\.TrangThai='cancelled'/);
});

test("customer purchase analytics use NguoiDungId and completed orders for value and interests", () => {
  assert.ok(catalogSource.includes('@Get(":id/analytics")'));
  assert.ok(catalogSource.includes("d.NguoiDungId=n.Id AND d.TrangThai='completed'"));
  assert.ok(catalogSource.includes("SUM(d.TongTien) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='completed'"));
  assert.ok(catalogSource.includes("AVG(d.TongTien) FROM DonHang d WHERE d.NguoiDungId=n.Id AND d.TrangThai='completed'"));

  const analyticsStart = catalogSource.indexOf('@Get(":id/analytics")');
  const customerDetailStart = catalogSource.indexOf('@Get(":id")', analyticsStart);
  const analyticsSource = catalogSource.slice(analyticsStart, customerDetailStart);
  const completedFilters = analyticsSource.match(/WHERE d\.NguoiDungId=\? AND d\.TrangThai='completed'/g) || [];

  assert.equal(completedFilters.length, 2, "top products and categories must both use completed orders");
  assert.ok(analyticsSource.includes("WHERE d.NguoiDungId=?"));
  assert.ok(analyticsSource.includes("JOIN ChiTietDonHang"));
  assert.ok(analyticsSource.includes("LEFT JOIN SanPham"));
  assert.doesNotMatch(analyticsSource, /Email|SoDienThoai/);
});
