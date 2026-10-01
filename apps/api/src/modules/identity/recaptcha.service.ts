import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  async verify(token: string, action?: string): Promise<boolean> {
    const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
    if (!secret) return true;
    if (!token.trim()) return false;

    const minScoreRaw = Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5);
    const minScore = Number.isFinite(minScoreRaw) ? minScoreRaw : 0.5;

    try {
      const body = new URLSearchParams({
        secret,
        response: token,
      });
      const response = await fetch(
        "https://www.google.com/recaptcha/api/siteverify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) return false;
      const result = await response.json() as Record<string, unknown>;
      if (result.success !== true) return false;
      if (action && result.action !== action) {
        return false;
      }
      return Number(result.score ?? 0) >= minScore;
    } catch (error) {
      this.logger.error(
        "Recaptcha verify exception",
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
}
