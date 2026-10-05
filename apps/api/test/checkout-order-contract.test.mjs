import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateCoupon } from "../dist/modules/coupons/coupon.helpers.js";
import {
  canCancelOrder,
  canonicalShippingAddress,
  hasReviewedVariant,
  isExpiredUnpaidOrder,
  paymentSecondsLeft,
  reviewedKey,
} from "../dist/modules/orders/order.helpers.js";
import {
  calculateMockQuote,
  normalizeGhnName,
  normalizeProvince,
} from "../dist/modules/shipping/shipping.helpers.js";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const ordersControllerSource = source("../src/modules/orders/orders.controller.ts");
const afterSalesSource = source("../src/modules/orders/order-after-sales.service.ts");
const reviewsSource = source("../src/modules/reviews/reviews.service.ts");
const simulatorSource = source("../src/modules/shipping/shipping-status-simulator.service.ts");
const adminAfterSalesSource = source("../src/modules/admin/admin-order-after-sales.service.ts");
const adminBoundarySource = source("../src/modules/admin/admin-order-status-boundary.interceptor.ts");
const adminModuleSource = source("../src/modules/admin/admin.module.ts");

test("coupon percent giữ min-order, usage và max-discount của C#", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const coupon = {
    type: "percent",
    value: 20,
    minOrderAmount: 200_000,
    maxDiscount: 50_000,
    usageLimit: 10,
    usedCount: 3,
    startDate: new Date("2026-09-01T00:00:00Z"),
    endDate: new Date("2026-10-31T23:59:59Z"),
    isActive: true,
  };
  assert.equal(evaluateCoupon(coupon, 100_000, now).isValid, false);
  const ok = evaluateCoupon(coupon, 400_000, now);
  assert.equal(ok.isValid, true);
  assert.equal(ok.discountAmount, 50_000);
});

test("canCancel chỉ cho pending/confirmed và shipping chưa vượt picking", () => {
  assert.equal(canCancelOrder("pending", null), true);
  assert.equal(canCancelOrder("confirmed", "ready_to_pick"), true);
  assert.equal(canCancelOrder("confirmed", "picking"), true);
  assert.equal(canCancelOrder("confirmed", "picked"), false);
  assert.equal(canCancelOrder("shipping", "picking"), false);
});

test("payment timeout 15 phút tính secondsLeft và expired đúng", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  const expires = new Date("2026-09-30T12:15:00Z");
  assert.equal(paymentSecondsLeft(expires, now), 900);
  assert.equal(
    isExpiredUnpaidOrder("pending", null, expires, new Date("2026-09-30T12:16:00Z")),
    true,
  );
  assert.equal(
    isExpiredUnpaidOrder("confirmed", new Date(), expires, new Date("2026-09-30T12:16:00Z")),
    false,
  );
});

test("review key giữ wildcard semantics của OrderDTO C#", () => {
  const reviewed = new Set([reviewedKey(7, 9, "120", "*")]);
  assert.equal(hasReviewedVariant(reviewed, 7, 9, "120", "Tím"), true);
  assert.equal(hasReviewedVariant(reviewed, 7, 9, "130", "Tím"), false);
});

test("địa chỉ canonical không dùng CustomerAddress legacy", () => {
  assert.equal(
    canonicalShippingAddress("12 Trần Thái Tông", "Dịch Vọng", "Cầu Giấy", "Hà Nội"),
    "12 Trần Thái Tông, Dịch Vọng, Cầu Giấy, Hà Nội",
  );
});

test("mock shipping giữ branch + phụ phí cân nặng", () => {
  const cfg = {
    mockEnabled: true,
    ghnEnabled: false,
    ghtkEnabled: false,
    ghnBaseUrl: "",
    ghnToken: null,
    ghnShopId: null,
    ghnFromDistrictId: "",
    ghnToDistrictIdFallback: "",
    ghnToWardCodeFallback: "",
    ghtkBaseUrl: "",
    ghtkToken: null,
    ghtkPickProvince: null,
    ghtkPickDistrict: null,
    kaitoKidBranches: [{ code: "HN", name: "KaitoKid Hà Nội", province: "Hà Nội", active: true }],
    mockOnlyServeBranches: true,
    mockFeeSameProvince: 22_000,
    mockFeeNearbyProvince: 35_000,
    mockFeeExpress: 15_000,
    mockLeadTimeStandardHours: 6,
    mockLeadTimeExpressHours: 2,
  };
  const options = calculateMockQuote({
    provider: "mock",
    toProvince: "Thành phố Hà Nội",
    toDistrict: "Cầu Giấy",
    weightGram: 1_600,
    orderValue: 500_000,
  }, cfg);
  assert.equal(normalizeProvince("Thành phố Hà Nội"), "ha noi");
  assert.equal(options.length, 2);
  assert.equal(options[0].fee, 32_000);
  assert.equal(options[0].leadTimeHours, 6);
});

test("GHN normalizer bỏ quận/huyện/phường + khoảng trắng như C#", () => {
  assert.equal(normalizeGhnName("Quận Cầu Giấy"), "caugiay");
  assert.equal(normalizeGhnName("Phường Dịch Vọng"), "dichvong");
});

test("carrier delivered does not complete commerce order before customer receipt", () => {
  assert.match(simulatorSource, /shippingStatus === "delivering" \|\| shippingStatus === "delivered"/);
  assert.match(simulatorSource, /return "shipping"/);
  assert.doesNotMatch(simulatorSource, /shippingStatus === "delivered"\) return "completed"/);
});

test("customer receipt is explicit and starts the seven-day return window", () => {
  assert.match(ordersControllerSource, /@Post\(":id\/confirm-received"\)/);
  assert.match(ordersControllerSource, /@Post\(":id\/report-not-received"\)/);
  assert.match(ordersControllerSource, /@Post\(":id\/return-request"\)/);
  assert.match(afterSalesSource, /7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(afterSalesSource, /TrangThaiVanChuyen = 'received_by_customer'/);
  assert.match(afterSalesSource, /NgayHoanThanh = \?/);
  assert.match(afterSalesSource, /TrangThaiVanChuyen = 'delivery_disputed'/);
  assert.match(afterSalesSource, /VALUES \(\?, 'return_requested'/);
});

test("receipt authority requires received_by_customer history marker, not timestamp alone", () => {
  assert.match(afterSalesSource, /received_by_customer/);
  assert.match(afterSalesSource, /const receiptConfirmed = receiptMarker && Boolean\(completedAt\)/);
  assert.match(afterSalesSource, /\["delivered", "completed"\]/);
  assert.match(afterSalesSource, /NgayHoanThanh = NULL/);
  assert.match(afterSalesSource, /hasMarker\(tx, orderId, "received_by_customer"\)/);
});

test("return request uses latest workflow marker instead of permanent requested boolean", () => {
  assert.match(afterSalesSource, /return_approved/);
  assert.match(afterSalesSource, /return_rejected/);
  assert.match(afterSalesSource, /return_received_restock/);
  assert.match(afterSalesSource, /return_received_quarantine/);
  assert.match(afterSalesSource, /latestReturnById/);
  assert.match(afterSalesSource, /returnStatus: currentReturnStatus/);
  assert.doesNotMatch(afterSalesSource, /UPDATE DonHang[\s\S]*?SET TrangThai = 'return_requested'/);
});

test("review requires customer-confirmed receipt marker", () => {
  assert.match(reviewsSource, /TrangThai = 'completed'/);
  assert.match(reviewsSource, /NgayHoanThanh IS NOT NULL/);
  assert.match(reviewsSource, /EXISTS \(/);
  assert.match(reviewsSource, /h\.TrangThai = 'received_by_customer'/);
  assert.match(reviewsSource, /khách chưa xác nhận đã nhận hàng/);
  assert.match(afterSalesSource, /const canReview = status === "completed" && receiptConfirmed/);
});

test("Admin legacy status endpoint cannot forge completed or returned", () => {
  assert.match(adminBoundarySource, /status === "completed"/);
  assert.match(adminBoundarySource, /status === "returned"/);
  assert.match(adminBoundarySource, /Chỉ khách xác nhận đã nhận hàng/);
  assert.match(adminModuleSource, /APP_INTERCEPTOR/);
  assert.match(adminModuleSource, /AdminOrderStatusBoundaryInterceptor/);
});

test("Admin return decision is audit-only before physical goods arrive", () => {
  assert.match(adminAfterSalesSource, /return_approved/);
  assert.match(adminAfterSalesSource, /return_rejected/);
  const decisionBlock = adminAfterSalesSource.match(/async decideReturn[\s\S]*?async receiveReturn/)?.[0] ?? "";
  assert.doesNotMatch(decisionBlock, /UPDATE SanPham/);
  assert.doesNotMatch(decisionBlock, /UPDATE TonKhoBienThe/);
  assert.doesNotMatch(decisionBlock, /TrangThai = 'returned'/);
});

test("Admin receive return separates sellable restock from quarantine", () => {
  assert.match(adminAfterSalesSource, /disposition === "restock" \? before \+ quantity : before/);
  assert.match(adminAfterSalesSource, /return_received_restock/);
  assert.match(adminAfterSalesSource, /return_received_quarantine/);
  assert.match(adminAfterSalesSource, /quarantine, không tăng tồn bán được/);
  assert.match(adminAfterSalesSource, /LoaiThayDoi: "return"/);
  assert.match(adminAfterSalesSource, /SoLuongDaBan = GREATEST\(0, SoLuongDaBan - \?\)/);
  assert.match(adminAfterSalesSource, /SET TrangThai = 'returned', TrangThaiVanChuyen = 'returned'/);
});

test("refund flow is explicit manual audit and never pretends to call a gateway", () => {
  assert.match(adminAfterSalesSource, /refund_pending/);
  assert.match(adminAfterSalesSource, /refund_completed_manual/);
  assert.match(adminAfterSalesSource, /Admin xác nhận đã hoàn tiền thủ công/);
  assert.doesNotMatch(adminAfterSalesSource, /refundGateway|paymentGateway\.refund|vnpay.*refund/i);
});
