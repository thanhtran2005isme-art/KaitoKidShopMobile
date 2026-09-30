import { Injectable, Logger } from "@nestjs/common";

export interface GoogleUserInfo {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

function text(
  source: Record<string, unknown>,
  ...names: string[]
): string | null {
  for (const name of names) {
    const value = source[name];
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return null;
}

function bool(
  source: Record<string, unknown>,
  ...names: string[]
): boolean | null {
  for (const name of names) {
    const value = source[name];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (/^true$/i.test(value)) return true;
      if (/^false$/i.test(value)) return false;
    }
  }
  return null;
}

export function hasGoogleAudience(
  tokenInfo: Record<string, unknown>,
  expectedClientId: string,
): boolean {
  return ["aud", "azp", "audience", "issued_to"].some(
    (field) => text(tokenInfo, field) === expectedClientId,
  );
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  async verifyIdToken(idToken: string): Promise<GoogleUserInfo | null> {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId || !idToken.trim()) return null;

    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok) return null;
      const info = await response.json() as Record<string, unknown>;

      if (text(info, "aud") !== clientId) return null;
      const exp = Number(text(info, "exp"));
      if (Number.isFinite(exp) && exp * 1000 < Date.now()) return null;

      const subject = text(info, "sub");
      const email = text(info, "email");
      if (!subject || !email) return null;

      return {
        subject,
        email,
        emailVerified: bool(info, "email_verified") ?? false,
        name: text(info, "name") ?? email,
        picture: text(info, "picture"),
      };
    } catch (error) {
      this.logger.error(
        "Google ID token verify exception",
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  async verifyAccessToken(
    accessToken: string,
  ): Promise<GoogleUserInfo | null> {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId || !accessToken.trim()) return null;

    try {
      const tokenResponse = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!tokenResponse.ok) return null;
      const tokenInfo =
        await tokenResponse.json() as Record<string, unknown>;

      if (!hasGoogleAudience(tokenInfo, clientId)) return null;

      const expiresIn = Number(text(tokenInfo, "expires_in"));
      const exp = Number(text(tokenInfo, "exp"));
      const hasExpiresIn = Number.isFinite(expiresIn);
      const hasExp = Number.isFinite(exp);
      if (
        (hasExpiresIn && expiresIn <= 0) ||
        (hasExp && exp * 1000 <= Date.now()) ||
        (!hasExpiresIn && !hasExp)
      ) {
        return null;
      }

      const profileResponse = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!profileResponse.ok) return null;
      const profile =
        await profileResponse.json() as Record<string, unknown>;

      const subject = text(profile, "sub") ?? text(tokenInfo, "sub", "user_id");
      const email = text(profile, "email") ?? text(tokenInfo, "email");
      if (!subject || !email) return null;

      return {
        subject,
        email,
        emailVerified:
          bool(profile, "email_verified") ??
          bool(tokenInfo, "email_verified", "verified_email") ??
          false,
        name: text(profile, "name") ?? email,
        picture: text(profile, "picture"),
      };
    } catch (error) {
      this.logger.error(
        "Google access token verify exception",
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }
}
