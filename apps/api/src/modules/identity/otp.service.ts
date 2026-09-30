import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { randomInt } from "node:crypto";
import { toNumber } from "../../common/db-value.js";
import { PrismaService } from "../../database/prisma.service.js";
import { AuthEmailService } from "./email.service.js";

interface OtpRow {
  id: unknown;
  code: string;
  expiresAt: Date | string;
  verifiedAt: Date | string | null;
  attemptCount: unknown;
  createdAt: Date | string;
}

export function otpCooldownSeconds(
  createdAt: Date | string,
  now = new Date(),
): number {
  const elapsed =
    (now.getTime() - new Date(createdAt).getTime()) / 1000;
  return Math.max(0, 60 - Math.trunc(elapsed));
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: AuthEmailService,
  ) {}

  async generateAndSend(
    identifierRaw: string,
    channel: string,
    purpose: string,
  ): Promise<string> {
    const identifier = identifierRaw.trim().toLowerCase();
    if (!identifier) {
      throw new BadRequestException({ message: "Identifier không hợp lệ." });
    }

    const code = String(randomInt(100_000, 1_000_000));
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<OtpRow[]>(
        `SELECT Id AS id, Code AS code, ExpiresAt AS expiresAt,
                VerifiedAt AS verifiedAt, AttemptCount AS attemptCount,
                CreatedAt AS createdAt
         FROM OtpCode
         WHERE Identifier = ? AND Purpose = ?
         ORDER BY CreatedAt DESC
         LIMIT 1
         FOR UPDATE`,
        identifier,
        purpose,
      );
      const previous = rows[0];
      if (previous && !previous.verifiedAt) {
        const wait = otpCooldownSeconds(previous.createdAt, now);
        if (wait > 0) return { wait };
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO OtpCode
           (Identifier, Channel, Purpose, Code, ExpiresAt, AttemptCount)
         VALUES (?, ?, ?, ?, ?, 0)`,
        identifier,
        channel,
        purpose,
        code,
        new Date(now.getTime() + 5 * 60_000),
      );
      return { wait: 0 };
    });

    if (result.wait > 0) {
      throw new BadRequestException({
        message:
          `Vui lòng đợi ${result.wait} giây trước khi gửi lại OTP.`,
      });
    }

    if (channel === "email") {
      const subject =
        purpose === "register"
          ? "[KaitoKid] Mã xác thực đăng ký tài khoản"
          : purpose === "reset_password"
            ? "[KaitoKid] Mã đặt lại mật khẩu"
            : "[KaitoKid] Mã xác thực";
      await this.email.send(
        identifier,
        subject,
        `<p>Mã OTP KaitoKid của bạn:</p>
         <p style="font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
         <p>Mã có hiệu lực trong 5 phút. Không chia sẻ mã này.</p>`,
      );
    } else {
      this.logger.log(`[OTP-SMS-MOCK] ${identifier} → code ${code}`);
    }

    return code;
  }

  async verify(
    identifierRaw: string,
    purpose: string,
    code: string,
  ): Promise<boolean> {
    const identifier = identifierRaw.trim().toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<OtpRow[]>(
        `SELECT Id AS id, Code AS code, ExpiresAt AS expiresAt,
                VerifiedAt AS verifiedAt, AttemptCount AS attemptCount,
                CreatedAt AS createdAt
         FROM OtpCode
         WHERE Identifier = ? AND Purpose = ? AND VerifiedAt IS NULL
         ORDER BY CreatedAt DESC
         LIMIT 1
         FOR UPDATE`,
        identifier,
        purpose,
      );
      const otp = rows[0];
      if (!otp) return false;
      if (new Date(otp.expiresAt) < new Date()) return false;
      if (toNumber(otp.attemptCount) >= 5) return false;

      await tx.$executeRawUnsafe(
        "UPDATE OtpCode SET AttemptCount = AttemptCount + 1 WHERE Id = ?",
        toNumber(otp.id),
      );

      if (otp.code !== code) return false;

      await tx.$executeRawUnsafe(
        "UPDATE OtpCode SET VerifiedAt = ? WHERE Id = ?",
        new Date(),
        toNumber(otp.id),
      );
      return true;
    });
  }
}
