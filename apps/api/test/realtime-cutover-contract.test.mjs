import assert from "node:assert/strict";
import test from "node:test";
import {
  signHs256,
} from "../dist/modules/identity/token.service.js";
import {
  tryAuthenticateBearer,
} from "../dist/auth/jwt-optional.js";
import {
  canChat,
  chatIdentityFromAuthorization,
} from "../dist/modules/chat/chat-identity.js";
import {
  cosineSimilarity,
} from "../dist/modules/search/image-search.service.js";
import {
  maskShippingSecret,
} from "../dist/modules/admin-shipping/admin-shipping.service.js";

function withJwtEnv(fn) {
  const old = {
    key: process.env.JWT_KEY,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  };
  process.env.JWT_KEY = "phase9-unit-key-at-least-32-bytes!";
  process.env.JWT_ISSUER = "KaitoKid.API.Auth";
  process.env.JWT_AUDIENCE = "KaitoKid.Client";
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(old)) {
      const envKey =
        key === "key"
          ? "JWT_KEY"
          : key === "issuer"
            ? "JWT_ISSUER"
            : "JWT_AUDIENCE";
      if (value === undefined) delete process.env[envKey];
      else process.env[envKey] = value;
    }
  }
}

test("optional JWT chỉ nhận token hợp lệ đúng issuer/audience", () => {
  withJwtEnv(() => {
    const now = Math.floor(Date.now() / 1000);
    const token = signHs256(
      {
        nameid: "12",
        unique_name: "Khách",
        role: "user",
        iss: process.env.JWT_ISSUER,
        aud: process.env.JWT_AUDIENCE,
        exp: now + 3600,
      },
      process.env.JWT_KEY,
    );
    assert.equal(
      tryAuthenticateBearer(`Bearer ${token}`)?.id,
      12,
    );

    const wrong = signHs256(
      {
        nameid: "12",
        iss: process.env.JWT_ISSUER,
        aud: "other-client",
        exp: now + 3600,
      },
      process.env.JWT_KEY,
    );
    assert.equal(
      tryAuthenticateBearer(`Bearer ${wrong}`),
      null,
    );
  });
});

test("chat staff cần đúng granular permission hoặc super admin", () => {
  withJwtEnv(() => {
    const now = Math.floor(Date.now() / 1000);
    const token = signHs256(
      {
        nameid: "7",
        unique_name: "NV hỗ trợ",
        user_type: "staff",
        is_super_admin: "false",
        permission: ["chat.view", "chat.reply"],
        iss: process.env.JWT_ISSUER,
        aud: process.env.JWT_AUDIENCE,
        exp: now + 3600,
      },
      process.env.JWT_KEY,
    );
    const staff = chatIdentityFromAuthorization(
      `Bearer ${token}`,
      null,
    );
    assert.equal(staff.isStaff, true);
    assert.equal(canChat(staff, "chat.view"), true);
    assert.equal(canChat(staff, "chat.manage"), false);

    const guest = chatIdentityFromAuthorization(
      undefined,
      "guest-123",
    );
    assert.equal(guest.userId, null);
    assert.equal(guest.guestId, "guest-123");
    assert.equal(canChat(guest, "chat.view"), false);
  });
});

test("cosine similarity dùng vector đã normalize và reject sai dimension", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1], [1, 0]), -1);
});

test("shipping secret masking không expose token đầy đủ", () => {
  assert.equal(maskShippingSecret("12345678"), "********");
  assert.equal(
    maskShippingSecret("abcd12345678wxyz"),
    "abcd********wxyz",
  );
});
