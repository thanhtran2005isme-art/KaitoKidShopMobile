import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePhone,
  resolveNextTier,
  utcDateOnly,
} from "../dist/modules/account/account.helpers.js";
import {
  normalizeReviewImages,
  selectPurchasedVariant,
} from "../dist/modules/reviews/review.helpers.js";

test("Account tier giữ đúng threshold C#", () => {
  assert.deepEqual(resolveNextTier("Member"), {
    nextTier: "Silver",
    threshold: 2_000_000,
  });
  assert.deepEqual(resolveNextTier("Gold"), {
    nextTier: "Diamond",
    threshold: 10_000_000,
  });
});

test("Phone giữ rule 9-12 chữ số", () => {
  assert.equal(normalizePhone("0901 234 567"), "0901 234 567");
  assert.equal(normalizePhone(""), null);
  assert.throws(() => normalizePhone("123"));
});

test("Birthday không cho ngày tương lai", () => {
  assert.equal(utcDateOnly("2000-01-02"), "2000-01-02");
  assert.throws(() => utcDateOnly("2999-01-01"));
});

test("Review dùng biến thể server và fallback khi đơn chỉ có 1 biến thể", () => {
  const items = [{ size: "120", color: "Tím" }];
  assert.deepEqual(
    selectPurchasedVariant(items, "999", "Màu client tự sửa"),
    items[0],
  );
});

test("Review nhiều biến thể không đoán khi client gửi sai", () => {
  const items = [
    { size: "120", color: "Tím" },
    { size: "130", color: "Cam" },
  ];
  assert.equal(selectPurchasedVariant(items, "999", "Sai"), null);
  assert.deepEqual(selectPurchasedVariant(items, "130", "Cam"), items[1]);
});

test("Review media loại trùng và chỉ lấy tối đa 4 ảnh", () => {
  assert.deepEqual(
    normalizeReviewImages([" a.jpg ", "a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"]),
    ["a.jpg", "b.jpg", "c.jpg", "d.jpg"],
  );
});
