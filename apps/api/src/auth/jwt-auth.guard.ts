import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthenticatedUser } from "./authenticated-user.js";

type JwtPayload = Record<string, unknown> & {
  exp?: number;
  nbf?: number;
  iss?: string;
  aud?: string | string[];
};

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

function firstClaim(payload: JwtPayload, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function decodeBase64UrlJson<T>(value: string): T {
  const text = Buffer.from(value, "base64url").toString("utf8");
  return JSON.parse(text) as T;
}

function verifyHs256(
  token: string,
  key: string,
  expectedIssuer: string,
  expectedAudience: string,
): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new UnauthorizedException();

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeBase64UrlJson<Record<string, unknown>>(encodedHeader);
  if (header.alg !== "HS256") throw new UnauthorizedException();

  const expectedSignature = createHmac("sha256", key)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  const actualSignature = Buffer.from(encodedSignature, "base64url");
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new UnauthorizedException();
  }

  const payload = decodeBase64UrlJson<JwtPayload>(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  const tolerance = 60;

  if (typeof payload.exp !== "number" || payload.exp + tolerance < now) {
    throw new UnauthorizedException();
  }
  if (typeof payload.nbf === "number" && payload.nbf - tolerance > now) {
    throw new UnauthorizedException();
  }
  if (payload.iss !== expectedIssuer) {
    throw new UnauthorizedException();
  }

  const audiences = Array.isArray(payload.aud)
    ? payload.aud
    : typeof payload.aud === "string"
      ? [payload.aud]
      : [];
  if (!audiences.includes(expectedAudience)) {
    throw new UnauthorizedException();
  }

  return payload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();

    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException();

    const key = process.env.JWT_KEY;
    if (!key || key === "CHANGE_ME") {
      throw new UnauthorizedException("Node API chưa được cấu hình JWT_KEY tương thích C#.");
    }

    try {
      const token = header.slice("Bearer ".length).trim();
      const payload = verifyHs256(
        token,
        key,
        process.env.JWT_ISSUER ?? "KaitoKid.API.Auth",
        process.env.JWT_AUDIENCE ?? "KaitoKid.Client",
      );

      const rawId = firstClaim(payload, NAME_ID_KEYS);
      const id = Number(rawId);
      if (!Number.isSafeInteger(id) || id <= 0) throw new UnauthorizedException();

      request.user = {
        id,
        name: firstClaim(payload, NAME_KEYS) ?? "Khách hàng",
        email: firstClaim(payload, EMAIL_KEYS),
        role: firstClaim(payload, ROLE_KEYS),
        claims: { ...payload },
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException();
    }
  }
}
