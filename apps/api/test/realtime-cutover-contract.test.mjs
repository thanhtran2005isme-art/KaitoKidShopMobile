import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFacets,
  levenshtein,
  parseCsv,
} from "../dist/modules/search/search.helpers.js";
import {
  ImageEmbeddingStore,
} from "../dist/modules/search/image-embedding.store.js";
import {
  resolveChatIdentity,
  resolveSocketIdentity,
} from "../dist/modules/chat/chat-identity.js";
import {
  TokenService,
} from "../dist/modules/identity/token.service.js";

test("search helper giữ CSV + Levenshtein semantics", () => {
  assert.deepEqual(parseCsv("M,L, XL "), ["M", "L", "XL"]);
  assert.equal(levenshtein("polo", "polo"), 0);
  assert.equal(levenshtein("polo", "pola"), 1);
});

test("facets bỏ chính filter đang đếm như C#", () => {
  const rows = [
    {
      id: 1,
      name: "Áo A",
      category: "Ao",
      subcategory: null,
      gender: "Nam",
      price: 250000,
      oldPrice: null,
      stock: 10,
      reserved: 0,
      status: "active",
      image: "/a.jpg",
      shortDescription: null,
      sku: "A1",
      slug: "a",
      isNew: 1,
      isSale: 0,
      isBestSeller: 0,
      rating: 4.5,
      soldCount: 1,
      colors: JSON.stringify(["Đen"]),
      sizes: JSON.stringify(["M", "L"]),
    },
    {
      id: 2,
      name: "Quần B",
      category: "Quan",
      subcategory: null,
      gender: "Nam",
      price: 450000,
      oldPrice: null,
      stock: 5,
      reserved: 0,
      status: "active",
      image: "/b.jpg",
      shortDescription: null,
      sku: "B1",
      slug: "b",
      isNew: 0,
      isSale: 0,
      isBestSeller: 1,
      rating: 4,
      soldCount: 2,
      colors: JSON.stringify(["Xanh"]),
      sizes: JSON.stringify(["L"]),
    },
  ];
  const facets = buildFacets(rows, {
    category: "Ao",
    sizes: ["L"],
    colors: [],
    page: 1,
    pageSize: 20,
  });
  assert.equal(facets.categories.Ao, 1);
  assert.equal(facets.categories.Quan, 1);
  assert.equal(facets.sizes.M, 1);
  assert.equal(facets.sizes.L, 1);
});

test("image embedding store dùng cosine/dot trên vector normalize", () => {
  const store = new ImageEmbeddingStore();
  store.replaceAll([
    [1, Float32Array.from([1, 0])],
    [2, Float32Array.from([0.8, 0.6])],
    [3, Float32Array.from([0, 1])],
  ]);
  const hits = store.search(Float32Array.from([1, 0]), 3, 0.5);
  assert.deepEqual(
    hits.map((item) => item.productId),
    [1, 2],
  );
  assert.equal(hits[0].score, 1);
});

test("chat identity phân biệt customer/staff/guest bằng JWT tương thích", () => {
  const previous = {
    key: process.env.JWT_KEY,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  };
  process.env.JWT_KEY = "phase9-test-key-at-least-32-bytes!!";
  process.env.JWT_ISSUER = "KaitoKid.API.Auth";
  process.env.JWT_AUDIENCE = "KaitoKid.Client";

  try {
    const tokens = new TokenService();
    const customer = tokens.issueUser({
      id: 12,
      name: "Customer",
      email: "c@example.com",
      role: "user",
    });
    const customerIdentity = resolveChatIdentity(
      "Bearer " + customer.accessToken,
      "guest-ignore",
    );
    assert.equal(customerIdentity.userId, 12);
    assert.equal(customerIdentity.isStaff, false);
    assert.equal(customerIdentity.guestId, null);

    const staff = tokens.issueStaff({
      id: 4,
      name: "Sales",
      email: "sales@example.com",
      roleCode: "sales_staff",
      superAdmin: false,
      permissions: ["chat.view", "chat.reply"],
    });
    const staffIdentity = resolveSocketIdentity(
      staff.accessToken,
      null,
    );
    assert.equal(staffIdentity.userId, 4);
    assert.equal(staffIdentity.isStaff, true);
    assert.deepEqual(
      staffIdentity.permissions,
      ["chat.view", "chat.reply"],
    );

    const guest = resolveSocketIdentity("", "guest-123");
    assert.equal(guest.userId, null);
    assert.equal(guest.guestId, "guest-123");
  } finally {
    if (previous.key === undefined) delete process.env.JWT_KEY;
    else process.env.JWT_KEY = previous.key;
    if (previous.issuer === undefined) delete process.env.JWT_ISSUER;
    else process.env.JWT_ISSUER = previous.issuer;
    if (previous.audience === undefined) delete process.env.JWT_AUDIENCE;
    else process.env.JWT_AUDIENCE = previous.audience;
  }
});
