import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  Body,
  ForbiddenException,
} from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../../auth/authenticated-user.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { isStaffUser } from "./staff-permissions.js";
import { StaffAuthService } from "./staff-auth.service.js";
import type { LoginRequestMeta } from "./user-agent.js";

interface RequestLike {
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
}

function meta(req: RequestLike): LoginRequestMeta {
  const ua = req.headers["user-agent"];
  return {
    ip: req.ip ?? req.socket?.remoteAddress ?? null,
    userAgent: Array.isArray(ua) ? ua.join(" ") : ua ?? null,
  };
}

@Controller("api/auth/staff")
export class StaffAuthController {
  constructor(private readonly staff: StaffAuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(
    @Body() body: Record<string, unknown>,
    @Req() req: RequestLike,
  ) {
    return this.staff.login(body, meta(req));
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    if (!isStaffUser(user)) throw new ForbiddenException();
    return this.staff.profile(user.id);
  }
}
