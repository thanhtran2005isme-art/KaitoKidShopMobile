import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createHash,
  randomBytes,
} from "node:crypto";
import { toBoolean, toNumber } from "../../common/db-value.js";
import type { SqlClient } from "../../common/sql-client.js";
import { PrismaService } from "../../database/prisma.service.js";
import { FacebookAuthService } from "./facebook-auth.service.js";
import { GoogleAuthService } from "./google-auth.service.js";
import { LoginActivityService } from "./login-activity.service.js";
import { OtpService } from "./otp.service.js";
import {
  hashPassword,
  verifyBcryptOnly,
  verifyPassword,
} from "./password.js";
import { RecaptchaService } from "./recaptcha.service.js";
import { AuthEmailService } from "./email.service.js";
import { TokenService } from "./token.service.js";
import { TwoFactorService } from "./two-factor.service.js";
import type { LoginRequestMeta } from "./user-agent.js";

interface UserRow {
  id: unknown;
  name: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  avatar: string | null;
  role: string;
  refreshToken: string | null;
  refreshTokenExpiry: Date | string | null;
  emailVerified: unknown;
  phoneVerified: unknown;
  provider: string | null;
  providerId: string | null;
  twoFactorEnabled: unknown;
  twoFactorSecret: string | null;
  failedAttempts: unknown;
  lockedUntil: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

interface PendingRow {
  id: unknown;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  expiresAt: Date | string;
}

interface LegacyVerifyRow {
  id: unknown;
  userId: unknown;
}

interface PasswordResetRow {
  id: unknown;
  userId: unknown;
}

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isPhoneIdentifier(value: string): boolean {
  return /^[0-9+.-]+$/.test(value);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return /^(1|true|yes)$/i.test(raw);
}

function numberEnv(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

@Injectable()
export class UserAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly recaptcha: RecaptchaService,
    private readonly otp: OtpService,
    private readonly email: AuthEmailService,
    private readonly google: GoogleAuthService,
    private readonly facebook: FacebookAuthService,
    private readonly twoFactor: TwoFactorService,
    private readonly activity: LoginActivityService,
  ) {}

  async register(body: Record<string, unknown>) {
    const name = this.text(body.name);
    const email = this.text(body.email).toLowerCase();
    const phone = this.text(body.phone) || null;
    const password =
      typeof body.password === "string" ? body.password : "";
    const otpCode =
      typeof body.otpCode === "string" ? body.otpCode : "";
    const recaptchaToken =
      typeof body.recaptchaToken === "string"
        ? body.recaptchaToken
        : "";

    if (this.requireRecaptcha()) {
      const ok = await this.recaptcha.verify(
        recaptchaToken,
        "register",
      );
      if (!ok) {
        throw new BadRequestException({
          message: "Bạn có vẻ là bot. Vui lòng thử lại.",
        });
      }
    }

    if (!name) {
      throw new BadRequestException({
        message: "Tên không được để trống",
      });
    }
    if (!email || !isValidEmail(email)) {
      throw new BadRequestException({
        message: "Email không hợp lệ",
      });
    }
    if (!password || password.length < 6) {
      throw new BadRequestException({
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    const exists = await this.prisma.$queryRawUnsafe<Array<{ id: unknown }>>(
      "SELECT Id AS id FROM NguoiDung WHERE Email = ? LIMIT 1",
      email,
    );
    if (exists[0]) {
      throw new BadRequestException({
        message: "Email đã được sử dụng",
      });
    }

    if (this.requireOtp()) {
      if (!otpCode.trim()) {
        throw new BadRequestException({
          message: "Vui lòng nhập mã OTP đã gửi tới email.",
        });
      }
      const verified = await this.otp.verify(
        email,
        "register",
        otpCode,
      );
      if (!verified) {
        throw new BadRequestException({
          message: "Mã OTP không đúng hoặc đã hết hạn.",
        });
      }
    }

    const now = new Date();
    const verifyHours = numberEnv(
      "AUTH_REGISTRATION_VERIFICATION_HOURS",
      24,
      1,
      168,
    );
    const expiresAt = new Date(
      now.getTime() + verifyHours * 60 * 60_000,
    );
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashVerificationToken(rawToken);
    const passwordHash = await hashPassword(password);

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO PendingRegistration
         (HoTen, Email, SoDienThoai, MatKhauHash,
          TokenHash, ExpiresAt, CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
         HoTen = VALUES(HoTen),
         SoDienThoai = VALUES(SoDienThoai),
         MatKhauHash = VALUES(MatKhauHash),
         TokenHash = VALUES(TokenHash),
         ExpiresAt = VALUES(ExpiresAt),
         UpdatedAt = VALUES(CreatedAt)`,
      name,
      email,
      phone,
      passwordHash,
      tokenHash,
      expiresAt,
      now,
    );

    const verifyBase =
      process.env.AUTH_EMAIL_VERIFY_URL ??
      "http://localhost:5173/verify-email";
    const separator = verifyBase.includes("?") ? "&" : "?";
    const verifyUrl =
      `${verifyBase}${separator}token=${encodeURIComponent(rawToken)}`;

    await this.email.send(
      email,
      "[KaitoKid] Xác nhận đăng ký tài khoản",
      this.emailTemplate(
        "Xác nhận đăng ký",
        `<p>Bạn vừa yêu cầu đăng ký tài khoản KaitoKid bằng email <strong>${this.escapeHtml(email)}</strong>.</p>
         <p><strong>Tài khoản chưa được tạo.</strong> Hãy mở liên kết dưới đây để xác nhận email và hoàn tất tạo tài khoản.</p>
         <p><a href="${this.escapeHtml(verifyUrl)}">Xác nhận và tạo tài khoản</a></p>
         <p>Link có hiệu lực trong ${verifyHours} giờ.</p>
         <p>${this.escapeHtml(verifyUrl)}</p>`,
      ),
    );

    return {
      message:
        "Đã gửi email xác nhận. Tài khoản chỉ được tạo sau khi bạn mở liên kết xác nhận trong email.",
      email,
      expiresAt,
      requiresEmailVerification: true,
    };
  }

  async login(
    body: Record<string, unknown>,
    meta?: LoginRequestMeta,
  ) {
    const identifier =
      typeof body.identifier === "string"
        ? body.identifier.trim()
        : "";
    const password =
      typeof body.password === "string" ? body.password : "";
    const recaptchaToken =
      typeof body.recaptchaToken === "string"
        ? body.recaptchaToken
        : "";

    if (this.requireRecaptcha()) {
      const ok = await this.recaptcha.verify(
        recaptchaToken,
        "login",
      );
      if (!ok) {
        throw new BadRequestException({
          message: "Vui lòng thử lại.",
        });
      }
    }

    if (!identifier || !password) {
      throw new UnauthorizedException({
        message: "Thiếu thông tin đăng nhập",
      });
    }

    const normalized = identifier.toLowerCase();
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await this.findUserByIdentifier(
        tx,
        identifier,
        true,
      );
      if (!user) {
        return {
          error: "Tài khoản hoặc mật khẩu không đúng",
          activityUserId: null as number | null,
          activityEmail: identifier,
          failReason: "Tài khoản không tồn tại",
        };
      }

      const now = new Date();
      if (
        user.lockedUntil &&
        new Date(user.lockedUntil).getTime() > now.getTime()
      ) {
        const remaining =
          Math.trunc(
            (new Date(user.lockedUntil).getTime() - now.getTime()) /
              60_000,
          ) + 1;
        return {
          error:
            `Tài khoản tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${remaining} phút.`,
          activityUserId: toNumber(user.id),
          activityEmail: user.email,
          failReason: "Tài khoản đang bị khóa",
        };
      }

      if (!user.passwordHash) {
        return {
          error:
            "Tài khoản này được tạo qua Google/Facebook. Hãy đăng nhập qua nút tương ứng.",
          activityUserId: toNumber(user.id),
          activityEmail: user.email,
          failReason: "Account social — không có password",
        };
      }

      const passwordResult = await verifyPassword(
        password,
        user.passwordHash,
        true,
      );

      if (!passwordResult.valid) {
        const attempt = toNumber(user.failedAttempts) + 1;
        const maxAttempts = numberEnv(
          "AUTH_MAX_FAILED_ATTEMPTS",
          5,
          1,
          20,
        );
        if (attempt >= maxAttempts) {
          const lockMinutes = numberEnv(
            "AUTH_LOCKOUT_MINUTES",
            15,
            1,
            1440,
          );
          await tx.$executeRawUnsafe(
            `UPDATE NguoiDung
             SET SoLanDangNhapSai = 0, BiKhoaDenLuc = ?
             WHERE Id = ?`,
            new Date(now.getTime() + lockMinutes * 60_000),
            toNumber(user.id),
          );
          return {
            error:
              `Sai quá ${maxAttempts} lần. Tài khoản bị khóa ${lockMinutes} phút.`,
            activityUserId: toNumber(user.id),
            activityEmail: user.email,
            failReason: `Bị khóa ${lockMinutes} phút`,
          };
        }

        await tx.$executeRawUnsafe(
          "UPDATE NguoiDung SET SoLanDangNhapSai = ? WHERE Id = ?",
          attempt,
          toNumber(user.id),
        );
        return {
          error:
            `Mật khẩu không đúng. Còn ${maxAttempts - attempt} lần thử trước khi tài khoản bị khóa.`,
          activityUserId: toNumber(user.id),
          activityEmail: user.email,
          failReason: `Sai mật khẩu (lần ${attempt})`,
        };
      }

      let passwordHash = user.passwordHash;
      if (passwordResult.needsRehash) {
        passwordHash = await hashPassword(password);
      }
      await tx.$executeRawUnsafe(
        `UPDATE NguoiDung
         SET SoLanDangNhapSai = 0, BiKhoaDenLuc = NULL,
             MatKhauHash = ?
         WHERE Id = ?`,
        passwordHash,
        toNumber(user.id),
      );
      user.passwordHash = passwordHash;
      user.failedAttempts = 0;
      user.lockedUntil = null;

      if (toBoolean(user.twoFactorEnabled)) {
        return {
          twoFactor: true as const,
          user: this.userInfo(user),
        };
      }

      const token = await this.issueTokens(tx, user);
      return {
        twoFactor: false as const,
        token,
        activityUserId: toNumber(user.id),
        activityEmail: user.email,
      };
    });

    if ("error" in result) {
      await this.activity.log(
        result.activityUserId,
        result.activityEmail,
        "local",
        false,
        result.failReason,
        meta,
      );
      throw new UnauthorizedException({ message: result.error });
    }

    if (result.twoFactor) {
      return {
        accessToken: "",
        refreshToken: "",
        expiresAt: new Date(),
        twoFactorRequired: true,
        user: result.user,
      };
    }

    await this.activity.log(
      result.activityUserId,
      result.activityEmail,
      "local",
      true,
      null,
      meta,
    );
    return result.token;
  }

  async loginTwoFactor(
    body: Record<string, unknown>,
    meta?: LoginRequestMeta,
  ) {
    const identifier = this.text(body.identifier);
    const password =
      typeof body.password === "string" ? body.password : "";
    const code = this.text(body.code);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await this.findUserByIdentifier(
        tx,
        identifier,
        true,
      );
      if (!user) {
        return { error: "Tài khoản không hợp lệ", user: null };
      }
      if (
        !user.passwordHash ||
        !(await verifyBcryptOnly(password, user.passwordHash))
      ) {
        return { error: "Sai mật khẩu", user: null };
      }
      if (
        !toBoolean(user.twoFactorEnabled) ||
        !user.twoFactorSecret
      ) {
        return { error: "Tài khoản chưa bật 2FA", user: null };
      }
      if (!this.twoFactor.verifyCode(user.twoFactorSecret, code)) {
        return {
          error: "Mã 2FA không đúng hoặc đã hết hạn.",
          user,
        };
      }

      return {
        error: null,
        user,
        token: await this.issueTokens(tx, user),
      };
    });

    if (result.error) {
      if (result.user && result.error.startsWith("Mã 2FA")) {
        await this.activity.log(
          toNumber(result.user.id),
          result.user.email,
          "local",
          false,
          "Sai mã 2FA",
          meta,
        );
      }
      throw new UnauthorizedException({ message: result.error });
    }

    await this.activity.log(
      toNumber(result.user!.id),
      result.user!.email,
      "local+2fa",
      true,
      null,
      meta,
    );
    return result.token!;
  }

  async refresh(refreshToken: string) {
    if (!refreshToken.trim()) {
      throw new UnauthorizedException({
        message: "Refresh token không hợp lệ hoặc đã hết hạn",
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<UserRow[]>(
        `${this.userSelect()}
         WHERE RefreshToken = ?
           AND HanRefreshToken > ?
         LIMIT 1
         FOR UPDATE`,
        refreshToken,
        new Date(),
      );
      if (!rows[0]) return null;
      return this.issueTokens(tx, rows[0]);
    });

    if (!result) {
      throw new UnauthorizedException({
        message: "Refresh token không hợp lệ hoặc đã hết hạn",
      });
    }
    return result;
  }

  async changePassword(
    userId: number,
    body: Record<string, unknown>,
  ): Promise<void> {
    const currentPassword =
      typeof body.currentPassword === "string"
        ? body.currentPassword
        : "";
    const newPassword =
      typeof body.newPassword === "string"
        ? body.newPassword
        : "";

    await this.prisma.$transaction(async (tx) => {
      const user = await this.findUserById(tx, userId, true);
      if (!user) {
        throw new BadRequestException({
          message: "Không tìm thấy tài khoản",
        });
      }
      if (!user.passwordHash) {
        throw new BadRequestException({
          message: "Tài khoản social không có mật khẩu để đổi.",
        });
      }
      if (
        !(await verifyBcryptOnly(
          currentPassword,
          user.passwordHash,
        ))
      ) {
        throw new BadRequestException({
          message: "Mật khẩu hiện tại không đúng",
        });
      }
      if (!newPassword.trim() || newPassword.length < 6) {
        throw new BadRequestException({
          message: "Mật khẩu mới phải có ít nhất 6 ký tự",
        });
      }

      const hash = await hashPassword(newPassword);
      await tx.$executeRawUnsafe(
        `UPDATE NguoiDung
         SET MatKhauHash = ?, NgayCapNhat = ?,
             RefreshToken = NULL, HanRefreshToken = NULL
         WHERE Id = ?`,
        hash,
        new Date(),
        userId,
      );
    });
  }

  async profile(userId: number) {
    const user = await this.findUserById(
      this.prisma,
      userId,
      false,
    );
    if (!user) {
      throw new NotFoundException({
        message: "Không tìm thấy tài khoản",
      });
    }
    return this.userInfo(user);
  }

  async requestPasswordReset(emailRaw: string): Promise<void> {
    const email = emailRaw.trim().toLowerCase();
    const rows = await this.prisma.$queryRawUnsafe<UserRow[]>(
      `${this.userSelect()}
       WHERE Email = ?
       LIMIT 1`,
      email,
    );
    const user = rows[0];
    if (!user) return;

    const token = randomBytes(32).toString("hex");
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO PasswordResetToken
         (UserId, Email, Token, ExpiresAt, CreatedAt)
       VALUES (?, ?, ?, ?, ?)`,
      toNumber(user.id),
      user.email,
      token,
      new Date(Date.now() + 30 * 60_000),
      new Date(),
    );

    const resetBase =
      process.env.AUTH_RESET_PASSWORD_URL ??
      "http://localhost:5173/reset-password";
    const url =
      `${resetBase}?token=${encodeURIComponent(token)}`;
    await this.email.send(
      user.email,
      "[KaitoKid] Đặt lại mật khẩu",
      this.emailTemplate(
        "Đặt lại mật khẩu",
        `<p>Mở liên kết dưới đây để đặt lại mật khẩu:</p>
         <p><a href="${this.escapeHtml(url)}">Đặt lại mật khẩu</a></p>
         <p>Link có hiệu lực trong 30 phút.</p>
         <p>${this.escapeHtml(url)}</p>`,
      ),
    );
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<void> {
    if (!newPassword.trim() || newPassword.length < 6) {
      throw new BadRequestException({
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<PasswordResetRow[]>(
        `SELECT Id AS id, UserId AS userId
         FROM PasswordResetToken
         WHERE Token = ?
           AND UsedAt IS NULL
           AND ExpiresAt > ?
         LIMIT 1
         FOR UPDATE`,
        token,
        new Date(),
      );
      const record = rows[0];
      if (!record) {
        throw new BadRequestException({
          message: "Link đặt lại không hợp lệ hoặc đã hết hạn.",
        });
      }

      const user = await this.findUserById(
        tx,
        toNumber(record.userId),
        true,
      );
      if (!user) {
        throw new BadRequestException({
          message: "Tài khoản không tồn tại",
        });
      }

      const hash = await hashPassword(newPassword);
      const now = new Date();
      await tx.$executeRawUnsafe(
        `UPDATE NguoiDung
         SET MatKhauHash = ?, NgayCapNhat = ?,
             RefreshToken = NULL, HanRefreshToken = NULL,
             SoLanDangNhapSai = 0, BiKhoaDenLuc = NULL
         WHERE Id = ?`,
        hash,
        now,
        toNumber(user.id),
      );
      await tx.$executeRawUnsafe(
        "UPDATE PasswordResetToken SET UsedAt = ? WHERE Id = ?",
        now,
        toNumber(record.id),
      );
    });
  }

  async sendVerifyEmail(userId: number): Promise<void> {
    const user = await this.findUserById(
      this.prisma,
      userId,
      false,
    );
    if (!user || toBoolean(user.emailVerified)) return;

    const token = randomBytes(32).toString("hex");
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO EmailVerificationToken
         (UserId, Email, Token, ExpiresAt, CreatedAt)
       VALUES (?, ?, ?, ?, ?)`,
      userId,
      user.email,
      token,
      new Date(Date.now() + 24 * 60 * 60_000),
      new Date(),
    );

    const base =
      process.env.AUTH_EMAIL_VERIFY_URL ??
      "http://localhost:5173/verify-email";
    const separator = base.includes("?") ? "&" : "?";
    const url =
      `${base}${separator}token=${encodeURIComponent(token)}`;
    await this.email.send(
      user.email,
      "[KaitoKid] Xác thực địa chỉ email",
      this.emailTemplate(
        "Xác thực email",
        `<p>Vui lòng mở liên kết dưới đây để xác thực email KaitoKid.</p>
         <p><a href="${this.escapeHtml(url)}">Xác thực email</a></p>
         <p>Link có hiệu lực trong 24 giờ.</p>
         <p>${this.escapeHtml(url)}</p>`,
      ),
    );
  }

  async verifyEmail(token: string) {
    if (!token.trim()) {
      throw new BadRequestException({
        message: "Link xác thực không hợp lệ.",
      });
    }

    const pendingResult = await this.verifyPendingRegistration(
      token,
    );
    if (pendingResult) {
      if (pendingResult.createdUserId) {
        await this.activity.log(
          pendingResult.createdUserId,
          pendingResult.email!,
          "local",
          true,
          "register-email-verified",
        );
      }
      if (pendingResult.error) {
        throw new BadRequestException({
          message: pendingResult.error,
        });
      }
      return pendingResult.message!;
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<LegacyVerifyRow[]>(
        `SELECT Id AS id, UserId AS userId
         FROM EmailVerificationToken
         WHERE Token = ?
           AND VerifiedAt IS NULL
           AND ExpiresAt > ?
         LIMIT 1
         FOR UPDATE`,
        token,
        new Date(),
      );
      const record = rows[0];
      if (!record) {
        throw new BadRequestException({
          message:
            "Link xác thực không hợp lệ, đã được sử dụng hoặc đã hết hạn.",
        });
      }
      const user = await this.findUserById(
        tx,
        toNumber(record.userId),
        true,
      );
      if (!user) {
        throw new BadRequestException({
          message: "Tài khoản không tồn tại",
        });
      }
      const now = new Date();
      await tx.$executeRawUnsafe(
        "UPDATE NguoiDung SET EmailDaXacThuc = 1 WHERE Id = ?",
        toNumber(user.id),
      );
      await tx.$executeRawUnsafe(
        "UPDATE EmailVerificationToken SET VerifiedAt = ? WHERE Id = ?",
        now,
        toNumber(record.id),
      );
      return "Xác thực email thành công. Bạn có thể đăng nhập.";
    });
  }

  async googleLogin(
    idToken: string | null,
    accessToken: string | null,
    meta?: LoginRequestMeta,
  ) {
    const info = idToken?.trim()
      ? await this.google.verifyIdToken(idToken)
      : accessToken?.trim()
        ? await this.google.verifyAccessToken(accessToken)
        : null;
    if (!info) {
      throw new UnauthorizedException({
        message: "Token Google không hợp lệ",
      });
    }
    if (!info.emailVerified) {
      throw new UnauthorizedException({
        message: "Email Google chưa xác thực",
      });
    }

    const result = await this.upsertSocialAndIssue(
      info.email,
      info.name,
      info.picture,
      "google",
      info.subject,
    );
    await this.activity.log(
      result.user.id,
      result.user.email,
      "google",
      true,
      null,
      meta,
    );
    return result.token;
  }

  async facebookLogin(
    accessToken: string,
    meta?: LoginRequestMeta,
  ) {
    const info =
      await this.facebook.verifyAccessToken(accessToken);
    if (!info) {
      throw new UnauthorizedException({
        message: "Token Facebook không hợp lệ",
      });
    }
    if (!info.email) {
      throw new UnauthorizedException({
        message:
          "Vui lòng cấp quyền email cho Facebook để đăng nhập.",
      });
    }

    const result = await this.upsertSocialAndIssue(
      info.email,
      info.name,
      info.picture,
      "facebook",
      info.id,
    );
    await this.activity.log(
      result.user.id,
      result.user.email,
      "facebook",
      true,
      null,
      meta,
    );
    return result.token;
  }

  async setupTwoFactor(userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const user = await this.findUserById(tx, userId, true);
      if (!user) {
        throw new BadRequestException({
          message: "Không tìm thấy tài khoản",
        });
      }
      const setup = this.twoFactor.generateSetup(user.email);
      await tx.$executeRawUnsafe(
        "UPDATE NguoiDung SET TwoFactorSecret = ? WHERE Id = ?",
        setup.secret,
        userId,
      );
      return {
        secret: setup.secret,
        otpAuthUri: setup.otpAuthUri,
      };
    });
  }

  async enableTwoFactor(userId: number, code: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await this.findUserById(tx, userId, true);
      if (
        !user ||
        !user.twoFactorSecret ||
        !this.twoFactor.verifyCode(user.twoFactorSecret, code)
      ) {
        return false;
      }
      await tx.$executeRawUnsafe(
        "UPDATE NguoiDung SET TwoFactorEnabled = 1 WHERE Id = ?",
        userId,
      );
      return true;
    });
  }

  async disableTwoFactor(userId: number, code: string) {
    return this.prisma.$transaction(async (tx) => {
      const user = await this.findUserById(tx, userId, true);
      if (
        !user ||
        !toBoolean(user.twoFactorEnabled) ||
        !user.twoFactorSecret ||
        !this.twoFactor.verifyCode(user.twoFactorSecret, code)
      ) {
        return false;
      }
      await tx.$executeRawUnsafe(
        `UPDATE NguoiDung
         SET TwoFactorEnabled = 0, TwoFactorSecret = NULL
         WHERE Id = ?`,
        userId,
      );
      return true;
    });
  }

  getActivity(userId: number) {
    return this.activity.getByUser(userId);
  }

  private async verifyPendingRegistration(token: string) {
    const tokenHash = hashVerificationToken(token);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<PendingRow[]>(
        `SELECT
           Id AS id, HoTen AS name, Email AS email,
           SoDienThoai AS phone, MatKhauHash AS passwordHash,
           ExpiresAt AS expiresAt
         FROM PendingRegistration
         WHERE TokenHash = ?
         LIMIT 1
         FOR UPDATE`,
        tokenHash,
      );
      const pending = rows[0];
      if (!pending) return null;

      if (
        new Date(pending.expiresAt).getTime() <= Date.now()
      ) {
        await tx.$executeRawUnsafe(
          "DELETE FROM PendingRegistration WHERE Id = ?",
          toNumber(pending.id),
        );
        return {
          error:
            "Link xác nhận đã hết hạn. Vui lòng đăng ký lại để nhận email mới.",
          message: null,
          createdUserId: null,
          email: pending.email,
        };
      }

      const existing = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT Id AS id FROM NguoiDung WHERE Email = ? LIMIT 1 FOR UPDATE",
        pending.email,
      );
      if (existing[0]) {
        await tx.$executeRawUnsafe(
          "DELETE FROM PendingRegistration WHERE Id = ?",
          toNumber(pending.id),
        );
        return {
          error: null,
          message:
            "Email này đã có tài khoản KaitoKid. Bạn có thể đăng nhập.",
          createdUserId: null,
          email: pending.email,
        };
      }

      const now = new Date();
      await tx.$executeRawUnsafe(
        `INSERT INTO NguoiDung
           (HoTen, Email, MatKhauHash, SoDienThoai, VaiTro,
            EmailDaXacThuc, NhaCungCap, NgayTao)
         VALUES (?, ?, ?, ?, 'user', 1, 'local', ?)`,
        pending.name,
        pending.email,
        pending.passwordHash,
        pending.phone,
        now,
      );
      const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
        "SELECT LAST_INSERT_ID() AS id",
      );
      const id = toNumber(ids[0]?.id);
      await tx.$executeRawUnsafe(
        "DELETE FROM PendingRegistration WHERE Id = ?",
        toNumber(pending.id),
      );

      return {
        error: null,
        message:
          "Xác thực email thành công. Tài khoản KaitoKid đã được tạo. Bạn có thể đăng nhập.",
        createdUserId: id,
        email: pending.email,
      };
    });
  }

  private async upsertSocialAndIssue(
    emailRaw: string,
    name: string,
    picture: string | null,
    provider: string,
    providerId: string,
  ) {
    const email = emailRaw.trim().toLowerCase();
    return this.prisma.$transaction(async (tx) => {
      let user = (
        await tx.$queryRawUnsafe<UserRow[]>(
          `${this.userSelect()}
           WHERE Email = ?
           LIMIT 1
           FOR UPDATE`,
          email,
        )
      )[0];

      if (!user) {
        const now = new Date();
        await tx.$executeRawUnsafe(
          `INSERT INTO NguoiDung
             (HoTen, Email, MatKhauHash, AnhDaiDien, VaiTro,
              EmailDaXacThuc, NhaCungCap, MaNhaCungCap, NgayTao)
           VALUES (?, ?, '', ?, 'user', 1, ?, ?, ?)`,
          name,
          email,
          picture,
          provider,
          providerId,
          now,
        );
        const ids = await tx.$queryRawUnsafe<Array<{ id: unknown }>>(
          "SELECT LAST_INSERT_ID() AS id",
        );
        user = (await this.findUserById(
          tx,
          toNumber(ids[0]?.id),
          true,
        ))!;
      } else {
        const combinedProvider = !user.provider
          ? provider
          : user.provider.includes(provider)
            ? user.provider
            : `${user.provider}+${provider}`;
        const avatar = user.avatar || picture;
        await tx.$executeRawUnsafe(
          `UPDATE NguoiDung
           SET NhaCungCap = ?, MaNhaCungCap = ?,
               EmailDaXacThuc = 1, AnhDaiDien = ?
           WHERE Id = ?`,
          combinedProvider,
          providerId,
          avatar,
          toNumber(user.id),
        );
        user.provider = combinedProvider;
        user.providerId = providerId;
        user.emailVerified = true;
        user.avatar = avatar;
      }

      const token = await this.issueTokens(tx, user);
      return {
        user: this.userInfo(user),
        token,
      };
    });
  }

  private async issueTokens(
    tx: SqlClient,
    user: UserRow,
  ) {
    const issued = this.tokens.issueUser({
      id: toNumber(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    });
    const refreshToken = this.tokens.refreshToken();
    const refreshDays = numberEnv(
      "JWT_REFRESH_TOKEN_DAYS",
      7,
      1,
      365,
    );
    const refreshExpiry =
      new Date(Date.now() + refreshDays * 24 * 60 * 60_000);

    await tx.$executeRawUnsafe(
      `UPDATE NguoiDung
       SET RefreshToken = ?, HanRefreshToken = ?, NgayCapNhat = ?
       WHERE Id = ?`,
      refreshToken,
      refreshExpiry,
      new Date(),
      toNumber(user.id),
    );

    return {
      accessToken: issued.accessToken,
      refreshToken,
      expiresAt: issued.expiresAt,
      twoFactorRequired: false,
      user: this.userInfo(user),
    };
  }

  private async findUserByIdentifier(
    client: SqlClient,
    identifierRaw: string,
    forUpdate: boolean,
  ): Promise<UserRow | null> {
    const normalized = identifierRaw.trim().toLowerCase();
    const phone = isPhoneIdentifier(normalized);
    const where = phone ? "SoDienThoai = ?" : "Email = ?";
    const value = phone
      ? identifierRaw.trim()
      : normalized;
    const rows = await client.$queryRawUnsafe<UserRow[]>(
      `${this.userSelect()}
       WHERE ${where}
       LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
      value,
    );
    return rows[0] ?? null;
  }

  private async findUserById(
    client: SqlClient,
    userId: number,
    forUpdate: boolean,
  ): Promise<UserRow | null> {
    const rows = await client.$queryRawUnsafe<UserRow[]>(
      `${this.userSelect()}
       WHERE Id = ?
       LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
      userId,
    );
    return rows[0] ?? null;
  }

  private userInfo(user: UserRow) {
    return {
      id: toNumber(user.id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private userSelect(): string {
    return `SELECT
      Id AS id, HoTen AS name, Email AS email,
      MatKhauHash AS passwordHash, SoDienThoai AS phone,
      AnhDaiDien AS avatar, VaiTro AS role,
      RefreshToken AS refreshToken, HanRefreshToken AS refreshTokenExpiry,
      EmailDaXacThuc AS emailVerified, SDTDaXacThuc AS phoneVerified,
      NhaCungCap AS provider, MaNhaCungCap AS providerId,
      TwoFactorEnabled AS twoFactorEnabled,
      TwoFactorSecret AS twoFactorSecret,
      SoLanDangNhapSai AS failedAttempts,
      BiKhoaDenLuc AS lockedUntil,
      NgayTao AS createdAt, NgayCapNhat AS updatedAt
    FROM NguoiDung`;
  }

  private text(value: unknown): string;
  private text(value: unknown, fallback: string): string;
  private text(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value.trim() : fallback;
  }

  private requireOtp(): boolean {
    return boolEnv("AUTH_REQUIRE_OTP_FOR_REGISTER", false);
  }

  private requireRecaptcha(): boolean {
    return boolEnv("AUTH_REQUIRE_RECAPTCHA", false);
  }

  private emailTemplate(title: string, content: string): string {
    return `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto">
      <h2>KaitoKid Shop — ${this.escapeHtml(title)}</h2>
      ${content}
      <hr />
      <p style="font-size:12px;color:#94a3b8">Email tự động — không trả lời. © 2026 KaitoKid Shop.</p>
    </div>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}
