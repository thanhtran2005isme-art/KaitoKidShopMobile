import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChatIdentity } from "./chat.types.js";

type Payload = Record<string, unknown> & {
  exp?: number;
  iss?: string;
  aud?: string | string[];
};

const ID_KEYS = [
  "nameid",
  "sub",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
];

const NAME_KEYS = [
  "unique_name",
  "name",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
];

function first(payload: Payload, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function verify(token: string): Payload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = JSON.parse(
      Buffer.from(headerPart, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (header.alg !== "HS256") return null;

    const key = process.env.JWT_KEY;
    if (!key) return null;

    const expected = createHmac("sha256", key)
      .update(headerPart + "." + payloadPart)
      .digest();
    const actual = Buffer.from(signaturePart, "base64url");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as Payload;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp + 60 < now) return null;
    if (payload.iss !== (process.env.JWT_ISSUER ?? "KaitoKid.API.Auth")) {
      return null;
    }
    const audiences = Array.isArray(payload.aud)
      ? payload.aud
      : typeof payload.aud === "string"
        ? [payload.aud]
        : [];
    if (!audiences.includes(process.env.JWT_AUDIENCE ?? "KaitoKid.Client")) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function permissions(payload: Payload | null): string[] {
  const raw = payload?.permission;
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === "string");
  }
  return [];
}

function superAdmin(payload: Payload | null): boolean {
  return String(payload?.is_super_admin ?? "").toLowerCase() === "true";
}

export function resolveChatIdentity(
  authorization: string | undefined,
  guestId: string | null | undefined,
): ChatIdentity {
  const raw = authorization?.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  const payload = raw ? verify(raw) : null;
  const id = Number(payload ? first(payload, ID_KEYS) : Number.NaN);
  const isStaff = payload?.user_type === "staff";

  if (Number.isSafeInteger(id) && id > 0 && !isStaff) {
    return {
      userId: id,
      guestId: null,
      displayName: first(payload!, NAME_KEYS) ?? null,
      isStaff: false,
      superAdmin: false,
      permissions: [],
    };
  }

  return {
    userId: null,
    guestId: guestId?.trim() || null,
    displayName: null,
    isStaff: false,
    superAdmin: false,
    permissions: [],
  };
}

export function resolveSocketIdentity(
  token: unknown,
  guestId: unknown,
): ChatIdentity {
  const payload = typeof token === "string" ? verify(token) : null;
  const id = Number(payload ? first(payload, ID_KEYS) : Number.NaN);
  const isStaff = payload?.user_type === "staff";

  if (Number.isSafeInteger(id) && id > 0) {
    return {
      userId: id,
      guestId: null,
      displayName: first(payload!, NAME_KEYS) ?? null,
      isStaff,
      superAdmin: superAdmin(payload),
      permissions: permissions(payload),
    };
  }

  return {
    userId: null,
    guestId:
      typeof guestId === "string" && guestId.trim() ? guestId.trim() : null,
    displayName: null,
    isStaff: false,
    superAdmin: false,
    permissions: [],
  };
}
