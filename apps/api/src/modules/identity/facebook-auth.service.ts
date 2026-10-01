import { Injectable, Logger } from "@nestjs/common";

export interface FacebookUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

@Injectable()
export class FacebookAuthService {
  private readonly logger = new Logger(FacebookAuthService.name);

  async verifyAccessToken(
    accessToken: string,
  ): Promise<FacebookUserInfo | null> {
    if (!process.env.FACEBOOK_APP_ID?.trim() || !accessToken.trim()) {
      return null;
    }

    try {
      const response = await fetch(
        "https://graph.facebook.com/me" +
        `?fields=id,email,name,picture&access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!response.ok) return null;
      const info = await response.json() as Record<string, any>;
      if (!info.id) return null;

      return {
        id: String(info.id),
        email: typeof info.email === "string" ? info.email : "",
        name: typeof info.name === "string" ? info.name : "",
        picture:
          typeof info.picture?.data?.url === "string"
            ? info.picture.data.url
            : null,
      };
    } catch (error) {
      this.logger.error(
        "Facebook verify exception",
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }
}
