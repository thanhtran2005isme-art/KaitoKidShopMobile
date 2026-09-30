import assert from "node:assert/strict";
import test from "node:test";
import {
  didYouMeanFromNames,
  levenshtein,
  priceRangeFacet,
} from "../dist/modules/search/search.helpers.js";
import {
  ImageEmbeddingStore,
} from "../dist/modules/search/image-embedding.store.js";
import {
  identityFromRequest,
} from "../dist/modules/chat/chat.types.js";

test("Levenshtein + did-you-mean giữ semantics search C#", () => {
  assert.equal(levenshtein("polo", "polo"), 0);
  assert.equal(levenshtein("polo", "pol"), 1);
  assert.equal(
    didYouMeanFromNames("polp", ["Áo Polo Nam", "Váy Bé Gái"]),
    "polo",
  );
  assert.equal(
    didYouMeanFromNames("zzzzzz", ["Áo Polo Nam"]),
    null,
  );
});

test("price facet giữ boundary/order C#", () => {
  const row = (price) => ({
    id: 1,
    name: "x",
    category: "Áo",
    subcategory: null,
    gender: "Nam",
    price,
    oldPrice: null,
    stock: 1,
    reserved: 0,
    status: "active",
    image: "",
    shortDescription: null,
    sku: "X",
    slug: null,
    isNew: false,
    isSale: false,
    isBestSeller: false,
    rating: 0,
    soldCount: 0,
    colors: "[]",
    sizes: "[]",
  });
  assert.deepEqual(
    priceRangeFacet([
      row(100_000),
      row(200_000),
      row(300_000),
      row(600_000),
      row(1_500_000),
      row(3_000_000),
    ]),
    {
      "Dưới 200k": 2,
      "200k - 500k": 1,
      "500k - 1tr": 1,
      "1tr - 2tr": 1,
      "Trên 2tr": 1,
    },
  );
});

test("image embedding store cosine top-K trên vector đã normalize", () => {
  const store = new ImageEmbeddingStore();
  store.upsert(1, [1, 0]);
  store.upsert(2, [0.8, 0.6]);
  store.upsert(3, [0, 1]);

  const hits = store.search([1, 0], 2, 0.1);
  assert.deepEqual(hits.map((item) => item.productId), [1, 2]);
  assert.ok(Math.abs(hits[0].score - 1) < 1e-6);
  assert.ok(Math.abs(hits[1].score - 0.8) < 1e-6);
});

test("chat identity ưu tiên JWT customer, guest dùng guestId giới hạn 64 ký tự", () => {
  const customer = identityFromRequest(
    {
      id: 7,
      name: "Khách",
      email: "k@example.com",
      role: "user",
      claims: {},
    },
    "guest-ignored",
  );
  assert.deepEqual(customer, {
    userId: 7,
    guestId: null,
    displayName: "Khách",
    authenticated: true,
  });

  const guest = identityFromRequest(undefined, "g".repeat(100));
  assert.equal(guest.authenticated, false);
  assert.equal(guest.guestId?.length, 64);
});

test("staff JWT không bị coi là customer owner trong chat", () => {
  const identity = identityFromRequest(
    {
      id: 2,
      name: "NV",
      role: "admin",
      claims: { user_type: "staff" },
    },
    "guest-staff-session",
  );
  assert.equal(identity.authenticated, false);
  assert.equal(identity.userId, null);
  assert.equal(identity.guestId, "guest-staff-session");
});
