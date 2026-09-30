import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { OtpService } from "./otp.service.js";
import { RecaptchaService } from "./recaptcha.service.js";
import { UserAuthService } from "./user-auth.service.js";
import type { LoginRequestMeta } from "./user-agent.js";

interface RequestLike {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
}

function requestMeta(req: RequestLike): LoginRequestMeta {
  const ua = req.headers["user-agent"];
  return {
    ip: req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent:
      Array.isArray(ua) ? ua.join(" ") : ua ?? null,
  };
}

@Controller("api/Auth")
export class UserAuthController {
  constructor(
    private readonly auth: UserAuthService,
    private readonly otp: OtpService,
    private readonly recaptcha: RecaptchaService,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.ACCEPTED)
  register(@Body() body: Record<string, unknown>) {
    return this.auth.register(body);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(
    @Body() body: Record<string, unknown>,
    @Req() req: RequestLike,
  ) {
    return this.auth.login(body, requestMeta(req));
  }

  @Post("login-2fa")
  @HttpCode(HttpStatus.OK)
  login2fa(
    @Body() body: Record<string, unknown>,
    @Req() req: RequestLike,
  ) {
    return this.auth.loginTwoFactor(
      body,
      requestMeta(req),
    );
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: Record<string, unknown>) {
    return this.auth.refresh(
      typeof body.refreshToken === "string"
        ? body.refreshToken
        : "",
    );
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    await this.auth.changePassword(user.id, body);
    return { message: "Đổi mật khẩu thành công" };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.profile(user.id);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: Record<string, unknown>,
  ) {
    const recaptchaToken =
      typeof body.recaptchaToken === "string"
        ? body.recaptchaToken
        : "";
    if (
      recaptchaToken &&
      !(await this.recaptcha.verify(
        recaptchaToken,
        "forgot_password",
      ))
    ) {
      throw new BadRequestException({
        message: "Vui lòng thử lại.",
      });
    }

    await this.auth.requestPasswordReset(
      typeof body.email === "string" ? body.email : "",
    );
    return {
      message:
        "Nếu email tồn tại, link đặt lại mật khẩu đã được gửi.",
    };
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: Record<string, unknown>,
  ) {
    await this.auth.resetPassword(
      typeof body.token === "string" ? body.token : "",
      typeof body.newPassword === "string"
        ? body.newPassword
        : "",
    );
    return { message: "Đặt lại mật khẩu thành công." };
  }

  @Post("send-verify-email")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendVerify(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.auth.sendVerifyEmail(user.id);
    return { message: "Đã gửi email xác thực." };
  }

  @Get("verify-email")
  async verifyEmail(@Query("token") token = "") {
    return { message: await this.auth.verifyEmail(token) };
  }

  @Post("otp/request")
  @HttpCode(HttpStatus.OK)
  async requestOtp(
    @Body() body: Record<string, unknown>,
  ) {
    const recaptchaToken =
      typeof body.recaptchaToken === "string"
        ? body.recaptchaToken
        : "";
    if (
      recaptchaToken &&
      !(await this.recaptcha.verify(recaptchaToken, "otp"))
    ) {
      throw new BadRequestException({
        message: "Vui lòng thử lại.",
      });
    }

    const identifier =
      typeof body.identifier === "string"
        ? body.identifier
        : "";
    await this.otp.generateAndSend(
      identifier,
      typeof body.channel === "string"
        ? body.channel
        : "email",
      typeof body.purpose === "string"
        ? body.purpose
        : "register",
    );
    return {
      message: `Đã gửi mã OTP tới ${identifier}.`,
    };
  }

  @Post("otp/verify")
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() body: Record<string, unknown>,
  ) {
    const ok = await this.otp.verify(
      typeof body.identifier === "string"
        ? body.identifier
        : "",
      typeof body.purpose === "string"
        ? body.purpose
        : "register",
      typeof body.code === "string" ? body.code : "",
    );
    if (!ok) {
      throw new BadRequestException({
        message: "Mã OTP không đúng hoặc đã hết hạn.",
      });
    }
    return { message: "Xác thực OTP thành công." };
  }

  @Post("google")
  @HttpCode(HttpStatus.OK)
  google(
    @Body() body: Record<string, unknown>,
    @Req() req: RequestLike,
  ) {
    return this.auth.googleLogin(
      typeof body.idToken === "string"
        ? body.idToken
        : null,
      typeof body.accessToken === "string"
        ? body.accessToken
        : null,
      requestMeta(req),
    );
  }

  @Post("facebook")
  @HttpCode(HttpStatus.OK)
  facebook(
    @Body() body: Record<string, unknown>,
    @Req() req: RequestLike,
  ) {
    return this.auth.facebookLogin(
      typeof body.accessToken === "string"
        ? body.accessToken
        : "",
      requestMeta(req),
    );
  }

  @Post("2fa/setup")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  setup2fa(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.auth.setupTwoFactor(user.id);
  }

  @Post("2fa/enable")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    const ok = await this.auth.enableTwoFactor(
      user.id,
      typeof body.code === "string" ? body.code : "",
    );
    if (!ok) {
      throw new BadRequestException({
        message:
          "Mã không đúng. Vui lòng quét lại QR và thử mã mới.",
      });
    }
    return { message: "Đã bật 2FA." };
  }

  @Post("2fa/disable")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Record<string, unknown>,
  ) {
    const ok = await this.auth.disableTwoFactor(
      user.id,
      typeof body.code === "string" ? body.code : "",
    );
    if (!ok) {
      throw new BadRequestException({
        message: "Mã không đúng.",
      });
    }
    return { message: "Đã tắt 2FA." };
  }

  @Get("activity")
  @UseGuards(JwtAuthGuard)
  activity(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.getActivity(user.id);
  }
}
