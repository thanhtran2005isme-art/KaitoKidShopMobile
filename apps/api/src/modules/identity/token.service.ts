import { Injectable, UnauthorizedException } from "@nestjs/common";
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export interface JwtUserInput {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface JwtStaffInput {
  id: number;
  name: string;
  email: string;
  roleCode: string;
  superAdmin: boolean;
  permissions: string[];
}

type JwtPayload = Record<string, unknown> & {
  exp?: number;
  iss?: string;
  aud?: string | string[];
};

function config() {
  const key = process.env.JWT_KEY;
  if (!key || key === "CHANGE_ME") {
    throw new UnauthorizedException(
      "Node API chưa được cấu hình JWT_KEY tương thích C#.",
    );
  }
  const expiryMinutes = Number(process.env.JWT_EXPIRY_MINUTES ?? 60);
  return {
    key,
    issuer: process.env.JWT_ISSUER ?? "KaitoKid.API.Auth",
    audience: process.env.JWT_AUDIENCE ?? "KaitoKid.Client",
    expiryMinutes:
      Number.isFinite(expiryMinutes) && expiryMinutes > 0
        ? Math.floor(expiryMinutes)
        : 60,
  };
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function signHs256(
  payload: Record<string, unknown>,
  key: string,
): string {
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const body = encodeJson(payload);
  const signature = createHmac("sha256", key)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("JWT không hợp lệ");
  return JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf8"),
  ) as JwtPayload;
}

export function verifyGeneratedJwt(
  token: string,
  key: string,
): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const expected = createHmac("sha256", key)
    .update(`${parts[0]}.${parts[1]}`)
    .digest();
  const actual = Buffer.from(parts[2], "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

@Injectable()
export class TokenService {
  issueUser(user: JwtUserInput) {
    const cfg = config();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date(
      (now + cfg.expiryMinutes * 60) * 1000,
    );
    const accessToken = signHs256(
      {
        nameid: String(user.id),
        unique_name: user.name,
        email: user.email,
        role: user.role,
        jti: randomUUID(),
        iss: cfg.issuer,
        aud: cfg.audience,
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
      cfg.key,
    );
    return { accessToken, expiresAt };
  }

  issueStaff(staff: JwtStaffInput) {
    const cfg = config();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date(
      (now + cfg.expiryMinutes * 60) * 1000,
    );
    const permissions = [...new Set(staff.permissions)];
    const accessToken = signHs256(
      {
        nameid: String(staff.id),
        unique_name: staff.name,
        email: staff.email,
        role: staff.superAdmin ? "admin" : staff.roleCode,
        user_type: "staff",
        is_super_admin: staff.superAdmin ? "true" : "false",
        ...(permissions.length > 0 ? { permission: permissions } : {}),
        jti: randomUUID(),
        iss: cfg.issuer,
        aud: cfg.audience,
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
      cfg.key,
    );
    return { accessToken, expiresAt };
  }

  refreshToken(): string {
    return randomBytes(64).toString("base64");
  }
}
