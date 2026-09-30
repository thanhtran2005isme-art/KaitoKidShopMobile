import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { ReferralService } from "./referral.service.js";

@Controller("api/referral")
export class ReferralController {
  constructor(private readonly referral: ReferralService) {}

  @Get("my-code")
  @UseGuards(JwtAuthGuard)
  async myCode(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: { protocol: string; get(name: string): string | undefined },
  ) {
    const result = await this.referral.myCode(user.id);
    if (!result) throw new NotFoundException();
    const host = request.get("host") ?? "localhost";
    const origin = `${request.protocol}://${host}`;
    return {
      code: result.code,
      url: `${origin}/login?tab=register&ref=${result.code}`,
    };
  }

  @Post("claim")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async claim(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { code?: unknown },
  ) {
    const result = await this.referral.claim(user.id, body.code);
    if (!result) throw new NotFoundException();
    return result;
  }
}
