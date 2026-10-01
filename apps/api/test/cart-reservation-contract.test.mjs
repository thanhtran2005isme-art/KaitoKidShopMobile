import assert from "node:assert/strict";
import test from "node:test";
import {
  availableStock,
  calculateReservationUpdate,
  groupReservationRelease,
  reservationExpiresAt,
} from "../dist/modules/cart/cart.helpers.js";
import {
  evaluateComboRows,
  roundHalfToEven,
} from "../dist/modules/cart/combo-discount.helpers.js";

test("availableStock không âm", () => {
  assert.equal(availableStock(5, 2), 3);
  assert.equal(availableStock(2, 5), 0);
});

test("update quantity tính lại reserve bằng cách hoàn phần giữ của chính item", () => {
  const result = calculateReservationUpdate({
    productStock: 10,
    productReserved: 7,
    oldQuantity: 3,
    newQuantity: 6,
    variantStock: 8,
    variantReserved: 4,
  });
  assert.equal(result.nextProductReserved, 10);
  assert.equal(result.nextVariantReserved, 7);
});

test("update quantity chặn vượt tồn biến thể", () => {
  assert.throws(
    () =>
      calculateReservationUpdate({
        productStock: 20,
        productReserved: 2,
        oldQuantity: 2,
        newQuantity: 5,
        variantStock: 5,
        variantReserved: 3,
      }),
    /biến thể này/,
  );
});

test("release reservation gom đúng product và size/màu", () => {
  const grouped = groupReservationRelease([
    { productId: 1, size: "120", color: "Tím", quantity: 2 },
    { productId: 1, size: "130", color: "Cam", quantity: 1 },
    { productId: 1, size: "120", color: "Tím", quantity: 3 },
    { productId: 2, size: "M", color: "Đen", quantity: 1 },
  ]);
  assert.deepEqual(grouped.products, [
    { productId: 1, quantity: 6 },
    { productId: 2, quantity: 1 },
  ]);
  assert.equal(
    grouped.variants.find(
      (item) => item.productId === 1 && item.size === "120" && item.color === "Tím",
    )?.quantity,
    5,
  );
});

test("reservation mặc định kéo dài 30 phút", () => {
  const now = new Date("2026-09-30T12:00:00.000Z");
  assert.equal(
    reservationExpiresAt(now).toISOString(),
    "2026-09-30T12:30:00.000Z",
  );
});

test("combo cần ít nhất 2 ProductId khác nhau cùng category", () => {
  const sameProduct = evaluateComboRows([
    { productId: 1, category: "Áo", price: 100_000, quantity: 2 },
    { productId: 1, category: "Áo", price: 100_000, quantity: 1 },
  ]);
  assert.equal(sameProduct.eligible, false);
  assert.equal(sameProduct.message, null);

  const combo = evaluateComboRows([
    { productId: 1, category: "Áo", price: 100_000, quantity: 1 },
    { productId: 2, category: "Áo", price: 200_000, quantity: 1 },
    { productId: 3, category: "Quần", price: 500_000, quantity: 1 },
  ]);
  assert.equal(combo.eligible, true);
  assert.equal(combo.eligibleSubtotal, 300_000);
  assert.equal(combo.discount, 30_000);
  assert.deepEqual(combo.categories, ["Áo"]);
});

test("combo dùng round-to-even giống decimal Math.Round của C#", () => {
  assert.equal(roundHalfToEven(0.5), 0);
  assert.equal(roundHalfToEven(1.5), 2);
  assert.equal(roundHalfToEven(2.5), 2);
  assert.equal(roundHalfToEven(3.5), 4);
});
