import assert from "node:assert/strict";
import test from "node:test";
import {
  mapProduct,
  mapProductDetail,
} from "../dist/modules/products/product.mapper.js";

const baseRow = {
  id: 10,
  name: "Áo thử nghiệm",
  category: "Áo",
  subcategory: "Áo thun",
  style: "Basic",
  ageGroup: "NguoiLon",
  gender: "Nam",
  price: "300000",
  oldPrice: "350000",
  stock: 10,
  reserved: 3,
  status: "active",
  image: "/product.jpg",
  images: '["/1.jpg","/2.jpg"]',
  shortDescription: "Mô tả",
  description: "Chi tiết",
  sku: "KK-TEST",
  slug: "kk-test",
  menu: null,
  collectionId: 2,
  specs: null,
  isNew: 1,
  isSale: 1,
  isBestSeller: 0,
  rating: 4.8,
  soldCount: 20,
  colors: '["Đen","Trắng"]',
  sizes: '["M","L"]',
  variants: '[{"size":"M","color":"Đen","sku":"KK-TEST-M-DEN"}]',
  createdAt: new Date("2026-09-30T00:00:00Z"),
};

test("Product list giữ availableStock = stock - reserved", () => {
  const dto = mapProduct(baseRow);
  assert.equal(dto.availableStock, 7);
  assert.deepEqual(dto.colors, ["Đen", "Trắng"]);
  assert.deepEqual(dto.sizes, ["M", "L"]);
});

test("Product detail giữ variant inventory và review contract", () => {
  const dto = mapProductDetail(
    baseRow,
    [{ size: "M", color: "Đen", stock: 4, reserved: 1 }],
    [{
      id: 1,
      productId: 10,
      customerName: "Khách",
      rating: 5,
      comment: "Tốt",
      createdAt: new Date("2026-09-29T00:00:00Z"),
      orderId: 22,
      images: '["/review.jpg"]',
      videoUrl: null,
      size: "M",
      color: "Đen",
      adminReply: null,
      repliedAt: null,
      helpfulCount: 2,
    }],
  );

  assert.equal(dto.variantInventory[0].available, 3);
  assert.equal(dto.reviews[0].isVerifiedPurchase, true);
  assert.deepEqual(dto.variants[0], {
    size: "M",
    color: "Đen",
    sku: "KK-TEST-M-DEN",
  });
});
