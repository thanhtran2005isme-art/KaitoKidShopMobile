import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeJwtPayload,
  signHs256,
  TokenService,
  verifyGeneratedJwt,
} from "../dist/modules/identity/token.service.js";
import {
  JwtAuthGuard,
} from "../dist/auth/jwt-auth.guard.js";
import {
  base32Decode,
  base32Encode,
  totpAt,
  verifyTotp,
} from "../dist/modules/identity/two-factor.service.js";
import {
  hashPassword,
  verifyPassword,
} from "../dist/modules/identity/password.js";
import {
  hashVerificationToken,
  isPhoneIdentifier,
  isValidEmail,
} from "../dist/modules/identity/user-auth.service.js";
import {
  hasGoogleAudience,
} from "../dist/modules/identity/google-auth.service.js";
import {
  hasStaffPermission,
  isSuperAdmin,
} from "../dist/modules/identity/staff-permissions.js";
import {
  parseUserAgent,
} from "../dist/modules/identity/user-agent.js";
import {
  otpCooldownSeconds,
} from "../dist/modules/identity/otp.service.js";

test("bcrypt Node đọc/ghi hash BCrypt và nâng plain legacy", async () => {
  const hash = await hashPassword("Secret@123");
  assert.equal((await verifyPassword("Secret@123", hash)).valid, true);
  assert.equal((await verifyPassword("wrong", hash)).valid, false);
  const legacy = await verifyPassword("legacy", "legacy", true);
  assert.equal(legacy.valid, true);
  assert.equal(legacy.needsRehash, true);
});

test("JWT user/staff dùng HS256 + claims tương thích C#", () => {
  const previous = {
    key: process.env.JWT_KEY,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
    expiry: process.env.JWT_EXPIRY_MINUTES,
  };
  process.env.JWT_KEY = "unit-test-key-at-least-32-bytes-long!";
  process.env.JWT_ISSUER = "KaitoKid.API.Auth";
  process.env.JWT_AUDIENCE = "KaitoKid.Client";
  process.env.JWT_EXPIRY_MINUTES = "60";

  try {
    const service = new TokenService();
    const user = service.issueUser({
      id: 7,
      name: "User Test",
      email: "user@example.com",
      role: "user",
    });
    assert.equal(
      verifyGeneratedJwt(user.accessToken, process.env.JWT_KEY),
      true,
    );
    const userPayload = decodeJwtPayload(user.accessToken);
    assert.equal(userPayload.nameid, "7");
    assert.equal(userPayload.role, "user");
    assert.equal(userPayload.iss, "KaitoKid.API.Auth");

    const staff = service.issueStaff({
      id: 3,
      name: "Admin",
      email: "admin@example.com",
      roleCode: "admin",
      superAdmin: false,
      permissions: ["staff.view", "roles.manage"],
    });
    const payload = decodeJwtPayload(staff.accessToken);
    assert.equal(payload.user_type, "staff");
    assert.equal(payload.is_super_admin, "false");
    assert.deepEqual(payload.permission, ["staff.view", "roles.manage"]);
  } finally {
    if (previous.key === undefined) delete process.env.JWT_KEY;
    else process.env.JWT_KEY = previous.key;
    if (previous.issuer === undefined) delete process.env.JWT_ISSUER;
    else process.env.JWT_ISSUER = previous.issuer;
    if (previous.audience === undefined) delete process.env.JWT_AUDIENCE;
    else process.env.JWT_AUDIENCE = previous.audience;
    if (previous.expiry === undefined) delete process.env.JWT_EXPIRY_MINUTES;
    else process.env.JWT_EXPIRY_MINUTES = previous.expiry;
  }
});



test("JwtAuthGuard chấp nhận token Node và claim URI .NET/C#", () => {
  const previous = {
    key: process.env.JWT_KEY,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
  };
  const key = "guard-test-key-at-least-32-bytes-long!";
  process.env.JWT_KEY = key;
  process.env.JWT_ISSUER = "KaitoKid.API.Auth";
  process.env.JWT_AUDIENCE = "KaitoKid.Client";

  const contextFor = (token) => {
    const request = {
      headers: { authorization: `Bearer ${token}` },
    };
    return {
      request,
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      },
    };
  };

  try {
    const guard = new JwtAuthGuard();
    const service = new TokenService();
    const issued = service.issueUser({
      id: 9,
      name: "Node User",
      email: "node@example.com",
      role: "user",
    });
    const nodeCtx = contextFor(issued.accessToken);
    assert.equal(guard.canActivate(nodeCtx.context), true);
    assert.equal(nodeCtx.request.user.id, 9);
    assert.equal(nodeCtx.request.user.email, "node@example.com");

    const now = Math.floor(Date.now() / 1000);
    const dotnetStyle = signHs256(
      {
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": "42",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "C# User",
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "csharp@example.com",
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "user",
        iss: "KaitoKid.API.Auth",
        aud: "KaitoKid.Client",
        exp: now + 3600,
      },
      key,
    );
    const dotnetCtx = contextFor(dotnetStyle);
    assert.equal(guard.canActivate(dotnetCtx.context), true);
    assert.equal(dotnetCtx.request.user.id, 42);
    assert.equal(dotnetCtx.request.user.name, "C# User");

    const wrongAudience = signHs256(
      {
        nameid: "9",
        iss: "KaitoKid.API.Auth",
        aud: "Other.Client",
        exp: now + 3600,
      },
      key,
    );
    assert.throws(() => guard.canActivate(contextFor(wrongAudience).context));
  } finally {
    if (previous.key === undefined) delete process.env.JWT_KEY;
    else process.env.JWT_KEY = previous.key;
    if (previous.issuer === undefined) delete process.env.JWT_ISSUER;
    else process.env.JWT_ISSUER = previous.issuer;
    if (previous.audience === undefined) delete process.env.JWT_AUDIENCE;
    else process.env.JWT_AUDIENCE = previous.audience;
  }
});

test("TOTP SHA1 30s khớp RFC vector 6 chữ số và drift ±1", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totpAt(secret, 59_000), "287082");
  assert.equal(verifyTotp(secret, "287082", 59_000), true);
  assert.equal(verifyTotp(secret, "287082", 89_000), true);
  assert.equal(verifyTotp(secret, "000000", 59_000), false);
});

test("base32 round-trip secret", () => {
  const source = Buffer.from("KaitoKid-2FA-secret");
  assert.deepEqual(base32Decode(base32Encode(source)), source);
});

test("verification token chỉ lưu SHA-256 hash", () => {
  const hash = hashVerificationToken("abc");
  assert.equal(hash.length, 64);
  assert.equal(hash, hashVerificationToken("abc"));
  assert.notEqual(hash, "abc");
});

test("identifier/email validation giữ contract login/register", () => {
  assert.equal(isPhoneIdentifier("+84901234567"), true);
  assert.equal(isPhoneIdentifier("user@example.com"), false);
  assert.equal(isValidEmail("user@example.com"), true);
  assert.equal(isValidEmail("invalid"), false);
});

test("Google access token audience chấp nhận schema mới và legacy", () => {
  assert.equal(
    hasGoogleAudience({ aud: "client-1" }, "client-1"),
    true,
  );
  assert.equal(
    hasGoogleAudience({ issued_to: "client-1" }, "client-1"),
    true,
  );
  assert.equal(
    hasGoogleAudience({ aud: "other" }, "client-1"),
    false,
  );
});

test("RBAC chỉ staff + permission hoặc super admin được phép", () => {
  const base = {
    id: 1,
    name: "Staff",
    email: "staff@example.com",
    role: "admin",
    claims: {
      user_type: "staff",
      is_super_admin: "false",
      permission: ["staff.view"],
    },
  };
  assert.equal(hasStaffPermission(base, "staff.view"), true);
  assert.equal(hasStaffPermission(base, "staff.manage"), false);

  const superAdmin = {
    ...base,
    claims: {
      user_type: "staff",
      is_super_admin: "true",
    },
  };
  assert.equal(isSuperAdmin(superAdmin), true);
  assert.equal(hasStaffPermission(superAdmin, "roles.manage"), true);

  const customer = {
    ...base,
    claims: {
      user_type: "customer",
      permission: ["staff.view"],
    },
  };
  assert.equal(hasStaffPermission(customer, "staff.view"), false);
});

test("activity parser và OTP cooldown giữ rule C#", () => {
  const ua = parseUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/154.0.0.0 Safari/537.36",
  );
  assert.equal(ua.browser, "Chrome");
  assert.equal(ua.os, "Windows 10/11");
  assert.equal(ua.deviceType, "Desktop");

  const now = new Date("2026-09-30T12:00:30Z");
  assert.equal(
    otpCooldownSeconds("2026-09-30T12:00:00Z", now),
    30,
  );
});
