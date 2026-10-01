import { createHmac, timingSafeEqual } from "node:crypto";

export interface OptionalJwtUser {
  id: number;
  name?: string;
  email?: string;
  role?: string;
  claims: Record<string, unknown>;
}

const NAME_ID_KEYS = [
  "nameid",
  "sub",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
] as const;
const NAME_KEYS = [
  "unique_name",
  "name",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
] as const;
const EMAIL_KEYS = [
  "email",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
] as const;
const ROLE_KEYS = [
  "role",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
] as const;

function first(payload: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

export function tryAuthenticateBearer(
  rawAuthorization: string | null | undefined,
): OptionalJwtUser | null {
  if (!rawAuthorization?.startsWith("Bearer ")) return null;
  const key = process.env.JWT_KEY;
  if (!key || key === "CHANGE_ME") return null;

  try {
    const token = rawAuthorization.slice(7).trim();
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (header.alg !== "HS256") return null;

    const expected = createHmac("sha256", key)
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    const actual = Buffer.from(parts[2], "base64url");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp) || exp + 60 < now) return null;
    if (
      typeof payload.nbf === "number" &&
      payload.nbf - 60 > now
    ) {
      return null;
    }
    const issuer = process.env.JWT_ISSUER ?? "KaitoKid.API.Auth";
    const audience = process.env.JWT_AUDIENCE ?? "KaitoKid.Client";
    if (payload.iss !== issuer) return null;
    const audiences = Array.isArray(payload.aud)
      ? payload.aud
      : typeof payload.aud === "string"
        ? [payload.aud]
        : [];
    if (!audiences.includes(audience)) return null;

    const id = Number(first(payload, NAME_ID_KEYS));
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return {
      id,
      name: first(payload, NAME_KEYS),
      email: first(payload, EMAIL_KEYS),
      role: first(payload, ROLE_KEYS),
      claims: payload,
    };
  } catch {
    return null;
  }
}
